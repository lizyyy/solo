#!/usr/bin/env node

import { setupCommands } from './cli/commands'

const program = setupCommands()

async function main() {
  try {
    await program.parseAsync(process.argv)
  } catch (error: any) {
    console.error('执行出错:', error.message)
    process.exit(1)
  }
}

main()
