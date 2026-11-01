#!/usr/bin/env bash
# Starts the real Claude Code with the plugin, without a login, and checks what its SessionStart hook left for the Bash tool.
# Claude Code runs SessionStart hooks before it asks for a login, gives each one its own CLAUDE_ENV_FILE under
# ~/.claude/session-env/<session>/, and prepends those files to every Bash tool command. HOME is a fresh folder so
# only this run's files are there.
set -u

root=$(cd "$(dirname "$0")/../.." && pwd)
home=$(mktemp -d)
work=$(mktemp -d)

out=$(cd "$work" && env -i HOME="$home" PATH="$PATH" \
  claude -p --plugin-dir "$root/plugins/safe-zsh" --max-turns 1 "Reply with just: ok" </dev/null 2>&1 | tail -n 3 | tr '\n' ' ')

files=$(find "$home/.claude/session-env" -type f -name '*.sh' 2>/dev/null)
if [ -z "$files" ]; then
  echo "::error title=engine env file::the SessionStart hook left no CLAUDE_ENV_FILE; claude said: $out"
  exit 1
fi

env_file="$work/env.sh"
cat $files >"$env_file"
echo "::notice title=engine env file::$(tr '\n' ' ' <"$env_file")"

if ! grep -q 'setopt no_nomatch sh_word_split no_equals' "$env_file"; then
  echo "::error title=engine env file::the setopt line is missing"
  exit 1
fi

# What the Bash tool would do with it: zsh gets the three options, bash goes on to the next command.
if command -v zsh >/dev/null; then
  zsh -fc ". '$env_file'; [[ -o shwordsplit ]] && [[ ! -o nomatch ]] && [[ ! -o equals ]]" ||
    { echo "::error title=engine env file::zsh did not get the options"; exit 1; }
fi
bash -c ". '$env_file' && true" || { echo "::error title=engine env file::bash did not exit 0"; exit 1; }
