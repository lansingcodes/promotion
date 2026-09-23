// Shared helpers for reading and writing event files.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import YAML, { Scalar } from 'yaml'

export const STATUSES = ['draft', 'approved', 'published']

// Everything outside `generated:`. /draft-event must never change these.
// `status` is handled separately: new copy always resets it to draft.
export const ORGANIZER_KEYS = [
  'date',
  'start_time',
  'end_time',
  'title',
  'speaker',
  'description_raw',
  'venue',
  'registration_link',
]

export const CAPTION_KEYS = ['announce', 'week_before', 'day_before', 'day_of']

export const GENERATED_KEYS = [
  'title',
  'hook',
  'description_long',
  'speaker_bio_short',
  'captions',
  'email_blurb',
  'gaps',
]

export function readEvent(path) {
  return readEventDoc(path).toJS()
}

// Every event file in `dir`, sorted by filename (which starts with the date).
// Files starting with "_" (templates) are skipped.
export function listEventFiles(dir) {
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f) && !f.startsWith('_'))
    .sort()
    .map((f) => join(dir, f))
}

export const isExportable = (e) => e.status === 'approved' || e.status === 'published'

export const eventStem = (path) => basename(path).replace(/\.ya?ml$/, '')

export function readEventDoc(path) {
  const doc = YAML.parseDocument(readFileSync(path, 'utf8'))
  if (doc.errors.length) {
    throw new Error(`${path}: ${doc.errors.map((e) => e.message).join('; ')}`)
  }
  return doc
}

const GENERATED_LINE = /^generated:/m

// Rewrites only the text from the top-level `generated:` key onward,
// keeping everything above it byte-for-byte as the organizer wrote it.
// Requires `generated:` (and `status:`) to come after the organizer fields.
export function writeGeneratedSection(path, doc) {
  const original = readFileSync(path, 'utf8')
  const rendered = doc.toString({ lineWidth: 0 })
  const cutOld = original.search(GENERATED_LINE)
  const cutNew = rendered.search(GENERATED_LINE)
  if (cutOld === -1 || cutNew === -1) throw new Error(`${path}: no top-level "generated:" key`)

  const output = original.slice(0, cutOld) + rendered.slice(cutNew)
  if (!isDeepStrictEqual(YAML.parse(output), doc.toJS())) {
    throw new Error(`${path}: "generated:" must come after all organizer fields`)
  }
  writeFileSync(path, output)
}

export function organizerFields(data) {
  return Object.fromEntries(ORGANIZER_KEYS.map((k) => [k, data[k]]))
}

export function organizerFieldsEqual(a, b) {
  return isDeepStrictEqual(organizerFields(a), organizerFields(b))
}

// Multi-line strings become `|` blocks so diffs stay readable;
// single-line strings are double-quoted so colons and '#' are always safe.
export function scalar(value) {
  const node = new Scalar(value)
  node.type = value.includes('\n') ? Scalar.BLOCK_LITERAL : Scalar.QUOTE_DOUBLE
  return node
}

export function hasGeneratedCopy(data) {
  const g = data.generated ?? {}
  return Boolean(
    g.title || g.hook || g.description_long || g.email_blurb ||
      CAPTION_KEYS.some((k) => g.captions?.[k]),
  )
}
