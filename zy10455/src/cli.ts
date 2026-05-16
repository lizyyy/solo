#!/usr/bin/env node

import { CLI } from './cli/index';

const cli = new CLI();
cli.run().catch(console.error);
