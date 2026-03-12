import { useQuery } from "@tanstack/react-query";
import { platform } from "@tauri-apps/plugin-os";
import {
  AxeIcon,
  FolderIcon,
  PanelLeftCloseIcon,
  SearchIcon,
  TimerIcon,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";

import { Button } from "@hypr/ui/components/ui/button";
import { Kbd } from "@hypr/ui/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@hypr/ui/components/ui/tooltip";
import { cn } from "@hypr/utils";

import { SidebarFoldersView } from "./folders";
import { ProfileSection } from "./profile";
import { SidebarSearchInput } from "./search";
import { TimelineView } from "./timeline";
import { ToastArea } from "./toast";

import { useShell } from "~/contexts/shell";
import { type SidebarView } from "~/contexts/shell/leftsidebar";
import { SearchResults } from "~/search/components/sidebar";
import { useSearch } from "~/search/contexts/ui";
import { TrafficLights } from "~/shared/ui/traffic-lights";
import { commands } from "~/types/tauri.gen";

const DevtoolView = lazy(() =>
  import("./devtool").then((m) => ({ default: m.DevtoolView })),
);

export function LeftSidebar() {
  const { leftsidebar } = useShell();
  const isLinux = platform() === "linux";
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);

  const { data: showDevtoolButton = false } = useQuery({
    queryKey: ["show_devtool"],
    queryFn: () => commands.showDevtool(),
  });

  return (
    <div className="flex h-full w-70 shrink-0 flex-col gap-1 overflow-hidden">
      <header
        data-tauri-drag-region
        className={cn([
          "flex flex-row items-center",
          "h-9 w-full py-1",
          isLinux ? "justify-between pl-3" : "justify-end pl-20",
          "shrink-0",
        ])}
      >
        {isLinux && <TrafficLights />}
        <div className="flex items-center">
          {showDevtoolButton && (
            <Button
              size="icon"
              variant="ghost"
              onClick={leftsidebar.toggleDevtool}
            >
              <AxeIcon size={16} />
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={leftsidebar.toggleExpanded}
              >
                <PanelLeftCloseIcon size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2">
              <span>Toggle sidebar</span>
              <Kbd className="animate-kbd-press">⌘ \</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      {!leftsidebar.showDevtool && (
        <SidebarTabBar
          view={leftsidebar.sidebarView}
          onViewChange={leftsidebar.setSidebarView}
        />
      )}

      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {leftsidebar.showDevtool ? (
            <Suspense fallback={null}>
              <DevtoolView />
            </Suspense>
          ) : (
            <>
              <div
                className={
                  leftsidebar.sidebarView === "search"
                    ? "flex h-full flex-col"
                    : "hidden"
                }
              >
                <SidebarSearchView onEscapeEmpty={leftsidebar.exitSearch} />
              </div>
              <div
                className={
                  leftsidebar.sidebarView === "timeline" ? "h-full" : "hidden"
                }
              >
                <TimelineView />
              </div>
              <div
                className={
                  leftsidebar.sidebarView === "folders" ? "h-full" : "hidden"
                }
              >
                <SidebarFoldersView />
              </div>
            </>
          )}
          {!leftsidebar.showDevtool && (
            <ToastArea isProfileExpanded={isProfileExpanded} />
          )}
        </div>
        <div className="relative z-30">
          <ProfileSection onExpandChange={setIsProfileExpanded} />
        </div>
      </div>
    </div>
  );
}

function SidebarTabBar({
  view,
  onViewChange,
}: {
  view: SidebarView;
  onViewChange: (v: SidebarView) => void;
}) {
  return (
    <div className={cn(["flex shrink-0 items-center gap-0.5 px-2"])}>
      <TabBarButton
        icon={<TimerIcon size={14} />}
        label="Timeline"
        active={view === "timeline"}
        onClick={() => onViewChange("timeline")}
      />
      <TabBarButton
        icon={<FolderIcon size={14} />}
        label="Folders"
        active={view === "folders"}
        onClick={() => onViewChange("folders")}
      />
      <TabBarButton
        icon={<SearchIcon size={14} />}
        label="Search"
        active={view === "search"}
        onClick={() => onViewChange("search")}
        shortcut="⌘K"
      />
    </div>
  );
}

function TabBarButton({
  icon,
  label,
  active,
  onClick,
  shortcut,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn([
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium",
            "transition-colors",
            active
              ? "bg-neutral-200 text-neutral-900"
              : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700",
          ])}
        >
          {icon}
          <span>{label}</span>
        </button>
      </TooltipTrigger>
      {shortcut && (
        <TooltipContent side="bottom" className="flex items-center gap-2">
          <span>{label}</span>
          <Kbd>{shortcut}</Kbd>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

function SidebarSearchView({ onEscapeEmpty }: { onEscapeEmpty: () => void }) {
  const { focus } = useSearch();

  useEffect(() => {
    focus();
  }, [focus]);

  return (
    <>
      <SidebarSearchInput onEscapeEmpty={onEscapeEmpty} />
      <div className="flex-1 overflow-hidden">
        <SearchResults />
      </div>
    </>
  );
}
