// @ts-check
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import assert from 'node:assert/strict'
import { test } from 'node:test'

const HOOKS = join(import.meta.dirname, '..', 'hooks')
const HOOK = join(HOOKS, 'pre-tool-use.sh')

/**
 * @typedef {{ hookSpecificOutput: { hookEventName: string, permissionDecision: string, permissionDecisionReason: string } }} Decision
 */

// Runs the hook on a Bash tool call the way Claude Code does: the call as JSON on stdin, one line unless `indent` is given.
/** @param {string} command @param {{ indent?: number, extra?: Record<string, unknown> }} [opts] */
function run(command, { indent, extra = {} } = {}) {
  const input = {
    session_id: 'test',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command, description: 'Run a command', ...extra },
  }
  const r = spawnSync('sh', [HOOK], { encoding: 'utf8', input: JSON.stringify(input, null, indent) })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.stderr, '')
  return r.stdout
}

// The decision the hook printed, or null when it printed nothing and left the call to Claude Code.
/** @param {string} command @param {{ indent?: number, extra?: Record<string, unknown> }} [opts] @returns {Decision | null} */
function decide(command, opts) {
  const out = run(command, opts)
  return out === '' ? null : JSON.parse(out)
}

/** @param {string} command @param {{ indent?: number, extra?: Record<string, unknown> }} [opts] */
function assertDenied(command, opts) {
  const d = decide(command, opts)
  assert.ok(d, `expected a deny for: ${command}`)
  assert.equal(d.hookSpecificOutput.hookEventName, 'PreToolUse')
  assert.equal(d.hookSpecificOutput.permissionDecision, 'deny')
}

test('the command from the report, print -l ${(s/:/)PATH}, is denied with a reason for the model', () => {
  const d = decide('print -l ${(s/:/)PATH} | rg -c /')
  assert.ok(d)
  assert.equal(d.hookSpecificOutput.permissionDecision, 'deny')
  const reason = d.hookSpecificOutput.permissionDecisionReason
  assert.match(reason, /^safe-zsh: /)
  assert.match(reason, /\$\{\(flags\)\.\.\.\}/)
  assert.match(reason, /dangerous rm/)
  // The rewrite it suggests is real POSIX sh, decoded from JSON as the model reads it.
  assert.ok(reason.includes(`printf '%s\\n' "$PATH" | tr ':' '\\n'`))
  assert.ok(reason.includes('while IFS= read -r line; do ...; done < file'))
})

test('other flag forms are denied too, inside double quotes and command substitutions', () => {
  assertDenied('for f in "${(@f)$(git ls-files)}"; do echo "$f"; done')
  assertDenied('echo ${(j:,:)arr}')
  assertDenied('n=$(echo ${(U)name})')
  assertDenied('cd /tmp &&\nprint -l ${(k)commands}')
})

test('a command without ${(...)} prints nothing, so Claude Code decides as it would without the plugin', () => {
  assert.equal(run(`printf '%s\\n' "$PATH" | tr ':' '\\n' | rg -c /`), '')
  assert.equal(run('ls ${HOME}/x $((1 + 2)) "$(pwd)" ${v:-d}'), '')
  assert.equal(run('rm -rf ./build'), '')
})

test('the rewrite the deny message suggests passes the hook itself', () => {
  const reason = decide('print -l ${(s/:/)PATH}')?.hookSpecificOutput.permissionDecisionReason ?? ''
  const rewrite = reason.match(/split a variable with (.+?), and read lines/)?.[1]
  assert.ok(rewrite)
  assert.equal(run(`${rewrite} | rg -c /`), '')
})

test('${(...)} inside single quotes is literal text and is let through, as the built-in check does', () => {
  assert.equal(run(`echo '\${(s/:/)PATH}'`), '')
  assert.equal(run(`zsh -fc 'print -l \${(s/:/)PATH}' | rg -c /`), '')
  // Outside the quotes it is still code.
  assertDenied(`echo 'a' \${(s/:/)PATH} 'b'`)
})

test('known over-matches, listed in the README limits: an escaped \\${(, a comment and a quoted heredoc body', () => {
  // bash reads all three as text, but the hook does not parse the shell. If it learns to, flip these.
  assertDenied('echo \\${(f)x}')
  assertDenied('ls # ${(f)x}')
  assertDenied("cat > a.zsh <<'EOF'\nprint -l ${(s/:/)PATH}\nEOF")
})

test('escaped double quotes in the command do not cut it short', () => {
  assertDenied('echo "say \\"hi\\"" ${(f)x}')
  assert.equal(run('echo "say \\"${HOME}\\""'), '')
})

test('only the command is read: ${(...)} in the description or another field is ignored', () => {
  assert.equal(run('ls', { extra: { description: 'Avoid ${(s/:/)PATH} here' } }), '')
  assert.equal(run('ls', { extra: { note: '"command":"${(f)x}"' } }), '')
})

test('pretty-printed JSON, with spaces after the colon, is read the same way', () => {
  assertDenied('print -l ${(s/:/)PATH}', { indent: 2 })
  assert.equal(run('ls', { indent: 2 }), '')
})

test('input without a Bash command exits 0 and prints nothing', () => {
  for (const input of ['', '{}', '{"tool_name":"Read","tool_input":{"file_path":"/x"}}', 'not json']) {
    const r = spawnSync('sh', [HOOK], { encoding: 'utf8', input })
    assert.deepEqual([r.status, r.stdout, r.stderr], [0, '', ''])
  }
})

test('the hook can only deny: its script has no allow or ask decision', () => {
  const script = readFileSync(HOOK, 'utf8')
  const decisions = [...script.matchAll(/"permissionDecision":"(\w+)"/g)].map(m => m[1])
  assert.deepEqual(decisions, ['deny'])
})

test('hooks.json runs the PreToolUse hook for Bash and keeps the SessionStart hook', () => {
  const config = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'))
  const pre = config.hooks.PreToolUse
  assert.equal(pre.length, 1)
  assert.equal(pre[0].matcher, 'Bash')
  assert.deepEqual(pre[0].hooks, [{ type: 'command', command: 'sh "${CLAUDE_PLUGIN_ROOT}/hooks/pre-tool-use.sh"' }])
  assert.equal(config.hooks.SessionStart.length, 1)
  for (const group of Object.values(config.hooks)) {
    for (const h of group[0].hooks) {
      const file = h.command.match(/\/hooks\/([\w-]+\.sh)/)?.[1]
      assert.ok(file && existsSync(join(HOOKS, file)), h.command)
    }
  }
})
