import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDb } from './db';

const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.cwd(), process.env.BACKUP_DIR)
  : path.resolve(process.cwd(), 'backups');

const KEEP_BACKUPS = 14; // keep two weeks of daily backups
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface BackupInfo {
  filename: string;
  size: number;
  created_at: string;
}

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ── Google Drive mirroring ───────────────────────────────────────
// If Google Drive for desktop is installed, every backup is also copied
// into "My Drive/Church App Backups" and the Drive client syncs it to
// the cloud automatically. Override with GDRIVE_BACKUP_DIR in .env.local.

function findDriveBackupDir(): string | null {
  if (process.env.GDRIVE_BACKUP_DIR) {
    return path.resolve(process.env.GDRIVE_BACKUP_DIR);
  }
  try {
    const cloudStorage = path.join(os.homedir(), 'Library', 'CloudStorage');
    const drives = fs.readdirSync(cloudStorage).filter(d => d.startsWith('GoogleDrive-'));
    if (drives.length === 0) return null;
    const myDrive = path.join(cloudStorage, drives[0], 'My Drive');
    if (!fs.existsSync(myDrive)) return null;
    return path.join(myDrive, 'Church App Backups');
  } catch {
    return null;
  }
}

export function getDriveStatus(): { enabled: boolean; location: string | null } {
  const dir = findDriveBackupDir();
  return { enabled: !!dir, location: dir };
}

function mirrorToDrive(localFile: string, filename: string) {
  const driveDir = findDriveBackupDir();
  if (!driveDir) return;
  try {
    if (!fs.existsSync(driveDir)) fs.mkdirSync(driveDir, { recursive: true });
    fs.copyFileSync(localFile, path.join(driveDir, filename));
    // Prune Drive copies to the same retention as local
    const driveFiles = fs.readdirSync(driveDir)
      .filter(f => f.endsWith('.db'))
      .map(f => ({ f, mtime: fs.statSync(path.join(driveDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const old of driveFiles.slice(KEEP_BACKUPS)) {
      try { fs.unlinkSync(path.join(driveDir, old.f)); } catch {}
    }
  } catch (err) {
    console.error('Google Drive mirror failed (backup still saved locally):', err);
  }
}

export function listBackups(): BackupInfo[] {
  ensureDir();
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db'))
    .map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { filename: f, size: stat.size, created_at: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createBackup(label = 'manual'): Promise<BackupInfo> {
  ensureDir();
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const filename = `church-${stamp}-${label}.db`;
  const dest = path.join(BACKUP_DIR, filename);

  // better-sqlite3's backup API produces a consistent snapshot even mid-write
  await getDb().backup(dest);

  mirrorToDrive(dest, filename);
  pruneOldBackups();
  const stat = fs.statSync(dest);
  return { filename, size: stat.size, created_at: stat.mtime.toISOString() };
}

function pruneOldBackups() {
  const backups = listBackups();
  for (const b of backups.slice(KEEP_BACKUPS)) {
    try { fs.unlinkSync(path.join(BACKUP_DIR, b.filename)); } catch {}
  }
}

export function getBackupPath(filename: string): string | null {
  // Prevent path traversal — only allow plain filenames that exist in the backup dir
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return null;
  const full = path.join(BACKUP_DIR, filename);
  return fs.existsSync(full) ? full : null;
}

/** Create a backup if the newest one is older than 24h. Called opportunistically. */
export async function maybeAutoBackup(): Promise<void> {
  try {
    const backups = listBackups();
    const newest = backups[0];
    if (!newest || Date.now() - new Date(newest.created_at).getTime() > AUTO_BACKUP_INTERVAL_MS) {
      await createBackup('auto');
    }
  } catch (err) {
    console.error('Auto-backup failed:', err);
  }
}
