import { describe, expect, test } from "vitest";

import type { Ctx } from "../../ctx";
import type { ExistingEvent, IncomingEvent } from "../../fetch/types";
import { syncEvents } from "./sync";
import type { EventsSyncInput } from "./types";

function createMockCtx(
  overrides: Partial<Ctx> & {
    eventToSession?: Map<string, string>;
    nonEmptySessions?: Set<string>;
  } = {},
): Ctx {
  const {
    eventToSession: _eventToSession,
    nonEmptySessions: _sessions,
    ...ctx
  } = overrides;

  return {
    provider: "apple" as const,
    connectionId: "apple",
    from: new Date("2024-01-01"),
    to: new Date("2024-02-01"),
    calendarIds: overrides.calendarIds ?? new Set(["cal-1"]),
    calendarTrackingIdToId:
      overrides.calendarTrackingIdToId ??
      new Map([["tracking-cal-1", "cal-1"]]),
    ...ctx,
  };
}

function createIncomingEvent(
  overrides: Partial<IncomingEvent> = {},
): IncomingEvent {
  return {
    tracking_id_event: "incoming-1",
    tracking_id_calendar: "tracking-cal-1",
    title: "Test Event",
    started_at: "2024-01-15T10:00:00Z",
    ended_at: "2024-01-15T11:00:00Z",
    has_recurrence_rules: false,
    is_all_day: false,
    ...overrides,
  };
}

function createExistingEvent(
  overrides: Partial<ExistingEvent> = {},
): ExistingEvent {
  return {
    id: "event-1",
    tracking_id_event: "existing-1",
    calendar_id: "cal-1",
    created_at: "2024-01-01T00:00:00Z",
    title: "Existing Event",
    started_at: "2024-01-15T10:00:00Z",
    ended_at: "2024-01-15T11:00:00Z",
    location: "",
    meeting_link: "",
    description: "",
    note: "",
    recurrence_series_id: "",
    has_recurrence_rules: false,
    is_all_day: false,
    provider: "apple",
    deleted_at: null,
    ...overrides,
  };
}

function syncInput(overrides: Partial<EventsSyncInput> = {}): EventsSyncInput {
  return {
    incoming: [],
    existing: [],
    incomingParticipants: new Map(),
    ...overrides,
  };
}

