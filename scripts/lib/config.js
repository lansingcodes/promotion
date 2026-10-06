// Everything tied to an outside tool's format lives here, so a template or
// format change is a one-line edit. See CLAUDE.md "Conventions for contributors".

export const TIMEZONE = 'America/Detroit'

// Canva speaker card templates (folder: "Lansing Codes Promo Templates").
// IDs and field names are documented in
// fixtures/2026-10-20-git-diff-my-brain/canva-fields.md.
export const CANVA_TEMPLATES = {
  square: { designId: 'DAHV-GiYiJg', size: '1080x1080' },
  story: { designId: 'DAHV-I339ys', size: '1080x1920' },
  banner: { designId: 'DAHV-DmupHc', size: '1640x924' },
}

// Where /make-cards files the generated designs (folder: "Lansing Codes Event Cards").
export const CANVA_CARDS_FOLDER = 'FAHV-E7bU34'

// Canva data field name → how to get its value from an event.
// The keys must match the named data fields in the Canva templates exactly;
// they double as the CSV headers for bulk create.
export const CANVA_FIELDS = {
  title: (e, f) => e.generated.title,
  hook: (e, f) => e.generated.hook,
  speaker_name: (e, f) => e.speaker.name,
  speaker_title_company: (e, f) =>
    [e.speaker.title, e.speaker.company].map((s) => s?.trim()).filter(Boolean).join(' · '),
  speaker_photo: (e, f) => e.speaker.photo_url ?? '',
  date_display: (e, f) => f.dateShort(e.date),
  time_display: (e, f) => f.time12(e.start_time),
  venue_name: (e, f) => e.venue.name,
}

// Image fields are filled with an uploaded Canva asset, not text.
export const CANVA_IMAGE_FIELDS = ['speaker_photo']

// Posting cadence (CLAUDE.md "Posting cadence"): caption key → days before the event.
export const POST_SCHEDULE = [
  { key: 'announce', daysBefore: 21 },
  { key: 'week_before', daysBefore: 7 },
  { key: 'day_before', daysBefore: 1 },
  { key: 'day_of', daysBefore: 0 },
]

// Post times (local, in TIMEZONE) by Buffer channel service, from Buffer's 2026
// best-time-to-post studies. `default` covers every caption key not listed.
// Day-of posts can't wait for a platform's evening peak when the event starts
// at 6 PM, so they go out in the morning (X, Bluesky) or at noon (LinkedIn,
// Instagram, where mornings are weakest).
export const POST_TIMES = {
  twitter: { default: '10:00', day_of: '09:00' }, // weekday mornings, 9–11 AM
  bluesky: { default: '20:00', day_of: '09:00' }, // weekday evenings, 6–9 PM; 10 AM–1 PM is the dead zone
  linkedin: { default: '16:00', day_of: '12:00' }, // weekday late afternoon, 3–5 PM
  instagram: { default: '19:00', day_of: '12:00' }, // evenings; mornings underperform
  other: { default: '12:00', day_of: '09:00' }, // any other service
}

export function postTime(key, service) {
  const times = POST_TIMES[service] ?? POST_TIMES.other
  return times[key] ?? times.default
}

// Buffer, via the Buffer connector in Claude Code (/schedule-posts).
export const BUFFER = {
  organizationId: '6ab324b8575c5b1e4fdcfc46', // "My organization"
  // Posts land in Buffer as drafts for a final look, with their dates set.
  saveAsDraft: true,
  // Buffer channel IDs to post to. Empty = every connected channel in the organization.
  channelIds: [],
  // Buffer fetches images when the post publishes, so they need a stable public URL.
  // /make-cards saves cards to cards/ in this repo, which is public on GitHub, so
  // each card is served from here once it's committed and pushed.
  // Empty = text-only posts; attach the image in Buffer by hand.
  imageBaseUrl: 'https://raw.githubusercontent.com/lansingcodes/promotion/main/cards/',
  image: 'square', // which card from /make-cards to attach
}
