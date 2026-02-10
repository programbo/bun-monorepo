import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..");
const E2E_ROOT = path.join(REPO_ROOT, ".tmp", "e2e");
const ARTIFACTS_ROOT = path.join(E2E_ROOT, "artifacts");

const CREATE_TEMPLATE = process.env.E2E_CREATE_TEMPLATE ?? "programbo/bun-monorepo";
const KEEP = process.env.E2E_KEEP === "1";

type CmdResult = { exitCode: number; stdout: string; stderr: string };

const readText = async (stream: ReadableStream | null | undefined) => {
  if (!stream) return "";
  return await new Response(stream).text();
};

const runCmd = async (
  argv: string[],
  opts: { cwd: string; env?: Record<string, string | undefined>; timeoutMs?: number },
): Promise<CmdResult> => {
  const proc = Bun.spawn(argv, {
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env ?? {}) },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  let timedOut = false;
  const timeoutMs = opts.timeoutMs ?? 10 * 60_000;
  const t = setTimeout(() => {
    timedOut = true;
    try {
      proc.kill("SIGKILL");
    } catch {
      // ignore
    }
  }, timeoutMs);

  const exitCode = await proc.exited;
  clearTimeout(t);
  const stdout = await readText(proc.stdout);
  const stderr = await readText(proc.stderr);

  if (timedOut) {
    throw new Error(`Command timed out after ${timeoutMs}ms: ${argv.join(" ")}`);
  }

  return { exitCode, stdout, stderr };
};

const assertOk = (res: CmdResult, label: string) => {
  if (res.exitCode === 0) return;
  throw new Error(
    [
      `${label} failed (exit ${res.exitCode})`,
      `stdout:\n${res.stdout.trim()}`,
      `stderr:\n${res.stderr.trim()}`,
    ].join("\n\n"),
  );
};

const waitForHttpOk = async (url: string, timeoutMs: number) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(750) });
      if (res.ok) return res;
    } catch {
      // ignore
    }
    await Bun.sleep(200);
  }
  throw new Error(`Timed out waiting for HTTP 2xx: ${url}`);
};

const startOutputCapture = (stream: ReadableStream | null | undefined) => {
  const decoder = new TextDecoder();
  let buf = "";
  let stopped = false;

  const pump = async () => {
    if (!stream) return;
    const reader = stream.getReader();
    while (!stopped) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done) break;
      if (value) {
        buf += decoder.decode(value, { stream: true });
        if (buf.length > 200_000) buf = buf.slice(-200_000);
      }
    }
  };

  void pump();
  return {
    get: () => buf,
    stop: () => {
      stopped = true;
    },
  };
};

const waitForLogMatch = async (getLogs: () => string, re: RegExp, timeoutMs: number, label: string) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const logs = getLogs();
    const m = logs.match(re);
    if (m) return m;
    await Bun.sleep(200);
  }
  const tail = getLogs().slice(-4000);
  throw new Error(`Timed out waiting for log pattern (${label}): ${re}\n\nLast logs:\n${tail}`);
};

const pgrepChildren = async (pid: number): Promise<number[]> => {
  const res = await runCmd(["pgrep", "-P", String(pid)], { cwd: REPO_ROOT, timeoutMs: 10_000 });
  if (res.exitCode !== 0) return [];
  return res.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
};

const killTree = async (pid: number, signal: "SIGTERM" | "SIGKILL") => {
  const children = await pgrepChildren(pid);
  for (const child of children) {
    await killTree(child, signal);
  }
  try {
    process.kill(pid, signal);
  } catch {
    // ignore
  }
};

