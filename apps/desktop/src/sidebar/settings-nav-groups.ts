import { useLingui } from "@lingui/react/macro";

import {
  Bell,
  BookOpen,
  Buildings,
  CalendarDots,
  ChartLineUp,
  Code,
  DownloadSimple,
  FileText,
  FolderSimple,
  Gear,
  type Icon,
  Lock,
  Microphone,
  Sparkle,
  Sun,
  Users,
  VideoCamera,
  Waveform,
} from "@anlg/ui/components/icons";

import { type SettingsTab, type TabInput } from "~/store/zustand/tabs";

type SettingsNavItem =
  | { id: SettingsTab; label: string; icon: Icon; requiresPro?: boolean }
  | {
      id: "calendar" | "contacts" | "folders" | "templates";
      label: string;
      icon: Icon;
      destination: TabInput;
      requiresPro?: boolean;
    };

export type SettingsNavGroup = { label: string; items: SettingsNavItem[] };

export function useSettingsNavGroups(): SettingsNavGroup[] {
  const { t } = useLingui();

  return [
    {
      label: t`App`,
      items: [
        { id: "app", label: t`General`, icon: Gear },
        { id: "insights", label: t`Insights`, icon: ChartLineUp },
        { id: "appearance", label: t`Appearance`, icon: Sun },
        { id: "notifications", label: t`Notifications`, icon: Bell },
      ],
    },
    {
      label: "AI",
      items: [
        { id: "transcription", label: t`Transcription`, icon: Waveform },
        { id: "dictation", label: t`Dictation`, icon: Microphone },
        { id: "intelligence", label: t`Intelligence`, icon: Sparkle },
        { id: "dictionary", label: t`Dictionary`, icon: BookOpen },
      ],
    },
    {
      label: t`Workspace`,
      items: [
        { id: "meetings", label: t`Meetings`, icon: VideoCamera },
        {
          id: "folders",
          label: t`Folders`,
          icon: FolderSimple,
          destination: { type: "folders" },
        },
        {
          id: "calendar",
          label: t`Calendar`,
          icon: CalendarDots,
          destination: { type: "calendar" },
        },
        {
          id: "contacts",
          label: t`Contacts`,
          icon: Users,
          destination: { type: "contacts" },
        },
        {
          id: "templates",
          label: t`Templates`,
          icon: FileText,
          destination: { type: "templates" },
        },
      ],
    },
    {
      label: t`Data`,
      items: [
        { id: "imports", label: t`Imports`, icon: DownloadSimple },
        { id: "crm", label: t`CRM`, icon: Buildings },
      ],
    },
    {
      label: t`Advanced`,
      items: [
        { id: "permissions", label: t`Permissions`, icon: Lock },
        { id: "developers", label: t`Developers`, icon: Code },
      ],
    },
  ];
}
