import { useQuery } from "@tanstack/react-query";
// @ts-ignore virtual module provided by the Vite changelog plugin
import { latestContent, latestVersion } from "virtual:changelog";

import { processContent } from "@anlg/changelog";

import { getForkChangelog } from "./fork";
import { changelogUrl } from "./source";
import { upstreamChangelogVersion } from "./version";

export function getLatestVersion(): string | null {
  return latestVersion;
}

export function useChangelogContent(version: string) {
  const query = useQuery({
    queryKey: ["changelog", version],
    queryFn: async ({ signal }) => {
      const forkContent = getForkChangelog(version);
      if (forkContent) return forkContent;
      if (version === latestVersion && latestContent)
        return latestContent as string;
      const upstreamVersion = upstreamChangelogVersion(version);
      const url = changelogUrl(upstreamVersion);
      if (!url) return null;
      const response = await fetch(url, { signal });
      if (!response.ok) return null;
      if (upstreamVersion.includes("-nightly.")) {
        const release = await response.json();
        return typeof release.body === "string" ? release.body : null;
      }
      return response.text();
    },
    staleTime: Infinity,
  });
  const parsed = query.data ? processContent(query.data) : null;
  return {
    content: parsed?.content ?? null,
    date: parsed?.date ?? null,
    loading: query.isPending,
  };
}
