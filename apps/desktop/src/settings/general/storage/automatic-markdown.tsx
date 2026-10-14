import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";

import { Switch } from "@anlg/ui/components/ui/switch";

import { useMarkdownExportPolicy } from "~/automations/markdown-export-policy";
import {
  AutomationLastRunLine,
  MarkdownExportConfig,
} from "~/settings/automations/starter-config";
import { setSettingValue } from "~/settings/queries";

export function AutomaticMarkdownExportRow() {
  const policy = useMarkdownExportPolicy();
  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      setSettingValue("automation_markdown_export_enabled", enabled),
  });
  return (
    <div className="border-border rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor="automatic-markdown-export"
          className="text-sm font-medium"
        >
          <Trans>Automatic Markdown export</Trans>
        </label>
        <Switch
          id="automatic-markdown-export"
          checked={policy.data?.enabled ?? true}
          disabled={!policy.data || toggle.isPending}
          onCheckedChange={(enabled) => toggle.mutate(enabled)}
        />
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        {!policy.data ? null : !policy.data.enabled ? (
          <Trans>Disabled</Trans>
        ) : policy.data.directory ? (
          <Trans>Automatically saves complete transcripts and summaries.</Trans>
        ) : (
          <Trans>Not configured</Trans>
        )}
      </p>
      <div className="mt-3">
        <MarkdownExportConfig />
      </div>
      <AutomationLastRunLine settingKey="automation_markdown_export_last_run" />
      {(policy.error || toggle.error) && (
        <p role="alert" className="text-destructive mt-2 text-xs">
          <Trans>Could not load or update the Markdown export settings.</Trans>
        </p>
      )}
    </div>
  );
}
