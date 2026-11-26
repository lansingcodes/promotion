import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { digest, digestContext, render } from '../scripts/digest.js'
import { fetchAroundTown, monthRange } from '../scripts/lib/around_town.js'
import { listEventFiles } from '../scripts/lib/events.js'
import { dateLong, monthName, timeRange } from '../scripts/lib/format.js'

const FIXTURE = 'fixtures/events/2026-11-17-sam-rivera.yml'
const IMAGES = 'https://example.org/cards/'

// A temp events dir with the fixture (as `status`), a template file, and any extra events.
function tempEvents(status, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'lc-'))
  const fixture = readFileSync(FIXTURE, 'utf8').replace('status: draft', `status: ${status}`)
  writeFileSync(join(dir, '2026-11-17-sam-rivera.yml'), fixture)
  writeFileSync(join(dir, '_template.yml'), 'status: approved\n')
  for (const [name, edit] of Object.entries(extra)) writeFileSync(join(dir, name), edit(fixture))
  return dir
}

const opts = { cardsDir: null, imageBaseUrl: IMAGES }

test('formats long dates, month names and time ranges', () => {
  assert.equal(dateLong('2026-11-10'), 'Tuesday, November 10')
  assert.equal(monthName('2026-11'), 'November')
  assert.throws(() => monthName('2026-13'), /bad month/)
  assert.throws(() => monthName('Nov'), /bad month/)
  assert.equal(timeRange('18:00', '20:00'), '6:00–8:00 PM')
  assert.equal(timeRange('16:30', '21:00'), '4:30–9:00 PM')
  assert.equal(timeRange('11:00', '13:00'), '11:00 AM–1:00 PM')
})

test('render fills values, repeats lists, drops empty sections and escapes HTML', () => {
  const tpl = 'A {{x}}\n{{#items}}\n- {{name}}{{#tag}} [{{tag}}]{{/tag}}\n{{/items}}\nB\n'
  const ctx = { x: '<&>', items: [{ name: 'one', tag: '' }, { name: '"two"', tag: 't' }] }
  assert.equal(render(tpl, ctx), 'A <&>\n- one\n- "two" [t]\nB\n')
  assert.equal(render(tpl, ctx, { html: true }), 'A &lt;&amp;&gt;\n- one\n- &quot;two&quot; [t]\nB\n')
  assert.equal(render('a\r\nb {{x}}\r\n', { x: 1 }), 'a\nb 1\n')
  assert.throws(() => render('{{nope}}', {}), /\{\{nope\}\}/)
})

test('includes only approved or published events in the month, sorted by date', () => {
  const dir = tempEvents('approved', {
    '2026-11-03-early.yml': (y) => y.replace('date: 2026-11-17', 'date: 2026-11-03').replace(/title: "Postgres[^"]*"/, 'title: "Early"').replace('status: approved', 'status: published'),
    '2026-11-24-draft.yml': (y) => y.replace('date: 2026-11-17', 'date: 2026-11-24').replace('status: approved', 'status: draft'),
    '2026-12-01-next.yml': (y) => y.replace('date: 2026-11-17', 'date: 2026-12-01'),
  })
  const ctx = digestContext('2026-11', listEventFiles(dir), opts)
  assert.deepEqual(ctx.events.map((e) => e.title), ['Early', "Postgres Tips I Wish I'd Known Earlier"])
  assert.equal(ctx.month, 'November')
  assert.equal(ctx.year, '2026')
  assert.equal(ctx.subject, "Lansing Codes in November · Early · Postgres Tips I Wish I'd Known Earlier")
  assert.match(ctx.preheader, /^Tuesday, November 3: Indexes, EXPLAIN,.* · Tuesday, November 17: Indexes/)
})

test('builds each event entry from the event file', () => {
  const dir = tempEvents('approved')
  const [e] = digestContext('2026-11', listEventFiles(dir), opts).events
  assert.deepEqual(e, {
    title: "Postgres Tips I Wish I'd Known Earlier",
    hook: 'Indexes, EXPLAIN, and why an app got slow when its table hit a few million rows',
    blurb: 'Sam Rivera is sharing the Postgres lessons that are easier to learn from someone else: indexes, EXPLAIN, and what happened when one app\'s table grew to a few million rows. Useful if you work with Postgres now or expect to.',
    date: 'Tuesday, November 17',
    time: '6:00–8:00 PM',
    venue_name: 'Technology Innovation Center',
    venue_address: '325 E Grand River Ave, East Lansing, MI',
    link: 'https://www.meetup.com/lansing-codes-meetup/',
    image_url: '',
  })
})

