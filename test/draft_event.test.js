import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { status, write } from '../scripts/draft_event.js'

const FIXTURE = 'fixtures/events/2026-11-17-sam-rivera.yml'

function tempCopy() {
  const path = join(mkdtempSync(join(tmpdir(), 'lc-')), 'event.yml')
  copyFileSync(FIXTURE, path)
  return path
}

const good = () => ({
  title: 'Postgres Tips I Wish I Knew Earlier',
  hook: 'Indexes, EXPLAIN, and what changed when the table hit a few million rows.',
  description_long: 'Para one.\n\nPara two.',
  speaker_bio_short: '',
  captions: {
    announce: 'Announce #LansingCodes',
    week_before: 'Week #LansingCodes',
    day_before: 'Tomorrow #LansingCodes',
    day_of: 'Tonight #LansingCodes',
  },
  email_blurb: 'Blurb.',
  gaps: ['No speaker bio'],
})

test('writes generated block and leaves organizer fields byte-identical', () => {
  const path = tempCopy()
  const before = readFileSync(path, 'utf8')
  write(path, good())
  const after = readFileSync(path, 'utf8')

  const organizerPart = (s) => s.slice(0, s.indexOf('# --- Generated'))
  assert.equal(organizerPart(after), organizerPart(before))

  const data = YAML.parse(after)
  assert.equal(data.generated.title, 'Postgres Tips I Wish I Knew Earlier')
  assert.equal(data.generated.description_long, 'Para one.\n\nPara two.\n')
  assert.deepEqual(data.generated.gaps, ['No speaker bio'])
  assert.match(after, /description_long: \|\n    Para one\./)
})

test('rejects captions over 280 characters', () => {
  const path = tempCopy()
  const g = good()
  g.captions.announce = `${'a'.repeat(270)} #LansingCodes`
  assert.throws(() => write(path, g), /captions\.announce is 284 chars/)
})

test('rejects missing and unknown keys', () => {
  const path = tempCopy()
  const g = good()
  delete g.hook
  g.speaker = { name: 'Someone Else' }
  assert.throws(() => write(path, g), /unknown keys: speaker[\s\S]*hook must be a string/)
})

test('approved events need --confirmed, and rewrites reset status to draft', () => {
  const path = tempCopy()
  writeFileSync(path, readFileSync(path, 'utf8').replace('status: draft', 'status: approved'))
  assert.equal(status(path).needs_confirmation, true)
  assert.throws(() => write(path, good()), /event is approved/)

  write(path, good(), { confirmed: true })
  assert.equal(YAML.parse(readFileSync(path, 'utf8')).status, 'draft')
})

test('warns on avoided words without blocking', () => {
  const path = tempCopy()
  const g = good()
  g.email_blurb = 'An exciting deep dive into indexes.'
  const { warnings } = write(path, g)
  assert.ok(warnings.some((w) => /exciting, deep dive/.test(w)))
})
