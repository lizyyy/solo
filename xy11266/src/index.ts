#! /usr/bin/env node

import { program } from './cli';

program.parseAsync(process.argv).catch(console.error);
