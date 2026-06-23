#!/bin/bash

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$DIR/dist"

minify() {
  echo "Minifying CSS..."
  sed \
    -e 's|/\*[^*]*\*\+\([^/*][^*]*\*\+\)*/||g' \
    -e 's/^[[:space:]]*//' \
    -e 's/[[:space:]]*$//' \
    -e '/^$/d' \
    "$DIR/style.css" \
    | tr '\n' ' ' \
    | sed \
      -e 's/[[:space:]]\{2,\}/ /g' \
      -e 's/ *{ */{/g' \
      -e 's/ *} */}/g' \
      -e 's/ *: */:/g' \
      -e 's/ *; */;/g' \
      -e 's/ *, */,/g' \
    > "$DIR/style.min.css"

  echo "Minifying JS..."
  sed \
    -e 's|//[^"'"'"']*$||' \
    -e 's/^[[:space:]]*//' \
    -e 's/[[:space:]]*$//' \
    -e '/^$/d' \
    "$DIR/app.js" \
    | tr '\n' ' ' \
    | sed \
      -e 's/[[:space:]]\{2,\}/ /g' \
    > "$DIR/app.min.js"

  CSS_ORIG=$(wc -c < "$DIR/style.css" | tr -d ' ')
  CSS_MIN=$(wc -c < "$DIR/style.min.css" | tr -d ' ')
  JS_ORIG=$(wc -c < "$DIR/app.js" | tr -d ' ')
  JS_MIN=$(wc -c < "$DIR/app.min.js" | tr -d ' ')

  echo "Done!"
  echo "  style.css: ${CSS_ORIG}B -> style.min.css: ${CSS_MIN}B"
  echo "  app.js:    ${JS_ORIG}B -> app.min.js:    ${JS_MIN}B"
}

integrity_hash() {
  openssl dgst -sha384 -binary "$1" | openssl base64 -A
}

html_escape() {
  sed \
    -e 's/&/\&amp;/g' \
    -e 's/</\&lt;/g' \
    -e 's/>/\&gt;/g' \
    -e 's/"/\&quot;/g' \
    -e "s/'/\&#39;/g"
}

github_repo_url() {
  local remote_url
  remote_url="$(git -C "$DIR" remote get-url origin 2>/dev/null || true)"

  if [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
    printf '%s/%s\n' "${GITHUB_SERVER_URL:-https://github.com}" "$GITHUB_REPOSITORY"
  elif [[ "$remote_url" =~ ^git@github\.com:(.+)\.git$ ]]; then
    printf 'https://github.com/%s\n' "${BASH_REMATCH[1]}"
  elif [[ "$remote_url" =~ ^https://github\.com/(.+)\.git$ ]]; then
    printf 'https://github.com/%s\n' "${BASH_REMATCH[1]}"
  elif [[ "$remote_url" =~ ^https://github\.com/.+ ]]; then
    printf '%s\n' "$remote_url"
  fi
}

update_build_version() {
  echo "Updating build version..."

  local full_hash short_hash repo_url version_html escaped_short
  full_hash="$(git -C "$DIR" rev-parse HEAD 2>/dev/null || true)"
  short_hash="$(git -C "$DIR" rev-parse --short=12 HEAD 2>/dev/null || true)"
  repo_url="$(github_repo_url)"

  if [[ -n "$full_hash" && -n "$short_hash" && -n "$repo_url" ]]; then
    escaped_short="$(printf '%s' "$short_hash" | html_escape)"
    version_html="<span id=\"build-version\">Version <a href=\"$repo_url/commit/$full_hash\" target=\"_blank\" rel=\"noreferrer\">$escaped_short</a></span>"
  elif [[ -n "$short_hash" ]]; then
    escaped_short="$(printf '%s' "$short_hash" | html_escape)"
    version_html="<span id=\"build-version\">Version $escaped_short</span>"
  else
    version_html="<span id=\"build-version\">Version unavailable</span>"
  fi

  BUILD_VERSION_HTML="$version_html" perl -0pi -e '
    s|<span id="build-version">.*?</span>|$ENV{BUILD_VERSION_HTML}|s;
  ' "$DIR/index.html"
}

update_integrity() {
  echo "Updating SRI hashes..."
  CSS_INTEGRITY="sha384-$(integrity_hash "$DIR/style.min.css")"
  JS_INTEGRITY="sha384-$(integrity_hash "$DIR/app.min.js")"

  CSS_INTEGRITY="$CSS_INTEGRITY" JS_INTEGRITY="$JS_INTEGRITY" perl -0pi -e '
    s|<link rel="stylesheet" href="style\.min\.css"(?: integrity="sha384-[^"]+")?>|<link rel="stylesheet" href="style.min.css" integrity="$ENV{CSS_INTEGRITY}">|g;
    s|<script src="app\.min\.js"(?: integrity="sha384-[^"]+")?></script>|<script src="app.min.js" integrity="$ENV{JS_INTEGRITY}"></script>|g;
  ' "$DIR/index.html"
}

echo "Creating dist directory..."
mkdir -p "$DIST_DIR"

minify
update_build_version
update_integrity

echo "Copying assets to dist..."
find "$DIR" -maxdepth 1 -type f \
  \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.svg' \) \
  -exec cp {} "$DIST_DIR"/ \;
rm -rf "$DIST_DIR/vendor"
cp -R "$DIR/vendor" "$DIST_DIR"/

echo "Build complete: $DIST_DIR"
