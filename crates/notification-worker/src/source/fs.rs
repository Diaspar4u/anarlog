use std::collections::HashMap;
use std::path::PathBuf;
use std::pin::Pin;

use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;

use super::{EventSource, UpcomingEvent};

pub struct FsEventSource {
    vault_base: PathBuf,
}

impl FsEventSource {
    pub fn new(vault_base: PathBuf) -> Self {
        Self { vault_base }
    }
}

#[derive(Debug, Deserialize)]
struct StoredParticipant {
    name: Option<String>,
    email: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StoredEvent {
    title: String,
    started_at: String,
    ended_at: Option<String>,
    #[serde(default)]
    participants: Vec<StoredParticipant>,
    #[serde(default)]
    meeting_link: String,
}

impl StoredEvent {
    fn has_meeting_link(&self) -> bool {
        !self.meeting_link.trim().is_empty()
    }
}

impl EventSource for FsEventSource {
    fn upcoming_events(
        &self,
        within: Duration,
    ) -> Pin<
        Box<dyn std::future::Future<Output = Result<Vec<UpcomingEvent>, crate::Error>> + Send + '_>,
    > {
        let path = self.vault_base.join("events.json");

        Box::pin(async move {
            let content = match tokio::fs::read_to_string(&path).await {
                Ok(c) => c,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
                Err(e) => return Err(e.into()),
            };

            let stored: HashMap<String, StoredEvent> = serde_json::from_str(&content)?;

            let now = Utc::now();
            let cutoff = now + within;

            let events = stored
                .into_iter()
                .filter_map(|(event_id, event)| {
                    if !event.has_meeting_link() {
                        return None;
                    }

                    let started_at = DateTime::parse_from_rfc3339(&event.started_at)
                        .ok()?
                        .with_timezone(&Utc);

                    if started_at <= now || started_at > cutoff {
                        return None;
                    }

                    let ended_at = event
                        .ended_at
                        .as_deref()
                        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                        .map(|dt| dt.with_timezone(&Utc));

                    let participants = event
                        .participants
                        .into_iter()
                        .filter_map(|p| p.name.or(p.email))
                        .collect();

                    Some(UpcomingEvent {
                        event_id,
                        title: event.title,
                        started_at,
                        ended_at,
                        participants,
                    })
                })
                .collect();

            Ok(events)
        })
    }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration, Utc};
    use serde_json::json;

    use super::{EventSource, FsEventSource, StoredEvent};

    fn stored_event(meeting_link: &str) -> StoredEvent {
        StoredEvent {
            title: "Focus time".to_string(),
            started_at: "2026-05-15T12:02:00Z".to_string(),
            ended_at: None,
            participants: vec![],
            meeting_link: meeting_link.to_string(),
        }
    }

    #[test]
    fn event_without_meeting_link_is_not_joinable() {
        assert!(!stored_event("").has_meeting_link());
    }

    #[test]
    fn event_with_blank_meeting_link_is_not_joinable() {
        assert!(!stored_event(" \t\n").has_meeting_link());
    }

    #[test]
    fn event_with_meeting_link_is_joinable() {
        assert!(stored_event("https://meet.example.com/design-review").has_meeting_link());
    }

    #[test]
    fn missing_meeting_link_defaults_to_empty() {
        let event: StoredEvent = serde_json::from_value(json!({
            "title": "Focus time",
            "started_at": "2026-05-15T12:02:00Z",
            "ended_at": null
        }))
        .unwrap();

        assert_eq!(event.meeting_link, "");
        assert!(!event.has_meeting_link());
    }

    #[tokio::test]
    async fn upcoming_events_only_returns_events_with_nonblank_meeting_links() {
        let temp_dir = tempfile::tempdir().unwrap();
        let started_at = (Utc::now() + Duration::minutes(5)).to_rfc3339();
        let events = json!({
            "missing-link": {
                "title": "No link",
                "started_at": started_at,
                "ended_at": null
            },
            "blank-link": {
                "title": "Blank link",
                "started_at": started_at,
                "ended_at": null,
                "meeting_link": "  "
            },
            "joinable": {
                "title": "Design review",
                "started_at": started_at,
                "ended_at": null,
                "meeting_link": "https://meet.example.com/design-review"
            }
        });
        std::fs::write(
            temp_dir.path().join("events.json"),
            serde_json::to_vec(&events).unwrap(),
        )
        .unwrap();

        let events = FsEventSource::new(temp_dir.path().to_path_buf())
            .upcoming_events(Duration::minutes(10))
            .await
            .unwrap();

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_id, "joinable");
    }
}
