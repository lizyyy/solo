"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./server");
const initSampleData_1 = require("./initSampleData");
const args = process.argv.slice(2);
if (args.includes('--init-sample')) {
    (0, initSampleData_1.initSampleData)();
}
