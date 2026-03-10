import { describe, expect, test } from "vitest";

import {
  getEffectiveIgnoredPlatformIds,
  getMicDetectionAppOptions,
} from "./notification-app-options";

describe("getMicDetectionAppOptions", () => {
  test("shows default ignored apps as includable matches", () => {
    const options = getMicDetectionAppOptions({
      allInstalledApps: [{ id: "com.microsoft.VSCode", name: "VS Code" }],
      ignoredPlatforms: [],
      includedPlatforms: [],
      inputValue: "code",
      defaultIgnoredBundleIds: ["com.microsoft.VSCode"],
    });

    expect(options).toEqual([
      {
        id: "com.microsoft.VSCode",
        name: "VS Code",
        action: "include",
        isDefaultIgnored: true,
      },
    ]);
  });

  test("shows explicitly included default apps as excludable again", () => {
    const options = getMicDetectionAppOptions({
      allInstalledApps: [{ id: "com.microsoft.VSCode", name: "VS Code" }],
      ignoredPlatforms: [],
      includedPlatforms: ["com.microsoft.VSCode"],
      inputValue: "code",
      defaultIgnoredBundleIds: ["com.microsoft.VSCode"],
    });

    expect(options).toEqual([
      {
        id: "com.microsoft.VSCode",
        name: "VS Code",
        action: "exclude",
        isDefaultIgnored: true,
      },
    ]);
  });
});

describe("getEffectiveIgnoredPlatformIds", () => {
  test("includes installed default ignored apps unless explicitly included", () => {
    expect(
      getEffectiveIgnoredPlatformIds({
        installedApps: [
          { id: "com.microsoft.VSCode", name: "VS Code" },
          { id: "us.zoom.xos", name: "Zoom Workplace" },
        ],
        ignoredPlatforms: [],
        includedPlatforms: [],
        defaultIgnoredBundleIds: ["com.microsoft.VSCode"],
      }),
    ).toEqual(["com.microsoft.VSCode"]);

    expect(
      getEffectiveIgnoredPlatformIds({
        installedApps: [{ id: "com.microsoft.VSCode", name: "VS Code" }],
        ignoredPlatforms: [],
        includedPlatforms: ["com.microsoft.VSCode"],
        defaultIgnoredBundleIds: ["com.microsoft.VSCode"],
      }),
    ).toEqual([]);
  });
});
