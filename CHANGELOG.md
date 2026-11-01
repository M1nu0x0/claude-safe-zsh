# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- The site has one pre-rendered page per language (`/`, `/ko/`, `/ja/`) instead of one page that switches language in the browser, so search engines and link previews read each language without running JavaScript; each page has its own canonical URL, title, description and Open Graph tags, and the old `?lang=` links redirect to the matching page
- The site is built from `site/` with `node site/build.mjs`, and CI fails if `docs/` is out of date
- The sitemap lists the three pages with `lastmod`

## [0.1.0] - 2026-11-01

### Added

- A SessionStart hook that writes `setopt no_nomatch sh_word_split no_equals` to `CLAUDE_ENV_FILE`, only for zsh, so the Bash tool's zsh reads Claude's bash-style globs, unquoted variables and `=` words the way bash does ([anthropics/claude-code#103027](https://github.com/anthropics/claude-code/issues/103027))
- Tests for the hook under zsh and bash, and CI on Ubuntu and macOS that also starts the real Claude Code to check what the hook leaves in `CLAUDE_ENV_FILE`
- A daily CI run against the latest Claude Code that reports the state of anthropics/claude-code#103027
- A check that a release tag matches the plugin's version, and Dependabot updates for GitHub Actions
- GitHub Pages site and READMEs in Korean, English and Japanese, with every related upstream issue and its live state

[Unreleased]: https://github.com/M1nu0x0/claude-safe-zsh/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/M1nu0x0/claude-safe-zsh/releases/tag/v0.1.0