test('digest accepts web registration links and rejects unsafe URLs with the source path', () => {
  const dir = tempEvents('approved')
  const path = join(dir, '2026-11-17-sam-rivera.yml')
  const original = readFileSync(path, 'utf8')
  for (const link of ['https://example.org/register', 'http://example.org/register']) {
    writeFileSync(path, original.replace('https://www.meetup.com/lansing-codes-meetup/', link))
    assert.equal(digestContext('2026-11', listEventFiles(dir), opts).events[0].link, link)
  }
  for (const link of ['javascript:alert(1)', 'https://user:pass@example.org/register', ' https://example.org/register']) {
    writeFileSync(path, original.replace('https://www.meetup.com/lansing-codes-meetup/', link))
    assert.throws(() => digestContext('2026-11', listEventFiles(dir), opts),
      (error) => error.message.includes(path) && /registration_link.*HTTP\(S\)/.test(error.message))
  }
})

test('adds the card image only when the PNG exists in the cards dir', () => {
  const dir = tempEvents('approved')
  const cards = join(dir, 'cards')
  mkdirSync(cards)
  const files = listEventFiles(dir)
  assert.equal(digestContext('2026-11', files, { ...opts, cardsDir: cards }).events[0].image_url, '')
  copyFileSync(FIXTURE, join(cards, '2026-11-17-sam-rivera-square.png'))
  assert.equal(
    digestContext('2026-11', files, { ...opts, cardsDir: cards }).events[0].image_url,
    `${IMAGES}2026-11-17-sam-rivera-square.png`,
  )
  assert.equal(digestContext('2026-11', files, { cardsDir: cards, imageBaseUrl: '' }).events[0].image_url, '')
})

