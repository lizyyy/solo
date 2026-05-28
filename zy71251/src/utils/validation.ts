/**
 * 状态流转验证工具 - 用于验证补录/撤回后的异常检测是否可靠
 * 可在浏览器控制台调用：
 *   import { runAllValidations } from './src/utils/validation';
 *   runAllValidations();
 */

import useStore from '../store/useStore';

const getState = () => useStore.getState();

export const logValidationResult = (name: string, passed: boolean, details?: string) => {
  const style = passed 
    ? 'color: #10B981; font-weight: bold' 
    : 'color: #EF4444; font-weight: bold';
  console.log(`%c[${passed ? '✓' : '✗'}] ${name}`, style);
  if (details) {
    console.log(`   ${details}`);
  }
};

export const validateDuplicateBox = () => {
  const state = getState();
  const duplicates = state.detectDuplicateLocations();
  const expected = 'BX-DUP-2024-00001';
  const hasExpected = duplicates.some(d => d.includes(expected));
  logValidationResult(
    '箱位重复检测',
    hasExpected,
    hasExpected 
      ? `检测到 ${duplicates.length} 处重复，包含稳定测试用例: ${expected}` 
      : `未检测到稳定测试用例 ${expected}，可能已通过撤回修复`
  );
  return { passed: hasExpected, duplicates };
};

export const validateTemperatureAlerts = () => {
  const state = getState();
  const alerts = state.detectTemperatureAlerts();
  const passed = alerts.length > 0;
  logValidationResult(
    '温度超限检测',
    passed,
    passed 
      ? `检测到 ${alerts.length} 个库位温度超限: ${alerts.slice(0, 3).map(a => a.code).join(', ')}` 
      : '未检测到温度超限'
  );
  return { passed, alerts };
};

export const validateHumidityAlerts = () => {
  const state = getState();
  const alerts = state.detectHumidityAlerts();
  const passed = alerts.length > 0;
  logValidationResult(
    '湿度超限检测',
    passed,
    passed 
      ? `检测到 ${alerts.length} 个库位湿度超限: ${alerts.slice(0, 3).map(a => a.code).join(', ')}` 
      : '未检测到湿度超限'
  );
  return { passed, alerts };
};

export const validateForbiddenZoneCrossing = () => {
  const state = getState();
  const routesWithCrossing = state.tasks.filter(t => 
    t.status !== 'completed' && t.status !== 'cancelled' && 
    state.checkForbiddenCrossing(t.route)
  );
  const hasExpected = routesWithCrossing.some(t => t.id === 'TASK-2024-002');
  logValidationResult(
    '路线穿越禁区检测',
    hasExpected,
    hasExpected 
      ? `检测到 ${routesWithCrossing.length} 条路线穿越禁区，包含稳定测试任务: TASK-2024-002` 
      : `测试任务 TASK-2024-002 可能已被撤回或完成`
  );
  return { passed: hasExpected, routesWithCrossing };
};

export const validateStatusFlow = () => {
  const state = getState();
  const task2 = state.tasks.find(t => t.id === 'TASK-2024-002');
  const task1 = state.tasks.find(t => t.id === 'TASK-2024-001');
  
  let passed = true;
  let details: string[] = [];
  
  if (task2?.hasForbiddenCrossing && task2.status === 'pending') {
    details.push('TASK-2024-002 正确保持 pending 状态（因路线告警）');
  } else if (task2?.status === 'cancelled') {
    details.push('TASK-2024-002 已被撤回（cancelled）');
  } else if (task2?.status === 'completed') {
    details.push('TASK-2024-002 已通过补录完成');
  } else {
    passed = false;
    details.push(`TASK-2024-002 状态异常: ${task2?.status}`);
  }
  
  if (task1?.status === 'in_progress') {
    details.push('TASK-2024-001 正确处于进行中状态');
  } else if (task1?.status === 'completed') {
    details.push('TASK-2024-001 已完成');
  } else if (task1?.status === 'cancelled') {
    details.push('TASK-2024-001 已被撤回');
  }
  
  logValidationResult(
    '任务状态流转',
    passed,
    details.join('；')
  );
  return { passed, details };
};

export const validateOperationLogs = () => {
  const state = getState();
  const hasSupplement = state.operationLogs.some(l => l.action.includes('补录'));
  const hasRevoke = state.operationLogs.some(l => l.action.includes('撤回'));
  
  logValidationResult(
    '操作日志记录',
    hasSupplement || hasRevoke,
    hasSupplement || hasRevoke
      ? `日志中包含${hasSupplement ? '补录' : ''}${hasSupplement && hasRevoke ? '、' : ''}${hasRevoke ? '撤回' : ''}操作记录，共 ${state.operationLogs.length} 条`
      : '尚未检测到用户操作，初始日志已加载'
  );
  return { passed: hasSupplement || hasRevoke, logCount: state.operationLogs.length };
};

export const runAllValidations = () => {
  console.log('%c=== 艺术仓库库位孪生 - 状态流转验证 ===', 'font-size: 16px; font-weight: bold; color: #3B82F6;');
  console.log('验证时间:', new Date().toLocaleString('zh-CN'));
  console.log('');
  
  const results = [
    validateDuplicateBox(),
    validateTemperatureAlerts(),
    validateHumidityAlerts(),
    validateForbiddenZoneCrossing(),
    validateStatusFlow(),
    validateOperationLogs()
  ];
  
  const passed = results.filter(r => r.passed).length;
  console.log('');
  console.log(`%c=== 验证结果: ${passed}/${results.length} 项通过 ===`, 
    passed === results.length ? 'color: #10B981; font-weight: bold' : 'color: #F59E0B; font-weight: bold');
  console.log('');
  console.log('%c测试场景说明:', 'font-weight: bold');
  console.log('  1. 箱位重复: BX-DUP-2024-00001 同时分配给 S-A01-L2-P01 和 S-A02-L2-P03');
  console.log('  2. 温湿度超限: B-02-L2, C-01-L3, D-03-L1 三个库位');
  console.log('  3. 路线穿越禁区: TASK-2024-002 移库路线穿越 FZ-002 精密仪器区');
  console.log('');
  console.log('%c可执行操作验证状态流转:', 'font-weight: bold');
  console.log('  - 点击库位 → 补录登记/撤回分配 → 观察异常检测变化');
  console.log('  - 点击任务按钮 → 任务开始/完成/撤回/补录 → 观察任务状态流转');
  console.log('  - 撤回 TASK-2024-002 → 验证路线告警是否清除');
  console.log('  - 撤回 S-A01-L2-P01 的重复箱子 → 验证箱位重复是否减少');
  
  return results;
};

if (typeof window !== 'undefined') {
  (window as any).__validateWarehouse = runAllValidations;
}
