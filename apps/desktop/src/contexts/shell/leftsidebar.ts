import { useCallback, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

export type SidebarView = "timeline" | "folders" | "search";

export function useLeftSidebar() {
  const [expanded, setExpanded] = useState(true);
  const [showDevtool, setShowDevtool] = useState(false);
  const [sidebarView, setSidebarViewState] = useState<SidebarView>("timeline");
  const prevViewRef = useRef<"timeline" | "folders">("timeline");

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const toggleDevtool = useCallback(() => {
    setShowDevtool((prev) => !prev);
  }, []);

  const setSidebarView = useCallback((view: SidebarView) => {
    setSidebarViewState((prev) => {
      if (prev !== "search" && view === "search") {
        prevViewRef.current = prev as "timeline" | "folders";
      }
      return view;
    });
  }, []);

  const exitSearch = useCallback(() => {
    setSidebarViewState(prevViewRef.current);
  }, []);

  useHotkeys(
    "mod+\\",
    toggleExpanded,
    {
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [toggleExpanded],
  );

  useHotkeys(
    "mod+k",
    () => setSidebarView("search"),
    {
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [setSidebarView],
  );

  return {
    expanded,
    setExpanded,
    toggleExpanded,
    showDevtool,
    setShowDevtool,
    toggleDevtool,
    sidebarView,
    setSidebarView,
    exitSearch,
  };
}
