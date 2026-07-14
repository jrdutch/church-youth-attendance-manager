#!/bin/bash
# Start the Church Attendance app (production mode)
# Cloudflare tunnel is managed separately by church.cloudflared.plist (auto-restarts via launchd)
#
# Runs `next build` + `next start` instead of the dev server:
# the dev server rebuilds files with new names on every restart, which
# breaks anyone who has the site open. Production builds are stable.

cd "$(dirname "$0")"

# First run: use the placeholder logo until the church adds their own
if [ ! -f public/logo.png ] && [ -f public/logo.default.png ]; then
  cp public/logo.default.png public/logo.png
fi

# Kill any previous Next.js instance so port 3000 is always free
pkill -f "next dev" 2>/dev/null
pkill -f "next start" 2>/dev/null
sleep 1
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1

# Build only when needed: no build yet, or source changed since the last one.
# Keeps crash-recovery restarts fast (launchd restarts us via KeepAlive).
NEEDS_BUILD=0
if [ ! -f .next/BUILD_ID ]; then
  NEEDS_BUILD=1
elif [ -n "$(find src public package.json -newer .next/BUILD_ID -print -quit 2>/dev/null)" ]; then
  NEEDS_BUILD=1
fi

if [ "$NEEDS_BUILD" = "1" ]; then
  echo ""
  echo "  Building Youth Attendance Manager..."
  echo ""
  if ! npm run build > /tmp/church-build.log 2>&1; then
    echo "  BUILD FAILED — see /tmp/church-build.log"
    echo "  Falling back to previous build if one exists..."
  fi
else
  echo "  Build is up to date — starting immediately."
fi

# Start the production server
npm run start > /tmp/church-app.log 2>&1 &
APP_PID=$!

# Wait for the app to be ready on port 3000
for i in $(seq 1 30); do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Show the public URL if one is configured in .env.local
PUBLIC_URL=$(grep '^NEXT_PUBLIC_APP_URL=' .env.local 2>/dev/null | cut -d= -f2)

echo "  ============================================"
echo "  Youth Attendance Manager is running!"
echo ""
echo "  Local:   http://localhost:3000"
if [ -n "$PUBLIC_URL" ]; then
  echo "  Public:  $PUBLIC_URL"
  echo "  Kiosk:   $PUBLIC_URL/kiosk"
fi
echo "  ============================================"
echo ""
echo "  Press Ctrl+C to stop."

trap "echo ''; echo 'Stopping...'; kill $APP_PID 2>/dev/null; exit 0" INT TERM
wait $APP_PID
