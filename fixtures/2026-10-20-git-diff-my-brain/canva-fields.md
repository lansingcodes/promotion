# Canva speaker card templates

Built 2026-09-22 from the existing "Meetup Template" design, which was left
unchanged. All three live in the Canva folder **Lansing Codes Promo Templates**
(https://www.canva.com/folder/FAHV-MbZa54).

| Template | Size | Design ID | Edit link |
|---|---|---|---|
| LC Template – Speaker Card – Banner | 1640×924 (Meetup event image) | `DAHV-DmupHc` | https://www.canva.com/d/cJyhl0BUTBQpsQU |
| LC Template – Speaker Card – Square | 1080×1080 (feed posts) | `DAHV-GiYiJg` | https://www.canva.com/d/XEkgDZQI9oZAZmQ |
| LC Template – Speaker Card – Story | 1080×1920 (stories) | `DAHV-I339ys` | https://www.canva.com/d/WU7kS6k8EnglOSu |

## Data fields (identical in all three)

Bulk create auto-matches CSV headers to these names, and autofill uses them as keys.
They must match the column mapping in `scripts/lib/config.js` exactly.

| Field | Type | Source in event YAML | Example |
|---|---|---|---|
| `title` | text | `generated.title` | 'git diff' My Brain: Working Memory for Claude Code |
| `hook` | text | `generated.hook` | A folder of markdown, updated by Claude Code, reviewed every morning as a git diff |
| `speaker_name` | text | `speaker.name` | Adam B. |
| `speaker_title_company` | text | `speaker.title` + " · " + `speaker.company` (blank if both are empty) | Staff Engineer · Example Co |
| `speaker_photo` | image | `speaker.photo_url`, uploaded to Canva first | (circle frame) |
| `date_display` | text | `date` → `Tue, Oct 20` | Tue, Oct 20 |
| `time_display` | text | `start_time` → `6:00 PM` | 6:00 PM |
| `venue_name` | text | `venue.name` | Red Cedar Spirits |

- **No photo:** the frame shows the Lansing Codes logo. Leave `speaker_photo` out and the card still looks finished.
- **Blank `speaker_title_company`:** send a single space (`" "`). An empty string may be rejected.
- **Length budget:** the banner fits a two-line title at the 70-character limit and a two-line hook at 90 characters.

## Verified

- `get-design-dataset` returns all 8 fields on each template.
- **Autofill works on this account.** `autofill-design` on the banner created a correct card for the Sam Rivera fixture: design `DAHV-OCnOu0`, titled "TEST autofill – Sam Rivera (fixture)", filed in the same folder, safe to delete.

## Known cosmetic issue

The speaker name, title/company, time and venue text boxes were added through the API and use Canva's default font. Title, hook and date keep the template's brand font. To make them match, open each template, select those four boxes, set the font to match the title, and save. Every future card inherits the fix.
