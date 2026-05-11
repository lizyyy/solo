#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');

const commandsDir = path.join(__dirname, '..', 'src', 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));

program
  .name('garment')
  .description('服装样衣借还管理CLI工具')
  .version('1.0.0');

for (const file of commandFiles) {
  const command = require(path.join(commandsDir, file));
  command(program);
}

program.parse(process.argv);
