#!/bin/bash

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
TMP_DIR="$(mktemp -d)"

PDFJS_VERSION="${PDFJS_VERSION:-latest}"
PDF_LIB_VERSION="${PDF_LIB_VERSION:-latest}"
FONTKIT_VERSION="${FONTKIT_VERSION:-latest}"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

npm_field() {
  local package="$1"
  local version="$2"
  local field="$3"

  npm view "${package}@${version}" "$field" --silent
}

download_package() {
  local package="$1"
  local requested_version="$2"
  local archive_path="$3"
  local actual_version
  local tarball_url

  actual_version="$(npm_field "$package" "$requested_version" version)"
  tarball_url="$(npm_field "$package" "$requested_version" dist.tarball)"

  if [ -z "$actual_version" ] || [ -z "$tarball_url" ]; then
    echo "Could not resolve $package@$requested_version" >&2
    exit 1
  fi

  echo "Downloading $package@$actual_version..." >&2
  curl -fsSL "$tarball_url" -o "$archive_path"

  printf '%s' "$actual_version"
}

extract_pdfjs() {
  local archive_path="$1"
  local dest="$DIR/vendor/pdfjs-dist"

  rm -rf "$dest"
  mkdir -p "$dest"
  tar -xzf "$archive_path" -C "$dest" --strip-components=1 \
    package/LICENSE \
    package/build/pdf.mjs \
    package/build/pdf.worker.mjs \
    package/cmaps \
    package/iccs \
    package/standard_fonts \
    package/wasm
}

extract_pdf_lib() {
  local archive_path="$1"
  local dest="$DIR/vendor/pdf-lib"

  rm -rf "$dest"
  mkdir -p "$dest"
  tar -xzf "$archive_path" -C "$dest" --strip-components=1 package/LICENSE.md
  tar -xzf "$archive_path" -C "$dest" --strip-components=2 package/dist/pdf-lib.esm.js
}

extract_fontkit() {
  local archive_path="$1"
  local dest="$DIR/vendor/fontkit"

  rm -rf "$dest"
  mkdir -p "$dest"
  tar -xzf "$archive_path" -C "$dest" --strip-components=2 package/dist/fontkit.umd.js
}

update_notices() {
  local pdfjs_version="$1"
  local pdf_lib_version="$2"
  local fontkit_version="$3"

  PDFJS_VERSION="$pdfjs_version" \
  PDF_LIB_VERSION="$pdf_lib_version" \
  FONTKIT_VERSION="$fontkit_version" \
  perl -0pi -e '
    s/PDF\.js [^:]+:/PDF.js $ENV{PDFJS_VERSION}:/;
    s/pdf-lib [^:]+:/pdf-lib $ENV{PDF_LIB_VERSION}:/;
    s/\@pdf-lib\/fontkit [^:]+:/\@pdf-lib\/fontkit $ENV{FONTKIT_VERSION}:/;
  ' "$DIR/vendor/THIRD_PARTY_NOTICES.md"
}

require_command curl
require_command npm
require_command perl
require_command tar

PDFJS_ARCHIVE="$TMP_DIR/pdfjs-dist.tgz"
PDF_LIB_ARCHIVE="$TMP_DIR/pdf-lib.tgz"
FONTKIT_ARCHIVE="$TMP_DIR/fontkit.tgz"

PDFJS_ACTUAL_VERSION="$(download_package "pdfjs-dist" "$PDFJS_VERSION" "$PDFJS_ARCHIVE")"
PDF_LIB_ACTUAL_VERSION="$(download_package "pdf-lib" "$PDF_LIB_VERSION" "$PDF_LIB_ARCHIVE")"
FONTKIT_ACTUAL_VERSION="$(download_package "@pdf-lib/fontkit" "$FONTKIT_VERSION" "$FONTKIT_ARCHIVE")"

extract_pdfjs "$PDFJS_ARCHIVE"
extract_pdf_lib "$PDF_LIB_ARCHIVE"
extract_fontkit "$FONTKIT_ARCHIVE"
update_notices "$PDFJS_ACTUAL_VERSION" "$PDF_LIB_ACTUAL_VERSION" "$FONTKIT_ACTUAL_VERSION"

echo
echo "Updated vendored dependencies:"
echo "  pdfjs-dist:       $PDFJS_ACTUAL_VERSION"
echo "  pdf-lib:          $PDF_LIB_ACTUAL_VERSION"
echo "  @pdf-lib/fontkit: $FONTKIT_ACTUAL_VERSION"
echo
echo "Next: run ./build.sh, test PDF preview/export, then commit the vendor changes."
