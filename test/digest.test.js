import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { renderDigest } from '../scripts/digest.js'

function withEvents(files, run) {
  const dir = mkdtempSync(join(tmpdir(), 'lansing-digest-'))
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
    return run(dir)
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

const event = ({ date = '2027-03-10', title = 'A talk', status = 'approved', link = 'https://example.org/register' } = {}) => `
date: ${date}
start_time: "18:00"
end_time: "20:00"
venue: { name: "Main Hall" }
registration_link: "${link}"
generated:
  title: "${title}"
  hook: "Meet the speaker"
  email_blurb: "A practical discussion"
status: ${status}
`

test('sorts approved and published events, excluding drafts and other months', () => withEvents({
  'b.yml': event({ date: '2027-03-20', title: 'Later' }),
  'a.yml': event({ date: '2027-03-10', title: 'Earlier', status: 'published' }),
  'draft.yml': event({ date: '2027-03-01', title: 'Draft', status: 'draft' }),
  'other.yml': event({ date: '2027-04-01', title: 'Other' }),
}, (dir) => {
  const result = renderDigest('2027-03', { eventsDir: dir })
  assert.equal(result.count, 2)
  assert.ok(result.html.indexOf('Earlier') < result.html.indexOf('Later'))
  assert.ok(!result.html.includes('Draft'))
  assert.match(result.text, /Wed, Mar 10, 6:00 PM–8:00 PM/)
}))

test('escapes HTML and rejects unsafe registration URLs', () => withEvents({
  'safe.yml': event({ title: '<script>alert(1)</script>' }),
}, (dir) => {
  const result = renderDigest('2027-03', { eventsDir: dir })
  assert.match(result.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.ok(!result.html.includes('<script>'))
  writeFileSync(join(dir, 'safe.yml'), event({ link: 'javascript:alert(1)' }))
  assert.throws(() => renderDigest('2027-03', { eventsDir: dir }), /invalid registration_link/)
}))

test('renders a clear empty month and rejects impossible dates', () => withEvents({}, (dir) => {
  assert.match(renderDigest('2027-03', { eventsDir: dir }).text, /No Lansing Codes events/)
  writeFileSync(join(dir, 'bad.yml'), event({ date: '2027-03-32' }))
  assert.throws(() => renderDigest('2027-03', { eventsDir: dir }), /invalid event date/)
}))
