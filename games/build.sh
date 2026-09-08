#!/usr/bin/env bash
# يبني ملف HTML واحد مكتفٍ بذاته من مصادر src/
set -euo pipefail
cd "$(dirname "$0")"
OUT="index.html"
{
  cat src/head.html
  echo '<style>'
  cat src/style.css
  echo '</style>'
  echo '</head>'
  echo '<body>'
  cat src/body.html
  echo '<script>'
  echo '"use strict";'
  cat src/engine.js
  for f in src/games/*.js; do cat "$f"; done
  cat src/app.js
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > "$OUT"
echo "بُني $OUT — $(wc -c < "$OUT") بايت · $(grep -c "^G({id:" src/games/*.js | awk -F: '{s+=$2} END {print s}') لعبة"
