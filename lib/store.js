import fs from "fs";
import path from "path";
import os from "os";

export const DATA_DIR = path.join(os.homedir(), ".ccusage");
export const CONFIG_FILE = path.join(DATA_DIR, "config.json");
export const USAGE_FILE = path.join(DATA_DIR, "usage.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadConfig() {
  ensureDir();
  if (!fs.existsSync(CONFIG_FILE)) return { mode: null, limit: null };
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); }
  catch { return { mode: null, limit: null }; }
}

export function saveConfig(config) {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function loadUsage() {
  ensureDir();
  if (!fs.existsSync(USAGE_FILE)) return { sessions: [] };
  try { return JSON.parse(fs.readFileSync(USAGE_FILE, "utf8")); }
  catch { return { sessions: [] }; }
}

export function saveUsage(usage) {
  ensureDir();
  fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
}

export function appendSession(session) {
  const usage = loadUsage();
  usage.sessions.push(session);
  saveUsage(usage);
}
