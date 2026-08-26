#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DESKTOP_ROOT="$REPO_ROOT/apps/desktop"
TAURI_ROOT="$DESKTOP_ROOT/src-tauri"
STABLE_CONFIG="$TAURI_ROOT/tauri.conf.stable.json"
STABLE_MACOS_CONFIG="$TAURI_ROOT/tauri.conf.stable-macos.json"
ENTITLEMENTS="$TAURI_ROOT/Entitlements.plist"
UPDATER_KEY="${ANARLOG_TAURI_KEY:-$HOME/.config/forkctl/anarlog-tauri.key}"
SIGNING_IDENTITY="${ANARLOG_SIGNING_IDENTITY:-Apple Development: ANDREY SHRAYEV (87R47LZ5EP)}"
REPOSITORY="${ANARLOG_GITHUB_REPOSITORY:-Diaspar4u/anarlog}"
FEED_BRANCH="${ANARLOG_FEED_BRANCH:-andrey/anarlog-v1.4.8}"
FEED_URL="https://raw.githubusercontent.com/$REPOSITORY/$FEED_BRANCH/latest.json"
RELEASE_BASE_URL="https://github.com/$REPOSITORY/releases/download"
EXPECTED_BUNDLE_ID="com.hyprnote.stable"
VERSION=""
OUTPUT_DIR=""
PUBLISH=0
ALLOW_DIRTY=0
PRE_METADATA_HEAD=""
PUBLISHED_METADATA_HEAD=""

rollback_published_metadata() {
    [[ -n "$PRE_METADATA_HEAD" && -n "$PUBLISHED_METADATA_HEAD" ]] || return 0
    git -C "$REPO_ROOT" push \
        "--force-with-lease=refs/heads/$FEED_BRANCH:$PUBLISHED_METADATA_HEAD" \
        origin "$PRE_METADATA_HEAD:refs/heads/$FEED_BRANCH"
    git -C "$REPO_ROOT" reset --hard "$PRE_METADATA_HEAD" >/dev/null
    PUBLISHED_METADATA_HEAD=""
}

on_exit() {
    local status=$?
    trap - EXIT
    if [[ "$status" != '0' && -n "$PUBLISHED_METADATA_HEAD" ]]; then
        rollback_published_metadata || status=1
    fi
    exit "$status"
}
trap on_exit EXIT

usage() {
    printf '%s\n' \
        'Usage: scripts/release.sh --version <semver-ads.N> [options]' \
        '' \
        'Builds, Apple-signs, verifies, packages, and Tauri-signs Anarlog.' \
        'With --publish, it uploads the immutable release asset, verifies it,' \
        'publishes latest.json last, and verifies the public update channel.' \
        '' \
        'Options:' \
        '  --version <semver-ads.N>    Ordered revision on the pinned upstream version.' \
        '  --output-dir <directory>    Artifact directory.' \
        '  --publish                   Publish release asset and latest.json.' \
        '  --allow-dirty               Permit a prepare-only build from dirty source.' \
        '  -h, --help                  Show this help.'
}

log() { printf '\n==> %s\n' "$1"; }
fail() { printf 'error: %s\n' "$1" >&2; exit 1; }
require_command() { command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"; }
plist_value() { plutil -extract "$2" raw "$1"; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --version)
            [[ $# -ge 2 ]] || fail '--version requires a value'
            VERSION="$2"
            shift 2
            ;;
        --output-dir)
            [[ $# -ge 2 ]] || fail '--output-dir requires a path'
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --publish)
            PUBLISH=1
            shift
            ;;
        --allow-dirty)
            ALLOW_DIRTY=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *) fail "Unknown argument: $1" ;;
    esac
done

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+-ads\.[1-9][0-9]*$ ]] || fail '--version must match X.Y.Z-ads.N'
[[ -f "$STABLE_CONFIG" ]] || fail "Missing $STABLE_CONFIG"
[[ -f "$STABLE_MACOS_CONFIG" ]] || fail "Missing $STABLE_MACOS_CONFIG"
[[ -f "$ENTITLEMENTS" ]] || fail "Missing $ENTITLEMENTS"
[[ -f "$UPDATER_KEY" ]] || fail "Missing Tauri updater key: $UPDATER_KEY"
[[ "$(stat -f '%Lp' "$UPDATER_KEY")" == '600' ]] || fail 'Tauri updater key must be mode 0600'

for command_name in cargo codesign curl ditto gh git jq plutil pnpm security shasum stat; do
    require_command "$command_name"
done

if [[ -z "$OUTPUT_DIR" ]]; then
    OUTPUT_DIR="$REPO_ROOT/.fork-build/releases/$VERSION"
