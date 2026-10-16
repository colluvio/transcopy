# Publishing on addons.mozilla.org (AMO)

The goal is a **listed** add-on, publicly available at addons.mozilla.org. Mozilla signs listed add-ons after submission and may review them before or after they become public.

Everything except account creation, credentials and legal acceptance is scripted:

| Step | Who | How |
|---|---|---|
| 1. Mozilla account, Developer Agreement | You | Browser (requires your consent) |
| 2. API credentials, stored locally | You | Browser + a local file outside the repo |
| 3. Submit the listed version with metadata | Script | `scripts/amo-submit.sh` (`web-ext sign --channel listed`) |
| 4. Icon, screenshots, privacy policy | Script | `node scripts/amo.mjs listing` |
| 5. Review status | Script | `node scripts/amo.mjs status` |
| 6. Optional Developer Hub fields | You | Browser (support website, which the API can't set) |

## 1. Account and Developer Agreement (you)

1. Go to https://addons.mozilla.org/developers/ and choose **Log in** (or **Register**). Use a Mozilla account; enable two-step authentication if asked.
2. Set a display name on your profile. Something like "Colluvio.org" makes the listing show the publisher. AMO shows the profile's display name as the author.
3. Open https://addons.mozilla.org/developers/addon/api/key/. On first use, AMO asks you to read and accept the **Firefox Add-on Distribution Agreement** and the **Review Policies**. Accepting them is your decision; the scripts never do it for you.

## 2. API credentials (you)

1. On https://addons.mozilla.org/developers/addon/api/key/ choose **Generate new credentials**. You get a **JWT issuer** (looks like `user:12345678:123`) and a **JWT secret**.
2. Store them in a file only your user can read. Create it with an editor; don't paste the secret into a chat or a shell command that lands in history.

   ```bash
   mkdir -p ~/.config/colluvio
   install -m 600 /dev/null ~/.config/colluvio/amo.env
   nano ~/.config/colluvio/amo.env
   ```

   Contents:

   ```dotenv
   WEB_EXT_API_KEY=user:12345678:123
   WEB_EXT_API_SECRET=<the JWT secret>
   ```

3. `chmod 600` is enforced by the scripts. Never commit this file; `*.env` is in `.gitignore`. You can revoke and regenerate the credentials on the same AMO page at any time.

## 3. Submit

```bash
scripts/amo-submit.sh
```

This runs the tests and lint, then calls:

```bash
web-ext sign --source-dir extension --channel listed \
  --amo-metadata amo/metadata.json --approval-timeout 0
```

- On the first run it creates the listing with the name, slug, summary, description, category, tag, homepage, license (MIT), compatibility (Firefox desktop) and reviewer notes from `amo/metadata.json`.
- Later runs with a higher version in `extension/manifest.json` add new listed versions. Metadata is optional then.
- `--approval-timeout 0` returns once Mozilla accepts the upload instead of waiting for review.
- No source-code upload is needed: the package is the unminified source.

## 4. Listing assets

```bash
node scripts/amo.mjs listing
```

This uploads `extension/icons/icon-128.png`, the three screenshots in `amo/screenshots/` with captions, and `PRIVACY.md` as the privacy policy. It is safe to rerun: screenshots are not uploaded twice.

## 5. Status

```bash
node scripts/amo.mjs status
```

- `addon_status: "nominated"` / `file_status: "unreviewed"`: submitted, awaiting Mozilla.
- `addon_status: "public"` and `current_public_version` set: **publicly listed**.
- Rejections and reviewer messages arrive by email and in the Developer Hub.

## 6. Optional Developer Hub settings (you)

At https://addons.mozilla.org/developers/addons → the add-on → **Edit Product Page**:

- **Support website**: `https://github.com/colluvio/transcopy/issues`. The API cannot set this field.
- Check the listing preview.

## Notes

- **Name.** The add-on is called **Transcopy**, slug `transcopy` (https://addons.mozilla.org/firefox/addon/transcopy/). It was renamed from "Copy YouTube Transcript" before its first submission, because several add-ons with nearly that name already exist on AMO. Both the name and the slug were free on 16 October 2026; if the slug has been taken by the time you submit, `web-ext sign` fails and the slug in `amo/metadata.json` needs changing.
- **Android.** The extension targets Firefox for desktop only. Mobile YouTube uses a different page, so `amo/metadata.json` lists only `firefox` compatibility. `web-ext lint` shows one warning about Firefox for Android versions; it can be ignored because Android isn't targeted.
- **Data collection.** The manifest declares `data_collection_permissions: { "required": ["none"] }`, which AMO requires for new extensions since November 2025. This needs Firefox 140, hence `strict_min_version: 140.0`.

## Status

| Date | Event |
|---|---|
| 2026-10-16 | v1.0.0 built, tested and released on GitHub as "Copy YouTube Transcript". |
| 2026-10-16 | Renamed to Transcopy; v1.0.1 released on GitHub. AMO submission waiting for steps 1–2. |
