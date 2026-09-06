import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const feedPath = resolve(process.cwd(), "../../latest.json");

describe("maintained updater feed continuity", () => {
  it("keeps valid published metadata in every promotable source tree", () => {
    expect(existsSync(feedPath)).toBe(true);

    const feed = JSON.parse(readFileSync(feedPath, "utf8")) as {
      version?: string;
      platforms?: Record<string, { signature?: string; url?: string }>;
    };
    const darwin = feed.platforms?.["darwin-aarch64"];

    expect(feed.version).toMatch(/^\d+\.\d+\.\d+-ads\.\d+$/);
    expect(darwin?.signature).toBeTruthy();
    expect(darwin?.url).toMatch(
      /^https:\/\/github\.com\/Diaspar4u\/anarlog\/releases\/download\//,
    );
  });
});
