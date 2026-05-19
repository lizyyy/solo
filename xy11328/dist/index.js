#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_1 = require("./cli/commands");
const program = (0, commands_1.setupCommands)();
async function main() {
    try {
        await program.parseAsync(process.argv);
    }
    catch (error) {
        console.error('执行出错:', error.message);
        process.exit(1);
    }
}
main();
