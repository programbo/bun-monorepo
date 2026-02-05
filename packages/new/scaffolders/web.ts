import {
  ensureTargetDir,
  ensureTemplates,
  ROOT_DIR,
  run,
  runQaInit,
  updatePackageName,
  runWorkspaceInstall,
  updateWebAppContent,
} from './utils'
import path from 'node:path'

export const metadata = {
  defaultRoot: 'apps',
} as const

export const scaffoldWeb = async (targetDir: string, options: { install: boolean }) => {
  await ensureTargetDir(targetDir)
  if (process.env.BUN_NEW_WEB_TEMPLATE === '1') {
    ensureTemplates()
    await run('bun', ['create', 'web', path.relative(ROOT_DIR, targetDir), '--no-install', '--no-git'], ROOT_DIR)
  } else {
    await run('bun', ['init', '--react=tailwind'], targetDir)
  }
  await updateWebAppContent(targetDir)
  await runQaInit(targetDir, 'web', true)
  await updatePackageName(targetDir)
  await run('bun', ['run', 'packages/new/scripts/web-postinstall.ts', '--dir', path.relative(ROOT_DIR, targetDir)], ROOT_DIR)
  if (options.install) {
    await runWorkspaceInstall()
  }
}
