import { DataStore } from '../store/store';
import { Reporter } from '../services/reporter';
import { Environment } from '../types';

export interface CheckOptions {
  storePath?: string;
  environment?: Environment;
  certificateId?: string;
  verbose?: boolean;
  operator: string;
}

export function checkCommand(options: CheckOptions): void {
  const store = new DataStore(options.storePath);

  if (!store.exists()) {
    console.error('❌ 错误: 数据存储不存在，请先运行 init 命令');
    process.exit(1);
  }

  const reporter = new Reporter(store);
  const startTime = new Date();

  console.log('🔍 开始检查证书状态...');
  console.log('');

  let results;

  if (options.certificateId) {
    const result = reporter.checkCertificateById(options.certificateId);
    if (!result) {
      console.error(`❌ 错误: 未找到证书 ID: ${options.certificateId}`);
      process.exit(1);
    }
    results = [result];
  } else if (options.environment) {
    results = reporter.checkByEnvironment(options.environment);
    console.log(`📋 环境: ${options.environment}`);
  } else {
    results = reporter.checkAllCertificates();
  }

  console.log(`📊 共检查 ${results.length} 个证书`);
  console.log('');

  for (const result of results) {
    console.log(reporter.formatCheckResult(result, options.verbose));
    console.log('');
  }

  store.addExecutionRecord({
    action: 'check',
    targetType: 'system',
    status: 'success',
    startedAt: startTime.toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: new Date().getTime() - startTime.getTime(),
    operator: options.operator,
    details: {
      metadata: {
        checkedCount: results.length,
        environment: options.environment,
        certificateId: options.certificateId
      }
    }
  });
}