const startDev = (cwd: string, env: Record<string, string | undefined>) => {
  const proc = Bun.spawn(["bun", "run", "dev"], {
    cwd,
    env: { ...process.env, ...env },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = startOutputCapture(proc.stdout);
  const err = startOutputCapture(proc.stderr);
  return { proc, out, err };
};

const stopDev = async (dev: ReturnType<typeof startDev>) => {
  dev.out.stop();
  dev.err.stop();
  await killTree(dev.proc.pid, "SIGTERM");
  const exited = await Promise.race([dev.proc.exited.then(() => true), Bun.sleep(5000).then(() => false)]);
  if (!exited) {
    await killTree(dev.proc.pid, "SIGKILL");
    await Promise.race([dev.proc.exited, Bun.sleep(5000)]);
  }
};

const getFreePort = async () => {
  const server = Bun.serve({ port: 0, fetch: () => new Response("ok") });
  const port = server.port;
  server.stop();
  return port;
};

const playwrightSmoke = async (url: string, session: string, artifactPath: string) => {
  const has = await runCmd(["bash", "-lc", "command -v playwright-cli >/dev/null 2>&1"], {
    cwd: REPO_ROOT,
    timeoutMs: 10_000,
  });
  if (has.exitCode !== 0) {
    throw new Error("playwright-cli not found on PATH (required for web e2e checks).");
  }

  const open = await runCmd(["playwright-cli", `-s=${session}`, "open", url], { cwd: REPO_ROOT, timeoutMs: 60_000 });
  assertOk(open, "playwright-cli open");

  try {
    const title = await runCmd(["playwright-cli", `-s=${session}`, "eval", "document.title"], {
      cwd: REPO_ROOT,
      timeoutMs: 30_000,
    });
    assertOk(title, "playwright-cli eval document.title");
    expect(title.stdout.trim().length).toBeGreaterThan(0);

    const root = await runCmd(
      ["playwright-cli", `-s=${session}`, "eval", "Boolean(document.querySelector('#root'))"],
      { cwd: REPO_ROOT, timeoutMs: 30_000 },
    );
    assertOk(root, "playwright-cli eval #root");
    expect(/(^|\n)\s*true\s*(\n|$)/.test(root.stdout)).toBe(true);

    await fsp.mkdir(path.dirname(artifactPath), { recursive: true });
    const screenshot = await runCmd(
      ["playwright-cli", `-s=${session}`, "screenshot", "--full-page", `--filename=${artifactPath}`],
      { cwd: REPO_ROOT, timeoutMs: 60_000 },
    );
    assertOk(screenshot, "playwright-cli screenshot");
  } finally {
    const close = await runCmd(["playwright-cli", `-s=${session}`, "close"], { cwd: REPO_ROOT, timeoutMs: 30_000 });
    assertOk(close, "playwright-cli close");
  }
};

const ensureCleanDir = async (dir: string) => {
  await fsp.mkdir(path.dirname(dir), { recursive: true });
  if (fs.existsSync(dir)) {
    await fsp.rm(dir, { recursive: true, force: true });
  }
};

const createProject = async (name: string) => {
  await fsp.mkdir(E2E_ROOT, { recursive: true });
  const res = await runCmd(["bun", "create", CREATE_TEMPLATE, name], { cwd: E2E_ROOT, timeoutMs: 20 * 60_000 });
  assertOk(res, `bun create ${CREATE_TEMPLATE}`);
  return path.join(E2E_ROOT, name);
};

const bunNew = async (projectRoot: string, type: "web" | "api" | "cli" | "lib" | "ui", name?: string) => {
  const args = ["bun", "new", type];
  if (name) args.push(name);
  args.push("--no-install");
  const res = await runCmd(args, { cwd: projectRoot, timeoutMs: 10 * 60_000 });
  assertOk(res, `bun new ${type}`);
};

const bunInstall = async (projectRoot: string) => {
  const res = await runCmd(["bun", "install"], { cwd: projectRoot, timeoutMs: 20 * 60_000 });
  assertOk(res, "bun install (project)");
};

const bunBuild = async (projectRoot: string) => {
  const res = await runCmd(["bun", "run", "build"], { cwd: projectRoot, timeoutMs: 20 * 60_000 });
  assertOk(res, "bun run build (project root)");
};

describe("bun create + bun new e2e", () => {
  test(
    "base template: build + dev (root) + playwright smoke",
    async () => {
      const projectName = `e2e-base-${Date.now()}`;
      const projectRoot = path.join(E2E_ROOT, projectName);
      await ensureCleanDir(projectRoot);

      await createProject(projectName);
      await bunBuild(projectRoot);

      const offset = "250";
      const dev = startDev(projectRoot, { PORT_OFFSET: offset });
      try {
        const getLogs = () => `${dev.out.get()}\n${dev.err.get()}`;
        const webMatch = await waitForLogMatch(
          getLogs,
          /Started .* server at https?:\/\/localhost:(\d+)/,
          60_000,
          "web started",
        );
        const webPort = Number(webMatch[1]);
        expect(Number.isFinite(webPort)).toBe(true);

        const hello = await waitForHttpOk(`http://localhost:${webPort}/api/hello`, 30_000);
        const helloData = (await hello.json()) as { message?: string };
        expect(helloData.message).toBeTruthy();

        const session = `${projectName}-web`;
        const artifact = path.join(ARTIFACTS_ROOT, projectName, "web.png");
        await playwrightSmoke(`http://localhost:${webPort}/`, session, artifact);
      } finally {
        await stopDev(dev);
        if (!KEEP) await fsp.rm(projectRoot, { recursive: true, force: true });
      }
    },
    30 * 60_000,
  );

  test(
    "adds api/cli/lib/ui: install once, build, dev, verify web+api+cli",
    async () => {
      const projectName = `e2e-full-${Date.now()}`;
      const projectRoot = path.join(E2E_ROOT, projectName);
      await ensureCleanDir(projectRoot);

      await createProject(projectName);

      await bunNew(projectRoot, "api", "api");
      await bunNew(projectRoot, "cli", "cli");
      await bunNew(projectRoot, "lib", "lib");
      await bunNew(projectRoot, "ui", "ui");
      await bunInstall(projectRoot);
      await bunBuild(projectRoot);

      expect(fs.existsSync(path.join(projectRoot, "packages", "cli", "dist", "index.js"))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, "packages", "lib", "dist", "index.js"))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, "packages", "ui", "dist", "index.js"))).toBe(true);

      const offset = "270";
      const apiPort = await getFreePort();
      const dev = startDev(projectRoot, { PORT_OFFSET: offset, API_PORT: String(apiPort) });
      try {
        const getLogs = () => `${dev.out.get()}\n${dev.err.get()}`;
        const webMatch = await waitForLogMatch(
          getLogs,
          /Started .* server at https?:\/\/localhost:(\d+)/,
          60_000,
          "web started",
        );
        const webPort = Number(webMatch[1]);
        expect(Number.isFinite(webPort)).toBe(true);

        // Prefer API_PORT if supported; otherwise this will just hit whatever the API chose (usually 3001).
        const apiBaseUrl = await (async () => {
          try {
            await waitForHttpOk(`http://localhost:${apiPort}/health`, 15_000);
            return `http://localhost:${apiPort}`;
          } catch {
            await waitForHttpOk("http://localhost:3001/health", 30_000);
            return "http://localhost:3001";
          }
        })();

        const apiHello = await waitForHttpOk(`${apiBaseUrl}/api/hello/codex`, 30_000);
        const apiData = (await apiHello.json()) as { message?: string };
        expect(apiData.message).toContain("codex");

        const session = `${projectName}-web`;
        const artifact = path.join(ARTIFACTS_ROOT, projectName, "web.png");
        await playwrightSmoke(`http://localhost:${webPort}/`, session, artifact);

        const cliRes = await runCmd(
          ["bun", path.join(projectRoot, "packages", "cli", "dist", "index.js"), "greet", "bun", "--shout"],
          { cwd: projectRoot, timeoutMs: 60_000 },
        );
        assertOk(cliRes, "cli greet (dist)");
        expect(cliRes.stdout).toContain("HELLO, BUN!");
      } finally {
        await stopDev(dev);
        if (!KEEP) await fsp.rm(projectRoot, { recursive: true, force: true });
      }
    },
    45 * 60_000,
  );
});
