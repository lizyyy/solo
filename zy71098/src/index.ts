#!/usr/bin/env node

import { runCli } from './cli';

runCli().then((exitCode) => {
  process.exitCode = exitCode;
}).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
