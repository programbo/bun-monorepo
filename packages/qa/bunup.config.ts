import { defineConfig } from "bunup";

export default defineConfig({
  entry: [
    "src/oxlint.ts",
    "src/prettier.ts",
    "src/prettier-tailwind.ts",
    "src/tsconfig.ts",
  ],
  outDir: "dist",
  format: ["esm"],
  target: "node",
  sourcemap: true,
});
