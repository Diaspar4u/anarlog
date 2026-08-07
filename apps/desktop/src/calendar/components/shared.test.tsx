import { describe, expect, it } from "vitest";

import { LOCAL_PROVIDERS } from "./shared";

describe("local calendar providers", () => {
  it("keeps Apple Calendar and excludes cloud OAuth integrations", () => {
    expect(LOCAL_PROVIDERS.map((provider) => provider.id)).toEqual(["apple"]);
    expect(
      LOCAL_PROVIDERS.every((provider) => !provider.nangoIntegrationId),
    ).toBe(true);
  });
});
