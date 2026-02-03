#!/usr/bin/env node

const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: cli [options]')
  process.exit(0)
}

console.log('Hello from your CLI')
