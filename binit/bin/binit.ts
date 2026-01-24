#!/usr/bin/env bun
import { Command } from 'commander'
import { init } from './src/index.js'

const program = new Command()

program
  .name('binit')
  .description('Interactive Bun monorepo initializer')
  .version('0.0.1')
  .action(async () => {
    await init()
  })

program.parse()
