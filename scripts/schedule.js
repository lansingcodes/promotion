#!/usr/bin/env node
// Social post schedule for an event. The posts themselves are created in
// Buffer by the /schedule-posts command through the Buffer connector; this
// script decides what to post and when, and remembers what was created.
//
//   node scripts/schedule.js plan <event.yml> [--json]
//     The four posts with their dates, already-created posts marked. No network calls.
//
//   node scripts/schedule.js record <event.yml> <post-key> <channel-id> <service> <buffer-post-id> <due-at>
//     Save a created Buffer post under buffer_posts: in the event file, so reruns skip it.
import { pathToFileURL } from 'node:url'
import { BUFFER, POST_SCHEDULE, POST_TIME, TIMEZONE } from './lib/config.js'
import { eventStem, isExportable, readEventDoc, writeGeneratedSection } from './lib/events.js'
import { addDays, dateShort, todayIn, zonedIso, zonedToUtc } from './lib/format.js'

export function planPosts(event, stem, { now = new Date(), imageBaseUrl = BUFFER.imageBaseUrl } = {}) {
  const posts = []
  const skipped = []
  const image = imageBaseUrl ? new URL(`${stem}-${BUFFER.image}.png`, imageBaseUrl).href : null

  for (const { key, daysBefore, time = POST_TIME } of POST_SCHEDULE) {
    const text = event.generated?.captions?.[key]
    if (!text) throw new Error(`generated.captions.${key} is empty; run /draft-event first`)

    let date = addDays(event.date, -daysBefore)
    let note = null

    if (zonedToUtc(date, time, TIMEZONE) <= now) {
      if (key !== 'announce') {
        skipped.push({ key, reason: `${dateShort(date)} has already passed` })
        continue
      }
      // Confirmed late: announce tomorrow instead, unless that runs into the day-before post.
      const tomorrow = addDays(todayIn(TIMEZONE, now), 1)
      if (tomorrow >= addDays(event.date, -1)) {
        skipped.push({ key, reason: 'too late to announce; the day-before and day-of posts cover it' })
        continue
      }
      note = `confirmed late: moved from ${dateShort(date)} to ${dateShort(tomorrow)}`
      date = tomorrow
    }
    posts.push({
      key,
      date,
      time,
      due_at: zonedIso(date, time, TIMEZONE), // local time with offset, as Buffer's connector wants
      text,
      image,
      note,
      created: event.buffer_posts?.[key] ?? [],
    })
  }
  return { posts, skipped }
}

export function plan(path, opts) {
  const event = readEventDoc(path).toJS()
  if (!isExportable(event)) throw new Error(`status is "${event.status}"; approve the copy first`)
  return {
    event: path,
    organization_id: BUFFER.organizationId,
    channel_ids: BUFFER.channelIds,
    save_to_draft: BUFFER.saveAsDraft,
    ...planPosts(event, eventStem(path), opts),
  }
}

export function record(path, { key, channelId, service, postId, dueAt }) {
  if (!POST_SCHEDULE.some((s) => s.key === key)) throw new Error(`unknown post key "${key}"`)
  if (![channelId, service, postId, dueAt].every(Boolean)) throw new Error('record needs channel id, service, post id and due-at')
  const doc = readEventDoc(path)
  const recorded = doc.toJS().buffer_posts ?? {}
  const list = recorded[key] ?? []
  if (list.some((r) => r.channel_id === channelId)) return false
  recorded[key] = [...list, { channel_id: channelId, service, post_id: postId, due_at: dueAt }]
  doc.set('buffer_posts', doc.createNode(recorded))
  writeGeneratedSection(path, doc)
  return true
}

function printPlan({ posts, skipped }) {
  for (const p of posts) {
    const done = p.created.length ? `  ✓ in Buffer on ${p.created.map((c) => c.service).join(', ')}` : ''
    console.log(`\n${p.key}: ${dateShort(p.date)} ${p.time} (${p.due_at})${p.note ? `  ⚠ ${p.note}` : ''}${done}`)
    console.log(`  ${p.text}`)
    console.log(`  image: ${p.image ?? '(none: attach the square card in Buffer)'}`)
  }
  for (const s of skipped) console.log(`\nskipped ${s.key}: ${s.reason}`)
}

function main(args) {
  const [cmd, path] = args
  if (cmd === 'plan' && path) {
    const result = plan(path)
    if (args.includes('--json')) console.log(JSON.stringify(result, null, 2))
    else printPlan(result)
    return
  }
  if (cmd === 'record' && path && args.length === 7) {
    const [, , key, channelId, service, postId, dueAt] = args
    const added = record(path, { key, channelId, service, postId, dueAt })
    console.log(added ? `Recorded ${key} → ${service} (${postId}).` : `${key} → ${service} was already recorded.`)
    return
  }
  console.error(
    'usage:\n  schedule.js plan <event.yml> [--json]\n  schedule.js record <event.yml> <post-key> <channel-id> <service> <buffer-post-id> <due-at>',
  )
  process.exitCode = 2
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2))
  } catch (err) {
    console.error(`error: ${err.message}`)
    process.exitCode = 1
  }
}
