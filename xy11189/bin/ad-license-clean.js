#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { main } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultConfig = {
  inputDir: join(__dirname, '..', 'samples', 'input'),
  outputDir: join(__dirname, '..', 'samples', 'output'),
  configPath: join(__dirname, '..', 'config', 'rules.json')
};

main(defaultConfig).catch(console.error);
