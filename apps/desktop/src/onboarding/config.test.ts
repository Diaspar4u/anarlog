import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-os", () => ({ platform }));

import { getInitialStep, getNextStep, getStepStatus } from "./config";

describe("local onboarding steps", () => {
  beforeEach(() => {
    platform.mockReturnValue("macos");
  });

  it("keeps permissions and skips account login", () => {
    expect(getInitialStep()).toBe("permissions");
    expect(getNextStep("permissions")).toBe("calendar");
    expect(getStepStatus("login", "permissions")).toBeNull();
  });

  it("starts with local onboarding outside macOS", () => {
    platform.mockReturnValue("windows");

    expect(getInitialStep()).toBe("calendar");
    expect(getStepStatus("login", "calendar")).toBeNull();
  });
});
