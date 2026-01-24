# Bun Monorepo Template

A production-ready Bun monorepo template with workspace configuration, interactive CLI tool for scaffolding, and shared configuration packages.

## Features

- **Bun Workspaces**: Native Bun workspace support for seamless inter-package dependencies
- **Interactive CLI Tool**: `binit` for easy project scaffolding
- **Shared Configuration**: Pre-configured Prettier, oxlint, and TypeScript settings
- **Template Support**: Web applications, CLI tools, and shared packages
- **TypeScript**: Full TypeScript support with strict mode
- **Modern Tooling**: React, Next.js, and modern JavaScript/TypeScript features

## Quick Start

### Using Bun Template System

The easiest way to create a new monorepo is using Bun's built-in template system:

```bash
bun create mono my-monorepo
cd my-monorepo
```

This will:
1. Copy the template files to `my-monorepo`
2. Run preinstall scripts
3. Install dependencies
4. Run the binit CLI tool to guide you through setting up your monorepo structure

### Using binit CLI

After creating the monorepo, run the interactive setup:

```bash
bun run binit
```

The `binit` tool will guide you through creating your monorepo structure with interactive prompts.

### Manual Initialization

```bash
bun init my-monorepo
cd my-monorepo
bun run binit
```

## Project Structure

```
bun-monorepo-template/
├── apps/                    # Application workspaces
│   ├── web-app/            # Web application
│   │   ├── src/
│   │   ├── public/
│   │   └── index.html
│   └── cli-tool/           # CLI tool
│       ├── src/
│       └── bin/
├── packages/               # Package workspaces
│   ├── config/             # Shared configuration
│   │   ├── prettier/
│   │   ├── oxlint/
│   │   └── tsconfig.json
│   ├── shared-ui/          # Shared UI components
│   └── shared-utils/       # Shared utilities
├── binit/                  # Interactive CLI tool
│   ├── src/
│   │   ├── templates/
│   │   └── prompts.ts
│   └── bin/
├── package.json            # Root workspace configuration
├── tsconfig.json           # Root TypeScript configuration
├── oxlint.json             # Root oxlint configuration
└── .prettierrc.cjs         # Root Prettier configuration
```

## binit CLI Tool

The `binit` tool provides an interactive way to scaffold your monorepo:

### Available Options

- **Monorepo Name**: Custom name for your monorepo
- **App Types**: 
  - Web Application
  - CLI Tool
  - Both Web and CLI
- **Package Types**:
  - Shared UI Components
  - Shared Utilities
- **Framework**: Next.js or Vanilla Bun
- **Tailwind CSS**: Include Tailwind CSS configuration
- **Config Package**: Use shared configuration for linting/formatting

### Usage

```bash
bun run binit
```

## Development Workflow

### Adding New Workspaces

1. **Add a new app**:
   ```bash
   mkdir -p apps/my-new-app/src
   cd apps/my-new-app
   bun init
   ```

2. **Add a new package**:
   ```bash
   mkdir -p packages/my-new-package/src
   cd packages/my-new-package
   bun init
   ```

3. **Update root package.json**:
   Add the new workspace to the `workspaces` array in root `package.json`

### Inter-Package Dependencies

Use workspace references in your `package.json`:

```json
{
  "dependencies": {
    "@<monorepo-name>/shared-ui": "workspace:*"
  }
}
```

### Shared Configuration

All workspaces automatically inherit configuration from the `@<monorepo-name>/config` package:

- **Prettier**: Code formatting with import sorting
- **oxlint**: Fast JavaScript/TypeScript linting
- **TypeScript**: Strict type checking configuration

### Running Commands

```bash
# Run all workspaces
bun run dev
bun run build
bun run test

# Run specific workspace
bun run --filter web-app dev
bun run --filter shared-ui build

# CI checks
bun run ci  # Runs lint and typecheck for all workspaces
```

## Configuration Details

### Prettier

The configuration includes:
- Import sorting with `@trivago/prettier-plugin-sort-imports`
- React and Next.js import ordering
- Tailwind CSS class sorting (when enabled)
- Consistent formatting across all workspaces

### oxlint

Configuration includes:
- Categories: correctness, suspicious, perf, style (warn)
- TypeScript strict rules
- Ignored directories: node_modules, dist, build, .next, out, coverage

### TypeScript

Root configuration includes:
- ES2022 target
- Bundler module resolution
- Strict mode enabled
- JSX support for React
- Path aliases for workspace packages

## Best Practices

1. **Use Workspace Dependencies**: Always use `workspace:*` for internal packages
2. **Keep Packages Focused**: Each package should have a single responsibility
3. **Run CI Checks**: Use `bun run ci` before committing
4. **Format Code**: Run `bun run format` before committing
5. **Type Check**: Run `bun run typecheck` to catch type errors

## Troubleshooting

### Workspace Resolution Issues

If you encounter workspace resolution problems:

1. Delete `node_modules` and `bun.lockb`
2. Run `bun install`
3. Check that all `package.json` files have correct workspace references

### Configuration Not Applying

If configuration isn't applying to workspaces:

1. Ensure the config package is in `devDependencies`
2. Check that `package.json` scripts reference the config package
3. Verify workspace references use `workspace:*` syntax

### Template Creation Issues

If `bun create mono` fails:

1. Verify the symlink exists: `ls -la ~/.bun-create/mono`
2. Check that the template directory is accessible
3. Ensure Bun is properly installed and configured
4. Try running `bun create mono --help` for more information

## License

MIT
