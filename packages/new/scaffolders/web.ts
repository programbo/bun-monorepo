import { run, runQaInit, updateWebAppContent, ensureTargetDir } from './utils'

export const metadata = {
  defaultRoot: 'apps',
} as const

export const scaffoldWeb = async (targetDir: string) => {
  await ensureTargetDir(targetDir)
  await run('bun', ['init', '--react=tailwind'], targetDir)
  await updateWebAppContent(targetDir)
  await runQaInit(targetDir, 'web', true)
}
