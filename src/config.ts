/**
 * App branding — configure in .env.local (see .env.example).
 *
 * These use NEXT_PUBLIC_ variables so they work in both server and browser
 * code. Changing them requires a rebuild (start.sh rebuilds automatically
 * when files change).
 */

/** App title shown in the navbar, login screen, kiosk, and browser tab. */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Youth Attendance';

/** Short name of your church/parish, used in labels like "Parents are ___ members". */
export const CHURCH_SHORT_NAME = process.env.NEXT_PUBLIC_CHURCH_SHORT_NAME || 'parish';

/** Public URL of the app (used in email footers). Leave empty to omit links. */
export const APP_PUBLIC_URL = process.env.NEXT_PUBLIC_APP_URL || '';
