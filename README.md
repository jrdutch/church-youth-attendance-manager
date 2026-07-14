# Youth Attendance Manager

A free, self-hosted attendance and student management app for parish youth ministries and religious education programs. Built for volunteer catechists and coordinators — not tech people.

Runs on a single computer (a Mac mini in the parish office works great) with a tablet at the classroom door for self check-in.

## Features

**Check-in & safety**
- 🖥️ **Tablet kiosk** — kids tap their name to check in; big touch targets, works offline
- 👋 **Check-out with pickup tracking** — records *who* picked each child up, from their authorized-adults list
- 🚨 **Medical alerts** — allergy/condition warnings pop up at check-in
- 🧑‍🤝‍🧑 **Guest check-in** — visitors sign in with just a name and emergency number; auto-converts to enrolled students after 3 visits

**Student management**
- 📋 Full student profiles: medical info, emergency contacts, sacraments, photo, family links
- 📥 **CSV import** — bring in your whole registration list at once (works great with Flocknote exports)
- 🔗 **Registration webhook** — auto-add students when parents register online (via Zapier/Make)
- 👨‍👩‍👧 Per-group staff permissions — each catechist sees only their class, with granular access to medical/contact info

**Ministry tools**
- ⭐ **Service point system** for teens — log volunteer hours, automatic scholarship tiers, self-serve point lookup on the kiosk
- 🔥 Auto-detects 90%+ attendance for consistency bonuses
- ✝️ **Sacramental prep tracking** (First Communion, Confirmation, OCIC) with alerts when a student misses too many classes
- 💛 **Absence follow-up list** — "these kids haven't been here in 3 weeks" with one-tap family phone numbers
- 🎂 Birthday reminders

**Reports & peace of mind**
- 📊 Attendance reports with CSV export, printable rosters and paper sign-in sheets
- 📧 **Weekly email digest** to the coordinator (attendance, new faces, birthdays, follow-ups)
- 💾 **Automatic daily backups**, mirrored to Google Drive if Drive for desktop is installed
- 📜 Full audit log of every change

## Quick start

Requires [Node.js](https://nodejs.org) 18+ (LTS recommended).

```bash
git clone https://github.com/jrdutch/church-youth-attendance-manager.git
cd church-youth-attendance-manager
npm install

# Create your config
cp .env.example .env.local
# Edit .env.local: set your church name and generate the two secrets:
#   openssl rand -hex 32

# Run it
./start.sh
```

Open http://localhost:3000 and sign in with the default admin account:

> **Email:** `admin@church.local` · **Password:** `admin123`
>
> ⚠️ Change this password immediately (My Account → Change Password).

## Make it yours

| What | How |
|---|---|
| **App name & parish name** | Edit `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_CHURCH_SHORT_NAME` in `.env.local` |
| **Logo** | Replace `public/logo.png` with your own (square PNG, ~256×256) |
| **Colors** | Edit the `primary` and `gold` palettes in `tailwind.config.js` (marked with a comment). Generate a palette from your brand color at [uicolors.app](https://uicolors.app) |
| **Groups/classes** | Admin → Groups (Kindergarten–6th Grade sub-groups are pre-seeded) |
| **Service events & point values** | Edit the `SERVICE_EVENTS` list in `src/lib/db.ts` before first run, or manage rows in the `service_event_types` table |

After changing `.env.local` or colors, restart with `./start.sh` (it rebuilds automatically).

## Staff permissions

Each staff user can be granted access to specific groups with fine-grained permissions:

| Permission | What it allows |
|---|---|
| Take Attendance | Check students in and out |
| View Parent Contacts | See phone numbers and emails |
| View Medical Info | See allergies, medications, conditions |
| Edit Student Records | Add/update student information |

Admins have full access; staff only see what they're granted.

## Hosting it online (optional)

The app works fine on a local network, but a free [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) lets the kiosk and your team reach it from anywhere at your own domain, with no ports opened:

1. Add your domain to Cloudflare (free plan)
2. Create a tunnel pointing `attendance.yourchurch.org` → `http://localhost:3000`
3. Set `NEXT_PUBLIC_APP_URL` in `.env.local`

On macOS, launchd can keep the app and tunnel running automatically with crash recovery — `start.sh` is designed to be run by a LaunchAgent with `KeepAlive` enabled.

## Weekly email digest

Add SMTP settings to `.env.local` (see `.env.example`). For Gmail/Google Workspace, use an [App Password](https://myaccount.google.com/apppasswords). The app then emails a weekly summary automatically — or send one anytime from Admin → Weekly Email.

## Online registration → automatic enrollment

`POST /api/webhook/registration?key=YOUR_WEBHOOK_SECRET` accepts registration form fields (name, birthdate, grade, allergies, contacts, …) and creates the student, medical record, and contacts in one call. Point Zapier or Make at it from your registration platform (built against Flocknote's field names; see `src/app/api/webhook/registration/route.ts` for accepted fields).

## Data & privacy

Everything lives in a single SQLite file (`church.db`) on your computer — no cloud service holds your students' data. The `.gitignore` keeps the database, backups, photos, and secrets out of git. Daily backups are pruned to 14 copies and can be downloaded from Admin → Backups.

## Tech stack

Next.js 15 (App Router) · TypeScript · SQLite (better-sqlite3) · Tailwind CSS (Material Design 3) · JWT auth · zero external services required

## License

MIT — free for any parish, church, or ministry to use and adapt.
