#!/bin/bash
# minify.sh — Minify CSS and JS files
# Produces style.min.css and app.min.js using basic shell-based minification.
# No external tools (terser, csso, etc.) required.

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Minifying CSS..."
# Remove comments, collapse whitespace, trim lines
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
# Remove single-line comments (but not URLs with //), collapse whitespace
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
