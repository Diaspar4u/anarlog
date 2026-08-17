import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { user: { id: "user-1" } } as { user: { id: string } } | null,
  currentTab: { type: "settings", state: { tab: "app" } } as {
    type: "settings";
    state: { tab?: string };
  } | null,
  tabs: [] as Array<{
    active: boolean;
    pinned: boolean;
    slotId: string;
    type: "templates";
    state: {
      showHomepage: boolean;
      isWebMode: boolean;
      selectedMineId: string | null;
      selectedWebIndex: number | null;
    };
  }>,
  openNew: vi.fn(),
  select: vi.fn(),
  transitionChatMode: vi.fn(),
  updateSettingsTabState: vi.fn(),
  updateTemplatesTabState: vi.fn(),
}));

const lingui = vi.hoisted(() => {
  const t = (
    input: TemplateStringsArray | { message?: string } | string,
    ...values: unknown[]
  ) => {
    if (Array.isArray(input)) {
      return input.reduce(
        (message, part, index) =>
          `${message}${part}${index < values.length ? String(values[index]) : ""}`,
        "",
      );
    }
    if (typeof input === "string") return input;
    if ("message" in input) return input.message ?? "";
    return "";
  };
  return { t };
});

vi.mock("@lingui/react/macro", () => ({
  Trans: ({
    children,
    id,
    message,
  }: {
    children?: ReactNode;
    id?: string;
    message?: string;
  }) => <>{children ?? message ?? id}</>,
  useLingui: () => ({ _: lingui.t, t: lingui.t }),
}));

vi.mock("./custom-sidebar-header", () => ({
  CustomSidebarHeader: () => <div />,
}));

vi.mock("~/store/zustand/tabs", () => {
  const getState = () => ({
    currentTab: mocks.currentTab,
    tabs: mocks.tabs,
    openNew: mocks.openNew,
    select: mocks.select,
    transitionChatMode: mocks.transitionChatMode,
    updateSettingsTabState: mocks.updateSettingsTabState,
    updateTemplatesTabState: mocks.updateTemplatesTabState,
  });
  const useTabs = Object.assign(
    (selector: (state: unknown) => unknown) => selector(getState()),
    { getState },
  );
  return { useTabs };
});

import { SettingsNav } from "./settings";

describe("SettingsNav", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.currentTab = { type: "settings", state: { tab: "app" } };
    mocks.tabs = [];
    mocks.openNew.mockClear();
    mocks.select.mockClear();
    mocks.transitionChatMode.mockClear();
    mocks.updateSettingsTabState.mockClear();
    mocks.updateTemplatesTabState.mockClear();
  });

  it("renders every local settings menu label", () => {
    render(<SettingsNav />);
    [
      "App",
      "General",
      "Appearance",
      "Notifications",
      "Workspace",
      "Meetings",
      "Calendar",
      "Contacts",
      "Templates",
      "AI",
      "Transcription",
      "Intelligence",
      "Dictionary",
      "Data",
      "Imports",
      "Advanced",
      "Permissions",
      "Developers",
    ].forEach((label) => expect(screen.getByText(label)).toBeTruthy());
  });

  it.each([
    ["Calendar", { type: "calendar" }],
    ["Contacts", { type: "contacts" }],
    ["Templates", { type: "templates" }],
  ] as const)("opens the %s workspace", (label, destination) => {
    render(<SettingsNav />);
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(
      screen.getByTestId(`settings-nav-destination-icon-${destination.type}`),
    ).toBeTruthy();
    expect(mocks.openNew).toHaveBeenCalledWith(destination);
  });

  it("keeps hosted-product settings hidden", () => {
    render(<SettingsNav />);
    ["Account", "Team", "Sync", "Automations", "Privacy"].forEach((label) =>
      expect(screen.queryByText(label)).toBeNull(),
    );
    expect(screen.getByText("Imports")).toBeTruthy();
  });

  it.each([
    ["Permissions", "permissions"],
    ["Appearance", "appearance"],
    ["Meetings", "meetings"],
    ["Transcription", "transcription"],
    ["Dictionary", "dictionary"],
    ["Imports", "imports"],
  ] as const)("opens %s inside settings", (label, tab) => {
    render(<SettingsNav />);
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(mocks.updateSettingsTabState).toHaveBeenCalledWith(
      mocks.currentTab,
      { tab },
    );
  });

  it("filters and clears settings search", () => {
    render(<SettingsNav />);
    const input = screen.getByPlaceholderText("Search settings...");
    fireEvent.change(input, { target: { value: "appear" } });
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.queryByText("Meetings")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText("Meetings")).toBeTruthy();
  });
});
