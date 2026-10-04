#!/usr/bin/env node
// Fails when a Markdown link in the repo points at a file or heading that does not exist.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const slug = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')

const stripCode = (text) => text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')

export function anchorsOf(text) {
  return new Set(
    stripCodeFences(text)
      .split('\n')
      .filter((line) => /^#{1,6}\s/.test(line))
      .map((line) => slug(line.replace(/^#{1,6}\s/, ''))),
  )
}

function stripCodeFences(text) {
  return text.replace(/```[\s\S]*?```/g, '')
}

/** Tracked and untracked Markdown files, so a doc added by the current change is checked too. */
export function markdownFiles(root) {
  const out = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'],
    { cwd: root, encoding: 'utf8' },
  )
  // The fixtures are broken on purpose; scripts/test runs the check against them directly.
  return out
    .split('\n')
    .filter((f) => f && !f.includes('test/fixtures/') && existsSync(join(root, f)))
}

export function checkDocs(root, files = markdownFiles(root)) {
  const problems = []
  for (const file of files) {
    const text = readFileSync(join(root, file), 'utf8')
    for (const [, target] of stripCode(text).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:)/.test(target)) continue
      const [path, anchor] = target.split('#')
      const dest = path ? resolve(root, dirname(file), path) : join(root, file)
      if (!existsSync(dest)) {
        problems.push(`${file}: broken link ${target}`)
        continue
      }
      if (anchor && dest.endsWith('.md') && !anchorsOf(readFileSync(dest, 'utf8')).has(anchor)) {
        problems.push(`${file}: missing heading ${target}`)
      }
    }
  }
  return { files: files.length, problems }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { files, problems } = checkDocs(process.cwd())
  for (const p of problems) console.error(p)
  if (files === 0) {
    console.error(
      'check-docs found no Markdown files, which means it is looking in the wrong place.',
    )
    process.exit(1)
  }
  console.log(`check-docs: ${files} files, ${problems.length} problems`)
  process.exit(problems.length ? 1 : 0)
}
