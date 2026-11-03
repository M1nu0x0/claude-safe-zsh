// @ts-check
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import assert from 'node:assert/strict'
import { test } from 'node:test'

const HOOK = join(import.meta.dirname, '..', 'hooks', 'session-start.sh')
const LINE = 'if [ -n "${ZSH_VERSION:-}" ]; then setopt no_nomatch sh_word_split no_equals; fi\n'

const OPTS = 'setopt no_nomatch sh_word_split no_equals'

// Runs the hook the way Claude Code does, with CLAUDE_ENV_FILE set (or not), and returns what it wrote.
/** @param {string} [envFile] @param {NodeJS.ProcessEnv} [extraEnv] */
function hook(envFile, extraEnv = {}) {
  /** @type {NodeJS.ProcessEnv} */
  const env = { ...process.env, ...extraEnv }
  delete env.CLAUDE_ENV_FILE
  if (envFile) env.CLAUDE_ENV_FILE = envFile
  return spawnSync('sh', [HOOK], { encoding: 'utf8', env })
}

// What the hook prints for the model, given the shell Claude Code would pick (an empty value counts as unset).
/** @param {NodeJS.ProcessEnv} shellEnv @returns {string} */
function hint(shellEnv) {
  const dir = mkdtempSync(join(tmpdir(), 'safe-zsh-'))
  try {
    const r = hook(join(dir, 'env.sh'), shellEnv)
    assert.equal(r.status, 0)
    return r.stdout
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// A fresh env file with the hook's line in it, as the Bash tool would see it.
/** @template T @param {(file: string) => T} run @returns {T} */
function withEnvFile(run) {
  const dir = mkdtempSync(join(tmpdir(), 'safe-zsh-'))
  try {
    const file = join(dir, 'env.sh')
    assert.equal(hook(file).status, 0)
    return run(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// `zsh -f` skips the tester's own ~/.zshenv, so its settings cannot mix into the result.
/** @param {string} file @param {string} script */
const zsh = (file, script) =>
  spawnSync('zsh', ['-fc', `. "${file}"; ${script}`], { encoding: 'utf8', env: { ...process.env } })

test('with CLAUDE_ENV_FILE, the hook appends one setopt line to it', () => {
  withEnvFile(file => {
    assert.equal(readFileSync(file, 'utf8'), LINE)
  })
})

test('a second run (resume, clear, compact) appends the same line again, which is harmless', () => {
  withEnvFile(file => {
    assert.equal(hook(file).status, 0)
    assert.equal(readFileSync(file, 'utf8'), LINE + LINE)
    assert.equal(zsh(file, '[[ -o shwordsplit ]]').status, 0)
  })
})

test('without CLAUDE_ENV_FILE, the hook exits 0 and writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'safe-zsh-'))
  try {
    const r = spawnSync('sh', [HOOK], { encoding: 'utf8', cwd: dir, env: { PATH: process.env.PATH ?? '' } })
    assert.equal(r.status, 0)
    assert.equal(r.stdout + r.stderr, '')
    assert.equal(existsSync(join(dir, 'env.sh')), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('zsh gets sh_word_split on, nomatch off and equals off', () => {
  withEnvFile(file => {
    const r = zsh(file, '[[ -o shwordsplit ]] && [[ ! -o nomatch ]] && [[ ! -o equals ]]')
    assert.equal(r.status, 0)
  })
})

test('bash sources the line and exits 0, so a command chained after it still runs', () => {
  withEnvFile(file => {
    const r = spawnSync('bash', ['-c', `. "${file}" && echo next`], { encoding: 'utf8' })
    assert.deepEqual([r.status, r.stdout], [0, 'next\n'])
  })
})

test('an unmatched glob is passed through instead of aborting the command', () => {
  withEnvFile(file => {
    const r = zsh(file, 'echo /nonexistent-safe-zsh/*/ --include=*.nomatch; echo after')
    assert.deepEqual([r.status, r.stdout], [0, '/nonexistent-safe-zsh/*/ --include=*.nomatch\nafter\n'])
  })
})

test('a word that starts with = is printed as is, not looked up as a command', () => {
  withEnvFile(file => {
    // With nomatch off alone, `=====` already survives, but `=ls` would still turn into /usr/bin/ls; equals off keeps both.
    const r = zsh(file, 'echo =====; echo =ls; echo after')
    assert.deepEqual([r.status, r.stdout], [0, '=====\n=ls\nafter\n'])
  })
})

test('an unquoted variable is split into words, as bash does', () => {
  withEnvFile(file => {
    const r = zsh(file, 'v="a b"; set -- $v; echo $#')
    assert.equal(r.stdout, '2\n')
  })
})

test('under zsh, the hook prints one line telling the model how to start a child zsh', () => {
  const out = hint({ SHELL: '/bin/zsh', CLAUDE_CODE_SHELL: '' })
  assert.equal(out.split('\n').filter(Boolean).length, 1)
  assert.match(out, /zsh -c/)
  // The hint and the line the hook writes must name the same options.
  assert.ok(LINE.includes(OPTS))
  assert.ok(out.includes(`"${OPTS};"`))
})

test('under bash the hook prints nothing, and CLAUDE_CODE_SHELL decides over SHELL', () => {
  assert.equal(hint({ SHELL: '/bin/bash', CLAUDE_CODE_SHELL: '' }), '')
  assert.equal(hint({ SHELL: '/bin/zsh', CLAUDE_CODE_SHELL: '/bin/bash' }), '')
  assert.notEqual(hint({ SHELL: '/bin/bash', CLAUDE_CODE_SHELL: '/bin/zsh' }), '')
})

test('plain zsh, without the line, still fails all three: the tests above are not passing by accident', () => {
  const r = spawnSync('zsh', ['-fc', 'v="a b"; set -- $v; echo $#; echo =====; echo after'], { encoding: 'utf8' })
  assert.equal(r.stdout.startsWith('1\n'), true)
  assert.ok(!r.stdout.includes('after'))
  assert.notEqual(spawnSync('zsh', ['-fc', 'echo /nonexistent-safe-zsh/*/'], { encoding: 'utf8' }).status, 0)
})
