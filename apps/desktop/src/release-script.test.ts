import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const releaseScript = readFileSync(
  resolve(process.cwd(), "../../scripts/release.sh"),
  "utf8",
);

describe("release script publication surface", () => {
  it("uses browser upload plus deterministic finalization without GitHub CLI", () => {
    expect(releaseScript).not.toMatch(/\bgh\b/);
    expect(releaseScript).toContain("--finalize-published");
    expect(releaseScript).toContain("Public archive hash mismatch");
    expect(releaseScript).toContain("Publishing latest.json last");
    expect(releaseScript).toContain("Cache-Control: no-cache");
    expect(releaseScript).toContain(
      "publication-check=$PUBLISHED_METADATA_HEAD-$attempt",
    );
  });
});
