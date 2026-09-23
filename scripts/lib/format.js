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
