---
description: Create an event's four social posts in Buffer (as dated drafts) through the Buffer connector
argument-hint: events/YYYY-MM-DD-speaker-slug.yml
allowed-tools: Read, Bash(node scripts/schedule.js:*), Bash(curl -sSIL:*)
---

Create the social posts for `$ARGUMENTS` in Buffer.

This uses the **Buffer connector's** tools: `list_channels`, `create_post` and `get_post`. If the connector isn't connected, stop and tell the user to connect it (Claude settings → Connectors → Buffer).

## 1. Get the plan

Run `node scripts/schedule.js plan $ARGUMENTS --json`.

- If it fails because the status isn't approved, stop and tell the user to approve the copy first.
- The JSON gives you `organization_id`, `channel_ids` (empty means every connected channel), `save_to_draft`, `posts` and `skipped`.
- Each post has:
  - `key`
  - `due_at_by_service`: local time with its offset for each channel service (`twitter`, `bluesky`, `linkedin`, `instagram`, and `other` for anything else). Each platform posts at its own best time (`POST_TIMES` in `scripts/lib/config.js`). Pass the time to Buffer exactly as given.
  - `passed_services`: services whose time for this post has already passed today. Don't create the post on those channels.
  - `due_at`: the same as `due_at_by_service.other`.
  - `text`
  - `image`: a URL, or `null`
  - `note`: for example, an announce post moved because the event was confirmed late
  - `created`: the Buffer posts already made for this key

**Use `text` exactly as given.** Don't reword or shorten it. The copy was approved in the event file, and edits belong there.

## 2. Pick channels

Call `list_channels` with `organization_id`. Use the channels whose IDs are in `channel_ids`, or, if that list is empty, every channel that isn't disconnected or locked. Tell the user which channels you're posting to.

## 3. Create the posts

If the posts have an `image`, first check that the link loads: `curl -sSIL <url>` should end in `200` with `content-type: image/png`. If it doesn't, the card hasn't been pushed to GitHub yet. Tell the user to commit and push `cards/`, or, if they'd rather, create the posts without the image and say so.

For each post, and for each chosen channel that isn't already in the post's `created` list:

1. Look up the channel's time: `due_at_by_service[service]`, or `due_at_by_service.other` if the service isn't listed. If the service (or `other`) is in `passed_services`, skip this channel and say so in the report.
2. Call `create_post` with:
   - `channelId`
   - `text`
   - `schedulingType: "automatic"`
   - `mode: "customScheduled"`
   - `dueAt` set to that channel's time
   - `saveToDraft` set to `save_to_draft`
   - If `image` is set, `assets: [{ image: { url, metadata: { altText } } }]`. For `altText`, use `"<generated.title> — Lansing Codes speaker card"`.
   - For Instagram, `metadata: { instagram: { type: "post", shouldShareToFeed: true } }`.
3. Skip Instagram and TikTok channels when there's no image, because they require one. Say so in the report.
4. **Record the post immediately** with `node scripts/schedule.js record $ARGUMENTS <key> <channelId> <service> <buffer post id> <that channel's time>`. Do this after every successful `create_post`, so a failure partway through never leads to duplicates on the next run.
5. If `create_post` fails (a plan limit, for example), stop. Report what was created and what wasn't.

After the first post, call `get_post` on it and confirm that its `dueAt` matches. If a draft lost its date, tell the user.

## 4. Report

Give a short table: post, date and time, channel, and status (created, already existed, or skipped). Then add:

- Any `note` or `skipped` entries from the plan.
- Next step: review the drafts in Buffer and schedule them.
