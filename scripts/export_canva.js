#!/usr/bin/env node
// Canva speaker card data:
//
//   node scripts/export_canva.js fields <event.yml> [--allow-draft]
//     JSON autofill payload for one event, used by /make-cards.
//
//   node scripts/export_canva.js set-photo <event.yml> <https-url>
//     Sets speaker.photo_url, changing only that line of the file.
//
//   node scripts/export_canva.js csv [--events <dir>] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
//     out/canva-bulk.csv for Canva bulk create: the fallback if autofill is unavailable.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import YAML from 'yaml'
import { CANVA_CARDS_FOLDER, CANVA_FIELDS, CANVA_IMAGE_FIELDS, CANVA_TEMPLATES } from './lib/config.js'
import { eventStem, isExportable, listEventFiles, readEvent } from './lib/events.js'
import * as format from './lib/format.js'

const TEXT_FIELDS = Object.keys(CANVA_FIELDS).filter((k) => !CANVA_IMAGE_FIELDS.includes(k))

export function cardValues(event) {
  if (!event.generated?.title || !event.generated?.hook) {
    throw new Error('generated.title and generated.hook are empty; run /draft-event first')
  }
  return Object.fromEntries(
    Object.entries(CANVA_FIELDS).map(([field, get]) => [field, (get(event, format) ?? '').trim()]),
  )
}

export function fields(path, { allowDraft = false } = {}) {
  const event = readEvent(path)
  if (!isExportable(event) && !allowDraft) {
    throw new Error(`status is "${event.status}"; approve the copy first (or pass --allow-draft for a preview)`)
  }
  const values = cardValues(event)
  const stem = eventStem(path)
  return {
    event: path,
    stem,
    status: event.status,
    folder: CANVA_CARDS_FOLDER,
    templates: Object.fromEntries(
      Object.entries(CANVA_TEMPLATES).map(([name, t]) => [
        name,
        { ...t, title: `${stem} – ${name}`, image: `out/images/${stem}-${name}.png` },
      ]),
    ),
    // Canva may reject an empty string, so blank text fields become a single space.
    text: Object.fromEntries(TEXT_FIELDS.map((k) => [k, values[k] || ' '])),
    photo_url: values.speaker_photo || null,
  }
}

const PHOTO_LINE = /^(  photo_url:)[^\n]*$/m

export function setPhoto(path, url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`not a URL: ${url}`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('photo URL must be http(s)')
  if (/["\s]/.test(url)) throw new Error('photo URL must not contain quotes or spaces')

  const before = readFileSync(path, 'utf8')
  if (!PHOTO_LINE.test(before)) throw new Error(`${path}: no "  photo_url:" line under speaker`)
  const after = before.replace(PHOTO_LINE, (_, key) => `${key} "${url}"`)

  // Only speaker.photo_url may change.
  const a = YAML.parse(before)
  const b = YAML.parse(after)
  const previous = a.speaker?.photo_url ?? ''
  if (b.speaker?.photo_url !== url) throw new Error('photo_url line is not under speaker:')
  a.speaker.photo_url = url
  if (!isDeepStrictEqual(a, b)) throw new Error('refusing to write: more than speaker.photo_url would change')
  writeFileSync(path, after)
  return { previous }
}

const csvCell = (s) => `"${String(s).replace(/"/g, '""')}"`

export function csv(files, { from, to } = {}) {
  const rows = files
    .map((path) => ({ path, event: readEvent(path) }))
    .filter(({ event }) => isExportable(event))
    .filter(({ event }) => (!from || event.date >= from) && (!to || event.date <= to))
  // Photos can't come through a CSV (Canva reads URLs as plain text), so
  // image fields are left out; drop the photo into each design by hand.
  const lines = [TEXT_FIELDS.map(csvCell).join(',')]
  for (const { event } of rows) {
    const v = cardValues(event)
    lines.push(TEXT_FIELDS.map((k) => csvCell(v[k])).join(','))
  }
  return { text: `${lines.join('\r\n')}\r\n`, count: rows.length }
}

function flag(args, name) {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

function main(args) {
  const [cmd, path] = args
  if (cmd === 'fields' && path) {
    console.log(JSON.stringify(fields(path, { allowDraft: args.includes('--allow-draft') }), null, 2))
    return
  }
  if (cmd === 'set-photo' && path && args[2]) {
    const { previous } = setPhoto(path, args[2])
    console.log(`Set speaker.photo_url in ${path}${previous ? ` (was ${previous})` : ''}.`)
    return
  }
  if (cmd === 'csv') {
    const out = 'out/canva-bulk.csv'
    const { text, count } = csv(listEventFiles(flag(args, '--events') ?? 'events'), {
      from: flag(args, '--from'),
      to: flag(args, '--to'),
    })
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, text)
    console.log(`Wrote ${out} (${count} approved event${count === 1 ? '' : 's'}).`)
    return
  }
  console.error(
    'usage:\n  export_canva.js fields <event.yml> [--allow-draft]\n  export_canva.js set-photo <event.yml> <https-url>\n  export_canva.js csv [--events <dir>] [--from YYYY-MM-DD] [--to YYYY-MM-DD]',
  )
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
