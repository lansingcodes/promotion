---
description: Draft all promo copy for one event file (fills the generated block only)
argument-hint: events/YYYY-MM-DD-speaker-slug.yml
allowed-tools: Read, Write, Bash(node scripts/draft_event.js:*), Bash(git diff:*)
---

Draft the promotional copy for the event file at `$ARGUMENTS`.

You write the copy. `scripts/draft_event.js` writes the file. **Never edit the event YAML directly.** The script is what guarantees that organizer fields stay untouched and that length limits hold.

## 1. Check status

Run `node scripts/draft_event.js status $ARGUMENTS`.

- If `needs_confirmation` is `true`, the event is `approved` or `published` and its copy has already been reviewed. Stop and ask the user: *"This event is <status>. Redrafting replaces the reviewed copy and resets status to draft. Continue?"* Carry on only after a clear yes, and pass `--confirmed` in step 4.
- If `has_generated_copy` is `true` on a draft, mention that you're replacing the existing draft copy. No confirmation is needed.

## 2. Read the inputs

- Read `CLAUDE.md`, especially **Voice and tone**, **Words and phrases to avoid**, **Hashtags**, **Captions: lengths and cadence**, and **Standard Meetup listing shape**. These rules are binding.
- Read the event file. Your only source of facts is the organizer section: `date`, times, `title`, `speaker.*`, `description_raw`, `venue.*` and `registration_link`.
- For a sense of the target quality, read `fixtures/2026-10-20-git-diff-my-brain/meetup-listing.md`.

## 3. Write the copy

**The facts rule overrides everything else.** Every claim in the copy must trace back to the organizer section. Never invent a speaker's job title, employer, experience, credentials, achievements, audience level, talk length, what attendees will "walk away with", or anything else not stated. When something useful is missing, write around it and add a line to `gaps` instead.

Produce these fields:

- **`title`** (at most 70 characters): the speaker's title, cleaned up. Fix casing and obvious typos, and keep their wording and any wit. If it's already good, keep it exactly.
- **`hook`** (one line, at most 90 characters, no trailing period unless it's a full sentence): the single most specific, interesting thing about the talk. It appears on the speaker card and in the email, so it has to work without the title next to it.
- **`description_long`** (Markdown): follow the **Standard Meetup listing shape** in CLAUDE.md.
  - Pitch paragraphs come from `description_raw`. If the speaker wrote well in first person, keep their text, lightly edited. If the input is thin, write two or three short paragraphs using **only** the stated facts. Short is better than padded.
  - Include "About the speaker" only when `bio_raw` has content.
  - Shift the agenda to match `start_time` and `end_time`.
  - Include venue notes only if `venue.notes` is set.
  - End with the long boilerplate.
- **`speaker_bio_short`** (1–2 sentences, third person): taken from `bio_raw` only. If `bio_raw` is empty, use `""`. Don't make a bio out of the speaker's name or the talk topic.
- **`captions`**: follow the cadence table in CLAUDE.md.
  - Each caption is **at most 280 characters, counting the full `registration_link` URL and the hashtags**, with at most 3 hashtags, always including `#LansingCodes`.
  - Each caption must make sense without an image and without the others.
  - `week_before` is about the topic, not the logistics.
  - `day_before` and `day_of` include the time and venue name.
  - Write dates like "Tue, Oct 20".
- **`email_blurb`** (2–3 sentences): Lansing Codes voice, and **no date, time or venue**, because the digest template adds those.
- **`gaps`**: one short line per missing fact that would have improved the copy, written as something the organizer can act on. Examples:
  - "No speaker bio: About the speaker section omitted"
  - "No speaker photo for the Canva card"
  - "Speaker title/company unknown: card line will be blank"
  - "Talk length not confirmed; agenda assumes the standard 60 minutes"

  Only list gaps that actually matter. `[]` is fine.

Self-check before writing:

1. Count the characters in every caption, with the link included.
2. Look for any word from the avoid list.
3. Check that every factual claim appears in the input.

## 4. Write it to the file

Save the copy as JSON to a scratch file outside the repo (the session scratchpad or the OS temp directory). It must have exactly these keys: `title, hook, description_long, speaker_bio_short, captions{announce, week_before, day_before, day_of}, email_blurb, gaps[]`. Then run:

```
node scripts/draft_event.js write $ARGUMENTS <scratch.json>          # add --confirmed only after the user said yes in step 1
```

If it fails on length or shape errors, fix the copy and run it again. Don't touch the event file yourself. For warnings (avoided words, missing `#LansingCodes`, extra emoji or `!`), fix the copy and rewrite unless the warning is a false positive, e.g. "leverage" used as a noun in the speaker's own quote.

## 5. Report

Run `git diff -- $ARGUMENTS` and give the user a short summary:

- the hook,
- each caption with its character count,
- the `gaps` list, as questions to take back to the speaker,
- a reminder that status is `draft`: they should edit anything directly in the file, then set `status: approved`.

Don't paste the whole diff back; they can read it.
