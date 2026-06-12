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

echo "Creating dist directory..."
mkdir -p "$DIST_DIR"

minify

echo "Copying assets to dist..."
find "$DIR" -maxdepth 1 -type f \
  \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.svg' \) \
  -exec cp {} "$DIST_DIR"/ \;
cp -R "$DIR/vendor" "$DIST_DIR"/

echo "Build complete: $DIST_DIR"
