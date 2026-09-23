# Lansing Codes Promo Pipeline

This repo turns one YAML file per event into every promotional artifact Lansing Codes needs: the Meetup listing, the speaker card images (via Canva autofill), a month of social posts (via Buffer bulk upload), and the monthly email digest (pasted into Mailchimp).

Nothing here posts anything automatically. Scripts write files to `out/` (and `/make-cards` creates designs in your Canva account). A person reviews them and uploads them by hand.

See [plan.md](plan.md) for the full plan, the open questions and the decisions log.

---

## The pipeline at a glance

```
speaker sends details
        │
        ▼
events/YYYY-MM-DD-speaker-slug.yml      ← organizer fills in the top half
        │
        ▼  /draft-event events/<file>.yml   (Claude Code slash command)
        │
generated: block filled in              ← organizer reviews the git diff, edits, sets status: approved
        │
        ├──▶ /make-cards <file> → Canva autofill → out/images/<stem>-{square,story,banner}.png
        ├──▶ npm run schedule   → out/buffer-schedule.csv   → Buffer bulk upload (with the PNGs)
        ├──▶ copy generated.description_long               → paste into the Meetup event
        └──▶ npm run digest -- 2026-10 → out/digest-2026-10.html/.txt → Mailchimp, sent on the 1st
```

> **Build status (2026-09-22):** Tasks 1–3 are done: the scaffold, this file, the schema, the fixtures, `/draft-event` and `/make-cards`. The `npm run schedule | digest` scripts (tasks 4–5) are **not built yet**. The steps below describe the target workflow.
>
> **How `/draft-event` works:** Claude writes the copy, and [`scripts/draft_event.js`](scripts/draft_event.js) is the only thing that writes to the file. The script rewrites only the text from `generated:` down, so everything above it stays byte-for-byte as you wrote it. It rejects copy that breaks the length or hashtag limits, warns on avoided words ([`scripts/lib/voice.js`](scripts/lib/voice.js); keep that list in sync with the one below), and resets `status` to `draft`.

### Step by step

