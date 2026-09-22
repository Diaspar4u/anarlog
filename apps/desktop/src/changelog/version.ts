export function upstreamChangelogVersion(version: string): string {
  return version.replace(/(?:-ads\.\d+|\+ads)$/, "");
}
