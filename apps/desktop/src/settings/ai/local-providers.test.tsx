import { describe, expect, it } from "vitest";

import { PROVIDERS as LLM_PROVIDERS } from "./llm/shared";
import { PROVIDERS as STT_PROVIDERS } from "./stt/shared";

describe("local AI provider surfaces", () => {
  it("excludes the account-backed Anarlog cloud providers", () => {
    expect(LLM_PROVIDERS.some((provider) => provider.id === "anarlog")).toBe(
      false,
    );
    expect(STT_PROVIDERS.some((provider) => provider.id === "anarlog")).toBe(
      false,
    );
  });

  it("retains local and user-configured providers", () => {
    expect(LLM_PROVIDERS.some((provider) => provider.id === "ollama")).toBe(
      true,
    );
    expect(STT_PROVIDERS.some((provider) => provider.id === "custom")).toBe(
      true,
    );
  });
});
