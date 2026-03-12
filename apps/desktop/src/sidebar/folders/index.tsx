import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FoldersIcon,
  StickyNoteIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@hypr/utils";

import { useFolderName, useFolderTree } from "~/folders";
import { useSession } from "~/store/tinybase/hooks";
import * as main from "~/store/tinybase/store/main";
import { useTabs } from "~/store/zustand/tabs";

type SortKey = "created_at";

export function SidebarFoldersView() {
  const { topLevel } = useFolderTree();
  const [sortBy] = useState<SortKey>("created_at");

  if (topLevel.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <FoldersIcon className="text-muted-foreground h-8 w-8" />
        <p className="text-muted-foreground text-sm">No folders yet</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto py-1">
        {topLevel.map((folderId) => (
          <FolderTreeNode
            key={folderId}
            folderId={folderId}
            depth={0}
            sortBy={sortBy}
          />
        ))}
      </div>
    </div>
  );
}

function FolderTreeNode({
  folderId,
  depth,
  sortBy,
}: {
  folderId: string;
  depth: number;
  sortBy: SortKey;
}) {
  const name = useFolderName(folderId);
  const { byParent } = useFolderTree();
  const [expanded, setExpanded] = useState(false);

  const childFolderIds = byParent[folderId] || [];
  const sessionIds = main.UI.useSliceRowIds(
    main.INDEXES.sessionsByFolder,
    folderId,
    main.STORE_ID,
  );
  const store = main.UI.useStore(main.STORE_ID);

  const sortedSessionIds = useMemo(() => {
    if (!sessionIds || !store) return sessionIds ?? [];
    return [...sessionIds].sort((a, b) => {
      const aVal = (store.getCell("sessions", a, sortBy) as string) ?? "";
      const bVal = (store.getCell("sessions", b, sortBy) as string) ?? "";
      return bVal.localeCompare(aVal);
    });
  }, [sessionIds, store, sortBy]);

  const itemCount = childFolderIds.length + (sessionIds?.length ?? 0);

  return (
    <div>
      <button
        className={cn([
          "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-sm",
          "hover:bg-muted text-foreground",
          depth === 0 ? "pl-2" : `pl-${2 + depth * 3}`,
        ])}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-muted-foreground shrink-0">
          {expanded ? (
            <ChevronDownIcon className="h-3.5 w-3.5" />
          ) : (
            <ChevronRightIcon className="h-3.5 w-3.5" />
          )}
        </span>
        <FolderIcon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{name}</span>
        {itemCount > 0 && (
          <span className="text-muted-foreground shrink-0 text-xs">
            {itemCount}
          </span>
        )}
      </button>

      {expanded && (
        <div>
          {childFolderIds.map((childId) => (
            <FolderTreeNode
              key={childId}
              folderId={childId}
              depth={depth + 1}
              sortBy={sortBy}
            />
          ))}
          {sortedSessionIds.map((sessionId) => (
            <SidebarSessionItem
              key={sessionId}
              sessionId={sessionId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarSessionItem({
  sessionId,
  depth,
}: {
  sessionId: string;
  depth: number;
}) {
  const session = useSession(sessionId);
  const openCurrent = useTabs((state) => state.openCurrent);

  return (
    <button
      className={cn([
        "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-sm",
        "hover:bg-muted text-foreground",
      ])}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      onClick={() => openCurrent({ type: "sessions", id: sessionId })}
    >
      <StickyNoteIcon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">
        {session.title || "Untitled"}
      </span>
    </button>
  );
}
