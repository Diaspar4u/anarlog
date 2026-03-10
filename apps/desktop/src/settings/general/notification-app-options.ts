import type { InstalledApp } from "@hypr/plugin-detect";

function isEffectivelyIgnored({
  bundleId,
  ignoredPlatforms,
  includedPlatforms,
  defaultIgnoredBundleIds,
}: {
  bundleId: string;
  ignoredPlatforms: string[];
  includedPlatforms: string[];
  defaultIgnoredBundleIds: string[] | undefined;
}) {
  const isDefaultIgnored = defaultIgnoredBundleIds?.includes(bundleId) ?? false;
  const isIncluded = includedPlatforms.includes(bundleId);
  const isUserIgnored = ignoredPlatforms.includes(bundleId);

  return isUserIgnored || (isDefaultIgnored && !isIncluded);
}

export function getMicDetectionAppOptions({
  allInstalledApps,
  ignoredPlatforms,
  includedPlatforms,
  inputValue,
  defaultIgnoredBundleIds,
}: {
  allInstalledApps: InstalledApp[] | undefined;
  ignoredPlatforms: string[];
  includedPlatforms: string[];
  inputValue: string;
  defaultIgnoredBundleIds: string[] | undefined;
}) {
  return (allInstalledApps ?? []).filter((app) => {
    const matchesSearch = app.name
      .toLowerCase()
      .includes(inputValue.trim().toLowerCase());
    const isIgnored = isEffectivelyIgnored({
      bundleId: app.id,
      ignoredPlatforms,
      includedPlatforms,
      defaultIgnoredBundleIds,
    });
    return matchesSearch && !isIgnored;
  });
}

export function getEffectiveIgnoredPlatformIds({
  installedApps,
  ignoredPlatforms,
  includedPlatforms,
  defaultIgnoredBundleIds,
}: {
  installedApps: InstalledApp[] | undefined;
  ignoredPlatforms: string[];
  includedPlatforms: string[];
  defaultIgnoredBundleIds: string[] | undefined;
}) {
  const installedAppIds = new Set((installedApps ?? []).map((app) => app.id));
  const bundleIds = new Set(ignoredPlatforms);

  for (const bundleId of defaultIgnoredBundleIds ?? []) {
    if (!installedAppIds.has(bundleId)) {
      continue;
    }

    if (
      isEffectivelyIgnored({
        bundleId,
        ignoredPlatforms,
        includedPlatforms,
        defaultIgnoredBundleIds,
      })
    ) {
      bundleIds.add(bundleId);
    }
  }

  return [...bundleIds];
}

function estimateIgnoredChipWidth({
  label,
  isDefaultIgnored,
}: {
  label: string;
  isDefaultIgnored: boolean;
}) {
  const labelWidth = label.length * 9;
  const defaultWidth = isDefaultIgnored ? 78 : 0;

  return labelWidth + defaultWidth + 44;
}

export function orderIgnoredPlatformIdsForWrap({
  bundleIds,
  availableWidth,
  bundleIdToName,
  isDefaultIgnored,
}: {
  bundleIds: string[];
  availableWidth: number | null;
  bundleIdToName: (bundleId: string) => string;
  isDefaultIgnored: (bundleId: string) => boolean;
}) {
  const items = bundleIds.map((bundleId) => ({
    bundleId,
    label: bundleIdToName(bundleId),
    estimatedWidth: estimateIgnoredChipWidth({
      label: bundleIdToName(bundleId),
      isDefaultIgnored: isDefaultIgnored(bundleId),
    }),
  }));

  if (!availableWidth || availableWidth <= 0) {
    return items
      .sort(
        (left, right) =>
          right.estimatedWidth - left.estimatedWidth ||
          left.label.localeCompare(right.label),
      )
      .map((item) => item.bundleId);
  }

  const rows: { items: typeof items; remainingWidth: number }[] = [];

  for (const item of items.sort(
    (left, right) =>
      right.estimatedWidth - left.estimatedWidth ||
      left.label.localeCompare(right.label),
  )) {
    let bestRow: { items: typeof items; remainingWidth: number } | undefined;

    for (const row of rows) {
      if (row.remainingWidth < item.estimatedWidth) {
        continue;
      }

      if (
        !bestRow ||
        row.remainingWidth - item.estimatedWidth <
          bestRow.remainingWidth - item.estimatedWidth
      ) {
        bestRow = row;
      }
    }

    if (bestRow) {
      bestRow.items.push(item);
      bestRow.remainingWidth -= item.estimatedWidth;
      continue;
    }

    rows.push({
      items: [item],
      remainingWidth: Math.max(0, availableWidth - item.estimatedWidth),
    });
  }

  return rows.flatMap((row) => row.items.map((item) => item.bundleId));
}
