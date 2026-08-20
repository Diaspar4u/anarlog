import { describe, expect, it } from "vitest";

import { upstreamChangelogVersion } from "./version";

describe("upstreamChangelogVersion", () => {
  it("maps ordered downstream prereleases to their upstream core", () => {
    expect(upstreamChangelogVersion("1.4.9-ads.1")).toBe("1.4.9");
    expect(upstreamChangelogVersion("1.4.9-ads.12")).toBe("1.4.9");
  });

  it("maps historical build-metadata versions to their upstream core", () => {
    expect(upstreamChangelogVersion("1.4.9+ads")).toBe("1.4.9");
  });

  it("preserves upstream versions", () => {
    expect(upstreamChangelogVersion("1.4.9")).toBe("1.4.9");
  });
});
