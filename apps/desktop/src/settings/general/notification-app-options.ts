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
  return (allInstalledApps ?? [])
    .filter((app) =>
      app.name.toLowerCase().includes(inputValue.trim().toLowerCase()),
    )
    .map((app) => {
      const isDefaultIgnored =
        defaultIgnoredBundleIds?.includes(app.id) ?? false;
      const isIgnored = isEffectivelyIgnored({
        bundleId: app.id,
        ignoredPlatforms,
        includedPlatforms,
        defaultIgnoredBundleIds,
      });

      return {
        ...app,
        action: isIgnored ? "include" : "exclude",
        isDefaultIgnored,
      };
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
