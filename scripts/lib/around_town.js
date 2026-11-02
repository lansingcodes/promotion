// Reads a month of events from the lansing.codes calendar for the digest's
// "Around town" section. See AROUND_TOWN in config.js for the sources.
import { AROUND_TOWN, TIMEZONE } from './config.js'
import { zonedToUtc } from './format.js'

// "2026-11" → [start, end) of that month in TIMEZONE, as epoch ms.
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return [zonedToUtc(`${month}-01`, '00:00', TIMEZONE).getTime(), zonedToUtc(`${next}-01`, '00:00', TIMEZONE).getTime()]
}

function firestoreQuery([start, end]) {
  const bound = (op, ms) => ({
    fieldFilter: { field: { fieldPath: 'startTime' }, op, value: { integerValue: String(ms) } },
  })
  return {
    structuredQuery: {
      from: [{ collectionId: 'events' }],
      where: { compositeFilter: { op: 'AND', filters: [bound('GREATER_THAN_OR_EQUAL', start), bound('LESS_THAN', end)] } },
      orderBy: [{ field: { fieldPath: 'startTime' } }],
    },
  }
}

// Firestore REST values ({ stringValue: "x" }, { integerValue: "1" }) → plain values.
function plain(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, 'integerValue' in v ? Number(v.integerValue) : Object.values(v)[0]]),
  )
}

async function getJson(fetchFn, url, init) {
  const res = await fetchFn(url, init)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

// Calendar events in `month`, sorted by start time, with each group's display name.
export async function fetchAroundTown(month, { fetchFn = fetch } = {}) {
  const [rows, groups] = await Promise.all([
    getJson(fetchFn, AROUND_TOWN.firestoreQueryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreQuery(monthRange(month))),
    }),
    getJson(fetchFn, AROUND_TOWN.groupsUrl),
  ])
  return rows
    .filter((r) => r.document)
    .map((r) => plain(r.document.fields))
    .map((e) => ({
      startTime: e.startTime,
      name: (e.name ?? '').trim(),
      group: AROUND_TOWN.groupNames[e.group] ?? groups[e.group]?.name ?? e.group ?? '',
      venue: (e.venue ?? '').trim(),
      url: e.url ?? '',
    }))
    .sort((a, b) => a.startTime - b.startTime || a.name.localeCompare(b.name))
}
