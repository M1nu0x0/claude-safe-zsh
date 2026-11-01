#!/bin/sh
# Claude Code prepends the contents of $CLAUDE_ENV_FILE to every Bash tool command and runs them in the same shell,
# so a setopt written here applies to the Bash tool's zsh. Outside zsh the line does nothing.
# `if ... fi` rather than `[ ... ] && setopt`: under bash the test is false, and the line must still exit 0.
[ -n "${CLAUDE_ENV_FILE:-}" ] || exit 0
cat >> "$CLAUDE_ENV_FILE" <<'EOF'
if [ -n "${ZSH_VERSION:-}" ]; then setopt no_nomatch sh_word_split no_equals; fi
EOF
# That line reaches only the Bash tool's own shell, so tell the model about the zsh it starts inside a command; stdout of
# a SessionStart hook goes to the model. shortcut: the model may ignore it, a ZDOTDIR .zshenv would hold for every child zsh.
case "${CLAUDE_CODE_SHELL:-${SHELL:-}}" in
  *zsh) echo 'The Bash tool runs zsh with setopt no_nomatch sh_word_split no_equals applied. A zsh you start inside a command (zsh -c, zsh -ic, a #!/bin/zsh script) does not inherit it: begin its script with "setopt no_nomatch sh_word_split no_equals;", or use bash -c for bash syntax.' ;;
esac
