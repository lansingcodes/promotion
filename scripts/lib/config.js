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
export const POST_TIME = '12:00' // local time in TIMEZONE

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
