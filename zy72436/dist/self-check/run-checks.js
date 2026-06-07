"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const checks_1 = require("./checks");
function main() {
    const results = (0, checks_1.runAllChecks)();
    (0, checks_1.printCheckResults)(results);
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
}
main();
