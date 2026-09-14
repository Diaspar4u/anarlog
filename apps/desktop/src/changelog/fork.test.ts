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

  it("returns correction notes for Apple Calendar deduplication", () => {
    const content = getForkChangelog("1.4.21-ads.2");

    expect(content).toContain("cancelled Apple Calendar events");
    expect(content).toContain("one calendar entry and one notification");
    expect(content).toContain("Preserve linked meeting notes");
  });

  it("returns superseding notes for Apple Calendar migration edges", () => {
    const content = getForkChangelog("1.4.21-ads.3");

    expect(content).toContain("timezone date boundaries");
    expect(content).toContain(
      "Resolve legacy linked sessions deterministically",
    );
    expect(content).toContain("one calendar entry, one notification");
  });

  it("returns the reviewed visible-occurrence correction notes", () => {
    const content = getForkChangelog("1.4.21-ads.4");

    expect(content).toContain("one Apple Calendar entry");
    expect(content).toContain("newest provider details");
    expect(content).toContain("replacement-series aliases");
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
