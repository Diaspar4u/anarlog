import changelog1413Ads1 from "../../../../packages/changelog/fork-content/1.4.13-ads.1.md?raw";
import changelog1413Ads2 from "../../../../packages/changelog/fork-content/1.4.13-ads.2.md?raw";
import changelog1419Ads1 from "../../../../packages/changelog/fork-content/1.4.19-ads.1.md?raw";

const FORK_CHANGELOGS: Readonly<Record<string, string>> = {
  "1.4.13-ads.1": changelog1413Ads1,
  "1.4.13-ads.2": changelog1413Ads2,
  "1.4.19-ads.1": changelog1419Ads1,
};

export function getForkChangelog(version: string): string | null {
  return FORK_CHANGELOGS[version] ?? null;
}
