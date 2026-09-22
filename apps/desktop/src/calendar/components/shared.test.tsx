import { describe, expect, it } from "vitest";

import { PROVIDERS } from "./shared";

describe("calendar providers", () => {
  it("exposes only local calendar providers", () => {
    expect(PROVIDERS.map((provider) => provider.id)).toEqual(["apple"]);
  });
});
