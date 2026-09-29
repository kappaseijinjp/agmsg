<!-- pi overlay. -->
<!-- agmsg:slot delivery -->
<!-- agmsg:render-overlay __AGENT_TYPE__ -->
  5. **REQUIRED — Do NOT skip this step.** Choose `monitor`, `turn`, or `off` delivery (empty input means `monitor`), then run `~/.agents/skills/__SKILL_NAME__/scripts/delivery.sh set <mode> __AGENT_TYPE__ "$(pwd)"`.
<!-- /agmsg:slot delivery -->
<!-- agmsg:slot execute-extra -->
pi delivery runs through the agmsg pi extension (`~/.pi/agent/extensions/__SKILL_NAME__/index.ts`, placed by the installer). In `monitor` mode, keep one watcher for this session by calling the `agmsg_watch` tool with the active name; `agmsg_watch_status` reports whether it is running and `agmsg_watch_stop` stops it. In `turn` mode the extension checks the inbox after each run on its own. If the `agmsg_watch` tool is not available, the extension is not installed: check the inbox with `inbox.sh` after each task instead.

The shell's session id is `$PI_SESSION_ID` (set only inside pi's bash tool).
<!-- /agmsg:slot execute-extra -->
<!-- agmsg:slot actas -->
If argument starts with "actas" followed by an agent name (e.g. "actas alice"):
1. Parse the new role name. If none was given, run `~/.agents/skills/__SKILL_NAME__/scripts/team.sh <team>` for each TEAM, propose 2-3 unused names that follow the roster's naming convention, and ask the user to pick one.
2. Run `~/.agents/skills/__SKILL_NAME__/scripts/identities.sh "$(pwd)" __AGENT_TYPE__` to see whether the role is already registered for this (project, type).
3. If the name does not appear in the output, join under the existing team: `~/.agents/skills/__SKILL_NAME__/scripts/join.sh <team> <name> __AGENT_TYPE__ "$(pwd)"`. For multiple teams, ask the user which team to join.
4. **Pre-flight claim** the actas exclusivity lock: `~/.agents/skills/__SKILL_NAME__/scripts/actas-claim.sh "$(pwd)" __AGENT_TYPE__ <name> "$PI_SESSION_ID"`. Read the `status=` line:
    - `status=ok ...`: proceed to step 5.
    - `status=held team=<team> owner=<sid>`: tell the user "Cannot actas as `<name>` — it is held by session `<sid>` in team `<team>`. Run `__CMD_PREFIX____SKILL_NAME__ drop <name>` in that session first, then retry." Then abort without touching the watcher.
    - anything else: report it as an error and stop.
5. Run `~/.agents/skills/__SKILL_NAME__/scripts/delivery.sh status __AGENT_TYPE__ "$(pwd)"` and read its **first line**.
    - `mode: monitor`: call the `agmsg_watch` tool with `name` = `<name>`. It replaces any watcher this session already runs. If the tool is missing, say that the agmsg pi extension is not installed and delivery is not active.
    - `mode: turn`: start nothing; the extension checks the inbox after each run.
    - `mode: off ...`: start nothing, and tell the user that agmsg delivery is not configured for this project (run `__CMD_PREFIX____SKILL_NAME__ mode <choice>` to set it).
6. Set the session's active FROM to `<name>` for every later `send.sh` call.
7. Tell the user: "Now acting as `<name>`. Sends use `<name>` as from; receive restricted to `<name>` only."
<!-- /agmsg:slot actas -->
<!-- agmsg:slot drop -->
If argument starts with "drop" followed by an agent name:
1. Run `~/.agents/skills/__SKILL_NAME__/scripts/reset.sh "$(pwd)" __AGENT_TYPE__ <name> "$PI_SESSION_ID"`.
2. If the active FROM was `<name>`, clear it and call the `agmsg_watch_stop` tool.
3. Tell the user: "Dropped role `<name>` from this project."
<!-- /agmsg:slot drop -->
<!-- agmsg:slot mode -->
If argument is "mode", run `~/.agents/skills/__SKILL_NAME__/scripts/delivery.sh status __AGENT_TYPE__ "$(pwd)"`.
For `mode monitor|turn|off`, run `~/.agents/skills/__SKILL_NAME__/scripts/delivery.sh set <mode> __AGENT_TYPE__ "$(pwd)"`; reject `both`. After switching to `monitor`, call `agmsg_watch` with the active name.
<!-- /agmsg:slot mode -->
