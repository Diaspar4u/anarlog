import { describe, expect, it } from "vitest";

import { getForkChangelog } from "./fork";

const EXCLUDED_FEATURES = [
  "automations",
  "Slack",
  "Notion",
  "Linear",
  "sharing",
  "Claude",
  "ChatGPT",
  "Mistral",
  "Linux",
  "cloud",
  "account",
  "sync",
];

describe("getForkChangelog", () => {
  it("returns curated notes for the maintained fork release", () => {
    const content = getForkChangelog("1.4.19-ads.1");

    expect(content).toContain("brief transcription or network drops");
    expect(content).toContain("Capture macOS system audio");
    expect(content).toContain("nested folders");
    expect(content).toContain("Edit existing dictionary entries");
  });

  it.each(EXCLUDED_FEATURES)(
    "omits removed or unused feature: %s",
    (feature) => {
      expect(getForkChangelog("1.4.19-ads.1")).not.toMatch(
        new RegExp(feature, "i"),
      );
    },
  );

  it("does not invent notes for unknown fork versions", () => {
    expect(getForkChangelog("1.4.20-ads.1")).toBeNull();
  });
});
