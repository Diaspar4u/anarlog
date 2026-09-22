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
  "Nari Labs",
  "OpenRouter",
  "Meta Muse",
  "Linux",
  "Windows",
  "cloud",
  "account",
  "billing",
  "team",
  "sync",
];

describe("getForkChangelog", () => {
  it("returns curated notes for the maintained fork release", () => {
    const content = getForkChangelog("1.4.25-ads.1");

    expect(content).toContain("Edit completed transcripts");
    expect(content).toContain("interrupted transcripts");
    expect(content).toContain("24-hour format");
    expect(content).toContain("Markdown automation");
  });

  it("preserves historical Apple Calendar correction notes", () => {
    expect(getForkChangelog("1.4.21-ads.2")).toContain(
      "cancelled Apple Calendar events",
    );
    expect(getForkChangelog("1.4.21-ads.3")).toContain(
      "timezone date boundaries",
    );
    expect(getForkChangelog("1.4.21-ads.4")).toContain(
      "replacement-series aliases",
    );
  });

  it.each(EXCLUDED_FEATURES)(
    "omits removed or unused feature: %s",
    (feature) => {
      expect(getForkChangelog("1.4.25-ads.1")).not.toMatch(
        new RegExp(feature, "i"),
      );
    },
  );

  it("does not invent notes for unknown fork versions", () => {
    expect(getForkChangelog("1.4.22-ads.1")).toBeNull();
  });
});
