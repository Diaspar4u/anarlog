import type { CalendarProviderType } from "@anlg/plugin-calendar";

type EventIdentity = {
  tracking_id_event: string;
  external_id?: string;
  provider_tracking_id?: string;
  occurrence_at?: string;
  recurrence_series_id?: string;
  has_recurrence_rules: boolean;
  started_at?: string;
};

const APPLE_REFERENCE_DATE_MS = Date.UTC(2001, 0, 1);

export function calendarEventKey(
  provider: CalendarProviderType,
  calendarId: string,
  event: EventIdentity,
): string {
  return `${calendarId}\u0000${stableTrackingId(provider, event)}`;
}

export function calendarEventKeys(
  provider: CalendarProviderType,
  calendarId: string,
  event: EventIdentity,
): string[] {
  const keys = [calendarEventKey(provider, calendarId, event)];
  if (provider !== "apple") return keys;

  const externalId = appleExternalId(event);
  const occurrenceInstant = appleOccurrenceInstant(event);
  if (externalId && occurrenceInstant) {
    keys.push(`${calendarId}\u0000${externalId}\u0000${occurrenceInstant}`);
  }

  const providerTrackingId = event.provider_tracking_id?.trim();
  if (providerTrackingId) {
    keys.push(`${calendarId}\u0000${providerTrackingId}`);
  }

  return Array.from(new Set(keys));
}

function stableTrackingId(
  provider: CalendarProviderType,
  event: EventIdentity,
): string {
  if (
    provider !== "apple" ||
    event.tracking_id_event.includes("/RID=") ||
    (!event.has_recurrence_rules &&
      !/:\d{4}-\d{2}-\d{2}$/.test(event.tracking_id_event))
  ) {
    return event.tracking_id_event;
  }

  const occurrence =
    event.tracking_id_event.match(/:(\d{4}-\d{2}-\d{2})$/)?.[1] ??
    event.started_at?.slice(0, 10);
  if (!occurrence) return event.tracking_id_event;

  const externalId = event.external_id?.trim();
  if (externalId) return `${externalId}:${occurrence}`;

  if (event.recurrence_series_id) {
    const seriesMarker = `:${event.recurrence_series_id}:`;
    const seriesIndex = event.tracking_id_event.lastIndexOf(seriesMarker);
    if (seriesIndex >= 0) {
      return `${event.tracking_id_event.slice(0, seriesIndex)}:${occurrence}`;
    }

    const seriesAtEnd = `:${event.recurrence_series_id}`;
    if (event.tracking_id_event.endsWith(seriesAtEnd)) {
      return `${event.tracking_id_event.slice(0, -seriesAtEnd.length)}:${occurrence}`;
    }
  }

  return event.tracking_id_event;
}

function appleExternalId(event: EventIdentity): string | undefined {
  const externalId = event.external_id?.trim();
  if (externalId) return externalId;

  const detachedSeriesIndex = event.tracking_id_event.indexOf(":");
  if (event.tracking_id_event.includes("/RID=") && detachedSeriesIndex >= 0) {
    return event.tracking_id_event.slice(0, detachedSeriesIndex);
  }

  if (event.recurrence_series_id) {
    const seriesMarker = `:${event.recurrence_series_id}:`;
    const seriesIndex = event.tracking_id_event.lastIndexOf(seriesMarker);
    if (seriesIndex >= 0) return event.tracking_id_event.slice(0, seriesIndex);

    const seriesAtEnd = `:${event.recurrence_series_id}`;
    if (event.tracking_id_event.endsWith(seriesAtEnd)) {
      return event.tracking_id_event.slice(0, -seriesAtEnd.length);
    }
  }

  const occurrenceSeparator = event.tracking_id_event.lastIndexOf(":");
  if (
    occurrenceSeparator >= 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      event.tracking_id_event.slice(occurrenceSeparator + 1),
    )
  ) {
    return event.tracking_id_event.slice(0, occurrenceSeparator);
  }

  return undefined;
}

function appleOccurrenceInstant(event: EventIdentity): string | undefined {
  if (event.occurrence_at) {
    const occurrenceMs = Date.parse(event.occurrence_at);
    if (Number.isFinite(occurrenceMs)) return String(occurrenceMs);
  }

  const rid = event.tracking_id_event.match(/\/RID=(-?\d+(?:\.\d+)?)$/)?.[1];
  if (!rid) return undefined;

  const seconds = Number(rid);
  if (!Number.isFinite(seconds)) return undefined;

  return String(APPLE_REFERENCE_DATE_MS + seconds * 1_000);
}
