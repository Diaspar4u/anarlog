use std::path::{Path, PathBuf};

use crate::global::compute_vault_config_path;

pub const VAULT_PATH_KEY: &str = "vault_path";
pub const SETTINGS_FILENAME: &str = "settings.json";

pub fn compute_settings_path(base: &Path) -> PathBuf {
    base.join(SETTINGS_FILENAME)
}

fn expand_path(path: &str, default_base: Option<&Path>) -> PathBuf {
    let home_dir = || dirs::home_dir().map(|p| p.to_string_lossy().into_owned());
    let context = |var: &str| -> Option<String> {
        if var == "DEFAULT" {
            return default_base.map(|p| p.to_string_lossy().into_owned());
        }
        std::env::var(var).ok()
    };
    let expanded = shellexpand::full_with_context_no_errors(path, home_dir, context);
    PathBuf::from(expanded.into_owned())
}

pub fn resolve_base(global_base: &Path, default_base: &Path) -> PathBuf {
    recorded_vault_path(global_base, default_base)
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| default_base.to_path_buf())
}

/// Reads the configured artifact location without relocating its contents.
/// The fork retains this override for recordings and legacy settings.
pub fn recorded_vault_path(global_base: &Path, default_base: &Path) -> Option<PathBuf> {
    let config = load_config(global_base)?;
    config
        .get(VAULT_PATH_KEY)
        .and_then(|v| v.as_str())
        .map(|path| expand_path(path, Some(default_base)))
}

/// Moves the notes and recordings of a custom storage location into
/// `default_base` and clears the override that pointed at it. Returns the
/// folder that was consolidated, if there was one.
///
/// The copy finishes before the override is cleared, so an interrupted or
/// failed launch leaves the recorded path in place and retries next time.
/// Only artifacts the app owns are removed from the old folder afterwards.
pub fn consolidate_custom_vault(
    global_base: &Path,
    default_base: &Path,
) -> Result<Option<PathBuf>, crate::Error> {
    let Some(mut config) = load_config(global_base) else {
        return Ok(None);
    };
    let Some(custom_path) = config
        .get(VAULT_PATH_KEY)
        .and_then(|v| v.as_str())
        .map(|path| expand_path(path, Some(default_base)))
    else {
        return Ok(None);
    };

    let has_separate_data = custom_path.is_dir() && !is_same_dir(&custom_path, default_base);
    if has_separate_data {
        std::fs::create_dir_all(default_base)?;
        super::fs::copy_vault_items(&custom_path, default_base)?;
        super::fs::remove_derived_items(default_base)?;
    }

    if let Some(obj) = config.as_object_mut() {
        obj.remove(VAULT_PATH_KEY);
    }
    crate::fs::atomic_write(
        &compute_vault_config_path(global_base),
        &serde_json::to_string_pretty(&config)?,
    )?;

    if has_separate_data {
        // Best-effort: the data is already safe at the default base.
        let _ = super::fs::remove_owned_items(&custom_path);
    }

    Ok(Some(custom_path))
}

fn is_same_dir(a: &Path, b: &Path) -> bool {
    a == b
        || matches!(
            (a.canonicalize(), b.canonicalize()),
            (Ok(a), Ok(b)) if a == b
        )
}

