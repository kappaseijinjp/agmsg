#!/usr/bin/env bash
# pi transcript hook for resume (#339 convention; sourced by boot-command.sh).
#
# pi stores each session as <session-root>/--<munged cwd>--/<timestamp>_<id>.jsonl
# (pi docs/sessions.md; the file name shape is observed on pi 0.85.1). The session root is, in pi's own precedence order:
# PI_CODING_AGENT_SESSION_DIR, then $PI_CODING_AGENT_DIR/sessions, then
# ~/.pi/agent/sessions. The directory name is matched by glob rather than
# re-deriving pi's cwd munging, and the file by its exact id suffix.

agmsg_transcript_path() {   # <session-id> <project>
  local id="$1" root f
  [ -n "$id" ] || return 1
  case "$id" in *[!A-Za-z0-9-]*) return 1 ;; esac
  if [ -n "${PI_CODING_AGENT_SESSION_DIR:-}" ]; then
    root="$PI_CODING_AGENT_SESSION_DIR"
  elif [ -n "${PI_CODING_AGENT_DIR:-}" ]; then
    root="$PI_CODING_AGENT_DIR/sessions"
  elif [ -n "${HOME:-}" ]; then
    root="$HOME/.pi/agent/sessions"
  else
    return 1
  fi
  for f in "$root"/*/*_"$id".jsonl; do
    [ -f "$f" ] || continue
    printf '%s\n' "$f"
    return 0
  done
  return 1
}

agmsg_transcript_exists() {
  agmsg_transcript_path "$1" "$2" >/dev/null
}

agmsg_transcript_tail() {   # <session-id> <project> [lines]
  local file lines="${3:-20}"
  file="$(agmsg_transcript_path "$1" "$2")" || return 1
  [ -r "$file" ] || return 1
  tail -n "$lines" -- "$file"
}
