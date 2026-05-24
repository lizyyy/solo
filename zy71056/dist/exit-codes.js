"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exitCodeDescriptions = void 0;
exports.describeExitCode = describeExitCode;
const types_1 = require("./types");
exports.exitCodeDescriptions = {
    [types_1.ExitCodes.SUCCESS]: '执行成功，未发现违规项',
    [types_1.ExitCodes.VIOLATIONS]: '发现许可证违规，需审查',
    [types_1.ExitCodes.INPUT_ERROR]: '输入参数错误或文件不存在',
    [types_1.ExitCodes.IO_ERROR]: '文件读写错误',
    [types_1.ExitCodes.PARSE_ERROR]: 'lockfile 或 package.json 解析错误',
};
function describeExitCode(code) {
    return exports.exitCodeDescriptions[code] || `未知退出码: ${code}`;
}