elif [[ "$OUTPUT_DIR" != /* ]]; then
    OUTPUT_DIR="$REPO_ROOT/$OUTPUT_DIR"
fi
[[ ! -e "$OUTPUT_DIR" ]] || fail "Output already exists: $OUTPUT_DIR"

if [[ "$ALLOW_DIRTY" == '0' && -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
    fail 'Git working tree is not clean. Commit/stash changes or pass --allow-dirty for a prepare-only build.'
fi
if [[ "$PUBLISH" == '1' ]]; then
    [[ "$ALLOW_DIRTY" == '0' ]] || fail '--publish cannot be combined with --allow-dirty'
    [[ "$(git -C "$REPO_ROOT" branch --show-current)" == "$FEED_BRANCH" ]] || fail "Publish requires branch $FEED_BRANCH"
    git -C "$REPO_ROOT" fetch origin "$FEED_BRANCH"
    git -C "$REPO_ROOT" merge-base --is-ancestor "origin/$FEED_BRANCH" HEAD \
        || fail "Release commit is not a descendant of origin/$FEED_BRANCH"
    [[ "$(gh api user --jq .login)" == 'Diaspar4u' ]] \
        || fail 'The established GitHub profile is not Diaspar4u'
fi

IDENTITY_SHA="$(security find-identity -v -p codesigning "$HOME/Library/Keychains/login.keychain-db" | awk -v identity="$SIGNING_IDENTITY" 'index($0, identity) {print $2; exit}')"
[[ -n "$IDENTITY_SHA" ]] || fail "Signing identity unavailable: $SIGNING_IDENTITY"

mkdir -p "$OUTPUT_DIR"
OVERRIDE_CONFIG="$OUTPUT_DIR/tauri.release.json"
jq -n --arg version "$VERSION" --arg identity "$SIGNING_IDENTITY" \
    '{version: $version, bundle: {macOS: {signingIdentity: $identity}}}' > "$OVERRIDE_CONFIG"

BUNDLE_DIR="$TAURI_ROOT/target/release/bundle/macos"
rm -rf "$BUNDLE_DIR"

log "Building updater-enabled Anarlog $VERSION"
export RUSTC_WRAPPER=""
export CARGO_BUILD_RUSTC_WRAPPER=""
pnpm install --frozen-lockfile
pnpm --filter @anlg/ui build
(
    cd "$DESKTOP_ROOT"
    export APP_VERSION="$VERSION"
    export VITE_APP_VERSION="$VERSION"
    export VITE_API_URL="https://127.0.0.1"
    export VITE_APP_URL="https://127.0.0.1"
    export POSTHOG_API_KEY=""
    export TAURI_SIGNING_PRIVATE_KEY="$(< "$UPDATER_KEY")"
    export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
    pnpm exec tauri build \
        --config src-tauri/tauri.conf.stable.json \
        --config src-tauri/tauri.conf.stable-macos.json \
        --config "$OVERRIDE_CONFIG" \
        --bundles app
)

APP_PATH="$BUNDLE_DIR/Anarlog.app"
TAURI_ARCHIVE="$APP_PATH.tar.gz"
TAURI_SIGNATURE="$TAURI_ARCHIVE.sig"
[[ -d "$APP_PATH" ]] || fail 'Tauri application bundle was not produced'
[[ -s "$TAURI_ARCHIVE" ]] || fail 'Tauri updater archive was not produced'
[[ -s "$TAURI_SIGNATURE" ]] || fail 'Tauri updater signature was not produced'

log 'Verifying Apple application signature and maintained updater configuration'
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
INFO_PLIST="$APP_PATH/Contents/Info.plist"
[[ "$(plist_value "$INFO_PLIST" CFBundleShortVersionString)" == "$VERSION" ]] || fail 'Built app version mismatch'
[[ "$(plist_value "$INFO_PLIST" CFBundleIdentifier)" == "$EXPECTED_BUNDLE_ID" ]] || fail 'Built app bundle identifier mismatch'
[[ "$(jq -r '.plugins.updater.active' "$STABLE_CONFIG")" == 'true' ]] || fail 'Maintained updater is not enabled'
[[ "$(jq -r '.plugins.updater.endpoints[0]' "$STABLE_CONFIG")" == "$FEED_URL" ]] || fail 'Maintained updater endpoint mismatch'
[[ -n "$(jq -r '.plugins.updater.pubkey // empty' "$STABLE_CONFIG")" ]] || fail 'Maintained updater public key is missing'

log 'Verifying Tauri updater signature'
cargo run --quiet -p updater-core --bin verify-updater-signature -- \
    "$TAURI_ARCHIVE" "$TAURI_SIGNATURE" "$STABLE_CONFIG"

SAFE_VERSION="$VERSION"
ARCHIVE_NAME="Anarlog-$SAFE_VERSION-macos-aarch64.app.tar.gz"
ARCHIVE_PATH="$OUTPUT_DIR/$ARCHIVE_NAME"
SIGNATURE_PATH="$OUTPUT_DIR/$ARCHIVE_NAME.sig"
ditto "$TAURI_ARCHIVE" "$ARCHIVE_PATH"
ditto "$TAURI_SIGNATURE" "$SIGNATURE_PATH"
ARCHIVE_SHA256="$(shasum -a 256 "$ARCHIVE_PATH" | awk '{print $1}')"
RELEASE_TAG="anarlog-v$SAFE_VERSION"
DOWNLOAD_URL="$RELEASE_BASE_URL/$RELEASE_TAG/$ARCHIVE_NAME"

if [[ "$PUBLISH" == '1' ]]; then
    log 'Publishing immutable GitHub Release asset'
    HEAD_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
    gh release create "$RELEASE_TAG" \
        "$ARCHIVE_PATH#$ARCHIVE_NAME" \
        --repo "$REPOSITORY" \
        --target "$HEAD_SHA" \
        --title "Anarlog $VERSION" \
        --notes "Maintained Anarlog $VERSION"

    REMOTE_ARCHIVE="$OUTPUT_DIR/public-$ARCHIVE_NAME"
    curl --fail --location --retry 3 --output "$REMOTE_ARCHIVE" "$DOWNLOAD_URL"
    [[ "$(shasum -a 256 "$REMOTE_ARCHIVE" | awk '{print $1}')" == "$ARCHIVE_SHA256" ]] || fail 'Public archive hash mismatch'
    cargo run --quiet -p updater-core --bin verify-updater-signature -- \
        "$REMOTE_ARCHIVE" "$SIGNATURE_PATH" "$STABLE_CONFIG"

    log 'Publishing latest.json last'
    SIGNATURE="$(< "$SIGNATURE_PATH")"
    PUBLICATION_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    CANDIDATE_METADATA="$OUTPUT_DIR/latest.json"
    jq -n \
        --arg version "$VERSION" \
        --arg notes "Maintained Anarlog $VERSION" \
        --arg pub_date "$PUBLICATION_DATE" \
        --arg signature "$SIGNATURE" \
        --arg url "$DOWNLOAD_URL" \
        '{version: $version, notes: $notes, pub_date: $pub_date, platforms: {"darwin-aarch64": {signature: $signature, url: $url}}}' \
        > "$CANDIDATE_METADATA"
    jq -e --arg version "$VERSION" --arg url "$DOWNLOAD_URL" \
        '.version == $version and .platforms["darwin-aarch64"].url == $url and (.platforms["darwin-aarch64"].signature | length > 0)' \
        "$CANDIDATE_METADATA" >/dev/null

    ditto "$CANDIDATE_METADATA" "$REPO_ROOT/latest.json"
    PRE_METADATA_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
    git -C "$REPO_ROOT" add -- latest.json
    [[ -z "$(git -C "$REPO_ROOT" diff --cached --name-only | grep -v '^latest.json$' || true)" ]] || fail 'Unexpected staged files before latest.json commit'
    git -C "$REPO_ROOT" commit -m "release: publish Anarlog $VERSION"
    git -C "$REPO_ROOT" push origin "HEAD:$FEED_BRANCH"
    PUBLISHED_METADATA_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"

    PUBLIC_METADATA="$OUTPUT_DIR/public-latest.json"
    for attempt in 1 2 3 4 5 6; do
        if curl --fail --location --output "$PUBLIC_METADATA" "$FEED_URL" \
            && jq -e --arg version "$VERSION" --arg url "$DOWNLOAD_URL" \
                '.version == $version and .platforms["darwin-aarch64"].url == $url and (.platforms["darwin-aarch64"].signature | length > 0)' \
                "$PUBLIC_METADATA" >/dev/null; then
            break
        fi
        [[ "$attempt" != '6' ]] || fail 'Public latest.json did not converge to the published metadata'
        sleep 2
    done
    PUBLIC_SIGNATURE="$OUTPUT_DIR/public-signature.sig"
    jq -r '.platforms["darwin-aarch64"].signature' "$PUBLIC_METADATA" > "$PUBLIC_SIGNATURE"
    cargo run --quiet -p updater-core --bin verify-updater-signature -- \
        "$REMOTE_ARCHIVE" "$PUBLIC_SIGNATURE" "$STABLE_CONFIG"
    PUBLISHED_METADATA_HEAD=""
fi

printf '\nAnarlog release prepared successfully.\n'
printf 'Version: %s\nArchive SHA-256: %s\n' "$VERSION" "$ARCHIVE_SHA256"
if [[ "$PUBLISH" == '1' ]]; then
    printf 'Publication: public asset and signed latest.json verified\n'
else
    printf 'Publication: not requested\n'
fi
