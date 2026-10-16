// Small client for the addons.mozilla.org API v5, for steps web-ext sign
// does not cover.
//
//   node scripts/amo.mjs status    # listing and review status
//   node scripts/amo.mjs listing   # upload icon, screenshots and privacy policy
//
// Credentials come from the same chmod-600 file as scripts/amo-submit.sh
// (default ~/.config/colluvio/amo.env, override with AMO_ENV_FILE). They are
// only used to sign short-lived JWTs and are never printed.
import { createHmac, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const API = (process.env.AMO_BASE_URL || "https://addons.mozilla.org/api/v5").replace(/\/$/, "");
const manifest = JSON.parse(await readFile(`${root}extension/manifest.json`, "utf8"));
const GUID = manifest.browser_specific_settings.gecko.id;

const SCREENSHOTS = [
  ["amo/screenshots/screenshot-1.png", "One click copies the transcript YouTube shows, as plain text."],
  ["amo/screenshots/screenshot-2.png", "Optional timestamps: [MM:SS] before every line."],
  ["amo/screenshots/screenshot-3.png", "Clear messages instead of partial copies."],
];

async function loadCredentials() {
  const file = process.env.AMO_ENV_FILE || `${homedir()}/.config/colluvio/amo.env`;
  const info = await stat(file).catch(() => null);
  if (!info) throw new Error(`Missing ${file}. See docs/PUBLISHING.md (step 2).`);
  if ((info.mode & 0o077) !== 0) throw new Error(`${file} must be readable only by you: chmod 600 ${file}`);
  const env = Object.fromEntries(
    (await readFile(file, "utf8"))
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, "$2")];
      })
  );
  if (!env.WEB_EXT_API_KEY || !env.WEB_EXT_API_SECRET) {
    throw new Error(`${file} must define WEB_EXT_API_KEY and WEB_EXT_API_SECRET.`);
  }
  return { key: env.WEB_EXT_API_KEY, secret: env.WEB_EXT_API_SECRET };
}

const b64url = (data) => Buffer.from(data).toString("base64url");

/** HS256 JWT as described in Mozilla's API authentication docs. */
function jwt({ key, secret }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: key, jti: randomUUID(), iat: now, exp: now + 60 }));
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function api(creds, method, path, body) {
  const headers = { Authorization: `JWT ${jwt(creds)}` };
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> HTTP ${res.status}: ${typeof data === "string" ? data.slice(0, 300) : JSON.stringify(data)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const addonPath = `/addons/addon/${encodeURIComponent(GUID)}/`;

async function status(creds) {
  const addon = await api(creds, "GET", addonPath);
  const versions = await api(creds, "GET", `${addonPath}versions/?filter=all_with_unlisted`);
  const latest = versions.results[0];
  const summary = {
    name: addon.name && (addon.name["en-US"] || Object.values(addon.name)[0]),
    slug: addon.slug,
    url: addon.url,
    addon_status: addon.status, // "nominated" = awaiting review, "public" = approved and listed
    is_disabled: addon.is_disabled,
    current_public_version: addon.current_version ? addon.current_version.version : null,
    latest_version: latest && {
      version: latest.version,
      channel: latest.channel,
      file_status: latest.file && latest.file.status, // "unreviewed" until approved, then "public"
      file_url: latest.file && latest.file.url,
    },
    icon: Boolean(addon.icons && Object.keys(addon.icons).length && !String(addon.icon_url).includes("default")),
    previews: (addon.previews || []).length,
    has_privacy_policy: addon.has_privacy_policy,
    homepage: addon.homepage && addon.homepage.url,
    support_url: addon.support_url && addon.support_url.url,
    support_email: addon.support_email,
  };
  console.log(JSON.stringify(summary, null, 2));
  return addon;
}

async function fileBlob(rel, type) {
  return new Blob([await readFile(`${root}${rel}`)], { type });
}

async function listing(creds) {
  const addon = await api(creds, "GET", addonPath);

  const icon = new FormData();
  icon.append("icon", await fileBlob("extension/icons/icon-128.png", "image/png"), "icon-128.png");
  await api(creds, "PATCH", addonPath, icon);
  console.log("icon: uploaded");

  const existing = addon.previews || [];
  if (existing.length >= SCREENSHOTS.length) {
    console.log(`screenshots: ${existing.length} already present, not uploading again`);
  } else {
    for (const [i, [file, caption]] of SCREENSHOTS.entries()) {
      if (i < existing.length) continue;
      const form = new FormData();
      form.append("image", await fileBlob(file, "image/png"), file.split("/").pop());
      form.append("position", String(i));
      const preview = await api(creds, "POST", `${addonPath}previews/`, form);
      await api(creds, "PATCH", `${addonPath}previews/${preview.id}/`, { caption: { "en-US": caption }, position: i });
      console.log(`screenshot ${i + 1}: uploaded`);
    }
  }

  const privacy = (await readFile(`${root}PRIVACY.md`, "utf8")).trim();
  await api(creds, "PATCH", `${addonPath}eula_policy/`, { privacy_policy: { "en-US": privacy } });
  console.log("privacy policy: set");

  await status(creds);
}

const command = process.argv[2];
try {
  const creds = await loadCredentials();
  if (command === "status") await status(creds);
  else if (command === "listing") await listing(creds);
  else {
    console.error("usage: node scripts/amo.mjs status|listing");
    process.exit(2);
  }
} catch (error) {
  console.error(error.message);
  process.exit(error.status === 404 ? 6 : 1);
}
