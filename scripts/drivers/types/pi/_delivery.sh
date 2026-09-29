#!/usr/bin/env bash
# pi delivery plug — a one-line marker file. delivery_modes=monitor turn off, so
# mode=both never reaches this function (rejected by delivery.sh's central gate
# before apply runs). Uses resolve_hooks_file from delivery.sh's sourced context.
#
# pi reads no hook file of its own. The global pi extension that install.sh
# places at ~/.pi/agent/extensions/<name>/index.ts reads this marker from the
# session's working directory:
#   monitor  the extension's agmsg_watch tool runs watch.sh resident and injects
#            each line as a follow-up user message (the actas flow calls it)
#   turn     after each agent run settles, the extension runs check-inbox.sh
#            and injects its output when there is any
#   off      no marker file: the extension does nothing
agmsg_delivery_apply() {
  local type="$1" project="$2" mode="$3" marker
  marker="$(resolve_hooks_file "$type" "$project")" || return 1
  case "$mode" in
    monitor|turn)
      mkdir -p "$(dirname "$marker")" || return 1
      printf 'mode: %s\n' "$mode" > "$marker.tmp.$$" && mv -f "$marker.tmp.$$" "$marker"
      ;;
    off)
      rm -f "$marker"
      ;;
  esac
}
agmsg_delivery_status() {
  local type="$1" project="$2" marker
  marker="$(resolve_hooks_file "$type" "$project")" || return 1
  # The exact no-hooks wording spawn.sh's readiness gate recognizes as off.
  if [ ! -f "$marker" ]; then
    echo "mode: off (no agmsg delivery hooks installed for this project)"
  elif grep -qx 'mode: monitor' "$marker" 2>/dev/null; then
    echo "mode: monitor"
  elif grep -qx 'mode: turn' "$marker" 2>/dev/null; then
    echo "mode: turn"
  else
    echo "mode: off (unrecognized: $marker)"
  fi
}
