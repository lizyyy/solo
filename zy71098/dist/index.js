#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = require("./cli");
(0, cli_1.runCli)().then((exitCode) => {
    process.exitCode = exitCode;
}).catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map