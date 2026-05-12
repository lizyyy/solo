'use strict';

const chalk = require('chalk');

function info(message) {
  console.log(chalk.blue('[INFO] ') + message);
}

function success(message) {
  console.log(chalk.green('[SUCCESS] ') + message);
}

function warn(message) {
  console.log(chalk.yellow('[WARN] ') + message);
}

function error(message) {
  console.log(chalk.red('[ERROR] ') + message);
}

function title(message) {
  console.log('\n' + chalk.bold.underline(message));
}

function section(message) {
  console.log('\n' + chalk.bold(message));
}

function step(index, total, message) {
  console.log(chalk.gray(`[${index}/${total}] `) + message);
}

module.exports = { info, success, warn, error, title, section, step };
