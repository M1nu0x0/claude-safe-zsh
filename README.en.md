# claude-safe-zsh

[![release](https://img.shields.io/github/v/release/M1nu0x0/claude-safe-zsh)](https://github.com/M1nu0x0/claude-safe-zsh/releases)
[![CI](https://github.com/M1nu0x0/claude-safe-zsh/actions/workflows/ci.yml/badge.svg)](https://github.com/M1nu0x0/claude-safe-zsh/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/M1nu0x0/claude-safe-zsh)](LICENSE)
[![anthropics/claude-code#103027](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/103027?label=anthropics%2Fclaude-code%23103027)](https://github.com/anthropics/claude-code/issues/103027)

[한국어](README.md) | **English** | [日本語](README.ja.md)

A Claude Code plugin that makes the Bash tool's zsh read the bash-style commands Claude writes the way bash does.

On macOS the login shell is zsh, so the Bash tool runs commands in zsh. Claude writes them for bash, though, so commands stop or silently behave differently on unmatched globs, unquoted variables and words that start with `=`. At session start this plugin turns on three options in the Bash tool's zsh: `no_nomatch`, `sh_word_split` and `no_equals`.

**[Website](https://m1nu0x0.github.io/claude-safe-zsh/) · [Releases](https://github.com/M1nu0x0/claude-safe-zsh/releases) · [Changelog](CHANGELOG.md)**

| Command Claude wrote | zsh as it is | With this plugin |
| --- | --- | --- |
| `grep -rn TODO src --include=*.ts` | `(eval):1: no matches found: --include=*.ts`, grep never runs | grep gets the `*.ts` pattern and runs |
| `echo =====; ls` | `(eval):1: ==== not found`, and the next command stops too | prints `=====` and runs `ls` |
| `T="a.py b.py"; pytest $T` | `$T` is passed as one word, so pytest looks for a single file named `a.py b.py` | split into two arguments, `a.py` and `b.py` |

## Why

Because of [anthropics/claude-code#103027](https://github.com/anthropics/claude-code/issues/103027) (*Claude keeps writing bash syntax under zsh*).

Its author counted their own transcripts from July 28 to October 17, 2026 and found zsh errors in 2,570 of 61,040 Bash tool calls. From late September the rate rose to about 51 per 1,000 calls, and 76% of them were silent: the command exited 0, so the error was buried in the middle of the output. Claude blamed zsh in only about 3% of cases. The three most common were unmatched globs (`--include=*.ts`, `ls libs/*/README.md`) and `=` words (`echo ====`); unquoted variables mostly fail silently, so the author expects there were more than could be counted.

The same problem was reported earlier as [#67146](https://github.com/anthropics/claude-code/issues/67146), which was closed for inactivity. Once #103027 is fixed in Claude Code, this plugin is no longer needed, and the repository will be archived. CI checks the state of #103027 every day.

## Install

At the Claude Code terminal prompt:

```
/plugin install safe-zsh --marketplace M1nu0x0/claude-safe-zsh
```

Answer `y` to `Add marketplace?` and choose the user scope. From a shell:

```sh
claude plugin install safe-zsh --marketplace M1nu0x0/claude-safe-zsh
```

In Claude Desktop, click `+` next to the prompt box → Plugins → Add marketplace, enter `M1nu0x0/claude-safe-zsh`, then add `safe-zsh`.

It applies from the next session after you install it.

## How it works

1. At session start (`SessionStart`: startup, resume, clear, compact) the hook writes this line to `$CLAUDE_ENV_FILE`:

   ```sh
   if [ -n "${ZSH_VERSION:-}" ]; then setopt no_nomatch sh_word_split no_equals; fi
   ```

2. Claude Code prepends the contents of `CLAUDE_ENV_FILE` to every Bash tool command and runs them in the same shell, so `setopt` applies as well as `export`.
3. Under bash the condition is false, so the line does nothing and exits 0. That is why it is `if ... fi` rather than `[ ... ] && setopt`.

Without `CLAUDE_ENV_FILE` the hook writes nothing and exits 0. If the line is written again on resume or compact, `setopt` simply runs twice.

## What it fixes and what it does not

| Symptom | Example | zsh option | This plugin |
| --- | --- | --- | --- |
| An unmatched glob aborts the command | `ls -d ~/.cache/x/*/` → `no matches found` | `nomatch` | Fixed |
| An unquoted variable is not split into words | `v="a b"; set -- $v` → `$#` is 1 | `sh_word_split` | Fixed |
| A word that starts with `=` is expanded to a command path | `echo =====` → the command list stops, `echo =ls` → `/bin/ls` | `equals` | Fixed |
| `:` and a letter after a variable is read as a modifier | `git show $B:shared/package.json`, `$r:uv.lock` → `HEADv.lock` | outside the three | Not fixed |
| `[` after a variable is read as an array subscript | `grep -oE "$pat[^};]*"` | outside the three | Not fixed |
| `path` is an array tied to `PATH` | `jq` not found after `for path in ...` | outside the three | Not fixed |
| `status` is a read-only variable | `status=$(...)` → `read-only variable: status` | outside the three | Not fixed |
| Bash-only syntax | `${!v}`, `declare -A`, `compgen` | none | Not fixed |

It turns on only these three options rather than `emulate sh`, because `emulate sh` changes many options and could change how the user's zsh functions, which the Bash tool loads from a snapshot, behave.

## Related issues

Badges show each issue's current state (open/closed).

**The issue behind this plugin**

| Issue | State | About |
| --- | --- | --- |
| [anthropics/claude-code#103027](https://github.com/anthropics/claude-code/issues/103027) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/103027?label=) | Claude keeps writing bash syntax under zsh. 51 failures per 1,000 calls, 76% silent. The reason for this plugin and the condition for removing it |

**Reports of the same symptoms**

| Issue | State | About |
| --- | --- | --- |
| [anthropics/claude-code#67146](https://github.com/anthropics/claude-code/issues/67146) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/67146?label=) | The earlier report behind #103027: bash-only syntax breaks under zsh. Closed for inactivity |
| [anthropics/claude-code#103576](https://github.com/anthropics/claude-code/issues/103576) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/103576?label=) | Unsplit words made pytest run no tests, and Claude reported the empty result as is |
| [anthropics/claude-code#74888](https://github.com/anthropics/claude-code/issues/74888) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/74888?label=) | Monitor tool example scripts assume bash word splitting and break under zsh |
| [anthropics/claude-code#101554](https://github.com/anthropics/claude-code/issues/101554) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/101554?label=) | A bash builtin (`compgen`) run under zsh. A case this plugin cannot fix |

**Shell choice and the tool's name**

| Issue | State | About |
| --- | --- | --- |
| [anthropics/claude-code#74746](https://github.com/anthropics/claude-code/issues/74746) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/74746?label=) | A request to run the Bash tool under bash. Closed with the answer that `CLAUDE_CODE_SHELL` already does it |
| [anthropics/claude-code#7490](https://github.com/anthropics/claude-code/issues/7490) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/7490?label=) | A request to choose the Bash tool's shell or inherit the shell Claude Code was started from |
| [anthropics/claude-code#91498](https://github.com/anthropics/claude-code/issues/91498) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/91498?label=) | The Bash tool actually runs the login shell (zsh), so rename it or flag shell errors |
| [anthropics/claude-code#52521](https://github.com/anthropics/claude-code/issues/52521) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/52521?label=) | A proposal to rename the `Bash` tool |
| [anthropics/claude-code#2444](https://github.com/anthropics/claude-code/issues/2444) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/2444?label=) | The Bash tool runs in the default shell, not bash |
| [anthropics/claude-code#24573](https://github.com/anthropics/claude-code/issues/24573) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/24573?label=) | The Bash tool picks zsh even when the user's shell is bash |

If you find another related issue, let me know in an issue or PR.

## Other ways

| Way | Applies to | Install and remove |
| --- | --- | --- |
| This plugin | The Bash tool's shell only. A `zsh -c` started inside it does not inherit the options | Turn it on and off in the marketplace |
| `CLAUDE_CODE_SHELL=/bin/bash` ([#74746](https://github.com/anthropics/claude-code/issues/74746)) | Runs the Bash tool in bash. Also fixes the "Not fixed" rows above | Add it under `env` in `settings.json`. zsh-only settings and functions are not available |
| `setopt` in `~/.zshenv` only when `CLAUDECODE` is set ([comment on #103027](https://github.com/anthropics/claude-code/issues/103027)) | Every `zsh -c` that inherits `CLAUDECODE` | Edit your dotfile by hand, on each machine |

The `~/.zshenv` block and this plugin do the same thing, so use one of them. A comment on #103027 also mentions another third-party plugin that works the same way ([JasonGDG/claude-zsh-compat](https://github.com/JasonGDG/claude-zsh-compat)).

## Layout

```
.claude-plugin/
  marketplace.json      registers this repository as a marketplace
plugins/safe-zsh/
  .claude-plugin/
    plugin.json         plugin manifest
  hooks/
    hooks.json          one SessionStart hook
    session-start.sh    appends one setopt line to CLAUDE_ENV_FILE
  tests/                tests for node --test
.github/ci/
  engine-env.sh         checks what the hook wrote, with the real Claude Code
site/                   GitHub Pages site (Astro): src/site.json translations, src/pages/ page
README.en.md, README.ja.md  README translations
```

The plugin lives in its own folder, `plugins/safe-zsh/`, and the marketplace points at it with a relative path, because claude.ai's Add marketplace can reject a repository whose root is itself the plugin.

## Development

```sh
claude plugin validate .                  # marketplace
claude plugin validate plugins/safe-zsh    # plugin
node --test 'plugins/safe-zsh/tests/*.test.mjs'
bash .github/ci/engine-env.sh             # checks the hook with the real Claude Code, without a login
cd site && npm ci && npm run build       # builds and checks the site (site/dist)
cd site && npm run dev                    # local preview
cd site && npm run og                     # draws the link-preview image for each language (needs Playwright)
```

The site is built with [Astro](https://astro.build) and the shared kit [claude-plugin-site](https://github.com/M1nu0x0/claude-plugin-site). All its words are in `site/src/site.json`, and the order of its sections is in `site/src/pages/[...lang].astro`. `npm run build` builds the per-language pages (`/`, `/ko/`, `/ja/`) and `sitemap.xml`, then checks them as a crawler reads them (title and description length, canonical, hreflang, OG, JSON-LD, broken links and images, HTML validity) and fails if any check fails. Once merged to main, the Pages workflow builds and deploys it. The page's JSON-LD carries the plugin version, so a version bump redeploys the site. When the content changes, also set `updated` in `site/src/site.json` to that day; CI warns on a pull request that changes the content without it. After changing `ask` or `ogImageText`, run `npm run og` and commit `site/public/images/og*.png` as well.

The tests need `sh`, `bash` and `zsh`. They run `zsh -f`, so the tester's own `~/.zshenv` does not mix in.

To check the Bash tool itself in a logged-in environment, set `ZDOTDIR` to an empty temporary folder to leave out `~/.zshenv`, then run the command below. It should print `ON`, and `OFF` without `--plugin-dir`.

```sh
cd "$(mktemp -d)" && printf '%s\n' 'Use the Bash tool to run exactly this command and reply with its output only: [[ -o shwordsplit ]] && echo ON || echo OFF' | ZDOTDIR="$PWD" claude -p --model haiku --plugin-dir /path/to/claude-safe-zsh/plugins/safe-zsh --setting-sources local --strict-mcp-config --allowedTools=Bash
```

For a new version, merge a PR that bumps `version` in `plugins/safe-zsh/.claude-plugin/plugin.json`, then create a `vX.Y.Z` Release with the same version. When the tag is created, CI checks that the tag and `version` match.

## Limits

- Claude Code only. Other agents such as Codex have no `CLAUDE_ENV_FILE`.
- The Claude Code binary has a branch that skips the env script when `scrubCredentialEnv` is set. Which modes turn it on has not been checked.
- If `CLAUDE_ENV_FILE` changes how it works, the plugin could silently stop having any effect. CI checks what the hook wrote every day with the latest Claude Code.

## License

MIT
