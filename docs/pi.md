# agmsg for pi

[pi](https://pi.dev/) (`pi-coding-agent`) supports **`monitor`, `turn`, and `off` delivery** and `spawn pi`. `both` is not supported. Behavior below was checked against pi 0.85.1.

## Install

```bash
bash <(curl -fsSL https://agmsg.cc/install.sh)
```

When pi's config root exists (`~/.pi/agent/`, or `$PI_CODING_AGENT_DIR` when set), the installer places two files there:

| File | Purpose |
|---|---|
| `skills/agmsg/SKILL.md` | the pi-typed skill. pi reads `~/.pi/agent/skills/` before `~/.agents/skills/` and keeps the first skill of a name, so pi never reads the Codex-typed shared skill |
| `extensions/agmsg/index.ts` | the delivery extension (below) |

The shared `~/.agents/skills/agmsg/SKILL.md` is left as it is, so Codex keeps working on the same machine. `--agent-type pi` does not retype it either.

`uninstall.sh` removes both files. The extension is removed only when it names the install being uninstalled.

## Join a team

From pi, run:

```
/skill:agmsg
```

Or from the shell:

```bash
~/.agents/skills/agmsg/scripts/join.sh <team> <agent_name> pi "$(pwd)"
~/.agents/skills/agmsg/scripts/delivery.sh set monitor pi "$(pwd)"
```

`whoami.sh` detects pi from `PI_CODING_AGENT=true`, which pi sets for every process it starts. A runtime started inside pi that has its own session marker (for example `CLAUDE_CODE_SESSION_ID`) is still detected as that runtime. The session id is `PI_SESSION_ID`, which pi sets only inside its bash tool.

## Delivery modes

`delivery.sh set <mode> pi <project>` writes a one-line marker, `<project>/.pi/agmsg-delivery` (`mode: monitor` or `mode: turn`); `off` removes it. The global extension reads this marker from the session's working directory.

| Mode | What happens |
|---|---|
| `monitor` | The actas flow calls the extension's `agmsg_watch` tool with the agent name. The tool runs `watch.sh <session> <project> pi <name>` resident, and each message is injected into the conversation as a follow-up that starts a turn. `agmsg_watch_status` reports the watcher, `agmsg_watch_stop` stops it (the drop flow calls it). The watcher also writes spawn's readiness sentinel. |
| `turn` | After each agent run settles, the extension runs `check-inbox.sh pi <project>` and injects its output when there is any. |
| `off` | No marker. The extension does nothing. |

The extension is global on purpose. pi loads a project-local `.pi/extensions/` entry only after its project-trust prompt, and that prompt would stop a spawned seat at startup. A plain file under `.pi/` does not count as a trusted resource.

## Spawn

```bash
~/.agents/skills/agmsg/scripts/spawn.sh pi <name> --project <path> [--model <provider/id>]
```

`spawn` starts `pi [--session <id>] [--model <provider/id>] "/skill:agmsg actas <name>"`. The actas prompt is a bare positional message. `--model` accepts pi's `provider/id[:thinking]` form.

A seat is resumed with `--session <id>` when agmsg has a recorded session id for it and pi still has that session file under `$PI_CODING_AGENT_SESSION_DIR`, `$PI_CODING_AGENT_DIR/sessions`, or `~/.pi/agent/sessions`. `spawn --fresh` starts a new session instead.

The session is not named `<team>-<name>`. pi titles its terminal `π - <name> - <cwd>`, and agmsg's shared title reader cannot read a name from that shape yet, so `team.sh` reports `cli_session=n/a:no_session_name` for a pi seat, as it does for OpenCode.
