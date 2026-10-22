#!/bin/sh
# Launches chrome-devtools-mcp for checking the site in a real browser.
# In the Claude Code cloud container it uses the preinstalled Chromium; elsewhere it finds the installed Chrome.
set -e
ARGS="--headless --isolated --usageStatistics=false --viewport=1440x900"
CLOUD_CHROME=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1)
if [ -n "$CLOUD_CHROME" ]; then
  exec npx -y chrome-devtools-mcp@1.11.0 $ARGS --executablePath="$CLOUD_CHROME" --chromeArg=--no-sandbox "$@"
fi
exec npx -y chrome-devtools-mcp@1.11.0 $ARGS "$@"
