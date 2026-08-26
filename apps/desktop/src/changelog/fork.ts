import changelog1413Ads1 from "../../../../packages/changelog/fork-content/1.4.13-ads.1.md?raw";

const FORK_CHANGELOGS: Readonly<Record<string, string>> = {
  "1.4.13-ads.1": changelog1413Ads1,
};

export function getForkChangelog(version: string): string | null {
  return FORK_CHANGELOGS[version] ?? null;
}