1. **Speaker confirms.** Copy `events/_template.yml` to `events/YYYY-MM-DD-speaker-slug.yml`. Paste what the speaker sent into `description_raw` and `speaker.bio_raw` exactly as sent. Don't clean it up. Confirm date, times and venue.
2. **Draft.** In Claude Code, run `/draft-event events/<file>.yml`. It fills in `generated:` and nothing else.
3. **Review.** Read the `git diff`. Edit anything you like directly in the YAML. Check `generated.gaps` and either get the missing info from the speaker or accept the gap. Then set `status: approved` and commit.
4. **Images.** Run `/make-cards events/<file>.yml` (add `--photo <image-url>` to set the speaker photo; it's saved to `speaker.photo_url`). It autofills the square, story and banner templates in Canva through the Canva connector, files the designs in the Canva folder "Lansing Codes Event Cards", and saves `out/images/<event-file-stem>-{square,story,banner}.png`. Add `--preview` to see cards before the copy is approved. If a speaker photo URL is set, it's used; otherwise the photo circle shows the Lansing Codes logo.
   *Fallback without the connector:* `npm run canva:csv` writes `out/canva-bulk.csv` (approved events; `-- --from/--to YYYY-MM-DD` to filter). Upload it to Canva bulk create on the templates; columns auto-match the field names. Drop photos in by hand.
5. **Social.** Run `npm run schedule` and upload `out/buffer-schedule.csv` to Buffer. Buffer takes one channel per upload, so repeat for each channel and choose "Save as Drafts". Its `Image URL` column needs a public URL, so either host the PNGs first or attach them in Buffer by hand. Then review the drafts.
6. **Meetup.** Paste `generated.description_long` into the Meetup event and use the banner PNG as the event image. Once it's live, set `status: published`.
7. **Email.** On the 1st of the month, run `npm run digest -- YYYY-MM`, paste the HTML into Mailchimp, send a test to yourself, then send it.

---

## About Lansing Codes

- **What it is:** Lansing Codes is a nonprofit community for developers, coding enthusiasts, product people and anyone curious about tech in the Lansing, Michigan area. It is independent of any employer.
- **What it does:** a free monthly meetup (usually the **3rd Tuesday**, 6–8 PM), a calendar of every local tech group's events at lansing.codes, a community Slack, and a monthly newsletter.
- **Mission line (from the Meetup group):** "We aim to foster a thriving tech community, inspiring members to learn to code and helping experienced coders acquire new skills."
- **Tagline (from lansing.codes):** "events and resources for Lansing coders". Keep it lowercase, as the site does.

### Boilerplate

Use the short line wherever there's space for an "about us" sentence. Use the long version at the bottom of Meetup listings and in the email footer.

- **Short:** Lansing Codes is a free, volunteer-run community for anyone in Greater Lansing who codes or wants to.
- **Long:** Lansing Codes is a nonprofit community for developers, coding enthusiasts, and anyone curious about tech in Greater Lansing. We host a free meetup every month, keep a calendar of every local tech event at lansing.codes, and hang out on Slack at slack.lansing.codes. All events follow our Code of Conduct: https://www.lansing.codes/code-of-conduct

### Links

| What | URL |
|---|---|
| Website | https://www.lansing.codes |
| Meetup group | https://www.meetup.com/lansing-codes-meetup/ |
| Slack invite | https://slack.lansing.codes |
| Code of Conduct | https://www.lansing.codes/code-of-conduct |
| Newsletter signup | https://www.lansing.codes/#newsletter |
| GitHub | https://github.com/lansingcodes |
| Facebook | https://www.facebook.com/LansingCodes/ |
| X / Twitter | https://twitter.com/lansingcodes |
| Email | lansingcodes@gmail.com |

---

## Voice and tone

The house voice is **a friendly local developer telling a friend about a talk they're looking forward to**. Our best listings sound like this: concrete, a bit wry, specific about what you'll actually see, and honest about what the talk isn't.

**Do:**

- **Lead with the specific thing.** Name the tool, the problem, or the surprising result. Say "It merged two people into one person, and the diff looked completely normal," not "learn about the challenges of AI memory".
- **Say what happens in the room.** Live demo or slides, how much Q&A, whether a laptop helps.
- **Say who it's for,** and say it generously. Beginners are always welcome. If no coding is needed, say so plainly.
- **Keep the speaker's own voice.** If the speaker wrote in first person, the Meetup listing can stay in first person. Captions and the email are in the Lansing Codes voice ("we", or neutral third person).
- **Keep it short.** Use short sentences and plain words. One idea per sentence.
- **Keep facts exact.** Date, time, venue and food exactly as the organizer entered them.

**Don't:**

- Hype the event. Nothing is "epic", "must-attend" or "not to be missed".
- Pad with filler: "In today's fast-paced world…", "Join us for an exciting evening of…", "Whether you're X or Y, there's something for everyone" (at most once, and only if it's true).
- Invent anything. That covers speaker credentials, job titles, employers, years of experience, "renowned", "industry-leading" and audience outcomes the speaker didn't promise. **If it isn't in the input, it isn't in the copy.** Put it in `generated.gaps` instead.
- Make captions about logistics alone. At least one caption (the week-before one) has to give people a reason to care about the topic.
- Stack emoji. Use at most one per caption, and none is fine.
- Use ALL CAPS for emphasis, or more than one exclamation mark in a piece.

### Words and phrases to avoid

> unlock · unleash · supercharge · level up · game-changer / game-changing · revolutionary · cutting-edge · deep dive / dive into · delve · leverage (as a verb) · synergy · seamless · robust (outside a technical claim) · harness the power · journey · elevate · empower · ninja / rockstar / guru · thought leader · don't miss out · limited seats (unless true) · "exciting" · "amazing" · "in today's…" · "navigate the landscape" · "tapestry"

Also avoid gendered group address ("guys"). Use "folks", "everyone", or "y'all".

### Spelling and formatting conventions

- **Times:** `6:00 PM`, with a space and capital PM. **Ranges:** `6:00–8:00 PM`, with an en dash.
- **Dates:** in running text, `Tuesday, October 20`. On images and in compact spots, `Tue, Oct 20`. Don't write ordinals ("20th").
- The group is **Lansing Codes**: two words, both capitalized, never "LansingCodes" except in a hashtag or handle.
- Keep product names exactly as their makers write them: Claude Code, GitHub, JavaScript, .NET, `git diff`. Put code and commands in backticks where Markdown renders (Meetup does, Buffer doesn't).
- American spelling in Lansing Codes copy. A speaker's own quoted text keeps its spelling.

---

## Hashtags

- Always include **#LansingCodes**.
- Add **#LansingTech** on announce and week-before posts.
- Add **one or two** topic tags that match the talk: `#ClaudeCode`, `#AI`, `#JavaScript`, `#OpenSource`, `#DevOps`, and so on. Use CamelCase so screen readers can read them.
- Never use more than **3 hashtags** per caption. Put them at the end, not inline.

---

## Captions: lengths and cadence

Buffer sends one caption to every connected channel. Each caption in `generated.captions` must therefore fit the strictest channel:

| Platform | Hard limit | Our target |
|---|---|---|
| X / Twitter | 280 (links count as 23) | **≤ 280 total, including link and hashtags** |
| Bluesky | 300 | fits if X fits |
| Threads / Mastodon | 500 | fits if X fits |
| Instagram | 2,200 | fits; link isn't clickable, so add "link in bio" only if we post there |
| LinkedIn | 3,000 | fits |
| Facebook | 63,206 | fits |

**Rule:** each caption is at most **280 characters**, including the registration link written out in full and the hashtags. `/draft-event` counts characters and must stay under the limit.

### Posting cadence (per event)

| Caption key | When | Angle |
|---|---|---|
| `announce` | 21 days before | What the talk is, who's speaking, date and venue. |
| `week_before` | 7 days before | **The topic, not the logistics.** One interesting idea, question or result from the talk. |
| `day_before` | 1 day before | "Tomorrow": time, venue, food. Short. |
| `day_of` | Event day | "Tonight": time and venue. The organizer may replace this with a post-event photo instead. |

The default post time is **12:00 PM Eastern** (set in `scripts/lib/config.js`). If an event is confirmed late and the announce date has already passed, `npm run schedule` moves the announce post to tomorrow and flags it in its output.

---

## Event file schema

One YAML file per event in `events/`, named `YYYY-MM-DD-speaker-slug.yml` (e.g. `2026-10-20-adam-broadbent.yml`). The top half belongs to the **organizer**. The `generated:` block belongs to **`/draft-event`**, and the organizer edits it after review. Start from [`events/_template.yml`](events/_template.yml). Files starting with `_` are ignored by every script.

```yaml
# --- Organizer input ---
date: 2026-10-20              # YYYY-MM-DD, unquoted
start_time: "18:00"           # 24-hour, quoted
end_time: "20:00"
title: "Raw title from speaker"
speaker:
  name: "Jane Doe"
  title: "Staff Engineer"     # leave "" if unknown — never guess
  company: "Example Co"       # leave "" if unknown
  photo_url: "https://..."    # direct image URL, or ""
  bio_raw: |
    Whatever the speaker sent, if anything.
description_raw: |
  Whatever the speaker sent, verbatim.
venue:
  name: "Venue Name"
  address: "123 Main St, Lansing, MI"
  notes: "Pizza provided; drinks available for purchase."   # optional
registration_link: "https://www.meetup.com/..."             # any URL, not Meetup-specific

# --- Generated by /draft-event (organizer reviews) ---
generated:
  title: ""                   # cleaned-up title, ≤ 70 chars
  hook: ""                    # one line, ≤ 90 chars, used on the image and in the email
  description_long: ""        # Meetup listing body (Markdown)
  speaker_bio_short: ""       # 1–2 sentences from bio_raw only; "" if no bio given
  captions:
    announce: ""
    week_before: ""
    day_before: ""
    day_of: ""
  email_blurb: ""             # 2–3 sentences, no date/time (the digest adds those)
  gaps: []                    # facts the copy had to work around, e.g. "No speaker photo"
status: draft                 # draft | approved | published
```

**Status lifecycle:** `draft` is where every file starts, and `/draft-event` output lands here. `approved` means the organizer has reviewed it, and the scripts only export approved or published events. `published` means it's live on Meetup; exports still include it.

**Ownership rules:**

- `/draft-event` never changes anything outside `generated:`. The organizer can edit anything.
- Rerunning `/draft-event` on an `approved` or `published` event asks for confirmation first, because it replaces hand-edited copy.

### Standard Meetup listing shape

`generated.description_long` follows this outline. Leave out any section with no input behind it.

1. **The pitch.** Two or three short paragraphs built from `description_raw`. Keep the speaker's voice and their best line.
2. **About the speaker.** Taken from `bio_raw` only. Leave the section out if there's no bio.
3. **Agenda.** The standard Lansing Codes agenda, shifted to match `start_time` and `end_time`:
   ```
   6:00 PM – Arrival and networking
   6:15 PM – Announcements and icebreakers
   6:30 PM – Presentation
   7:30 PM – Wrap-up and networking
   ```
4. **Venue notes.** From `venue.notes`, e.g. food and drinks.
5. **Boilerplate.** The long version from above.

---

## Repo layout

```
CLAUDE.md                  this file
plan.md                    plan, open questions, decisions log
events/                    one YAML per real event (+ _template.yml)
fixtures/                  test data — never read by default
  events/                  sample event files for script tests
  2026-10-20-git-diff-my-brain/   the hand-run acceptance fixture
templates/email.html       monthly digest (HTML)
templates/email.txt        monthly digest (plain text)
scripts/                   Node CLI scripts (export_canva, schedule, digest)
scripts/lib/               shared helpers + config (column mappings, post times)
.claude/commands/          /draft-event, /make-cards
out/                       generated files (gitignored)
```

## Conventions for contributors

- **Node 22+, ES modules, one dependency (`yaml`).** Add others only if they save real effort. Tests use `node --test`.
- Every script accepts `--events <dir>` (default `events/`) so tests can run against `fixtures/events/`.
- Script output is deterministic: same input, same bytes. Sort by date, then filename.
- Anything tied to an outside tool's format goes in `scripts/lib/config.js`, not scattered through the code. That covers Canva template IDs and field names, Buffer columns, timezone and post times. If you rename a field in a Canva template, rename it in `CANVA_FIELDS` too.
- Times are **America/Detroit**.
- Don't commit anything in `out/`.
