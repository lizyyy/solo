#! /usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const commands_1 = require("./cli/commands");
function parseArgs(args) {
    const result = {
        command: null,
        options: {},
        positional: []
    };
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const eqIndex = arg.indexOf('=');
            let key;
            let value;
            if (eqIndex > 0) {
                key = arg.substring(2, eqIndex);
                value = arg.substring(eqIndex + 1);
            }
            else {
                key = arg.substring(2);
                const nextArg = args[i + 1];
                if (nextArg && !nextArg.startsWith('--')) {
                    value = nextArg;
                    i++;
                }
                else {
                    value = true;
                }
            }
            if (key === 'help') {
                result.options['help'] = true;
            }
            else {
                const numValue = Number(value);
                if (!isNaN(numValue) && typeof value === 'string') {
                    result.options[key] = numValue;
                }
                else {
                    result.options[key] = value;
                }
            }
        }
        else if (arg.startsWith('-')) {
            const shortOpt = arg.substring(1);
            if (shortOpt === 'h') {
                result.options['help'] = true;
            }
            else {
                result.options[shortOpt] = true;
            }
        }
        else if (!result.command) {
            result.command = arg;
        }
        else {
            result.positional.push(arg);
        }
        i++;
    }
    return result;
}
async function main() {
    const args = process.argv.slice(2);
    const parsed = parseArgs(args);
    if (parsed.options['help'] || !parsed.command) {
        (0, commands_1.printHelp)();
        process.exit(0);
    }
    const dataDir = parsed.options['data-dir'] || './data';
    const ctx = (0, commands_1.createContext)(path.resolve(dataDir));
    try {
        switch (parsed.command) {
            case 'init':
                await (0, commands_1.executeInit)(ctx);
                break;
            case 'import':
                await (0, commands_1.executeImport)(ctx, {
                    sample: !!parsed.options['sample'],
                    invalid: !!parsed.options['invalid'],
                    file: parsed.options['file']
                });
                break;
            case 'check':
                await (0, commands_1.executeCheck)(ctx);
                break;
            case 'detail':
                if (parsed.positional.length === 0) {
                    console.error('✗ 请指定资产 ID 或编号');
                    process.exit(1);
                }
                await (0, commands_1.executeDetail)(ctx, parsed.positional[0]);
                break;
            case 'report':
                await (0, commands_1.executeReport)(ctx, {
                    year: parsed.options['year'],
                    month: parsed.options['month'],
                    store: parsed.options['store']
                });
                break;
            default:
                console.error(`✗ 未知命令: ${parsed.command}`);
                (0, commands_1.printHelp)();
                process.exit(1);
        }
    }
    catch (error) {
        console.error('\n✗ 执行出错:');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map