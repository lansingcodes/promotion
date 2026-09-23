---
description: Generate an event's speaker cards (square, story, banner) in Canva and download the PNGs
argument-hint: events/YYYY-MM-DD-speaker-slug.yml [--photo <url>] [--preview]
allowed-tools: Read, Bash(node scripts/export_canva.js:*), Bash(curl:*), Bash(mkdir -p out/images)
---

Create this event's speaker cards in Canva from the templates, then save the PNGs to `out/images/`. Arguments: `$ARGUMENTS`.

This uses the **Canva connector's** tools: `upload-asset-from-url`, `autofill-design`, `read-design`, `edit-design`, `move-item-to-folder`, `get-export-formats` and `export-design`. If the connector isn't connected, stop and tell the user to either connect it or use the fallback: `npm run canva:csv` plus Canva bulk create.

## 0. Photo argument (optional)

If the arguments include `--photo <url>`, or the user gave a photo link in the same message:

1. Check that the link is a public image: `curl -sSIL "<url>"`. The last response must be `200` with `content-type: image/...`.
   - If it's an HTML page (a LinkedIn profile, for example), ask for the direct image link instead.
   - If the user attached an image file rather than a link, explain that Canva can only fetch images from a public link. Ask for one, or suggest running without a photo and swapping it in by hand in Canva.
2. Save it with `node scripts/export_canva.js set-photo <event file> "<url>"`. This changes only the `speaker.photo_url` line, so every later run reuses the photo.

## 1. Get the card data

Run `node scripts/export_canva.js fields <event file>`. Add `--allow-draft` only if the user passed `--preview`.

- If it fails because the status is `draft`, stop. Tell the user the copy needs `status: approved` first, or that they can rerun with `--preview` to see cards from unapproved copy.
- If it fails because `generated.title` or `generated.hook` is empty, tell them to run `/draft-event` first.

The JSON gives you:
- `templates` (name → `designId`, `title`, `image` path)
- `text`: the text field values
- `photo_url`
- `folder`: the Canva folder the cards go in

**Use the values exactly as given.** Don't reword, shorten or "fix" them. The copy was approved in the event file, and edits belong there.

## 2. Photo

- If `photo_url` is set, upload it with `upload-asset-from-url`, named `<stem> – speaker photo`. The URL comes from the organizer's event file and is already public, so uploading it publishes nothing new. Use the returned asset ID as `speaker_photo: { type: "image", asset_id }` in every autofill.
- If the upload fails, or `photo_url` is `null`, leave `speaker_photo` out. The templates fall back to the Lansing Codes logo. Mention this in the report.

## 3. Autofill each template

For each entry in `templates` (square, story, banner):

1. Call `autofill-design` with `design_id` set to the template's `designId` and `title` set to the template's `title`. Pass every key of `text` as `{ type: "text", text }`, plus the photo if you have one. **Never set `update_in_place`**, because that would overwrite the template.
2. Move the new design into `folder` with `move-item-to-folder`.
3. Check the result:
   - Open it with `read-design`, using `open_transaction: true` and `filter.fields: ["thumbnails"]`.
   - Read it again with that `transaction_id` to get a fresh thumbnail.
   - Cancel the transaction with `edit-design`, `finalize: "cancel"`.
   - Look for text that overflows its area or overlaps the photo circle, and for leftover sample text such as "Adam B." or "Speaker Title · Company" on a different event.
   - If something is wrong, report it. Don't hand-edit the card, since the fix belongs in the template or the copy.

## 4. Download PNGs

Run `mkdir -p out/images`. For each card:

1. Call `get-export-formats` and confirm that `png` is supported.
2. Call `export-design` as PNG.
3. Download the result with `curl -sSfL "<url>" -o <image path from step 1>`.

Show the Canva download URL too, in case `curl` fails.

## 5. Report

Give a short table: template, Canva edit link, local PNG path. Then add:

- Whether a real photo was used or the logo placeholder.
- Anything odd from the visual check.
- Next step: run `npm run schedule` and attach these images in Buffer. The Meetup event image is the banner.
