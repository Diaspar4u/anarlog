import { useQuery } from "@tanstack/react-query";

import { commands as localApiCommands } from "@anlg/plugin-local-api";

import { useStoredSettingValuesQuery } from "~/settings/queries";

export function useMarkdownExportPolicy() {
  const settings = useStoredSettingValuesQuery();
  return useQuery({
    queryKey: [
      "markdown-export-policy",
      settings.data?.values.automation_markdown_export_enabled,
      settings.data?.values.automation_markdown_export_directory,
    ],
    enabled: !!settings.data,
    queryFn: async () => {
      const result = await localApiCommands.markdownExportPolicy();
      if (result.status === "error") {
        throw new Error(result.error);
      }
      return result.data;
    },
  });
}
