#!/usr/bin/env bun

import { Command } from 'commander'

const program = new Command()

program
  .name('cli-tool')
  .description('A CLI tool built with Bun')
  .version('0.0.1')

program.command('hello')
  .description('Say hello')
  .action(() => {
    console.log('Hello from CLI Tool!')
  })

program.parse()
