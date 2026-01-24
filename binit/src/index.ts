import inquirer from 'inquirer'
import chalk from 'chalk'
import { generateTemplates } from './templates/index.js'
import { askPrompts } from './prompts.js'

export async function init() {
  console.log(chalk.blue('🚀 Welcome to binit - Bun Monorepo Generator'))
  console.log(chalk.gray('This will create a Bun monorepo with workspace configuration'))
  
  const answers = await askPrompts()
  console.log(chalk.green('\n✓ Configuration selected'))
  
  await generateTemplates(answers)
  
  console.log(chalk.green('\n✓ Monorepo initialized successfully!'))
  console.log(chalk.gray('Run "bun install" to install dependencies'))
}
