#!/bin/sh
# Claude Code prepends the contents of $CLAUDE_ENV_FILE to every Bash tool command and runs them in the same shell,
# so a setopt written here applies to the Bash tool's zsh. Outside zsh the line does nothing.
# `if ... fi` rather than `[ ... ] && setopt`: under bash the test is false, and the line must still exit 0.
[ -n "${CLAUDE_ENV_FILE:-}" ] || exit 0
cat >> "$CLAUDE_ENV_FILE" <<'EOF'
if [ -n "${ZSH_VERSION:-}" ]; then setopt no_nomatch sh_word_split no_equals; fi
EOF
