import path from 'node:path'
import { ensureTargetDir, ensureTemplates, run, runQaInit, runWorkspaceInstall, ROOT_DIR } from './utils'

export const metadata = {
  defaultRoot: 'packages',
} as const

export const scaffoldCli = async (targetDir: string, options: { install: boolean }) => {
  await ensureTargetDir(targetDir)
  ensureTemplates()
  await run('bun', ['create', 'cli', path.relative(ROOT_DIR, targetDir), '--no-install', '--no-git'], ROOT_DIR)
  await runQaInit(targetDir, 'cli', false)
  if (options.install) {
    await runWorkspaceInstall()
  }
}
