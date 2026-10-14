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
  it("describes default-on export and preserves the configured vault in the public release", () => {
    const content = getForkChangelog("1.4.30-ads.2");
    expect(content).toContain("enabled by default");
    expect(content).toContain("existing vault");
    expect(content).toContain("transcripts and summaries");
    for (const feature of EXCLUDED_FEATURES) {
      expect(content).not.toMatch(new RegExp(feature, "i"));
    }
  });
  it("describes the private candidate without advertising hosted services", () => {
    const content = getForkChangelog("1.4.30-ads.1");
    expect(content).toContain("Private candidate");
    expect(content).toContain("configured recording location");
    expect(content).toContain("automatic Markdown export");
    for (const feature of EXCLUDED_FEATURES) {
      expect(content).not.toMatch(new RegExp(feature, "i"));
    }
  });
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
