# Lansing Codes promotion

Turns one YAML file per event into everything [Lansing Codes](https://www.lansing.codes) needs to promote it: the Meetup listing, card images, a month of social posts and the monthly email digest.

Nothing here publishes on its own. Scripts write files to `out/`, Canva designs land in your Canva account, and social posts are created as **drafts** in Buffer. A person reviews everything before it goes live.

## How it works

```
events/YYYY-MM-DD-speaker-slug.yml      ← organizer fills in the event details
        │
        ▼  /draft-event                  ← Claude writes the copy into generated:
        │
review the git diff, edit, set status: approved
        │
        ├──▶ /make-cards       → Canva → cards/<stem>-{square,story,banner}.png
        ├──▶ /schedule-posts   → Buffer → dated drafts on every connected channel
        ├──▶ generated.description_long → paste into the Meetup event
        └──▶ monthly digest    → Mailchimp
```

The `/…` commands are [Claude Code](https://claude.com/claude-code) slash commands in [`.claude/commands/`](.claude/commands). `/make-cards` and `/schedule-posts` use the Canva and Buffer connectors.

## Adding an event

1. Copy [`events/_template.yml`](events/_template.yml) to `events/YYYY-MM-DD-speaker-slug.yml`. Paste what the speaker sent into `description_raw` and `speaker.bio_raw`, exactly as sent, and fill in the date, times, venue and registration link.
2. In Claude Code, run `/draft-event events/<file>.yml`. It fills in the `generated:` block and nothing else.
3. Read the diff, edit anything you like, check `generated.gaps`, then set `status: approved` and commit.
4. Run `/make-cards events/<file>.yml`, then commit and push the PNGs in `cards/`. Buffer loads the images from this public repo, so push them before scheduling.
5. Run `npm run schedule -- plan events/<file>.yml` to preview the four posts and their times, then `/schedule-posts events/<file>.yml` to create them as Buffer drafts. Review and schedule them in Buffer.
6. Paste `generated.description_long` into the Meetup event, use the banner card as its image, and set `status: published` once it's live.

[CLAUDE.md](CLAUDE.md) has the full workflow, the event file schema, and the voice, hashtag and caption rules the copy follows. [plan.md](plan.md) has the design, open questions and decisions log.

## Setup

Requires Node 22 or later.

```bash
npm install
```

```bash
npm test
```

| Command | What it does |
|---|---|
| `npm run schedule -- plan events/<file>.yml` | Shows each post's text, date, per-platform time and image. No network calls. |
| `npm run canva:csv` | Writes `out/canva-bulk.csv` for Canva bulk create, a fallback when the Canva connector isn't available. |
| `npm test` | Runs the tests with `node --test`. |

Every script takes `--events <dir>` (default `events/`), so tests run against `fixtures/events/`.

## Repo layout

| Path | Contents |
|---|---|
| `events/` | One YAML file per event, plus `_template.yml` |
| `cards/` | Card PNGs, committed on purpose so Buffer has a permanent image link |
| `scripts/` | Node CLI scripts; shared helpers and outside-tool config in `scripts/lib/` |
| `templates/` | Email digest templates (HTML and plain text) |
| `fixtures/` | Test data |
| `test/` | Tests |
| `.claude/commands/` | `/draft-event`, `/make-cards`, `/schedule-posts` |
| `out/` | Generated files (gitignored) |

## Contributing

- Node ES modules, one dependency (`yaml`). Add another only if it saves real effort.
- Script output is deterministic: same input, same bytes.
- Anything tied to an outside tool's format (Canva template IDs and fields, Buffer channels, post times, timezone) goes in [`scripts/lib/config.js`](scripts/lib/config.js).
- This repo is public. Never commit API keys, tokens, or anything a speaker hasn't agreed to make public.

## License

[Hippocratic License 2.1](https://firstdonoharm.dev/version/2/1/license/), as set in `package.json`.
