#!/usr/bin/env node
// Monthly email digest, pasted into Mailchimp on the 1st.
//
//   node scripts/digest.js YYYY-MM [--events <dir>] [--cards <dir>]
//     out/digest-YYYY-MM.html and .txt from templates/email.{html,txt}:
//     every approved or published event in that month, sorted by date.
//
// Templates use {{key}} for values and {{#key}}…{{/key}} for sections: a list
// repeats the section per item, any other truthy value shows it once, and an
// empty value drops it. Values are HTML-escaped in the .html output.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DIGEST } from './lib/config.js'
import { eventStem, isExportable, listEventFiles, readEvent } from './lib/events.js'
import { dateLong, monthName, timeRange } from './lib/format.js'

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// A section tag alone on its line takes the line with it, so sections add no blank lines.
const STANDALONE_TAG = /^[ \t]*(\{\{[#/]\w+\}\})[ \t]*\n/gm
const SECTION = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g
const VALUE = /\{\{(\w+)\}\}/g

function renderPart(tpl, ctx, escape) {
  return tpl
    .replace(SECTION, (_, key, body) => {
      const v = ctx[key]
      if (Array.isArray(v)) return v.map((item) => renderPart(body, { ...ctx, ...item }, escape)).join('')
      return v ? renderPart(body, ctx, escape) : ''
    })
    .replace(VALUE, (_, key) => {
      if (!(key in ctx)) throw new Error(`template uses {{${key}}}, which the digest doesn't provide`)
      return escape(ctx[key] ?? '')
    })
}

export function render(template, ctx, { html = false } = {}) {
  // Normalize line endings so output bytes don't depend on git's autocrlf setting.
  const tpl = template.replace(/\r\n/g, '\n').replace(STANDALONE_TAG, '$1')
  return renderPart(tpl, ctx, html ? escapeHtml : String)
}

function eventEntry(path, event, { cardsDir, imageBaseUrl }) {
  const g = event.generated ?? {}
  for (const key of ['title', 'hook', 'email_blurb']) {
    if (!g[key]?.trim()) throw new Error(`${path}: generated.${key} is empty; run /draft-event first`)
  }
  if (!event.registration_link) throw new Error(`${path}: registration_link is empty`)

  const card = `${eventStem(path)}-${DIGEST.image}.png`
  const hasCard = imageBaseUrl && cardsDir && existsSync(join(cardsDir, card))
  return {
    title: g.title.trim(),
    hook: g.hook.trim(),
    blurb: g.email_blurb.trim(),
    date: dateLong(event.date),
    time: timeRange(event.start_time, event.end_time),
    venue_name: event.venue?.name ?? '',
    venue_address: event.venue?.address ?? '',
    link: event.registration_link,
    image_url: hasCard ? new URL(card, imageBaseUrl).href : '',
  }
}

// Everything the templates need for one month, plus a suggested subject line.
export function digestContext(month, files, { cardsDir = 'cards', imageBaseUrl = DIGEST.imageBaseUrl } = {}) {
  const name = monthName(month)
  const events = files
    .map((path) => ({ path, event: readEvent(path) }))
    .filter(({ event }) => isExportable(event) && String(event.date).startsWith(`${month}-`))
    .sort((a, b) => String(a.event.date).localeCompare(String(b.event.date)) || a.path.localeCompare(b.path))
    .map(({ path, event }) => eventEntry(path, event, { cardsDir, imageBaseUrl }))
  if (!events.length) throw new Error(`no approved or published events in ${month}`)

  return {
    month: name,
    year: month.slice(0, 4),
    events,
    // The inbox shows the subject first and this preview text after it, so it adds the hook.
    preheader: events.map((e) => `${e.date}: ${e.hook}`).join(' · '),
    subject: `Lansing Codes in ${name} · ${events.map((e) => e.title).join(' · ')}`,
  }
}

export function digest(month, files, { templatesDir = 'templates', ...opts } = {}) {
  const ctx = digestContext(month, files, opts)
  const read = (f) => readFileSync(join(templatesDir, f), 'utf8')
  return {
    ctx,
    html: render(read('email.html'), ctx, { html: true }),
    text: render(read('email.txt'), ctx),
  }
}

function flag(args, name) {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

function main(args) {
  const [month] = args
  if (!month || month.startsWith('--')) {
    console.error('usage: digest.js YYYY-MM [--events <dir>] [--cards <dir>]')
    process.exitCode = 2
    return
  }
  const { ctx, html, text } = digest(month, listEventFiles(flag(args, '--events') ?? 'events'), {
    cardsDir: flag(args, '--cards') ?? 'cards',
  })
  mkdirSync('out', { recursive: true })
  writeFileSync(`out/digest-${month}.html`, html)
  writeFileSync(`out/digest-${month}.txt`, text)
  console.log(`Wrote out/digest-${month}.html and .txt (${ctx.events.length} event${ctx.events.length === 1 ? '' : 's'}).`)
  for (const e of ctx.events) console.log(`  ${e.date}: ${e.title}${e.image_url ? '' : ' (no card image)'}`)
  console.log(`Subject:      ${ctx.subject}`)
  console.log(`Preview text: ${ctx.preheader}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2))
  } catch (err) {
    console.error(`error: ${err.message}`)
    process.exitCode = 1
  }
}
