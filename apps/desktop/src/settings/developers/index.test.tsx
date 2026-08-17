import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkEmbeddedCli: vi.fn(),
  installEmbeddedCli: vi.fn(),
  showDevtool: vi.fn(),
  devtoolsPanelShow: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  getCloudApiSettings: vi.fn(),
  setCloudApiEnabled: vi.fn(),
  backfillCloudApiSnapshots: vi.fn(),
  createCloudApiKey: vi.fn(),
}));

vi.mock("~/types/tauri.gen", () => ({
  commands: {
    checkEmbeddedCli: mocks.checkEmbeddedCli,
    installEmbeddedCli: mocks.installEmbeddedCli,
    showDevtool: mocks.showDevtool,
  },
}));

vi.mock("@anlg/plugin-windows", () => ({
  commands: {
    devtoolsPanelShow: mocks.devtoolsPanelShow,
  },
}));

vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: vi.fn() },
}));

vi.mock("@anlg/plugin-local-api", () => ({
  commands: {
    listWebhooks: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
  },
}));

vi.mock("~/cloud-api/client", () => ({
  getCloudApiSettings: mocks.getCloudApiSettings,
  setCloudApiEnabled: mocks.setCloudApiEnabled,
  backfillCloudApiSnapshots: mocks.backfillCloudApiSnapshots,
  scheduleCloudApiBackfillRetry: vi.fn(),
  listCloudApiKeys: vi.fn().mockResolvedValue([]),
  createCloudApiKey: mocks.createCloudApiKey,
  revokeCloudApiKey: vi.fn(),
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  sonnerToast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

import {
  SettingsDevelopers,
  buildMcpConfiguration,
  getCliInstallNotification,
} from "./index";

describe("buildMcpConfiguration", () => {
  it("uses the exact installed CLI path", () => {
    const configuration = JSON.parse(
      buildMcpConfiguration("/Users/test/.local/bin/anarlog"),
    );

    expect(configuration).toEqual({
      mcpServers: {
        anarlog: {
          command: "/Users/test/.local/bin/anarlog",
          args: ["mcp"],
        },
      },
    });
  });
});

describe("getCliInstallNotification", () => {
  it("reports installed as success", () => {
    expect(
      getCliInstallNotification({
        supported: true,
        commandName: "anarlog",
        installPath: "/Users/test/.local/bin/anarlog",
        state: "installed",
        details: "Installed.",
      }),
    ).toEqual({ type: "success", message: "anarlog is ready to use" });
  });

  it.each(["resource_missing", "unsupported"] as const)(
    "reports %s as an install error",
    (state) => {
      expect(
        getCliInstallNotification({
          supported: false,
          commandName: "anarlog",
          installPath: "/Users/test/.local/bin/anarlog",
          state,
          details: "The CLI is unavailable in this build.",
        }),
      ).toEqual({
        type: "error",
        message: "The CLI is unavailable in this build.",
      });
    },
  );
});

describe("SettingsDevelopers", () => {
  beforeEach(() => {
    mocks.checkEmbeddedCli.mockReset();
    mocks.installEmbeddedCli.mockReset();
    mocks.showDevtool.mockReset();
    mocks.showDevtool.mockResolvedValue(false);
    mocks.devtoolsPanelShow.mockReset();
    mocks.devtoolsPanelShow.mockResolvedValue({ status: "ok" });
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.createCloudApiKey.mockReset();
    mocks.getCloudApiSettings.mockResolvedValue({
      enabled: false,
      updated_at: null,
    });
    mocks.setCloudApiEnabled.mockReset();
    mocks.backfillCloudApiSnapshots.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("uses the installed CLI path when copying the MCP configuration", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mocks.checkEmbeddedCli.mockResolvedValue({
      status: "ok",
      data: {
        supported: true,
        commandName: "anarlog",
        installPath: "/Users/test/.local/bin/anarlog",
        state: "installed",
        details:
          "Installed at /Users/test/.local/bin/anarlog and managed by Anarlog.",
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SettingsDevelopers />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Reinstall")).toBeTruthy();
    expect(
      screen.queryByText(/\/Users\/test\/\.local\/bin\/anarlog/),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Copy config" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual({
      mcpServers: {
        anarlog: {
          command: "/Users/test/.local/bin/anarlog",
          args: ["mcp"],
        },
      },
    });
  });

  it("copies each CLI command", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mocks.checkEmbeddedCli.mockResolvedValue({
      status: "ok",
      data: {
        supported: true,
        commandName: "anarlog",
        installPath: "/Users/test/.local/bin/anarlog",
        state: "installed",
        details: "Installed.",
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SettingsDevelopers />
      </QueryClientProvider>,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Copy anarlog --json meetings list",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy anarlog mcp" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenNthCalledWith(
        1,
        "anarlog --json meetings list",
      );
      expect(writeText).toHaveBeenNthCalledWith(2, "anarlog mcp");
    });
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(2);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Command copied");
  });

  it("does not expose a nonexistent MCP path when the CLI is unsupported", async () => {
    mocks.checkEmbeddedCli.mockResolvedValue({
      status: "ok",
      data: {
        supported: false,
        commandName: "anarlog-dev",
        installPath: "/Users/test/.local/bin/anarlog-dev",
        state: "unsupported",
        details: "Bundled CLI installation is currently available on macOS.",
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SettingsDevelopers />
      </QueryClientProvider>,
    );

    const copyButton = await screen.findByRole("button", {
      name: "Copy config",
    });
    expect(copyButton.hasAttribute("disabled")).toBe(true);
    expect(
      screen.queryByText(/\/Users\/test\/\.local\/bin\/anarlog-dev/),
    ).toBeNull();
  });

  it("keeps hosted Cloud API surfaces hidden", async () => {
    mocks.checkEmbeddedCli.mockResolvedValue({
      status: "ok",
      data: {
        supported: false,
        commandName: "anarlog",
        installPath: "/Users/test/.local/bin/anarlog",
        state: "unsupported",
        details: "Unavailable.",
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SettingsDevelopers />
      </QueryClientProvider>,
    );

    await screen.findByText("Webhooks");
    expect(screen.queryByText("Cloud API & Connectors")).toBeNull();
    expect(
      screen.queryByRole("switch", {
        name: "Enable Cloud API & Connectors",
      }),
    ).toBeNull();
    expect(screen.queryByText("REST API")).toBeNull();
    expect(mocks.setCloudApiEnabled).not.toHaveBeenCalled();
    expect(mocks.backfillCloudApiSnapshots).not.toHaveBeenCalled();
  });

  it("hides the devtools section when devtools are disabled", async () => {
    mocks.checkEmbeddedCli.mockResolvedValue({
      status: "ok",
      data: {
        supported: false,
        commandName: "anarlog",
        installPath: "/Users/test/.local/bin/anarlog",
        state: "unsupported",
        details: "Unavailable.",
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SettingsDevelopers />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mocks.showDevtool).toHaveBeenCalled());
    expect(screen.queryByText("Devtools panel")).toBeNull();
  });

  it("opens the devtools panel from the settings button when enabled", async () => {
    mocks.checkEmbeddedCli.mockResolvedValue({
      status: "ok",
      data: {
        supported: false,
        commandName: "anarlog",
        installPath: "/Users/test/.local/bin/anarlog",
        state: "unsupported",
        details: "Unavailable.",
      },
    });
    mocks.showDevtool.mockResolvedValue(true);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SettingsDevelopers />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Devtools panel")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open panel" }));

    await waitFor(() =>
      expect(mocks.devtoolsPanelShow).toHaveBeenCalledTimes(1),
    );
  });
});