test('refuses an empty month and events missing copy', () => {
  assert.throws(() => digestContext('2026-11', listEventFiles(tempEvents('draft')), opts), /no approved or published events in 2026-11/)
  const dir = tempEvents('approved')
  const path = join(dir, '2026-11-17-sam-rivera.yml')
  writeFileSync(path, readFileSync(path, 'utf8').replace(/email_blurb: "[^"]*"/, 'email_blurb: ""'))
  assert.throws(() => digestContext('2026-11', listEventFiles(dir), opts), /generated\.email_blurb is empty/)
})

test('renders the real templates deterministically', () => {
  const files = listEventFiles(tempEvents('approved'))
  const a = digest('2026-11', files, opts)
  const b = digest('2026-11', files, opts)
  assert.equal(a.html, b.html)
  assert.equal(a.text, b.text)

  assert.match(a.html, /<h2[^>]*><a [^>]*>Postgres Tips I Wish I'd Known Earlier<\/a><\/h2>/)
  assert.match(a.html, /<strong>Tuesday, November 17, 6:00–8:00 PM<\/strong>/)
  assert.match(a.html, /href="https:\/\/www\.meetup\.com\/lansing-codes-meetup\/"/)
  // A code-block fragment: Mailchimp's own footer handles unsubscribe.
  assert.doesNotMatch(a.html, /\{\{|<img|<html|<head|<style|\*\|UNSUB\|\*/)
  assert.match(a.text, /\nUnsubscribe: \*\|UNSUB\|\*\n/)

  assert.match(a.text, /^Lansing Codes · November 2026\n/)
  assert.match(a.text, /\nTuesday, November 17, 6:00–8:00 PM\nTechnology Innovation Center\n/)
  assert.match(a.text, /\nDetails and RSVP: https:\/\/www\.meetup\.com\/lansing-codes-meetup\/\n/)
  assert.doesNotMatch(a.text, /\{\{|\n\n\n/)
})

// Shaped like the lansing.codes Firestore REST response and groups.json.
const firestoreRow = (group, name, startTime, url, venue = '') => ({
  document: {
    fields: {
      group: { stringValue: group },
      name: { stringValue: name },
      startTime: { integerValue: String(startTime) },
      url: { stringValue: url },
      venue: { stringValue: venue },
    },
  },
})
const NOV_19_6PM = Date.parse('2026-11-19T23:00:00Z') // 6:00 PM EST
const NOV_6_3PM = Date.parse('2026-11-06T20:00:00Z') // 3:00 PM EST

function fakeFetch(rows) {
  const calls = []
  const fetchFn = async (url, init) => {
    calls.push({ url, body: init?.body && JSON.parse(init.body) })
    const body = url.endsWith('groups.json')
      ? { ai: { name: 'AI' }, dotnet: { name: '.NET' } }
      : [...rows, { readTime: 'x' }]
    return { ok: true, json: async () => body }
  }
  return { fetchFn, calls }
}

test('monthRange covers the month in Lansing time, across DST and year end', () => {
  assert.deepEqual(monthRange('2026-11'), [Date.parse('2026-11-01T04:00:00Z'), Date.parse('2026-12-01T05:00:00Z')])
  assert.deepEqual(monthRange('2026-12'), [Date.parse('2026-12-01T05:00:00Z'), Date.parse('2027-01-01T05:00:00Z')])
})

test('fetchAroundTown queries the month, sorts, and names groups', async () => {
  const { fetchFn, calls } = fakeFetch([
    firestoreRow('dotnet', 'The Anatomy of an AI Agent', NOV_19_6PM, 'https://example.org/b', ' Online '),
    firestoreRow('ai', 'AI Office Hours', NOV_6_3PM, 'https://example.org/a'),
  ])
  const events = await fetchAroundTown('2026-11', { fetchFn })
  assert.deepEqual(events, [
    { startTime: NOV_6_3PM, name: 'AI Office Hours', group: 'AI', venue: '', url: 'https://example.org/a' },
    { startTime: NOV_19_6PM, name: 'The Anatomy of an AI Agent', group: 'GLUGnet (.NET)', venue: 'Online', url: 'https://example.org/b' },
  ])
  const filters = calls.find((c) => c.body).body.structuredQuery.where.compositeFilter.filters
  assert.deepEqual(filters.map((f) => f.fieldFilter.value.integerValue), monthRange('2026-11').map(String))
})

test('fetchAroundTown fails loudly on an HTTP error', async () => {
  const fetchFn = async () => ({ ok: false, status: 403 })
  await assert.rejects(fetchAroundTown('2026-11', { fetchFn }), /HTTP 403/)
})

test('Around town lists calendar events, skipping ones already featured', async () => {
  const { fetchFn } = fakeFetch([
    firestoreRow('ai', 'AI Office Hours', NOV_6_3PM, 'https://example.org/a'),
    firestoreRow('lansing_codes', 'Postgres tips', NOV_19_6PM, 'https://www.meetup.com/lansing-codes-meetup/'),
    firestoreRow('dotnet', 'Agents & <tools>', NOV_19_6PM, 'https://example.org/b', 'Online'),
  ])
  const aroundTown = await fetchAroundTown('2026-11', { fetchFn })
  const files = listEventFiles(tempEvents('approved'))
  const { ctx, html, text } = digest('2026-11', files, { ...opts, aroundTown })

  assert.deepEqual(ctx.around_town.map((e) => e.title), ['AI Office Hours', 'Agents & <tools>'])
  assert.deepEqual(ctx.around_town[0], {
    date: 'Fri, Nov 6', time: '3:00 PM', title: 'AI Office Hours', group: 'AI', venue: '', link: 'https://example.org/a',
  })
  assert.equal(html.match(/Around town in November/g).length, 1)
  assert.match(html, /<a href="https:\/\/example\.org\/b"[^>]*>Agents &amp; &lt;tools&gt;<\/a><br><span[^>]*>GLUGnet \(\.NET\) · 6:00 PM · Online<\/span>/)
  assert.match(text, /\nAround town in November\n.*\n\nFri, Nov 6 · AI Office Hours\n  AI · 3:00 PM\n  https:\/\/example\.org\/a\n\nThu, Nov 19 · Agents & <tools>\n  GLUGnet \(\.NET\) · 6:00 PM · Online\n/)

  const none = digest('2026-11', files, opts)
  assert.doesNotMatch(none.html + none.text, /Around town/)
})

test('digest rejects unsafe Around town links before rendering anchors', () => {
  const files = listEventFiles(tempEvents('approved'))
  for (const url of ['javascript:alert(1)', 'https://user:pass@example.org/', '']) {
    const aroundTown = [{ startTime: NOV_6_3PM, name: 'Unsafe event', group: 'AI', venue: '', url }]
    assert.throws(() => digest('2026-11', files, { ...opts, aroundTown }),
      /Around town event "Unsafe event": url: expected an HTTP\(S\) URL without credentials/)
  }
})
