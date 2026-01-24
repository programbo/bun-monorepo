import inquirer from 'inquirer'

export interface InitAnswers {
  appName: string
  appType: 'web' | 'cli' | 'both'
  packageTypes: ('ui' | 'utils')[]
  framework: 'nextjs' | 'vanilla'
  useTailwind: boolean
  useConfigPackage: boolean
}

export async function askPrompts(): Promise<InitAnswers> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'appName',
      message: 'Enter your monorepo name:',
      default: 'my-monorepo',
      validate: (input) => input.trim().length > 0
    },
    {
      type: 'list',
      name: 'appType',
      message: 'Select app types to create:',
      choices: [
        { name: 'Web Application', value: 'web' },
        { name: 'CLI Tool', value: 'cli' },
        { name: 'Both Web and CLI', value: 'both' }
      ]
    },
    {
      type: 'checkbox',
      name: 'packageTypes',
      message: 'Select package types to create:',
      choices: [
        { name: 'Shared UI Components', value: 'ui' },
        { name: 'Shared Utilities', value: 'utils' }
      ]
    },
    {
      type: 'list',
      name: 'framework',
      message: 'Select framework for web app:',
      choices: [
        { name: 'Next.js', value: 'nextjs' },
        { name: 'Vanilla Bun', value: 'vanilla' }
      ]
    },
    {
      type: 'confirm',
      name: 'useTailwind',
      message: 'Include Tailwind CSS?',
      default: true
    },
    {
      type: 'confirm',
      name: 'useConfigPackage',
      message: 'Use @<monorepo-name>/config for linting/formatting?',
      default: true
    }
  ])
  
  return answers
}
