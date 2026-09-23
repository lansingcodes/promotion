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
