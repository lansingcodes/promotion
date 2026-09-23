#!/usr/bin/env node
// Helper for the /draft-event slash command. Claude writes the copy; this
// script is the only thing that touches the event file, so the organizer
// fields are guaranteed untouched and the length limits are enforced.
//
//   node scripts/draft_event.js status <event.yml>
//   node scripts/draft_event.js write  <event.yml> <generated.json> [--confirmed]
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  CAPTION_KEYS,
  GENERATED_KEYS,
  STATUSES,
  hasGeneratedCopy,
  organizerFieldsEqual,
  readEventDoc,
  scalar,
  writeGeneratedSection,
} from './lib/events.js'
import { checkGenerated } from './lib/voice.js'

export function status(path) {
  const data = readEventDoc(path).toJS()
  const s = data.status ?? 'draft'
  return {
    status: s,
    has_generated_copy: hasGeneratedCopy(data),
    needs_confirmation: s === 'approved' || s === 'published',
  }
}

function validateShape(g) {
  const errors = []
  if (typeof g !== 'object' || g === null || Array.isArray(g)) return ['generated must be an object']
  const extra = Object.keys(g).filter((k) => !GENERATED_KEYS.includes(k))
  if (extra.length) errors.push(`unknown keys: ${extra.join(', ')}`)
  for (const k of GENERATED_KEYS.filter((k) => k !== 'captions' && k !== 'gaps')) {
    if (typeof g[k] !== 'string') errors.push(`${k} must be a string`)
  }
  if (typeof g.captions !== 'object' || g.captions === null) {
    errors.push('captions must be an object')
  } else {
    const extraCaps = Object.keys(g.captions).filter((k) => !CAPTION_KEYS.includes(k))
    if (extraCaps.length) errors.push(`unknown caption keys: ${extraCaps.join(', ')}`)
    for (const k of CAPTION_KEYS) {
      if (typeof g.captions[k] !== 'string' || !g.captions[k].trim()) {
        errors.push(`captions.${k} must be a non-empty string`)
      }
    }
  }
  if (!Array.isArray(g.gaps) || !g.gaps.every((x) => typeof x === 'string')) {
    errors.push('gaps must be a list of strings')
  }
  for (const k of ['title', 'hook', 'description_long', 'email_blurb']) {
    if (typeof g[k] === 'string' && !g[k].trim()) errors.push(`${k} must not be empty`)
  }
  return errors
}

// Multi-line text ends with exactly one newline (a plain `|` block);
// single-line text is trimmed.
const tidy = (s) => (s.trim().includes('\n') ? `${s.trim()}\n` : s.trim())

export function write(path, generated, { confirmed = false } = {}) {
  const doc = readEventDoc(path)
  const before = doc.toJS()

  if (!STATUSES.includes(before.status ?? 'draft')) {
    throw new Error(`unknown status "${before.status}" (expected ${STATUSES.join(' | ')})`)
  }
  if ((before.status === 'approved' || before.status === 'published') && !confirmed) {
    throw new Error(
      `event is ${before.status}; rerunning replaces reviewed copy. Pass --confirmed once the organizer agrees.`,
    )
  }

  const shapeErrors = validateShape(generated)
  if (shapeErrors.length) throw new Error(`invalid generated block:\n  - ${shapeErrors.join('\n  - ')}`)

  const g = {
    ...Object.fromEntries(
      GENERATED_KEYS.filter((k) => k !== 'captions' && k !== 'gaps').map((k) => [k, tidy(generated[k])]),
    ),
    captions: Object.fromEntries(CAPTION_KEYS.map((k) => [k, tidy(generated.captions[k])])),
    gaps: generated.gaps.map((x) => x.trim()).filter(Boolean),
  }

  const { errors, warnings } = checkGenerated(g)
  if (errors.length) throw new Error(`copy breaks limits:\n  - ${errors.join('\n  - ')}`)

  for (const k of ['title', 'hook', 'description_long', 'speaker_bio_short']) {
    doc.setIn(['generated', k], scalar(g[k]))
  }
  for (const k of CAPTION_KEYS) doc.setIn(['generated', 'captions', k], scalar(g.captions[k]))
  doc.setIn(['generated', 'email_blurb'], scalar(g.email_blurb))
  doc.setIn(['generated', 'gaps'], doc.createNode(g.gaps.map(scalar)))
  // New copy hasn't been reviewed yet, whatever the file said before.
  doc.set('status', 'draft')

  if (!organizerFieldsEqual(before, doc.toJS())) {
    throw new Error('refusing to write: organizer fields would change')
  }
  writeGeneratedSection(path, doc)
  return { warnings, previous_status: before.status ?? 'draft' }
}

function main([cmd, path, jsonPath, ...flags]) {
  if (cmd === 'status' && path) {
    console.log(JSON.stringify(status(path), null, 2))
    return
  }
  if (cmd === 'write' && path && jsonPath) {
    const generated = JSON.parse(readFileSync(jsonPath, 'utf8'))
    const { warnings, previous_status } = write(path, generated, { confirmed: flags.includes('--confirmed') })
    console.log(`Wrote generated copy to ${path} (status: ${previous_status} → draft).`)
    for (const w of warnings) console.log(`warning: ${w}`)
    return
  }
  console.error('usage:\n  draft_event.js status <event.yml>\n  draft_event.js write <event.yml> <generated.json> [--confirmed]')
  process.exitCode = 2
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2))
  } catch (err) {
    console.error(`error: ${err.message}`)
    process.exitCode = 1
  }
}
