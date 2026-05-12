#!/usr/bin/env node

import { setupCLI } from './cli';

const program = setupCLI();
program.parse(process.argv);
