import type { SessionEvent } from "@anlg/store";

import type { Ctx } from "../../ctx";
import type { IncomingEvent } from "../../fetch/types";
import type { SessionSyncRow } from "../../storage";
import { calendarEventKey, calendarEventKeys } from "./identity";

export type SessionEventUpdate = {
  sessionId: string;
  trackingId: string;
  calendarId: string;
  seriesId: string;
  eventJson: string;
};

export function syncSessionEmbeddedEvents(
  ctx: Ctx,
  incoming: IncomingEvent[],
  sessions: SessionSyncRow[],
): SessionEventUpdate[] {
  const incomingByTrackingId = new Map(
    incoming.map((event) => [event.tracking_id_event, event]),
  );
  const incomingByCanonicalKey = new Map<string, IncomingEvent>();
  for (const event of incoming) {
    const calendarId = ctx.calendarTrackingIdToId.get(
      event.tracking_id_calendar,
    );
    if (!calendarId) continue;
    incomingByCanonicalKey.set(
      calendarEventKey(ctx.provider, calendarId, event),
      event,
    );
  }

  const incomingByKey = new Map<string, IncomingEvent>();
  for (const event of incomingByCanonicalKey.values()) {
    const calendarId = ctx.calendarTrackingIdToId.get(
      event.tracking_id_calendar,
    );
    if (!calendarId) continue;
    for (const key of calendarEventKeys(ctx.provider, calendarId, event)) {
      incomingByKey.set(key, event);
    }
  }
  const updates: SessionEventUpdate[] = [];

  for (const session of sessions) {
    const hasActiveCalendar = ctx.calendarIds.has(session.calendarId);
    const incomingEvent =
      session.calendarId && hasActiveCalendar
        ? calendarEventKeys(ctx.provider, session.calendarId, {
            tracking_id_event: session.trackingId,
            recurrence_series_id: session.recurrenceSeriesId,
            has_recurrence_rules: session.hasRecurrenceRules,
            started_at: session.startedAt,
          })
            .map((key) => incomingByKey.get(key))
            .find((event) => event !== undefined)
        : incomingByTrackingId.get(session.trackingId);
    if (!incomingEvent) continue;

    const calendarId =
      ctx.calendarTrackingIdToId.get(incomingEvent.tracking_id_calendar) ?? "";
    const event: SessionEvent = {
      tracking_id: incomingEvent.tracking_id_event,
      calendar_id: calendarId,
      title: incomingEvent.title ?? "",
      started_at: incomingEvent.started_at ?? "",
      ended_at: incomingEvent.ended_at ?? "",
      is_all_day: incomingEvent.is_all_day,
      has_recurrence_rules: incomingEvent.has_recurrence_rules,
      location: incomingEvent.location,
      meeting_link: incomingEvent.meeting_link,
      description: incomingEvent.description,
      recurrence_series_id: incomingEvent.recurrence_series_id,
    };

    updates.push({
      sessionId: session.id,
      trackingId: incomingEvent.tracking_id_event,
      calendarId,
      seriesId: incomingEvent.recurrence_series_id ?? "",
      eventJson: JSON.stringify(event),
    });
  }

  return updates;
}
