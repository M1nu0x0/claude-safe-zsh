# claude-safe-zsh

[![release](https://img.shields.io/github/v/release/M1nu0x0/claude-safe-zsh)](https://github.com/M1nu0x0/claude-safe-zsh/releases)
[![CI](https://github.com/M1nu0x0/claude-safe-zsh/actions/workflows/ci.yml/badge.svg)](https://github.com/M1nu0x0/claude-safe-zsh/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/M1nu0x0/claude-safe-zsh)](LICENSE)
[![anthropics/claude-code#103027](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/103027?label=anthropics%2Fclaude-code%23103027)](https://github.com/anthropics/claude-code/issues/103027)

[한국어](README.md) | [English](README.en.md) | **日本語**

Claude Code の Bash ツールのシェルが zsh のとき、Claude が bash の書き方で書いたコマンドを zsh でも bash と同じように解釈させる Claude Code のプラグインです。

macOS ではログインシェルが zsh なので、Bash ツールも zsh でコマンドを実行します。ところが Claude は bash の書き方でコマンドを書くため、一致しない glob、クォートしていない変数、`=` で始まる単語でコマンドが止まったり、気づかないうちに違う動きをしたりします。このプラグインはセッション開始時に、Bash ツールの zsh で `no_nomatch`、`sh_word_split`、`no_equals` の 3 つのオプションをオンにします。

**[Website](https://m1nu0x0.github.io/claude-safe-zsh/ja/) · [Releases](https://github.com/M1nu0x0/claude-safe-zsh/releases) · [Changelog](CHANGELOG.md)**

| Claude が書いたコマンド | そのままの zsh | このプラグイン |
| --- | --- | --- |
| `grep -rn TODO src --include=*.ts` | `(eval):1: no matches found: --include=*.ts`、grep が実行されない | grep が `*.ts` のパターンを受け取って実行される |
| `echo =====; ls` | `(eval):1: ==== not found`、後のコマンドも止まる | `=====` を出力し `ls` まで実行される |
| `T="a.py b.py"; pytest $T` | `$T` が 1 語のまま渡され、`a.py b.py` という 1 つのファイルを探す | `a.py` と `b.py` の 2 つの引数に分かれる |

## 作った理由

[anthropics/claude-code#103027](https://github.com/anthropics/claude-code/issues/103027)（*Claude keeps writing bash syntax under zsh*）がきっかけです。

この issue の作成者は 2026 年 7 月 28 日から 10 月 17 日までの自分の transcript を数え、Bash ツールの呼び出し 61,040 回のうち 2,570 回で zsh のエラーが出たと報告しました。9 月下旬以降は 1,000 回あたり約 51 回に増え、その 76% はコマンドが 0 で終わったため、エラーが出力の途中に埋もれていました。Claude が zsh のせいだと気づいたのは約 3% だけでした。多かった上位 3 つは一致しない glob（`--include=*.ts`、`ls libs/*/README.md`）と `=` の単語（`echo ====`）で、クォートしていない変数はほとんどが気づかれずに失敗するので、数えられた以上にあるはずだとしています。

同じ問題は以前 [#67146](https://github.com/anthropics/claude-code/issues/67146) でも報告されましたが、活動がなく閉じられました。#103027 が Claude Code で修正されればこのプラグインは不要になるので、そのときリポジトリをアーカイブする予定です。CI が毎日 #103027 の状態を確認しています。

## インストール

Claude Code のターミナルのプロンプトで:

```
/plugin install safe-zsh --marketplace M1nu0x0/claude-safe-zsh
```

`Add marketplace?` に `y` と答え、scope は user を選びます。シェルからは次のようにインストールします。

```sh
claude plugin install safe-zsh --marketplace M1nu0x0/claude-safe-zsh
```

Claude Desktop では、プロンプト横の `+` → Plugins → Add marketplace に `M1nu0x0/claude-safe-zsh` を入力し、`safe-zsh` を追加します。

インストール後、次のセッションから適用されます。

## 動作

1. セッション開始時（`SessionStart`: startup、resume、clear、compact）に、フックが `$CLAUDE_ENV_FILE` に次の 1 行を書きます。

   ```sh
   if [ -n "${ZSH_VERSION:-}" ]; then setopt no_nomatch sh_word_split no_equals; fi
   ```

2. Claude Code は `CLAUDE_ENV_FILE` の内容を Bash ツールのコマンドごとに先頭に付け、同じシェルで実行します。そのため `export` だけでなく `setopt` も適用されます。
3. シェルが bash なら条件が偽になり、何もせずに 0 で終わります。`[ ... ] && setopt` ではなく `if ... fi` で書いているのはこのためです。

`CLAUDE_ENV_FILE` がなければ、フックは何も書かずに 0 で終わります。resume や compact のときに同じ行がもう一度書かれても、`setopt` が繰り返されるだけです。

## 防げるものと防げないもの

| 症状 | 例 | zsh のオプション | このプラグイン |
| --- | --- | --- | --- |
| 一致しない glob がコマンドを止める | `ls -d ~/.cache/x/*/` → `no matches found` | `nomatch` | 防げる |
| クォートしていない変数が単語に分割されない | `v="a b"; set -- $v` → `$#` が 1 | `sh_word_split` | 防げる |
| `=` で始まる単語をコマンドのパスに展開する | `echo =====` → コマンド列が止まる、`echo =ls` → `/bin/ls` | `equals` | 防げる |
| 変数の後の `:` と文字を修飾子として解釈する | `git show $B:shared/package.json`、`$r:uv.lock` → `HEADv.lock` | 3 つの外 | 防げない |
| 変数の後の `[` を配列の添字として解釈する | `grep -oE "$pat[^};]*"` | 3 つの外 | 防げない |
| `path` が `PATH` と結び付いた配列 | `for path in ...` の後で `jq` が見つからない | 3 つの外 | 防げない |
| `status` が読み取り専用の変数 | `status=$(...)` → `read-only variable: status` | 3 つの外 | 防げない |
| bash にしかない書き方 | `${!v}`、`declare -A`、`compgen` | なし | 防げない |

`emulate sh` ではなく 3 つのオプションだけをオンにするのは、`emulate sh` は変わるオプションが多く、Bash ツールが snapshot から読み込むユーザーの zsh 関数の動きまで変えてしまうおそれがあるからです。

## 関連 issue

バッジは各 issue の現在の状態（open/closed）を表示します。

**このプラグインのきっかけになった issue**

| Issue | 状態 | 内容 |
| --- | --- | --- |
| [anthropics/claude-code#103027](https://github.com/anthropics/claude-code/issues/103027) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/103027?label=) | Claude が zsh で bash の書き方を使い続ける。1,000 回あたり 51 回失敗し、76% は気づかれない。このプラグインを作った理由であり、削除する条件 |

**同じ症状の報告**

| Issue | 状態 | 内容 |
| --- | --- | --- |
| [anthropics/claude-code#67146](https://github.com/anthropics/claude-code/issues/67146) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/67146?label=) | #103027 の以前の報告。zsh で bash 専用の書き方が壊れる。活動がなく閉じられた |
| [anthropics/claude-code#103576](https://github.com/anthropics/claude-code/issues/103576) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/103576?label=) | 単語分割されず pytest がテストを 1 つも実行しなかったのに、Claude が空の結果をそのまま報告した |
| [anthropics/claude-code#74888](https://github.com/anthropics/claude-code/issues/74888) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/74888?label=) | Monitor ツールの例のスクリプトが bash の単語分割を前提にしていて zsh で壊れる |
| [anthropics/claude-code#101554](https://github.com/anthropics/claude-code/issues/101554) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/101554?label=) | zsh で bash の組み込みコマンド（`compgen`）を実行した。このプラグインでは防げないケース |

**シェルの選択とツールの名前**

| Issue | 状態 | 内容 |
| --- | --- | --- |
| [anthropics/claude-code#74746](https://github.com/anthropics/claude-code/issues/74746) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/74746?label=) | Bash ツールを bash で実行したいという要望。`CLAUDE_CODE_SHELL` ですでにできるという回答とともに閉じられた |
| [anthropics/claude-code#7490](https://github.com/anthropics/claude-code/issues/7490) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/7490?label=) | Bash ツールのシェルを選ぶか、Claude Code を起動したシェルを引き継ぎたいという要望 |
| [anthropics/claude-code#91498](https://github.com/anthropics/claude-code/issues/91498) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/91498?label=) | Bash ツールは実際にはログインシェル（zsh）を実行するので、名前を変えるかシェルのエラーを知らせてほしいという提案 |
| [anthropics/claude-code#52521](https://github.com/anthropics/claude-code/issues/52521) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/52521?label=) | `Bash` ツールの名前変更の提案 |
| [anthropics/claude-code#2444](https://github.com/anthropics/claude-code/issues/2444) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/2444?label=) | Bash ツールが bash ではなく既定のシェルで実行されるという報告 |
| [anthropics/claude-code#24573](https://github.com/anthropics/claude-code/issues/24573) | ![](https://img.shields.io/github/issues/detail/state/anthropics/claude-code/24573?label=) | ユーザーのシェルが bash でも Bash ツールが zsh になる問題 |

新しい関連 issue を見つけたら、issue か PR で教えてください。

## 他の方法

| 方法 | 適用範囲 | インストールと削除 |
| --- | --- | --- |
| このプラグイン | Bash ツールのシェルだけ。その中で起動した `zsh -c` には引き継がれない | マーケットプレイスでオン・オフ |
| `CLAUDE_CODE_SHELL=/bin/bash`（[#74746](https://github.com/anthropics/claude-code/issues/74746)） | Bash ツールを bash で実行する。上の表の「防げない」も解決する | `settings.json` の `env` に追加。zsh 専用の設定や関数は使えない |
| `~/.zshenv` で `CLAUDECODE` のときだけ `setopt`（[#103027 のコメント](https://github.com/anthropics/claude-code/issues/103027)） | `CLAUDECODE` を引き継いだすべての `zsh -c` | dotfile を手で編集。マシンごとに設定 |

`~/.zshenv` のブロックとこのプラグインを両方オンにすると重複するので、どちらか一方を使います。#103027 のコメントでは、同じ方式の別のサードパーティ製プラグイン（[JasonGDG/claude-zsh-compat](https://github.com/JasonGDG/claude-zsh-compat)）も紹介されています。

## 構成

```
.claude-plugin/
  marketplace.json      このリポジトリをマーケットプレイスとして登録
plugins/safe-zsh/
  .claude-plugin/
    plugin.json         プラグインのマニフェスト
  hooks/
    hooks.json          SessionStart フック 1 つ
    session-start.sh    CLAUDE_ENV_FILE に setopt を 1 行追加
  tests/                node --test 用のテスト
.github/ci/
  engine-env.sh         本物の Claude Code でフックが書いた内容を確認
site/                   GitHub Pages サイト（Astro）: src/site.json 翻訳、src/pages/ ページ
README.en.md, README.ja.md  README の翻訳
```

プラグインは `plugins/safe-zsh/` に分けて置き、マーケットプレイスから相対パスで指しています。claude.ai の Add marketplace は、リポジトリのルートをそのままプラグインとして使う構成を受け付けないことがあるためです。

## 開発

```sh
claude plugin validate .                  # マーケットプレイス
claude plugin validate plugins/safe-zsh    # プラグイン
node --test 'plugins/safe-zsh/tests/*.test.mjs'
bash .github/ci/engine-env.sh             # ログインなしで本物の Claude Code でフックを確認
cd site && npm ci && npm run build       # サイトのビルドと検査（site/dist）
cd site && npm run dev                    # ローカルでプレビュー
cd site && npm run og                     # 言語ごとのリンクプレビュー画像を生成（Playwright が必要）
```

サイトは [Astro](https://astro.build) と共通キット [claude-plugin-site](https://github.com/M1nu0x0/claude-plugin-site) で作ります。文言はすべて `site/src/site.json` に、セクションの順序は `site/src/pages/[...lang].astro` にあります。`npm run build` は言語別のページ（`/`、`/ko/`、`/ja/`）と `sitemap.xml` を生成したあと、クローラーが読むとおりに検査し（タイトルと説明の長さ、canonical、hreflang、OG、JSON-LD、リンク切れと画像切れ、HTML の妥当性）、ひとつでも外れると失敗します。main にマージされると Pages ワークフローがビルドしてデプロイします。ページの JSON-LD にプラグインのバージョンが入るので、バージョンを上げるとサイトもデプロイし直されます。内容を変えたら `site/src/site.json` の `updated` もその日の日付にします。変えないと、プルリクエストで CI が警告します。`ask` や `ogImageText` を変えたら、`npm run og` で `site/public/images/og*.png` も生成し直してコミットします。

テストには `sh`、`bash`、`zsh` が必要です。テストは `zsh -f` で実行し、テストする人の `~/.zshenv` が混ざらないようにしています。

ログインした環境で Bash ツールまで確認するには、`ZDOTDIR` を空の一時ディレクトリにして `~/.zshenv` を除外し、次のコマンドを実行します。`ON` が出力され、`--plugin-dir` を外すと `OFF` が出力されるはずです。

```sh
cd "$(mktemp -d)" && printf '%s\n' 'Use the Bash tool to run exactly this command and reply with its output only: [[ -o shwordsplit ]] && echo ON || echo OFF' | ZDOTDIR="$PWD" claude -p --model haiku --plugin-dir /path/to/claude-safe-zsh/plugins/safe-zsh --setting-sources local --strict-mcp-config --allowedTools=Bash
```

新しいバージョンは、`plugins/safe-zsh/.claude-plugin/plugin.json` の `version` を上げる PR をマージしてから、同じバージョンで `vX.Y.Z` の Release を作ります。タグができると、CI がタグと `version` が一致しているか確認します。

## 制限

- Claude Code 専用です。Codex など他のエージェントには `CLAUDE_ENV_FILE` がありません。
- Claude Code のバイナリには、`scrubCredentialEnv` のとき env スクリプトを飛ばす分岐があります。どのモードで有効になるかは確認できていません。
- `CLAUDE_ENV_FILE` の動作が変わると、プラグインが気づかないうちに効かなくなる可能性があります。CI が毎日最新の Claude Code でフックが書いた内容を確認しています。

## License

MIT
