import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = path.resolve(import.meta.dir, "../..");
const QA_INIT = path.join(ROOT_DIR, "qa", "scripts", "qa-init.ts");

const runQaInit = async (args: string[]) => {
  const proc = Bun.spawn(["bun", QA_INIT, ...args], {
    cwd: ROOT_DIR,
    stdout: "ignore",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(err || `qa-init failed with code ${exitCode}`);
  }
};

const writeJson = async (filePath: string, data: unknown) => {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const createTempPackage = async (name: string, extras: Record<string, unknown> = {}) => {
  const tempDir = path.join("/tmp", `qa-init-${name}-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
  await writeJson(path.join(tempDir, "package.json"), {
    name,
    version: "0.0.0",
    private: true,
    ...extras,
  });
  return tempDir;
};

describe("qa:init", () => {
  it("writes configs and scripts for lib packages", async () => {
    const dir = await createTempPackage("sample-lib");

    try {
      await runQaInit([dir, "--kind", "lib"]);

      const pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8")) as {
        scripts: Record<string, string>;
        devDependencies: Record<string, string>;
      };

      expect(pkg.scripts.build).toBe("bunup");
      expect(pkg.scripts.lint).toContain("oxlint");
      expect(pkg.scripts.format).toContain("prettier");
      expect(pkg.scripts.typecheck).toContain("tsc");
      expect(pkg.devDependencies["@repo/qa"]).toBe("workspace:*");

      expect(existsSync(path.join(dir, "prettier.config.cjs"))).toBeTrue();
      expect(existsSync(path.join(dir, "oxlint.json"))).toBeTrue();
      expect(existsSync(path.join(dir, "tsconfig.json"))).toBeTrue();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("detects Tailwind and uses the Tailwind Prettier config", async () => {
    const dir = await createTempPackage("sample-ui", {
      devDependencies: {
        tailwindcss: "^4.0.0",
      },
    });

    try {
      await runQaInit([dir, "--kind", "lib"]);

      const prettierConfig = await readFile(path.join(dir, "prettier.config.cjs"), "utf8");
      expect(prettierConfig).toContain("@repo/qa/prettier-tailwind");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("parses JSON with comments", async () => {
    const dir = await createTempPackage("sample-jsonc");

    const tsconfig = `{
  // comment
  "compilerOptions": {
    "target": "ESNext"
  }
}\n`;

    await writeFile(path.join(dir, "tsconfig.json"), tsconfig, "utf8");

    try {
      await runQaInit([dir, "--kind", "lib"]);
      const config = JSON.parse(await readFile(path.join(dir, "tsconfig.json"), "utf8")) as {
        extends?: string;
      };
      expect(config.extends).toBe("@repo/qa/tsconfig/node");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
