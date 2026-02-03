#!/usr/bin/env bun
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const USAGE = `
Usage:
  bun run qa:init --dir <path> [--kind web|cli|lib|auto] [--tailwind] [--force]

Examples:
  bun run qa:init --dir apps/web --kind auto
  bun run qa:init --dir packages/cli --kind cli
  bun run qa:init --dir packages/lib --kind lib
`;

type Kind = "web" | "cli" | "lib" | "auto";

type Options = {
  dir?: string;
  kind: Kind;
  tailwind?: boolean;
  force: boolean;
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {
    kind: "auto",
    force: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === "--dir") {
      options.dir = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--kind") {
      const next = args[i + 1];
      if (next === "web" || next === "cli" || next === "lib" || next === "auto") {
        options.kind = next;
        i += 1;
        continue;
      }
      throw new Error(`Invalid --kind: ${next ?? "(missing)"}`);
    }

    if (arg === "--tailwind") {
      options.tailwind = true;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(USAGE.trim());
      process.exit(0);
    }
  }

  return options;
};

const ensureDir = async (dir: string) => {
  await mkdir(dir, { recursive: true });
};

const readJson = async <T>(filePath: string): Promise<T> => {
  const contents = await readFile(filePath, "utf8");
  return JSON.parse(contents) as T;
};

const writeJson = async (filePath: string, data: unknown) => {
  const contents = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(filePath, contents, "utf8");
};

const writeIfMissing = async (filePath: string, contents: string, force: boolean) => {
  if (existsSync(filePath) && !force) return false;
  await writeFile(filePath, contents, "utf8");
  return true;
};

const getPackageJson = async (dir: string) => {
  const packagePath = path.join(dir, "package.json");
  if (!existsSync(packagePath)) {
    throw new Error(`Missing package.json at ${packagePath}`);
  }

  return {
    path: packagePath,
    data: await readJson<Record<string, unknown>>(packagePath),
  };
};

const coerceDeps = (pkg: Record<string, unknown>) => {
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
  return { deps, devDeps };
};

const detectKind = (pkg: Record<string, unknown>): Exclude<Kind, "auto"> => {
  const { deps, devDeps } = coerceDeps(pkg);
  const allDeps = new Set([...Object.keys(deps), ...Object.keys(devDeps)]);

  if (allDeps.has("react") || allDeps.has("react-dom") || allDeps.has("next") || allDeps.has("vite")) {
    return "web";
  }

  if (typeof pkg.bin === "string" || typeof pkg.bin === "object") {
    return "cli";
  }

  if (typeof pkg.name === "string" && pkg.name.toLowerCase().includes("cli")) {
    return "cli";
  }

  return "lib";
};

const detectTailwind = (pkg: Record<string, unknown>) => {
  const { deps, devDeps } = coerceDeps(pkg);
  return Boolean(deps.tailwindcss || devDeps.tailwindcss);
};

const ensurePackageJson = async (
  dir: string,
  pkg: Record<string, unknown>,
  kind: Exclude<Kind, "auto">,
) => {
  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  const devDependencies = (pkg.devDependencies ?? {}) as Record<string, string>;

  scripts.lint = "oxlint --config oxlint.json --fix .";
  scripts.format = "prettier --config prettier.config.cjs --write .";
  scripts.typecheck = "tsc -p tsconfig.json --noEmit";

  if (kind !== "web") {
    scripts.build = "bunup";
  }

  devDependencies["@repo/qa"] = "workspace:*";

  pkg.scripts = scripts;
  pkg.devDependencies = devDependencies;

  await writeJson(path.join(dir, "package.json"), pkg);
};

const ensurePrettierConfig = async (dir: string, tailwind: boolean, force: boolean) => {
  const configPath = path.join(dir, "prettier.config.cjs");
  const target = tailwind ? "@repo/qa/prettier-tailwind" : "@repo/qa/prettier";
  const contents = `module.exports = require('${target}')\n`;
  await writeIfMissing(configPath, contents, force);
};

const ensureOxlintConfig = async (dir: string, force: boolean) => {
  const configPath = path.join(dir, "oxlint.json");
  if (!existsSync(configPath) || force) {
    const contents = `{
  "$schema": "https://oxc.rs/schema/oxlint.json",
  "extends": ["@repo/qa/oxlint"]
}\n`;
    await writeFile(configPath, contents, "utf8");
    return;
  }

  const config = await readJson<Record<string, unknown>>(configPath);
  const extendsField = Array.isArray(config.extends)
    ? (config.extends as string[])
    : typeof config.extends === "string"
      ? [config.extends]
      : [];

  if (!extendsField.includes("@repo/qa/oxlint")) {
    extendsField.push("@repo/qa/oxlint");
  }

  config.$schema = "https://oxc.rs/schema/oxlint.json";
  config.extends = extendsField;
  await writeJson(configPath, config);
};

const ensureTsconfig = async (dir: string, kind: Exclude<Kind, "auto">, force: boolean) => {
  const configPath = path.join(dir, "tsconfig.json");
  if (!existsSync(configPath)) {
    const compilerOptions: Record<string, unknown> = {};
    if (kind === "web") {
      compilerOptions.lib = ["ESNext", "DOM"];
      compilerOptions.jsx = "react-jsx";
    }

    const contents = {
      extends: "@repo/qa/tsconfig",
      compilerOptions,
    };

    await writeJson(configPath, contents);
    return;
  }

  if (force) {
    const existing = await readJson<Record<string, unknown>>(configPath);
    existing.extends = "@repo/qa/tsconfig";
    await writeJson(configPath, existing);
    return;
  }

  const existing = await readJson<Record<string, unknown>>(configPath);
  if (!existing.extends) {
    existing.extends = "@repo/qa/tsconfig";
  }
  await writeJson(configPath, existing);
};

const ensureBunupConfig = async (dir: string, kind: Exclude<Kind, "auto">, force: boolean) => {
  if (kind === "web") return;

  const configPath = path.join(dir, "bunup.config.ts");
  if (existsSync(configPath) && !force) return;

  const isLib = kind === "lib";
  const contents = `import { defineConfig } from "bunup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: [${isLib ? '"esm", "cjs"' : '"esm"'}],
  target: "node",
  sourcemap: true${isLib ? ",\n  dts: true" : ""}
});
`;

  await writeFile(configPath, contents, "utf8");
};

const main = async () => {
  const options = parseArgs();
  if (!options.dir) {
    console.error("Missing --dir");
    console.log(USAGE.trim());
    process.exit(1);
  }

  const dir = path.resolve(process.cwd(), options.dir);
  if (!existsSync(dir)) {
    await ensureDir(dir);
  }

  const { data: pkg } = await getPackageJson(dir);
  const resolvedKind = options.kind === "auto" ? detectKind(pkg) : options.kind;
  const resolvedTailwind = options.tailwind ?? detectTailwind(pkg) || resolvedKind === "web";

  await ensurePackageJson(dir, pkg, resolvedKind);
  await ensurePrettierConfig(dir, resolvedTailwind, options.force);
  await ensureOxlintConfig(dir, options.force);
  await ensureTsconfig(dir, resolvedKind, options.force);
  await ensureBunupConfig(dir, resolvedKind, options.force);

  console.log(`QA config applied to ${dir} (kind: ${resolvedKind}, tailwind: ${resolvedTailwind})`);
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
