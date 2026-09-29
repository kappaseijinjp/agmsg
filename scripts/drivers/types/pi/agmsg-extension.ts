/**
 * agmsg delivery for pi (global extension).
 *
 * install.sh renders this file to ~/.pi/agent/extensions/__SKILL_NAME__/index.ts
 * with __SKILL_DIR__ replaced by the install directory. A global extension is
 * used on purpose: a project-local `.pi/extensions` entry loads only after pi's
 * project-trust prompt, which would block a spawned seat at startup.
 *
 * The per-project mode lives in `<cwd>/.pi/agmsg-delivery` (written by
 * `delivery.sh set <mode> pi <project>`), one line: `mode: monitor|turn`.
 *
 *   monitor  The `agmsg_watch` tool (called by the actas flow) runs
 *            `watch.sh <session> <cwd> pi <name>` resident. Each stdout line is
 *            one message; it is injected as a follow-up that triggers a turn.
 *   turn     After each agent run settles, `check-inbox.sh pi <cwd>` runs and
 *            its output, when any, is injected the same way.
 *   off      No marker file: this extension does nothing.
 */

import { spawn, execFile, type ChildProcess } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SKILL_DIR = "__SKILL_DIR__";
const MARKER = join(".pi", "agmsg-delivery");
const MESSAGE_TYPE = "agmsg";

// The project path agmsg registered is whatever `$(pwd)` printed in pi's bash
// tool: the logical path pi inherited in PWD. ctx.cwd is the resolved path, so
// on a symlinked directory (macOS /tmp -> /private/tmp) the two differ and
// watch.sh would find no registration. Use PWD when it names the same place.
function projectPath(cwd: string): string {
	const pwd = process.env.PWD;
	if (pwd) {
		try {
			if (realpathSync(pwd) === realpathSync(cwd)) return pwd;
		} catch {
			// Fall through to ctx.cwd.
		}
	}
	return cwd;
}

function deliveryMode(cwd: string): "monitor" | "turn" | "off" {
	try {
		const line = readFileSync(join(cwd, MARKER), "utf-8").trim();
		if (line === "mode: monitor") return "monitor";
		if (line === "mode: turn") return "turn";
	} catch {
		// No marker: delivery is off for this project.
	}
	return "off";
}

export default function (pi: ExtensionAPI) {
	let watcher: ChildProcess | undefined;
	let watching = "";
	let checking = false;

	const inject = (text: string) => {
		pi.sendMessage(
			{ customType: MESSAGE_TYPE, content: `[agmsg] ${text}`, display: true },
			{ triggerTurn: true, deliverAs: "followUp" },
		);
	};

	const stopWatcher = () => {
		if (watcher && watcher.exitCode === null) watcher.kill("SIGTERM");
		watcher = undefined;
		watching = "";
	};

	// Start (or replace) the resident watcher for <name>. watch.sh writes the
	// spawn readiness sentinel when it attaches, so a seat is only "ready" once
	// this has run.
	const startWatcher = (name: string, ctx: { cwd: string; sessionManager: { getSessionId(): string } }): ChildProcess => {
		stopWatcher();
		const session = ctx.sessionManager.getSessionId() || "-";
		const child = spawn(
			join(SKILL_DIR, "scripts", "watch.sh"),
			[session, projectPath(ctx.cwd), "pi", name],
			{ cwd: ctx.cwd, stdio: ["ignore", "pipe", "ignore"] },
		);
		let buffered = "";
		child.stdout?.setEncoding("utf-8");
		child.stdout?.on("data", (chunk: string) => {
			buffered += chunk;
			let nl: number;
			while ((nl = buffered.indexOf("\n")) >= 0) {
				const line = buffered.slice(0, nl).trim();
				buffered = buffered.slice(nl + 1);
				if (line) inject(line);
			}
		});
		child.on("exit", (code) => {
			if (watcher !== child) return;
			watcher = undefined;
			watching = "";
			inject(`inbox watcher for ${name} exited (code ${code}); call agmsg_watch again to re-arm it`);
		});
		watcher = child;
		watching = name;
		return child;
	};

	pi.registerTool(
		defineTool({
			name: "agmsg_watch",
			label: "agmsg watch",
			description:
				"Start (or switch) the resident agmsg inbox watcher for this session, acting as <name>. " +
				"Each incoming agmsg message then arrives in this conversation on its own. " +
				"Call it from the agmsg actas flow only when `delivery.sh status pi` reports monitor.",
			parameters: Type.Object({
				name: Type.String({ description: "agmsg agent name this session acts as" }),
			}),
			async execute(_id, params, _signal, _onUpdate, ctx) {
				const mode = deliveryMode(ctx.cwd);
				if (mode !== "monitor") {
					return {
						content: [{ type: "text", text: `agmsg delivery mode is ${mode}; watcher not started` }],
						details: { started: false, mode },
					};
				}
				const child = startWatcher(params.name, ctx);
				return {
					content: [{ type: "text", text: `agmsg inbox stream (acting as ${params.name}) started` }],
					details: { started: true, mode, name: params.name, pid: child.pid },
				};
			},
		}),
	);

	pi.registerTool(
		defineTool({
			name: "agmsg_watch_stop",
			label: "agmsg watch stop",
			description: "Stop this session's agmsg inbox watcher (the agmsg drop flow calls it).",
			parameters: Type.Object({}),
			async execute() {
				const name = watching;
				stopWatcher();
				return {
					content: [{ type: "text", text: name ? `stopped name=${name}` : "no watcher was running" }],
					details: { stopped: !!name, name },
				};
			},
		}),
	);

	pi.registerTool(
		defineTool({
			name: "agmsg_watch_status",
			label: "agmsg watch status",
			description: "Report whether this session's agmsg inbox watcher is running, and for which name.",
			parameters: Type.Object({}),
			async execute() {
				const running = !!watcher && watcher.exitCode === null;
				return {
					content: [{ type: "text", text: running ? `running name=${watching}` : "stopped" }],
					details: { running, name: running ? watching : "" },
				};
			},
		}),
	);

	pi.on("agent_settled", async (_event, ctx) => {
		if (checking || deliveryMode(ctx.cwd) !== "turn") return;
		checking = true;
		execFile(
			join(SKILL_DIR, "scripts", "check-inbox.sh"),
			["pi", projectPath(ctx.cwd)],
			{ cwd: ctx.cwd, timeout: 30000 },
			(_err, stdout) => {
				checking = false;
				const text = String(stdout || "").trim();
				if (text) inject(text);
			},
		);
	});

	// A resumed session (spawn/restart with --session) is a new pi process: no
	// watcher runs, and the model may skip agmsg_watch because the history shows
	// it already ran, leaving spawn waiting for a readiness sentinel until it
	// times out (Issue kappaseijin/agguild#230, nago restart). Re-arm from the
	// session's own record: the last agmsg_watch result on this branch names the
	// role, unless a later agmsg_watch_stop cleared it.
	pi.on("session_start", async (_event, ctx) => {
		if (deliveryMode(ctx.cwd) !== "monitor") return;
		let name = "";
		for (const entry of ctx.sessionManager.getBranch() as any[]) {
			const msg = entry?.type === "message" ? entry.message : undefined;
			if (!msg || msg.role !== "toolResult") continue;
			if (msg.toolName === "agmsg_watch" && msg.details?.started && msg.details?.name) name = msg.details.name;
			if (msg.toolName === "agmsg_watch_stop" && msg.details?.stopped) name = "";
		}
		if (name) startWatcher(name, ctx);
	});

	pi.on("session_shutdown", async () => {
		stopWatcher();
	});
}
