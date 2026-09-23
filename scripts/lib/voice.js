// Mechanical checks for the house voice rules in CLAUDE.md.
// These catch the easy stuff; the organizer's review catches the rest.

export const LIMITS = {
  title: 70,
  hook: 90,
  caption: 280, // counted with the full link and hashtags, per CLAUDE.md
  captionHashtags: 3,
}

// Keep in sync with "Words and phrases to avoid" in CLAUDE.md.
export const AVOID = [
  'unlock', 'unleash', 'supercharge', 'level up', 'game-changer', 'game-changing',
  'revolutionary', 'cutting-edge', 'deep dive', 'dive into', 'delve', 'leverage',
  'synergy', 'seamless', 'harness the power', 'journey', 'elevate', 'empower',
  'ninja', 'rockstar', 'guru', 'thought leader', "don't miss out", 'exciting',
  'amazing', "in today's", 'navigate the landscape', 'tapestry', 'epic',
  'must-attend', 'not to be missed', 'guys',
]

export const charCount = (s) => [...s].length

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const AVOID_RE = new RegExp(`\\b(${AVOID.map(escape).join('|')})\\b`, 'gi')

// Returns { errors, warnings }. Errors block the write; warnings are reported.
export function checkGenerated(g) {
  const errors = []
  const warnings = []

  if (charCount(g.title) > LIMITS.title) {
    errors.push(`title is ${charCount(g.title)} chars (max ${LIMITS.title})`)
  }
  if (g.hook.includes('\n')) errors.push('hook must be one line')
  if (charCount(g.hook) > LIMITS.hook) {
    errors.push(`hook is ${charCount(g.hook)} chars (max ${LIMITS.hook})`)
  }

  for (const [key, text] of Object.entries(g.captions)) {
    const n = charCount(text)
    if (n > LIMITS.caption) errors.push(`captions.${key} is ${n} chars (max ${LIMITS.caption})`)
    const tags = text.match(/#\w+/g) ?? []
    if (tags.length > LIMITS.captionHashtags) {
      errors.push(`captions.${key} has ${tags.length} hashtags (max ${LIMITS.captionHashtags})`)
    }
    if (!/#LansingCodes\b/.test(text)) warnings.push(`captions.${key} is missing #LansingCodes`)
    if ((text.match(/\p{Extended_Pictographic}/gu) ?? []).length > 1) {
      warnings.push(`captions.${key} has more than one emoji`)
    }
  }

  const fields = {
    title: g.title,
    hook: g.hook,
    description_long: g.description_long,
    speaker_bio_short: g.speaker_bio_short,
    email_blurb: g.email_blurb,
    ...Object.fromEntries(Object.entries(g.captions).map(([k, v]) => [`captions.${k}`, v])),
  }
  for (const [name, text] of Object.entries(fields)) {
    const hits = [...new Set((text.match(AVOID_RE) ?? []).map((w) => w.toLowerCase()))]
    if (hits.length) warnings.push(`${name} uses avoided words: ${hits.join(', ')}`)
    if ((text.match(/!/g) ?? []).length > 1) warnings.push(`${name} has more than one "!"`)
  }

  return { errors, warnings }
}
