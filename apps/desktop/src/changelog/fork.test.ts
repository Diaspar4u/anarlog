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
    const content = getForkChangelog("1.4.21-ads.1");

    expect(content).toContain("Your stats");
    expect(content).toContain("Choose where notes and recordings are stored");
    expect(content).toContain("Verify API keys");
    expect(content).toContain("pausing and resuming capture");
  });

  it.each(EXCLUDED_FEATURES)(
    "omits removed or unused feature: %s",
    (feature) => {
      expect(getForkChangelog("1.4.21-ads.1")).not.toMatch(
        new RegExp(feature, "i"),
      );
    },
  );

  it("does not invent notes for unknown fork versions", () => {
    expect(getForkChangelog("1.4.22-ads.1")).toBeNull();
  });
});