fn load_config(global_base: &Path) -> Option<serde_json::Value> {
    let content = std::fs::read_to_string(compute_vault_config_path(global_base)).ok()?;
    serde_json::from_str::<serde_json::Value>(&content).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn resolves_default_without_override() {
        let dir = tempfile::tempdir().unwrap();
        let global = dir.path().join("global");
        let default = dir.path().join("default");
        assert_eq!(resolve_base(&global, &default), default);
        assert!(!global.exists());
    }

    #[test]
    fn configured_base_preserves_config_and_existing_audio() {
        let dir = tempfile::tempdir().unwrap();
        let global = dir.path().join("global");
        let vault = dir.path().join("vault");
        fs::create_dir_all(&global).unwrap();
        fs::create_dir_all(vault.join("sessions").join("session-1")).unwrap();
        let config = serde_json::json!({VAULT_PATH_KEY: vault}).to_string();
        fs::write(compute_vault_config_path(&global), &config).unwrap();
        let audio = vault.join("sessions").join("session-1").join("audio.mp3");
        fs::write(&audio, b"existing recording").unwrap();

        assert_eq!(resolve_base(&global, &global), vault);
        assert_eq!(
            fs::read_to_string(compute_vault_config_path(&global)).unwrap(),
            config
        );
        assert_eq!(fs::read(audio).unwrap(), b"existing recording");
        assert!(!global.join("sessions").exists());
    }

    #[test]
    fn empty_override_uses_default() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(
            compute_vault_config_path(dir.path()),
            r#"{"vault_path":""}"#,
        )
        .unwrap();
        assert_eq!(resolve_base(dir.path(), dir.path()), dir.path());
    }

    mod consolidate_custom_vault_tests {
        use super::*;

        fn write_config(global_base: &Path, config: serde_json::Value) {
            fs::write(compute_vault_config_path(global_base), config.to_string()).unwrap();
        }

        fn read_config(global_base: &Path) -> serde_json::Value {
            let content = fs::read_to_string(compute_vault_config_path(global_base)).unwrap();
            serde_json::from_str(&content).unwrap()
        }

        fn seed_vault(vault: &Path) {
            fs::create_dir_all(vault.join("sessions").join("s1")).unwrap();
            fs::write(
                vault.join("sessions").join("s1").join("audio.wav"),
                "custom",
            )
            .unwrap();
            fs::create_dir_all(vault.join("search_index")).unwrap();
            fs::write(vault.join("search_index").join("meta.json"), "{}").unwrap();
            fs::write(vault.join("settings.json"), r#"{"theme":"dark"}"#).unwrap();
            fs::write(vault.join("AGENTS.md"), "# Anarlog Desktop\n").unwrap();
            fs::create_dir_all(vault.join(".obsidian")).unwrap();
            fs::write(vault.join("Daily note.md"), "note").unwrap();
        }

        #[test]
        fn does_nothing_without_an_override() {
            let temp = tempdir().unwrap();
            let global_base = temp.path().to_path_buf();
            let default_base = temp.path().join("default");
            fs::create_dir_all(&default_base).unwrap();
            write_config(&global_base, serde_json::json!({"theme": "dark"}));

            assert_eq!(
                consolidate_custom_vault(&global_base, &default_base).unwrap(),
                None
            );
            assert_eq!(
                read_config(&global_base),
                serde_json::json!({"theme": "dark"})
            );
        }

        #[test]
        fn moves_owned_items_into_the_default_base_and_clears_the_override() {
            let temp = tempdir().unwrap();
            let global_base = temp.path().join("global");
            let default_base = global_base.clone();
            let vault = temp.path().join("obsidian-vault");
            fs::create_dir_all(&default_base).unwrap();
            seed_vault(&vault);
            fs::create_dir_all(default_base.join("sessions").join("s0")).unwrap();
            fs::write(
                default_base.join("sessions").join("s0").join("audio.wav"),
                "older",
            )
            .unwrap();
            fs::create_dir_all(default_base.join("search_index")).unwrap();
            fs::write(default_base.join("search_index").join("meta.json"), "stale").unwrap();
            write_config(
                &global_base,
                serde_json::json!({
                    "theme": "dark",
                    VAULT_PATH_KEY: vault.to_string_lossy(),
                }),
            );

            let result = consolidate_custom_vault(&global_base, &default_base).unwrap();

            assert_eq!(result, Some(vault.clone()));
            assert_eq!(
                fs::read_to_string(default_base.join("sessions").join("s1").join("audio.wav"))
                    .unwrap(),
                "custom"
            );
            assert!(
                default_base
                    .join("sessions")
                    .join("s0")
                    .join("audio.wav")
                    .exists()
            );
            assert_eq!(
                fs::read_to_string(default_base.join("settings.json")).unwrap(),
                r#"{"theme":"dark"}"#
            );
            assert!(
                !default_base.join("search_index").exists(),
                "a stale index must not survive; the app rebuilds it from the database"
            );
            assert_eq!(
                read_config(&global_base),
                serde_json::json!({"theme": "dark"})
            );

            assert!(!vault.join("sessions").exists());
            assert!(!vault.join("search_index").exists());
            assert!(!vault.join("settings.json").exists());
            assert!(!vault.join("AGENTS.md").exists());
            assert!(vault.join(".obsidian").exists());
            assert!(vault.join("Daily note.md").exists());
        }

        #[test]
        fn clears_an_override_that_points_at_the_default_base() {
            let temp = tempdir().unwrap();
            let global_base = temp.path().join("global");
            fs::create_dir_all(&global_base).unwrap();
            seed_vault(&global_base);
            write_config(
                &global_base,
                serde_json::json!({ VAULT_PATH_KEY: global_base.to_string_lossy() }),
            );

            let result = consolidate_custom_vault(&global_base, &global_base).unwrap();

            assert_eq!(result, Some(global_base.clone()));
            assert!(read_config(&global_base).get(VAULT_PATH_KEY).is_none());
            assert!(global_base.join("sessions").join("s1").exists());
            assert!(global_base.join("search_index").exists());
        }

        #[test]
        fn clears_an_override_whose_folder_is_gone() {
            let temp = tempdir().unwrap();
            let global_base = temp.path().join("global");
            fs::create_dir_all(&global_base).unwrap();
            let missing = temp.path().join("missing");
            write_config(
                &global_base,
                serde_json::json!({ VAULT_PATH_KEY: missing.to_string_lossy() }),
            );

            let result = consolidate_custom_vault(&global_base, &global_base).unwrap();

            assert_eq!(result, Some(missing));
            assert!(read_config(&global_base).get(VAULT_PATH_KEY).is_none());
        }

        #[test]
        fn recorded_path_is_a_source_until_consolidation_clears_it() {
            let temp = tempdir().unwrap();
            let global_base = temp.path().join("global");
            let vault = temp.path().join("vault");
            fs::create_dir_all(&global_base).unwrap();
            seed_vault(&vault);
            write_config(
                &global_base,
                serde_json::json!({ VAULT_PATH_KEY: vault.to_string_lossy() }),
            );

            assert_eq!(
                recorded_vault_path(&global_base, &global_base),
                Some(vault.clone())
            );

            consolidate_custom_vault(&global_base, &global_base).unwrap();

            assert_eq!(recorded_vault_path(&global_base, &global_base), None);
        }

        #[test]
        fn keeps_the_override_when_the_copy_fails() {
            let temp = tempdir().unwrap();
            let global_base = temp.path().join("global");
            let vault = temp.path().join("vault");
            fs::create_dir_all(&global_base).unwrap();
            seed_vault(&vault);
            // A file where the sessions directory must go makes the copy fail.
            fs::write(global_base.join("sessions"), "not a directory").unwrap();
            write_config(
                &global_base,
                serde_json::json!({ VAULT_PATH_KEY: vault.to_string_lossy() }),
            );

            assert!(consolidate_custom_vault(&global_base, &global_base).is_err());

            assert_eq!(
                read_config(&global_base)
                    .get(VAULT_PATH_KEY)
                    .and_then(|v| v.as_str()),
                Some(vault.to_string_lossy().as_ref())
            );
            assert!(vault.join("sessions").join("s1").join("audio.wav").exists());
            assert!(vault.join("settings.json").exists());
        }
    }
}
