#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isExportable, listEventFiles, readEvent } from './lib/events.js'
import { dateShort, time12 } from './lib/format.js'

const escapeHtml = (value) => String(value).replace(/[&<>"'\u007f-\u{10ffff}]/gu, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char] ?? `&#${char.codePointAt(0)};`)

function safeLink(value) {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('registration_link must be an HTTP(S) URL without credentials')
  }
  return url.href
}

function validateEvent(event, path, month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(event.date)) ||
      event.date.slice(0, 7) !== month) throw new Error(`${path}: invalid event date`)
  const date = new Date(`${event.date}T12:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== event.date) {
    throw new Error(`${path}: invalid event date`)
  }
  for (const [field, value] of [['start_time', event.start_time], ['end_time', event.end_time]]) {
    if (value && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value)))) {
      throw new Error(`${path}: invalid ${field}`)
    }
  }
  for (const [field, value] of [['generated.title', event.generated?.title], ['generated.hook', event.generated?.hook],
    ['generated.email_blurb', event.generated?.email_blurb], ['venue.name', event.venue?.name],
    ['start_time', event.start_time], ['registration_link', event.registration_link]]) {
    if (!String(value ?? '').trim()) throw new Error(`${path}: missing ${field}`)
  }
  try { safeLink(event.registration_link) } catch { throw new Error(`${path}: invalid registration_link`) }
}

function eventDetails(event) {
  const end = event.end_time ? `–${time12(event.end_time)}` : ''
  return `${dateShort(event.date)}, ${time12(event.start_time)}${end} · ${event.venue.name}`
}

function renderHtmlEvent(event) {
  const title = escapeHtml(event.generated.title)
  const hook = escapeHtml(event.generated.hook)
  const details = escapeHtml(eventDetails(event))
  const blurb = escapeHtml(event.generated.email_blurb).replace(/\n/g, '<br>')
  const link = escapeHtml(safeLink(event.registration_link))
  return `<section style="border-top:1px solid #d9e0e7;padding:20px 0">\n` +
    `  <h2 style="font-size:22px;margin:0 0 6px">${title}</h2>\n` +
    `  <p style="margin:0 0 8px;font-weight:bold">${hook}</p>\n` +
    `  <p style="margin:0 0 8px">${details}</p>\n` +
    `  <p style="margin:0 0 12px">${blurb}</p>\n` +
    `  <a href="${link}" style="color:#b42b22;font-weight:bold">Event details and registration</a>\n` +
    `</section>`
}

function renderTextEvent(event) {
  return `${event.generated.title}\n${event.generated.hook}\n${eventDetails(event)}\n` +
    `${event.generated.email_blurb}\n${safeLink(event.registration_link)}`
}

export function renderDigest(month, { eventsDir = 'events', templatesDir = 'templates' } = {}) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('month must be YYYY-MM')
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T12:00:00Z`))
  const events = listEventFiles(eventsDir).map((path) => ({ path, event: readEvent(path) }))
    .filter(({ event }) => isExportable(event) && String(event.date).startsWith(month))
  for (const { path, event } of events) validateEvent(event, path, month)
  events.sort((a, b) => a.event.date.localeCompare(b.event.date) || a.path.localeCompare(b.path))
  const htmlEvents = events.length ? events.map(({ event }) => renderHtmlEvent(event)).join('\n') :
    '<p>No Lansing Codes events are scheduled for this month.</p>'
  const textEvents = events.length ? events.map(({ event }) => renderTextEvent(event)).join('\n\n') :
    'No Lansing Codes events are scheduled for this month.'
  const apply = (template, body) => template.replaceAll('{{MONTH}}', monthLabel).replaceAll('{{EVENTS}}', () => body)
  return {
    count: events.length,
    html: apply(readFileSync(join(templatesDir, 'email.html'), 'utf8'), htmlEvents),
    text: apply(readFileSync(join(templatesDir, 'email.txt'), 'utf8'), textEvents),
  }
}

function main(args) {
  const month = args.shift()
  let eventsDir = 'events'
  let outDir = 'out'
  while (args.length) {
    const flag = args.shift()
    const value = args.shift()
    if (flag === '--events' && value) eventsDir = value
    else if (flag === '--out' && value) outDir = value
    else throw new Error('usage: npm run digest -- YYYY-MM [--events DIR] [--out DIR]')
  }
  const result = renderDigest(month, { eventsDir })
  mkdirSync(outDir, { recursive: true })
  for (const [ext, content] of [['html', result.html], ['txt', result.text]]) {
    const path = join(outDir, `digest-${month}.${ext}`)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  console.log(`Wrote ${result.count} event(s) to ${outDir}/digest-${month}.{html,txt}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)) } catch (error) {
    console.error(`error: ${error.message}`)
    process.exitCode = 1
  }
}
