import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { InitAnswers } from '../prompts.js'

export async function generateTemplates(answers: InitAnswers) {
  const rootDir = process.cwd()
  const monorepoName = answers.appName
  
  // Create apps directory
  if (answers.appType === 'web' || answers.appType === 'both') {
    await createWebApp(rootDir, answers, monorepoName)
  }
  
  if (answers.appType === 'cli' || answers.appType === 'both') {
    await createCLITool(rootDir, answers, monorepoName)
  }
  
  // Create packages directory
  if (answers.packageTypes.includes('ui')) {
    await createSharedUI(rootDir, answers, monorepoName)
  }
  
  if (answers.packageTypes.includes('utils')) {
    await createSharedUtils(rootDir, answers, monorepoName)
  }
}

async function createWebApp(rootDir: string, answers: InitAnswers, monorepoName: string) {
  const appDir = path.join(rootDir, 'apps', answers.appName)
  const packageJson = {
    name: answers.appName,
    version: "0.0.1",
    scripts: {
      dev: "bun run --watch src/index.ts",
      build: "bun build src/index.ts --outdir ./dist",
      start: "bun run dist/index.js",
      lint: "oxlint .",
      format: "prettier --write .",
      format:check: "prettier --check .",
      typecheck: "tsc --noEmit"
    },
    dependencies: {
      react: "^18.3.1",
      react-dom: "^18.3.1"
    },
    devDependencies: {
      "@<monorepo-name>/config": "workspace:*",
      "@trivago/prettier-plugin-sort-imports": "^6.0.2",
      "oxlint": "^1.38.0",
      "prettier": "^3.7.4",
      "prettier-plugin-tailwindcss": "^0.7.2",
      "typescript": "^5.9.3"
    }
  }
  
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packageJson, null, 2))
  console.log(chalk.green(`✓ Created web app: ${appDir}`))
}

async function createCLITool(rootDir: string, answers: InitAnswers, monorepoName: string) {
  const appDir = path.join(rootDir, 'apps', answers.appName)
  const packageJson = {
    name: answers.appName,
    version: "0.0.1",
    type: "module",
    bin: {
      [answers.appName]: "./bin/cli.ts"
    },
    scripts: {
      dev: "bun run --watch src/index.ts",
      build: "bun build src/index.ts --outdir ./dist",
      start: "bun run dist/index.js",
      lint: "oxlint .",
      format: "prettier --write .",
      format:check: "prettier --check .",
      typecheck: "tsc --noEmit"
    },
    dependencies: {},
    devDependencies: {
      "@<monorepo-name>/config": "workspace:*",
      "@trivago/prettier-plugin-sort-imports": "^6.0.2",
      "oxlint": "^1.38.0",
      "prettier": "^3.7.4",
      "prettier-plugin-tailwindcss": "^0.7.2",
      "typescript": "^5.9.3"
    }
  }
  
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packageJson, null, 2))
  console.log(chalk.green(`✓ Created CLI tool: ${appDir}`))
}

async function createSharedUI(rootDir: string, answers: InitAnswers, monorepoName: string) {
  const packageDir = path.join(rootDir, 'packages', answers.appName)
  const packageJson = {
    name: answers.appName,
    version: "0.0.1",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        import: "./dist/index.js",
        types: "./dist/index.d.ts"
      }
    },
    scripts: {
      dev: "bun run --watch src/index.ts",
      build: "tsc",
      lint: "oxlint .",
      format: "prettier --write .",
      format:check: "prettier --check .",
      typecheck: "tsc --noEmit"
    },
    dependencies: {
      react: "^18.3.1",
      react-dom: "^18.3.1"
    },
    devDependencies: {
      "@<monorepo-name>/config": "workspace:*",
      "@trivago/prettier-plugin-sort-imports": "^6.0.2",
      "oxlint": "^1.38.0",
      "prettier": "^3.7.4",
      "prettier-plugin-tailwindcss": "^0.7.2",
      "typescript": "^5.9.3"
    }
  }
  
  fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify(packageJson, null, 2))
  console.log(chalk.green(`✓ Created shared UI package: ${packageDir}`))
}

async function createSharedUtils(rootDir: string, answers: InitAnswers, monorepoName: string) {
  const packageDir = path.join(rootDir, 'packages', answers.appName)
  const packageJson = {
    name: answers.appName,
    version: "0.0.1",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        import: "./dist/index.js",
        types: "./dist/index.d.ts"
      }
    },
    scripts: {
      dev: "bun run --watch src/index.ts",
      build: "tsc",
      lint: "oxlint .",
      format: "prettier --write .",
      format:check: "prettier --check .",
      typecheck: "tsc --noEmit"
    },
    dependencies: {},
    devDependencies: {
      "@<monorepo-name>/config": "workspace:*",
      "@trivago/prettier-plugin-sort-imports": "^6.0.2",
      "oxlint": "^1.38.0",
      "prettier": "^3.7.4",
      "prettier-plugin-tailwindcss": "^0.7.2",
      "typescript": "^5.9.3"
    }
  }
  
  fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify(packageJson, null, 2))
  console.log(chalk.green(`✓ Created shared utils package: ${packageDir}`))
}