describe("syncEvents", () => {
  test("adds new incoming events", () => {
    const ctx = createMockCtx();
    const result = syncEvents(
      ctx,
      syncInput({
        incoming: [createIncomingEvent()],
      }),
    );

    expect(result.toAdd).toHaveLength(1);
    expect(result.toDelete).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(0);
  });

  test("updates existing events with matching tracking id", () => {
    const ctx = createMockCtx();
    const result = syncEvents(
      ctx,
      syncInput({
        incoming: [createIncomingEvent({ tracking_id_event: "existing-1" })],
        existing: [createExistingEvent()],
      }),
    );

    expect(result.toUpdate).toHaveLength(1);
    expect(result.toAdd).toHaveLength(0);
    expect(result.toDelete).toHaveLength(0);
  });

  test("deletes orphaned events without matching incoming", () => {
    const ctx = createMockCtx();
    const result = syncEvents(
      ctx,
      syncInput({
        existing: [createExistingEvent()],
      }),
    );

    expect(result.toDelete).toContain("event-1");
  });

  test("resurrects a tombstoned event instead of allocating a new id", () => {
    const result = syncEvents(
      createMockCtx(),
      syncInput({
        incoming: [createIncomingEvent({ tracking_id_event: "existing-1" })],
        existing: [
          createExistingEvent({
            deleted_at: "2024-01-10T00:00:00Z",
          }),
        ],
      }),
    );

    expect(result.toUpdate.map((event) => event.id)).toEqual(["event-1"]);
    expect(result.toAdd).toEqual([]);
    expect(result.toDelete).toEqual([]);
  });

  test("keeps one durable row when duplicate active events exist", () => {
    const result = syncEvents(
      createMockCtx(),
      syncInput({
        incoming: [createIncomingEvent({ tracking_id_event: "existing-1" })],
        existing: [
          createExistingEvent({ id: "event-1" }),
          createExistingEvent({ id: "event-duplicate" }),
        ],
      }),
    );

    expect(result.toUpdate.map((event) => event.id)).toEqual(["event-1"]);
    expect(result.toDelete).toEqual(["event-duplicate"]);
    expect(result.toAdd).toEqual([]);
  });

  test("keeps one durable row when EventKit replaces a recurring series id", () => {
    const result = syncEvents(
      createMockCtx(),
      syncInput({
        incoming: [
          createIncomingEvent({
            tracking_id_event: "external-1:new-series:2024-01-15",
            external_id: "external-1",
            recurrence_series_id: "new-series",
            has_recurrence_rules: true,
            title: "Updated planning",
          }),
        ],
        existing: [
          createExistingEvent({
            id: "event-with-session",
            tracking_id_event: "external-1:old-series:2024-01-15",
            recurrence_series_id: "old-series",
            has_recurrence_rules: true,
          }),
          createExistingEvent({
            id: "event-duplicate",
            tracking_id_event: "external-1:other-series:2024-01-15",
            recurrence_series_id: "other-series",
            has_recurrence_rules: true,
          }),
        ],
      }),
    );

    expect(result.toUpdate).toHaveLength(1);
    expect(result.toUpdate[0]).toMatchObject({
      id: "event-with-session",
      tracking_id_event: "external-1:new-series:2024-01-15",
      title: "Updated planning",
    });
    expect(result.toDelete).toEqual(["event-duplicate"]);
    expect(result.toAdd).toEqual([]);
  });

  test("migrates a detached EventKit occurrence into its stable identity", () => {
    const result = syncEvents(
      createMockCtx(),
      syncInput({
        incoming: [
          createIncomingEvent({
            tracking_id_event: "external-1:2026-09-14",
            external_id: "external-1",
            provider_tracking_id: "external-1:new-series/RID=811141200",
            occurrence_at: "2026-09-15T05:00:00Z",
            has_recurrence_rules: false,
            started_at: "2026-09-16T05:00:00Z",
          }),
        ],
        existing: [
          createExistingEvent({
            id: "detached-event",
            tracking_id_event: "external-1:series-b/RID=811141200",
            recurrence_series_id: "",
            has_recurrence_rules: false,
            started_at: "2026-09-16T05:00:00Z",
          }),
        ],
      }),
    );

    expect(result.toUpdate).toHaveLength(1);
    expect(result.toUpdate[0]).toMatchObject({
      id: "detached-event",
      tracking_id_event: "external-1:2026-09-14",
    });
    expect(result.toDelete).toEqual([]);
    expect(result.toAdd).toEqual([]);
  });

  test("migrates a pre-SQLite recurring id ending in the series id", () => {
    const result = syncEvents(
      createMockCtx(),
      syncInput({
        incoming: [
          createIncomingEvent({
            tracking_id_event: "external-1:2024-01-15",
            external_id: "external-1",
            recurrence_series_id: "new-series",
            has_recurrence_rules: true,
          }),
        ],
        existing: [
          createExistingEvent({
            id: "legacy-event",
            tracking_id_event: "external-1:old-series",
            recurrence_series_id: "old-series",
            has_recurrence_rules: true,
          }),
        ],
      }),
    );

    expect(result.toUpdate.map((event) => event.id)).toEqual(["legacy-event"]);
    expect(result.toAdd).toEqual([]);
  });

  test("keeps distinct occurrences from one recurring event", () => {
    const result = syncEvents(
      createMockCtx(),
      syncInput({
        incoming: [
          createIncomingEvent({
            tracking_id_event: "external-1:series-a:2024-01-15",
            external_id: "external-1",
            recurrence_series_id: "series-a",
            has_recurrence_rules: true,
          }),
          createIncomingEvent({
            tracking_id_event: "external-1:series-b:2024-01-22",
            external_id: "external-1",
            recurrence_series_id: "series-b",
            has_recurrence_rules: true,
          }),
        ],
      }),
    );

    expect(result.toAdd.map((event) => event.tracking_id_event)).toEqual([
      "external-1:series-a:2024-01-15",
      "external-1:series-b:2024-01-22",
    ]);
  });

  test("adds only one row for replacement series of the same occurrence", () => {
    const result = syncEvents(
      createMockCtx(),
      syncInput({
        incoming: [
          createIncomingEvent({
            tracking_id_event: "external-1:old-series:2024-01-15",
            external_id: "external-1",
            recurrence_series_id: "old-series",
            has_recurrence_rules: true,
          }),
          createIncomingEvent({
            tracking_id_event: "external-1:new-series:2024-01-15",
            external_id: "external-1",
            recurrence_series_id: "new-series",
            has_recurrence_rules: true,
          }),
        ],
      }),
    );

    expect(result.toAdd.map((event) => event.tracking_id_event)).toEqual([
      "external-1:new-series:2024-01-15",
    ]);
  });

  describe("removed calendar cleanup", () => {
    test("deletes events when calendar removed from Apple Calendar (no incoming events)", () => {
      const ctx = createMockCtx({
        calendarIds: new Set(["cal-1"]),
        calendarTrackingIdToId: new Map([["tracking-cal-1", "cal-1"]]),
      });

      const result = syncEvents(
        ctx,
        syncInput({
          existing: [
            createExistingEvent({
              id: "event-1",
              tracking_id_event: "track-1",
            }),
            createExistingEvent({
              id: "event-2",
              tracking_id_event: "track-2",
            }),
          ],
        }),
      );

      expect(result.toDelete).toContain("event-1");
      expect(result.toDelete).toContain("event-2");
      expect(result.toDelete).toHaveLength(2);
    });

    test("deletes events regardless of non-empty sessions when calendar removed", () => {
      const ctx = createMockCtx({
        calendarIds: new Set(["cal-1"]),
        eventToSession: new Map([["event-1", "session-1"]]),
        nonEmptySessions: new Set(["session-1"]),
      });

      const result = syncEvents(
        ctx,
        syncInput({
          existing: [
            createExistingEvent({
              id: "event-1",
              tracking_id_event: "track-1",
            }),
            createExistingEvent({
              id: "event-2",
              tracking_id_event: "track-2",
            }),
          ],
        }),
      );

      expect(result.toDelete).toContain("event-1");
      expect(result.toDelete).toContain("event-2");
    });

    test("deletes events with empty sessions when calendar removed", () => {
      const ctx = createMockCtx({
        calendarIds: new Set(["cal-1"]),
        eventToSession: new Map([["event-1", "session-1"]]),
        nonEmptySessions: new Set(),
      });

      const result = syncEvents(
        ctx,
        syncInput({
          existing: [createExistingEvent({ id: "event-1" })],
        }),
      );

      expect(result.toDelete).toContain("event-1");
    });

    test("only deletes events from removed calendar, keeps events from active calendars", () => {
      const ctx = createMockCtx({
        calendarIds: new Set(["cal-1", "cal-2"]),
        calendarTrackingIdToId: new Map([
          ["tracking-cal-1", "cal-1"],
          ["tracking-cal-2", "cal-2"],
        ]),
      });

      const result = syncEvents(
        ctx,
        syncInput({
          incoming: [
            createIncomingEvent({
              tracking_id_event: "track-2",
              tracking_id_calendar: "tracking-cal-2",
            }),
          ],
          existing: [
            createExistingEvent({
              id: "event-1",
              calendar_id: "cal-1",
              tracking_id_event: "track-1",
            }),
            createExistingEvent({
              id: "event-2",
              calendar_id: "cal-2",
              tracking_id_event: "track-2",
            }),
          ],
        }),
      );

      expect(result.toDelete).toContain("event-1");
      expect(result.toDelete).not.toContain("event-2");
      expect(result.toUpdate).toHaveLength(1);
    });
  });

  describe("participants", () => {
    test("attaches participants to added events", () => {
      const ctx = createMockCtx();
      const participants = [
        { email: "alice@example.com", name: "Alice", is_organizer: true },
        { email: "bob@example.com", name: "Bob" },
      ];
      const result = syncEvents(
        ctx,
        syncInput({
          incoming: [createIncomingEvent()],
          incomingParticipants: new Map([["incoming-1", participants]]),
        }),
      );

      expect(result.toAdd).toHaveLength(1);
      expect(result.toAdd[0].participants).toEqual(participants);
    });

    test("attaches participants to updated events", () => {
      const ctx = createMockCtx();
      const participants = [{ email: "alice@example.com", name: "Alice" }];
      const result = syncEvents(
        ctx,
        syncInput({
          incoming: [createIncomingEvent({ tracking_id_event: "existing-1" })],
          existing: [createExistingEvent()],
          incomingParticipants: new Map([["existing-1", participants]]),
        }),
      );

      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0].participants).toEqual(participants);
    });

    test("defaults to empty participants when no match in incomingParticipants", () => {
      const ctx = createMockCtx();
      const result = syncEvents(
        ctx,
        syncInput({
          incoming: [createIncomingEvent()],
          incomingParticipants: new Map(),
        }),
      );

      expect(result.toAdd).toHaveLength(1);
      expect(result.toAdd[0].participants).toEqual([]);
    });

    test("matches participants by tracking_id_event for recurring events", () => {
      const ctx = createMockCtx();
      const participants = [{ email: "alice@example.com", name: "Alice" }];
      const result = syncEvents(
        ctx,
        syncInput({
          incoming: [
            createIncomingEvent({
              tracking_id_event: "recurring-1",
              has_recurrence_rules: true,
              started_at: "2024-01-15T10:00:00Z",
            }),
          ],
          incomingParticipants: new Map([["recurring-1", participants]]),
        }),
      );

      expect(result.toAdd).toHaveLength(1);
      expect(result.toAdd[0].participants).toEqual(participants);
    });
  });
});
