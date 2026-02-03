import path from 'node:path'
import { ensureTargetDir, ensureTemplates, run, runQaInit, ROOT_DIR } from './utils'

export const metadata = {
  defaultRoot: 'packages',
} as const

export const scaffoldCli = async (targetDir: string) => {
  await ensureTargetDir(targetDir)
  ensureTemplates()
  await run('bun', ['create', 'cli', path.relative(ROOT_DIR, targetDir), '--no-install', '--no-git'], ROOT_DIR)
  await runQaInit(targetDir, 'cli', false)
}
