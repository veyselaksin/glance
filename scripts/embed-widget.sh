#!/usr/bin/env bash
# Embeds GlanceWidget.appex into the Wails Glance.app bundle after `wails build`.
# Invoked automatically via wails.json postBuildHooks (darwin/*).
set -euo pipefail

BIN="${1:-}"
if [[ -z "$BIN" ]]; then
  echo "embed-widget: usage: embed-widget.sh <path-to-Glance-binary>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIDGET_DIR="$ROOT/native-widget"
# ${bin} → .../Glance.app/Contents/MacOS/Glance
APP_BUNDLE="$(cd "$(dirname "$BIN")/../.." && pwd)"
PLUGINS="$APP_BUNDLE/Contents/PlugIns"
APPEX_DST="$PLUGINS/GlanceWidget.appex"
ENTITLEMENTS="$WIDGET_DIR/Generated/GlanceWidget.entitlements"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister"

if [[ ! "$APP_BUNDLE" == *.app ]]; then
  echo "embed-widget: expected .app bundle, got: $APP_BUNDLE" >&2
  exit 1
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "embed-widget: xcodegen not found — install with: brew install xcodegen" >&2
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "embed-widget: xcodebuild not found — install Xcode" >&2
  exit 1
fi

echo "embed-widget: building GlanceWidget.appex …"
cd "$WIDGET_DIR"
xcodegen generate

DERIVED="$WIDGET_DIR/.derivedData"
PRODUCTS="$DERIVED/Build/Products/Release"
mkdir -p "$PRODUCTS"

xcodebuild \
  -project GlanceWidget.xcodeproj \
  -target GlanceWidget \
  -configuration Release \
  -sdk macosx \
  CONFIGURATION_BUILD_DIR="$PRODUCTS" \
  MACOSX_DEPLOYMENT_TARGET=14.0 \
  CODE_SIGN_IDENTITY="${CODE_SIGN_IDENTITY:--}" \
  build \
  | tail -5

APPEX_SRC="$PRODUCTS/GlanceWidget.appex"
if [[ ! -d "$APPEX_SRC" ]]; then
  echo "embed-widget: GlanceWidget.appex not found after xcodebuild" >&2
  exit 1
fi

echo "embed-widget: copying into $APP_BUNDLE"
mkdir -p "$PLUGINS"
rm -rf "$APPEX_DST"
ditto "$APPEX_SRC" "$APPEX_DST"

# Match the host app's signing identity (ad-hoc "-" when no Developer ID).
SIGN_ID="-"
if AUTHORITY="$(codesign -dv "$APP_BUNDLE" 2>&1 | awk -F= '/Authority=/{print $2; exit}')"; then
  if [[ -n "$AUTHORITY" && "$AUTHORITY" != "Sign to Run Locally" ]]; then
    SIGN_ID="$AUTHORITY"
  fi
fi

echo "embed-widget: re-signing with identity: ${SIGN_ID}"
codesign --force --sign "$SIGN_ID" --entitlements "$ENTITLEMENTS" --timestamp=none "$APPEX_DST"
codesign --force --deep --sign "$SIGN_ID" --timestamp=none "$APP_BUNDLE"

"$LSREGISTER" -f -R -trusted "$APP_BUNDLE"

echo "embed-widget: GlanceWidget.appex embedded in Glance.app"
