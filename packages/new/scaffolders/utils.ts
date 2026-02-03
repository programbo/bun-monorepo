import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type AppType = "web" | "cli" | "lib" | "ui";
export type DefaultRoot = "apps" | "packages";

export const ROOT_DIR = path.resolve(import.meta.dir, "../..");
export const BUN_CREATE_DIR = path.join(ROOT_DIR, ".bun-create");

export const run = async (command: string, args: string[], cwd: string) => {
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

export const ensureEmptyDir = async (dir: string) => {
  if (!existsSync(dir)) return;
  const entries = await readdir(dir);
  if (entries.length > 0) {
    throw new Error(`Target directory is not empty: ${dir}`);
  }
};

export const resolveTarget = (name: string, defaultRoot: DefaultRoot) => {
  const isPath = name.includes("/") || name.includes("\\") || name.startsWith("apps/") || name.startsWith("packages/");
  if (isPath) return path.resolve(ROOT_DIR, name);
  return path.join(ROOT_DIR, defaultRoot, name);
};

export const updateWebAppContent = async (targetDir: string) => {
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

export const runQaInit = async (targetDir: string, kind: "web" | "cli" | "lib", tailwind: boolean) => {
  const relative = path.relative(ROOT_DIR, targetDir);
  const args = ["run", "qa:init", "--dir", relative, "--kind", kind];
  if (tailwind) {
    args.push("--tailwind");
  }
  await run("bun", args, ROOT_DIR);
};

export const ensureTargetDir = async (targetDir: string) => {
  await ensureEmptyDir(targetDir);
  if (!existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
  }
};

export const ensureTemplates = () => {
  if (!existsSync(BUN_CREATE_DIR)) {
    throw new Error("Missing .bun-create directory at repo root. Run bun install or bun run -w new postinstall.");
  }
};
