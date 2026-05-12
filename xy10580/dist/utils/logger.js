"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const chalk_1 = __importDefault(require("chalk"));
exports.logger = {
    info: (message) => {
        console.log(chalk_1.default.blue('[INFO]'), message);
    },
    success: (message) => {
        console.log(chalk_1.default.green('[SUCCESS]'), message);
    },
    warn: (message) => {
        console.log(chalk_1.default.yellow('[WARN]'), message);
    },
    error: (message) => {
        console.error(chalk_1.default.red('[ERROR]'), message);
    },
    debug: (message) => {
        if (process.env.DEBUG) {
            console.log(chalk_1.default.gray('[DEBUG]'), message);
        }
    },
    step: (num, message) => {
        console.log(chalk_1.default.cyan(`[${num}]`), message);
    },
    status: (label, value) => {
        console.log(chalk_1.default.white(`${label}:`), chalk_1.default.italic(value));
    },
    divider: () => {
        console.log(chalk_1.default.gray('─'.repeat(60)));
    },
    header: (title) => {
        console.log('');
        console.log(chalk_1.default.bold.bgBlue.white(` ${title} `));
        exports.logger.divider();
    },
};
//# sourceMappingURL=logger.js.map