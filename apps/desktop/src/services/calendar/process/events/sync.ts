import type { Ctx } from "../../ctx";
import { calendarEventKey, calendarEventKeys } from "./identity";
import type { EventsSyncInput, EventsSyncOutput } from "./types";

export function syncEvents(
  ctx: Ctx,
  { incoming, existing, incomingParticipants }: EventsSyncInput,
): EventsSyncOutput {
  const out: EventsSyncOutput = {
    toDelete: [],
    toUpdate: [],
    toAdd: [],
  };

  const incomingByCanonicalKey = new Map<string, (typeof incoming)[number]>();
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

  const incomingByKey = new Map<string, (typeof incoming)[number]>();
  for (const event of incomingByCanonicalKey.values()) {
    const calendarId = ctx.calendarTrackingIdToId.get(
      event.tracking_id_calendar,
    );
    if (!calendarId) continue;
    for (const key of calendarEventKeys(ctx.provider, calendarId, event)) {
      incomingByKey.set(key, event);
    }
  }
  const handledKeys = new Set<string>();

  for (const storeEvent of existing) {
    const matchingIncomingEvent = calendarEventKeys(
      ctx.provider,
      storeEvent.calendar_id,
      storeEvent,
    )
      .map((key) => incomingByKey.get(key))
      .find((event) => event !== undefined);
    const key = matchingIncomingEvent
      ? calendarEventKey(
          ctx.provider,
          storeEvent.calendar_id,
          matchingIncomingEvent,
        )
      : calendarEventKey(ctx.provider, storeEvent.calendar_id, storeEvent);

    if (matchingIncomingEvent && !handledKeys.has(key)) {
      out.toUpdate.push({
        ...storeEvent,
        ...matchingIncomingEvent,
        id: storeEvent.id,
        created_at: storeEvent.created_at,
        calendar_id: storeEvent.calendar_id,
        has_recurrence_rules: matchingIncomingEvent.has_recurrence_rules,
        participants:
          incomingParticipants.get(matchingIncomingEvent.tracking_id_event) ??
          [],
      });
      handledKeys.add(key);
      continue;
    }

    if (!storeEvent.deleted_at) {
      out.toDelete.push(storeEvent.id);
    }
  }

  const scheduledKeys = new Set(handledKeys);
  for (const [key, incomingEvent] of incomingByCanonicalKey) {
    if (!scheduledKeys.has(key)) {
      out.toAdd.push({
        ...incomingEvent,
        participants:
          incomingParticipants.get(incomingEvent.tracking_id_event) ?? [],
      });
      scheduledKeys.add(key);
    }
  }

  return out;
}
