// Display formatting for dates and times, per CLAUDE.md conventions.
// Event dates are plain "YYYY-MM-DD" strings with no timezone attached, so
// they're formatted as calendar dates (UTC noon) to avoid off-by-one shifts.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function parseDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd))
  if (!m) throw new Error(`bad date "${ymd}" (expected YYYY-MM-DD)`)
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12))
}

// 2026-10-20 → "Tue, Oct 20"
export function dateShort(ymd) {
  const d = parseDate(ymd)
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

// "18:00" → "6:00 PM"
export function time12(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm))
  if (!m) throw new Error(`bad time "${hhmm}" (expected HH:MM)`)
  const h = +m[1]
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

const pad = (n) => String(n).padStart(2, '0')

// 2026-10-20 + (-21) → "2026-09-29"
export function addDays(ymd, days) {
  const d = parseDate(ymd)
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

// Wall-clock parts of an instant in a timezone.
function wallParts(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms))
  const get = (t) => +parts.find((p) => p.type === t).value
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') }
}

// Today's calendar date in a timezone, as "YYYY-MM-DD".
export function todayIn(timeZone, now = new Date()) {
  const p = wallParts(now.getTime(), timeZone)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}

// "2026-09-29" + "12:00" in America/Detroit → Date (the matching UTC instant).
export function zonedToUtc(ymd, hhmm, timeZone) {
  const [y, m, d] = ymd.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const target = Date.UTC(y, m - 1, d, h, mi)
  let ms = target
  // Two passes settle the offset, including across DST changes.
  for (let i = 0; i < 2; i++) {
    const p = wallParts(ms, timeZone)
    ms += target - Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s)
  }
  return new Date(ms)
}

// "2026-09-29" + "12:00" in America/Detroit → "2026-09-29T12:00:00-04:00"
export function zonedIso(ymd, hhmm, timeZone) {
  const [y, m, d] = ymd.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const offsetMin = Math.round((Date.UTC(y, m - 1, d, h, mi) - zonedToUtc(ymd, hhmm, timeZone).getTime()) / 60000)
  const sign = offsetMin < 0 ? '-' : '+'
  const abs = Math.abs(offsetMin)
  return `${ymd}T${pad(h)}:${pad(mi)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}
