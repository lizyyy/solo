"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExitCodeExplanations = exports.ExitCodes = void 0;
exports.ExitCodes = {
    SUCCESS: 0,
    DIFFERENCES_FOUND: 1,
    INPUT_ERROR: 2,
    PARSE_ERROR: 3,
    CONFIG_ERROR: 4,
    INTERNAL_ERROR: 5,
};
exports.ExitCodeExplanations = [
    {
        code: 0,
        name: 'SUCCESS',
        description: '比较完成，未发现差异',
        action: '无需操作'
    },
    {
        code: 1,
        name: 'DIFFERENCES_FOUND',
        description: '发现一个或多个差异',
        action: '查看生成的差异报告，确认是接口变更还是脱敏问题'
    },
    {
        code: 2,
        name: 'INPUT_ERROR',
        description: '输入参数错误或文件不存在',
        action: '检查命令参数和文件路径'
    },
    {
        code: 3,
        name: 'PARSE_ERROR',
        description: 'Cassette 文件解析失败',
        action: '检查文件格式是否为有效的 YAML 或 JSON'
    },
    {
        code: 4,
        name: 'CONFIG_ERROR',
        description: '配置文件加载失败或格式错误',
        action: '检查配置文件格式'
    },
    {
        code: 5,
        name: 'INTERNAL_ERROR',
        description: '程序内部错误',
        action: '请提交 Issue 并附上错误日志'
    }
];
//# sourceMappingURL=index.js.map