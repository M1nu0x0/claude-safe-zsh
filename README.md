# claude-safe-zsh

[![release](https://img.shields.io/github/v/release/M1nu0x0/claude-safe-zsh)](https://github.com/M1nu0x0/claude-safe-zsh/releases)
[![CI](https://github.com/M1nu0x0/claude-safe-zsh/actions/workflows/ci.yml/badge.svg)](https://github.com/M1nu0x0/claude-safe-zsh/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/M1nu0x0/claude-safe-zsh)](LICENSE)
[![anthropics/claude-code#103027](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/103027?label=anthropics%2Fclaude-code%23103027)](https://github.com/anthropics/claude-code/issues/103027)

**한국어** | [English](README.en.md) | [日本語](README.ja.md)

Claude Code의 Bash 도구 셸이 zsh일 때, Claude가 bash 문법으로 쓴 명령을 zsh도 bash처럼 해석하게 해 주는 Claude Code 플러그인입니다.

macOS에서는 로그인 셸이 zsh라서 Bash 도구도 zsh로 명령을 실행합니다. 그런데 Claude는 bash 문법으로 명령을 쓰기 때문에, 매치 없는 glob, 따옴표 없는 변수, `=`로 시작하는 단어에서 명령이 멈추거나 조용히 다르게 동작합니다. 이 플러그인은 세션이 시작될 때 Bash 도구의 zsh에 `no_nomatch`, `sh_word_split`, `no_equals` 세 옵션을 켭니다.

**[Website](https://m1nu0x0.github.io/claude-safe-zsh/ko/) · [Releases](https://github.com/M1nu0x0/claude-safe-zsh/releases) · [Changelog](CHANGELOG.md)**

| Claude가 쓴 명령 | zsh 기본값 | 이 플러그인 |
| --- | --- | --- |
| `grep -rn TODO src --include=*.ts` | `(eval):1: no matches found: --include=*.ts`, grep이 실행되지 않음 | grep이 `*.ts` 패턴을 받아 실행 |
| `echo =====; ls` | `(eval):1: ==== not found`, 뒤 명령도 멈춤 | `=====`을 찍고 `ls`까지 실행 |
| `T="a.py b.py"; pytest $T` | `$T`가 한 단어로 넘어가 `a.py b.py`라는 파일 하나를 찾음 | `a.py`, `b.py` 두 인자로 나뉨 |

## 만든 이유

[anthropics/claude-code#103027](https://github.com/anthropics/claude-code/issues/103027) (*Claude keeps writing bash syntax under zsh*) 때문입니다.

이 이슈의 작성자는 2026년 7월 28일부터 10월 17일까지 자신의 transcript를 세어, Bash 도구 호출 61,040번 중 2,570번에서 zsh 오류가 났다고 보고했습니다. 9월 하순 이후로는 1,000번당 51번꼴로 늘었고, 그중 76%는 명령이 0으로 끝나서 오류가 출력 중간에 묻혔습니다. Claude가 zsh 탓이라고 알아챈 경우는 약 3%뿐이었습니다. 가장 많은 세 가지가 매치 없는 glob(`--include=*.ts`, `ls libs/*/README.md`)과 `=` 단어(`echo ====`)였고, 따옴표 없는 변수는 대부분 조용히 실패해서 셀 수 있었던 것보다 많을 것이라고 했습니다.

같은 문제는 앞서 [#67146](https://github.com/anthropics/claude-code/issues/67146)으로도 보고됐지만 활동이 없어 닫혔습니다. #103027이 Claude Code 안에서 고쳐지면 이 플러그인은 필요 없어지므로, 그때 레포를 보관(archive)할 예정입니다. CI가 매일 #103027의 상태를 확인합니다.

## 설치

Claude Code 터미널 프롬프트에서:

```
/plugin install safe-zsh --marketplace M1nu0x0/claude-safe-zsh
```

`Add marketplace?`에 `y`를 누르고 scope는 user를 고릅니다. 셸에서는 이렇게 설치합니다.

```sh
claude plugin install safe-zsh --marketplace M1nu0x0/claude-safe-zsh
```

Claude Desktop에서는 프롬프트 옆 `+` → Plugins → Add marketplace에 `M1nu0x0/claude-safe-zsh`를 넣고 `safe-zsh`를 추가합니다.

설치한 뒤 새 세션부터 적용됩니다.

## 동작

1. 세션이 시작될 때(`SessionStart`: startup, resume, clear, compact) 훅이 `$CLAUDE_ENV_FILE`에 아래 한 줄을 씁니다.

   ```sh
   if [ -n "${ZSH_VERSION:-}" ]; then setopt no_nomatch sh_word_split no_equals; fi
   ```

2. Claude Code는 `CLAUDE_ENV_FILE`의 내용을 Bash 도구 명령마다 앞에 붙여 같은 셸에서 실행합니다. 그래서 `export`뿐 아니라 `setopt`도 적용됩니다.
3. 셸이 bash면 조건이 거짓이라 아무것도 하지 않고 0으로 끝납니다. `[ ... ] && setopt` 대신 `if ... fi`로 쓴 이유입니다.
4. 셸이 zsh(`CLAUDE_CODE_SHELL`이 있으면 그 값, 없으면 `$SHELL`)이면 훅이 stdout으로 한 줄을 더 냅니다. SessionStart 훅의 stdout은 모델에게 전달됩니다. Bash 도구 안에서 직접 띄운 `zsh -c`는 위 옵션을 물려받지 않으니 스크립트 맨 앞에 `setopt no_nomatch sh_word_split no_equals;`를 붙이거나, bash 문법이면 `bash -c`를 쓰라는 안내입니다. 모델이 따르지 않을 수 있고, 도구나 스크립트가 띄우는 자식 zsh에는 닿지 않습니다.

`CLAUDE_ENV_FILE`이 없으면 훅은 아무것도 쓰지 않고 0으로 끝납니다. resume이나 compact 때 같은 줄이 다시 쓰여도 `setopt`가 반복될 뿐입니다.

## 막는 것과 못 막는 것

| 증상 | 예 | zsh 옵션 | 이 플러그인 |
| --- | --- | --- | --- |
| 매치 없는 glob이 명령을 멈춤 | `ls -d ~/.cache/x/*/` → `no matches found` | `nomatch` | 막음 |
| 따옴표 없는 변수가 단어로 나뉘지 않음 | `v="a b"; set -- $v` → `$#`이 1 | `sh_word_split` | 막음 |
| `=`로 시작하는 단어를 명령 경로로 풂 | `echo =====` → 명령 목록 중단, `echo =ls` → `/bin/ls` | `equals` | 막음 |
| 변수 뒤 `:`+글자를 modifier로 해석 | `git show $B:shared/package.json`, `$r:uv.lock` → `HEADv.lock` | 세 옵션 밖 | 못 막음 |
| 변수 뒤 `[`를 배열 첨자로 해석 | `grep -oE "$pat[^};]*"` | 세 옵션 밖 | 못 막음 |
| `path`가 `PATH`와 묶인 배열 | `for path in ...` 뒤 `jq`를 못 찾음 | 세 옵션 밖 | 못 막음 |
| `status`가 읽기 전용 변수 | `status=$(...)` → `read-only variable: status` | 세 옵션 밖 | 못 막음 |
| bash에만 있는 문법 | `${!v}`, `declare -A`, `compgen` | 없음 | 못 막음 |

`emulate sh`를 쓰지 않고 세 옵션만 켜는 이유는, 바뀌는 옵션이 많아 Bash 도구가 snapshot으로 불러오는 사용자 zsh 함수의 동작까지 바꿀 수 있어서입니다.

## 관련 이슈

배지는 각 이슈의 현재 상태(open/closed)를 보여줍니다.

**원인 이슈**

| 이슈 | 상태 | 내용 |
| --- | --- | --- |
| [anthropics/claude-code#103027](https://github.com/anthropics/claude-code/issues/103027) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/103027?label=) | Claude가 zsh에서 bash 문법을 계속 씀. 1,000번당 51번 실패, 76%는 조용히 실패. 이 플러그인이 생긴 이유이자 제거 조건 |

**같은 증상 보고**

| 이슈 | 상태 | 내용 |
| --- | --- | --- |
| [anthropics/claude-code#67146](https://github.com/anthropics/claude-code/issues/67146) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/67146?label=) | #103027의 앞선 보고. zsh에서 bash 전용 문법이 깨짐. 활동이 없어 닫힘 |
| [anthropics/claude-code#103576](https://github.com/anthropics/claude-code/issues/103576) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/103576?label=) | 단어 분리가 안 돼 pytest가 테스트를 하나도 돌리지 않았는데, Claude가 빈 결과를 그대로 보고함 |
| [anthropics/claude-code#74888](https://github.com/anthropics/claude-code/issues/74888) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/74888?label=) | Monitor 도구 예시 스크립트가 bash 단어 분리를 가정해 zsh에서 깨짐 |
| [anthropics/claude-code#101554](https://github.com/anthropics/claude-code/issues/101554) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/101554?label=) | zsh에서 bash 내장 명령(`compgen`)을 실행함. 이 플러그인으로 막지 못하는 경우 |

**셸 선택과 도구 이름**

| 이슈 | 상태 | 내용 |
| --- | --- | --- |
| [anthropics/claude-code#74746](https://github.com/anthropics/claude-code/issues/74746) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/74746?label=) | Bash 도구를 bash로 실행하게 해 달라는 요청. `CLAUDE_CODE_SHELL`로 이미 가능하다는 답과 함께 닫힘 |
| [anthropics/claude-code#7490](https://github.com/anthropics/claude-code/issues/7490) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/7490?label=) | Bash 도구가 쓰는 셸을 고르거나 실행한 셸을 물려받게 해 달라는 요청 |
| [anthropics/claude-code#91498](https://github.com/anthropics/claude-code/issues/91498) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/91498?label=) | Bash 도구가 실제로는 로그인 셸(zsh)을 실행하니 이름을 바꾸거나 셸 오류를 알려 달라는 제안 |
| [anthropics/claude-code#52521](https://github.com/anthropics/claude-code/issues/52521) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/52521?label=) | `Bash` 도구 이름 변경 제안 |
| [anthropics/claude-code#2444](https://github.com/anthropics/claude-code/issues/2444) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/2444?label=) | Bash 도구가 bash가 아니라 기본 셸에서 실행된다는 보고 |
| [anthropics/claude-code#24573](https://github.com/anthropics/claude-code/issues/24573) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/24573?label=) | 사용자 셸이 bash여도 Bash 도구가 zsh로 잡히는 문제 |

새 관련 이슈를 찾으면 issue나 PR로 알려주세요.

## 다른 방법

| 방법 | 적용 범위 | 설치와 제거 |
| --- | --- | --- |
| 이 플러그인 | Bash 도구 셸만. 그 안에서 다시 띄운 `zsh -c`에는 옮겨 가지 않음 | 마켓플레이스에서 켜고 끔 |
| `CLAUDE_CODE_SHELL=/bin/bash` ([#74746](https://github.com/anthropics/claude-code/issues/74746)) | Bash 도구를 아예 bash로 실행. 위 표의 "못 막음"까지 해결 | `settings.json`의 `env`에 추가. zsh 전용 설정과 함수는 쓸 수 없음 |
| `~/.zshenv`에 `CLAUDECODE`일 때만 `setopt` ([#103027 댓글](https://github.com/anthropics/claude-code/issues/103027)) | `CLAUDECODE`를 물려받은 모든 `zsh -c` | dotfile을 직접 수정. 머신마다 따로 설정 |

`~/.zshenv` 블록과 이 플러그인을 같이 켜면 중복이니 하나만 씁니다. #103027 댓글에는 같은 방식의 다른 서드파티 플러그인([JasonGDG/claude-zsh-compat](https://github.com/JasonGDG/claude-zsh-compat))도 소개되어 있습니다.

## 구성

```
.claude-plugin/
  marketplace.json      이 레포를 마켓플레이스로 등록
plugins/safe-zsh/
  .claude-plugin/
    plugin.json         플러그인 매니페스트
  hooks/
    hooks.json          SessionStart 훅 하나
    session-start.sh    CLAUDE_ENV_FILE에 setopt 한 줄 추가, 모델에게 자식 zsh 안내 한 줄 출력
  tests/                node --test 용 테스트
.github/ci/
  engine-env.sh         실제 Claude Code로 훅이 쓴 내용을 확인
site/                   GitHub Pages 사이트(Astro): src/site.json 번역, src/pages/ 페이지
README.en.md, README.ja.md  README 번역본
```

플러그인은 `plugins/safe-zsh/`에 따로 두고 마켓플레이스가 상대경로로 가리킵니다. claude.ai의 Add marketplace는 레포 루트를 통째로 플러그인으로 쓰는 구성을 받아주지 않는 경우가 있어서입니다.

## 개발

```sh
claude plugin validate .                  # 마켓플레이스
claude plugin validate plugins/safe-zsh    # 플러그인
node --test 'plugins/safe-zsh/tests/*.test.mjs'
bash .github/ci/engine-env.sh             # 로그인 없이 실제 Claude Code로 훅 확인
cd site && npm ci && npm run build       # 사이트 빌드와 검사(site/dist)
cd site && npm run dev                    # 로컬 미리보기
cd site && npm run og                     # 언어별 링크 미리보기 이미지 생성(Playwright 필요)
```

사이트는 [Astro](https://astro.build)와 공용 키트 [claude-plugin-site](https://github.com/M1nu0x0/claude-plugin-site)로 만듭니다. 문구는 모두 `site/src/site.json`에, 섹션 순서는 `site/src/pages/[...lang].astro`에 있습니다. `npm run build`는 언어별 페이지(`/`, `/ko/`, `/ja/`)와 `sitemap.xml`을 만든 뒤 크롤러가 읽는 그대로 검사하고(제목·설명 길이, canonical, hreflang, OG, JSON-LD, 깨진 링크와 이미지, HTML 검증), 하나라도 어긋나면 실패합니다. main에 병합되면 Pages 워크플로가 빌드해 배포합니다. 페이지의 JSON-LD에 플러그인 버전이 들어가므로 버전을 올리면 사이트도 다시 배포됩니다. 내용이 바뀌면 `site/src/site.json`의 `updated`도 그날 날짜로 바꿉니다. 바꾸지 않으면 PR에서 CI가 경고합니다. `ask`, `ogImageText`를 바꾸면 `npm run og`로 `site/public/images/og*.png`도 다시 만들어 커밋합니다.

테스트에는 `sh`, `bash`, `zsh`가 필요합니다. 테스트는 `zsh -f`로 실행해 테스트하는 사람의 `~/.zshenv`가 섞이지 않게 합니다.

로그인된 환경에서 Bash 도구까지 확인하려면, `ZDOTDIR`을 빈 임시 디렉터리로 바꿔 `~/.zshenv`를 배제하고 실행합니다. `ON`이 나와야 하고, `--plugin-dir`를 빼면 `OFF`가 나와야 합니다.

```sh
cd "$(mktemp -d)" && printf '%s\n' 'Use the Bash tool to run exactly this command and reply with its output only: [[ -o shwordsplit ]] && echo ON || echo OFF' | ZDOTDIR="$PWD" claude -p --model haiku --plugin-dir /path/to/claude-safe-zsh/plugins/safe-zsh --setting-sources local --strict-mcp-config --allowedTools=Bash
```

새 버전은 `plugins/safe-zsh/.claude-plugin/plugin.json`의 `version`을 올리는 PR을 병합한 뒤, 같은 버전으로 `vX.Y.Z` Release를 만듭니다. 태그가 생기면 CI가 태그와 `version`이 같은지 확인합니다.

## 한계

- Claude Code 전용입니다. Codex 등 다른 에이전트에는 `CLAUDE_ENV_FILE`이 없습니다.
- Claude Code 바이너리에는 `scrubCredentialEnv`일 때 env 스크립트를 건너뛰는 분기가 있습니다. 어떤 모드에서 켜지는지는 확인하지 못했습니다.
- `CLAUDE_ENV_FILE`의 동작이 바뀌면 플러그인이 조용히 효과를 잃을 수 있습니다. CI가 매일 최신 Claude Code로 훅이 쓴 내용을 확인합니다.

## License

MIT
