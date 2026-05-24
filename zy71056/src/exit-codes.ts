import { ExitCodes, ExitCode } from './types';

export const exitCodeDescriptions: Record<ExitCode, string> = {
  [ExitCodes.SUCCESS]: '执行成功，未发现违规项',
  [ExitCodes.VIOLATIONS]: '发现许可证违规，需审查',
  [ExitCodes.INPUT_ERROR]: '输入参数错误或文件不存在',
  [ExitCodes.IO_ERROR]: '文件读写错误',
  [ExitCodes.PARSE_ERROR]: 'lockfile 或 package.json 解析错误',
};

export function describeExitCode(code: ExitCode): string {
  return exitCodeDescriptions[code] || `未知退出码: ${code}`;
}
