use std::{collections::HashMap, path::Path};

use crate::MarkdownExportPolicy;

pub(crate) async fn load(
    pool: &sqlx::SqlitePool,
    configured_vault: Option<&Path>,
) -> Result<MarkdownExportPolicy, String> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, value_json FROM (\
         SELECT id, value_json, 0 AS source_rank FROM app_settings \
         UNION ALL SELECT id, value_json, 1 AS source_rank FROM synced_preferences) \
         WHERE id IN ('automation_markdown_export_enabled', \
                      'automation_markdown_export_directory', \
                      'legacy_settings_document', 'legacy_main_values_document') \
         ORDER BY id, source_rank",
    )
    .fetch_all(pool)
    .await
    .map_err(|error| format!("could not load Markdown export settings: {error}"))?;
    let mut values = HashMap::new();
    for (id, json) in rows {
        let value = serde_json::from_str::<serde_json::Value>(&json)
            .map_err(|error| format!("invalid Markdown export setting '{id}': {error}"))?;
        values.insert(id, value);
    }
    Ok(resolve(&values, configured_vault))
}

fn setting<'a>(
    values: &'a HashMap<String, serde_json::Value>,
    key: &str,
    field: &str,
    valid: fn(&serde_json::Value) -> bool,
) -> Option<&'a serde_json::Value> {
    values
        .get(key)
        .filter(|value| valid(value))
        .or_else(|| {
            values
                .get("legacy_settings_document")?
                .get("automations")?
                .get(field)
                .filter(|value| valid(value))
        })
        .or_else(|| {
            values
                .get("legacy_main_values_document")?
                .get(key)
                .filter(|value| valid(value))
        })
}

fn resolve(
    values: &HashMap<String, serde_json::Value>,
    configured_vault: Option<&Path>,
) -> MarkdownExportPolicy {
    let enabled = setting(
        values,
        "automation_markdown_export_enabled",
        "markdown_export_enabled",
        serde_json::Value::is_boolean,
    )
    .and_then(serde_json::Value::as_bool)
    .unwrap_or(true);
    let directory = setting(
        values,
        "automation_markdown_export_directory",
        "markdown_export_directory",
        serde_json::Value::is_string,
    )
    .and_then(serde_json::Value::as_str)
    .map(str::trim)
    .filter(|path| !path.is_empty())
    .map(str::to_string)
    .or_else(|| {
        configured_vault
            .filter(|path| !path.as_os_str().is_empty())
            .map(|path| path.join("sessions").to_string_lossy().into_owned())
    });
    MarkdownExportPolicy { enabled, directory }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn default_on_requires_a_recipient_owned_destination_and_respects_off() {
        let mut settings = HashMap::new();
        assert_eq!(
            resolve(&settings, None),
            MarkdownExportPolicy {
                enabled: true,
                directory: None
            }
        );
        assert_eq!(
            resolve(&settings, Some(Path::new("/recipient/vault")))
                .directory
                .as_deref(),
            Some("/recipient/vault/sessions")
        );
        settings.insert(
            "automation_markdown_export_directory".into(),
            json!("/chosen/export"),
        );
        assert_eq!(
            resolve(&settings, Some(Path::new("/recipient/vault")))
                .directory
                .as_deref(),
            Some("/chosen/export")
        );
        settings.insert("automation_markdown_export_enabled".into(), json!(false));
        assert!(!resolve(&settings, Some(Path::new("/recipient/vault"))).enabled);
    }

    #[test]
    fn saved_legacy_off_is_not_reinterpreted_as_an_absent_default() {
        let settings = HashMap::from([(
            "legacy_settings_document".into(),
            json!({"automations": {"markdown_export_enabled": false, "markdown_export_directory": "/legacy/export"}}),
        )]);
        let policy = resolve(&settings, Some(Path::new("/recipient/vault")));
        assert!(!policy.enabled);
        assert_eq!(policy.directory.as_deref(), Some("/legacy/export"));
    }
}
