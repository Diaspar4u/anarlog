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
    const content = getForkChangelog("1.4.13-ads.1");

    expect(content).toContain("OpenAI");
    expect(content).toContain("AssemblyAI");
    expect(content).toContain("Edit note titles before recording");
    expect(content).toContain("Open past notes with less delay");
  });

  it.each(EXCLUDED_FEATURES)(
    "omits removed or unused feature: %s",
    (feature) => {
      expect(getForkChangelog("1.4.13-ads.1")).not.toMatch(
        new RegExp(feature, "i"),
      );
    },
  );

  it("does not invent notes for unknown fork versions", () => {
    expect(getForkChangelog("1.4.14-ads.1")).toBeNull();
  });
});
