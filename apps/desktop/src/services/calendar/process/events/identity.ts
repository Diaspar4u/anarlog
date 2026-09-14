import type { CalendarProviderType } from "@anlg/plugin-calendar";

type EventIdentity = {
  tracking_id_event: string;
  external_id?: string;
  recurrence_series_id?: string;
  has_recurrence_rules: boolean;
  started_at?: string;
};

export function calendarEventKey(
  provider: CalendarProviderType,
  calendarId: string,
  event: EventIdentity,
): string {
  return `${calendarId}\u0000${stableTrackingId(provider, event)}`;
}

function stableTrackingId(
  provider: CalendarProviderType,
  event: EventIdentity,
): string {
  if (
    provider !== "apple" ||
    (!event.has_recurrence_rules &&
      !event.tracking_id_event.includes("/RID=") &&
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
  }

  const detachedSeriesIndex = event.tracking_id_event.indexOf(":");
  if (event.tracking_id_event.includes("/RID=") && detachedSeriesIndex >= 0) {
    return `${event.tracking_id_event.slice(0, detachedSeriesIndex)}:${occurrence}`;
  }

  return event.tracking_id_event;
}
