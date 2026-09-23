import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { csv, fields, setPhoto } from '../scripts/export_canva.js'
import { dateShort, time12 } from '../scripts/lib/format.js'

const FIXTURE = 'fixtures/events/2026-11-17-sam-rivera.yml'

function tempEvents(status) {
  const dir = mkdtempSync(join(tmpdir(), 'lc-'))
  const path = join(dir, '2026-11-17-sam-rivera.yml')
  copyFileSync(FIXTURE, path)
  writeFileSync(path, readFileSync(path, 'utf8').replace('status: draft', `status: ${status}`))
  writeFileSync(join(dir, '_template.yml'), 'status: approved\n')
  return { dir, path }
}

test('formats dates and times for display', () => {
  assert.equal(dateShort('2026-10-20'), 'Tue, Oct 20')
  assert.equal(dateShort('2026-11-01'), 'Sun, Nov 1')
  assert.equal(time12('18:00'), '6:00 PM')
  assert.equal(time12('12:30'), '12:30 PM')
  assert.equal(time12('09:05'), '9:05 AM')
})

test('fields refuses drafts unless previewing', () => {
  const { path } = tempEvents('draft')
  assert.throws(() => fields(path), /status is "draft"/)
  assert.equal(fields(path, { allowDraft: true }).text.date_display, 'Tue, Nov 17')
})

test('fields builds the autofill payload', () => {
  const { path } = tempEvents('approved')
  const f = fields(path)
  assert.deepEqual(f.text, {
    title: "Postgres Tips I Wish I'd Known Earlier",
    hook: 'Indexes, EXPLAIN, and why an app got slow when its table hit a few million rows',
    speaker_name: 'Sam Rivera',
    speaker_title_company: ' ',
    date_display: 'Tue, Nov 17',
    time_display: '6:00 PM',
    venue_name: 'Technology Innovation Center',
  })
  assert.equal(f.photo_url, null)
  assert.equal(f.templates.square.title, '2026-11-17-sam-rivera – square')
  assert.equal(f.templates.story.image, 'out/images/2026-11-17-sam-rivera-story.png')
})

test('csv includes only approved events, skips _ files, and quotes cells', () => {
  const { dir } = tempEvents('approved')
  const { text, count } = csv([join(dir, '2026-11-17-sam-rivera.yml')])
  assert.equal(count, 1)
  const [header, row] = text.trim().split('\r\n')
  assert.equal(header, '"title","hook","speaker_name","speaker_title_company","date_display","time_display","venue_name"')
  assert.match(row, /^"Postgres Tips I Wish I'd Known Earlier","Indexes, EXPLAIN,/)

  assert.equal(csv([join(dir, '2026-11-17-sam-rivera.yml')], { from: '2026-12-01' }).count, 0)
})

test('set-photo changes only the photo_url line', () => {
  const { path } = tempEvents('approved')
  const before = readFileSync(path, 'utf8').split('\n')
  setPhoto(path, 'https://github.com/example.png')
  const after = readFileSync(path, 'utf8').split('\n')
  assert.equal(after.length, before.length)
  assert.deepEqual(after.filter((line, i) => line !== before[i]), ['  photo_url: "https://github.com/example.png"'])
  assert.equal(fields(path).photo_url, 'https://github.com/example.png')

  assert.throws(() => setPhoto(path, 'not a url'), /not a URL/)
  assert.throws(() => setPhoto(path, 'file:///C:/me.jpg'), /must be http/)
})
