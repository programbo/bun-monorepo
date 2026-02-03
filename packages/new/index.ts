#!/usr/bin/env bun
import { existsSync } from "fs";
import { mkdir, readdir, writeFile } from "fs/promises";
import path from "path";

const USAGE = `
Usage:
  bun run new <type> <name>

Types:
  web   Creates a Bun React + Tailwind app in apps/<name>
`.trim();

type AppType = "web";

const ROOT_DIR = path.resolve(import.meta.dir, "../..");

const run = async (command: string, args: string[], cwd: string) => {
  const proc = Bun.spawn([command, ...args], {
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
};

const ensureEmptyDir = async (dir: string) => {
  if (!existsSync(dir)) return;
  const entries = await readdir(dir);
  if (entries.length > 0) {
    throw new Error(`Target directory is not empty: ${dir}`);
  }
};

const resolveTarget = (type: AppType, name: string) => {
  if (type === "web") {
    return path.join(ROOT_DIR, "apps", name);
  }
  throw new Error(`Unsupported type: ${type}`);
};

const updateWebAppContent = async (targetDir: string) => {
  const candidates = [
    path.join(targetDir, "src", "App.tsx"),
    path.join(targetDir, "src", "App.jsx"),
    path.join(targetDir, "src", "app.tsx"),
    path.join(targetDir, "src", "app.jsx"),
  ];

  const appFile = candidates.find(candidate => existsSync(candidate));
  if (!appFile) {
    throw new Error("Unable to locate App component to update.");
  }

  const contents = `export default function App() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-semibold">Welcome</h1>
        <p className="mt-4 text-base text-slate-600">
          This is a fresh Bun + React + Tailwind app. Build something great.
        </p>
      </div>
    </main>
  );
}
`;

  await writeFile(appFile, contents, "utf8");
};

const runQaInit = async (targetDir: string) => {
  const relative = path.relative(ROOT_DIR, targetDir);
  await run("bun", ["run", "qa:init", "--dir", relative, "--kind", "web", "--tailwind"], ROOT_DIR);
};

const main = async () => {
  const [, , typeArg, nameArg] = process.argv;
  if (!typeArg || !nameArg) {
    console.log(USAGE);
    process.exit(1);
  }

  if (typeArg !== "web") {
    throw new Error(`Unsupported type: ${typeArg}`);
  }

  const type = typeArg as AppType;
  const targetDir = resolveTarget(type, nameArg);
  await ensureEmptyDir(targetDir);

  if (!existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
  }

  await run("bun", ["init", "--react=tailwind"], targetDir);
  await updateWebAppContent(targetDir);
  await runQaInit(targetDir);

  console.log(`Created ${type} app at ${targetDir}`);
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
