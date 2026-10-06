import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { plan, planPosts, record } from '../scripts/schedule.js'
import { zonedIso } from '../scripts/lib/format.js'

const FIXTURE = 'fixtures/events/2026-11-17-sam-rivera.yml' // Tue, Nov 17 2026
const event = YAML.parse(readFileSync(FIXTURE, 'utf8'))
const at = (iso) => new Date(iso)

test('local times carry the right offset on both sides of DST', () => {
  assert.equal(zonedIso('2026-09-29', '12:00', 'America/Detroit'), '2026-09-29T12:00:00-04:00')
  assert.equal(zonedIso('2026-11-10', '12:00', 'America/Detroit'), '2026-11-10T12:00:00-05:00')
})

test('plans four posts at noon Detroit time, day-of at 9 AM', () => {
  const { posts, skipped } = planPosts(event, 'stem', { now: at('2026-09-22T12:00:00Z'), imageBaseUrl: '' })
  assert.deepEqual(skipped, [])
  assert.deepEqual(
    posts.map((p) => [p.key, p.due_at]),
    [
      ['announce', '2026-10-27T12:00:00-04:00'],
      ['week_before', '2026-11-10T12:00:00-05:00'],
      ['day_before', '2026-11-16T12:00:00-05:00'],
      ['day_of', '2026-11-17T09:00:00-05:00'],
    ],
  )
  assert.equal(posts[0].text, event.generated.captions.announce)
  assert.equal(posts[0].image, null)
})

test('late confirmation moves announce to tomorrow and notes it', () => {
  const { posts, skipped } = planPosts(event, 'stem', { now: at('2026-11-03T15:00:00Z') })
  assert.equal(posts[0].key, 'announce')
  assert.equal(posts[0].date, '2026-11-04')
  assert.match(posts[0].note, /moved from Tue, Oct 27 to Wed, Nov 4/)
  assert.deepEqual(skipped, [])
})

test('past posts are skipped; announce is dropped when it would collide', () => {
  const { posts, skipped } = planPosts(event, 'stem', { now: at('2026-11-15T20:00:00Z') })
  assert.deepEqual(posts.map((p) => p.key), ['day_before', 'day_of'])
  assert.deepEqual(skipped.map((s) => s.key), ['announce', 'week_before'])
  assert.match(skipped[0].reason, /too late to announce/)
})

test('image URL comes from the base URL and the event stem', () => {
  const { posts } = planPosts(event, '2026-11-17-sam-rivera', {
    now: at('2026-09-22T12:00:00Z'),
    imageBaseUrl: 'https://example.org/cards/',
  })
  assert.equal(posts[0].image, 'https://example.org/cards/2026-11-17-sam-rivera-square.png')
})

function approvedCopy() {
  const path = join(mkdtempSync(join(tmpdir(), 'lc-')), '2026-11-17-sam-rivera.yml')
  copyFileSync(FIXTURE, path)
  writeFileSync(path, readFileSync(path, 'utf8').replace('status: draft', 'status: approved'))
  return path
}

test('plan refuses unapproved events', () => {
  assert.throws(() => plan(FIXTURE), /approve the copy first/)
})

test('record saves post IDs once, leaves organizer fields alone, and shows up in the plan', () => {
  const path = approvedCopy()
  const before = readFileSync(path, 'utf8')
  const post = { key: 'announce', channelId: 'c1', service: 'twitter', postId: 'p1', dueAt: '2026-10-27T12:00:00-04:00' }

  assert.equal(record(path, post), true)
  assert.equal(record(path, { ...post, postId: 'p2' }), false) // same post + channel: no duplicate

  const after = readFileSync(path, 'utf8')
  assert.equal(after.slice(0, after.indexOf('generated:')), before.slice(0, before.indexOf('generated:')))
  assert.deepEqual(YAML.parse(after).buffer_posts, {
    announce: [{ channel_id: 'c1', service: 'twitter', post_id: 'p1', due_at: '2026-10-27T12:00:00-04:00' }],
  })

  const { posts } = plan(path, { now: at('2026-09-22T12:00:00Z') })
  assert.equal(posts[0].created[0].post_id, 'p1')
  assert.deepEqual(posts[1].created, [])

  assert.throws(() => record(path, { ...post, key: 'nope' }), /unknown post key/)
})
