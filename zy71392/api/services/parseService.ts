import scriptRepository from '../repositories/scriptRepository.js';
import activityRepository from '../repositories/activityRepository.js';
import type { ApiCall, CloudPlatform } from '../types/index.js';

interface CloudPattern {
  prefix: RegExp;
  serviceMap: Record<string, string>;
}

const cloudPatterns: Record<CloudPlatform, CloudPattern> = {
  aws: {
    prefix: /aws\s+(\w+)\s+(\w+)/i,
    serviceMap: {
      ec2: 'EC2', s3: 'S3', iam: 'IAM', lambda: 'Lambda', rds: 'RDS',
      cloudwatch: 'CloudWatch', sqs: 'SQS', sns: 'SNS', dynamodb: 'DynamoDB',
      ecs: 'ECS', eks: 'EKS', ssm: 'SSM', kms: 'KMS',
    },
  },
  aliyun: {
    prefix: /aliyun\s+(\w+)\s+(\w+)/i,
    serviceMap: {
      ecs: 'ECS', oss: 'OSS', ram: 'RAM', fc: 'FC', rds: 'RDS',
      sls: 'SLS', mns: 'MNS', dyvmsapi: 'VMS', vod: 'VOD',
    },
  },
  tencent: {
    prefix: /tccli\s+(\w+)\s+(\w+)/i,
    serviceMap: {
      cvm: 'CVM', cos: 'COS', cam: 'CAM', scf: 'SCF', cdb: 'CDB',
      cls: 'CLS', cmq: 'CMQ', tke: 'TKE',
    },
  },
  gcp: {
    prefix: /gcloud\s+(\w+)\s+(\w+)/i,
    serviceMap: {
      compute: 'Compute', storage: 'Storage', iam: 'IAM', functions: 'CloudFunctions',
      sql: 'CloudSQL', pubsub: 'PubSub', container: 'KubernetesEngine',
    },
  },
};

const sdkPatterns: Record<CloudPlatform, RegExp[]> = {
  aws: [
    /boto3\.client\(['"](\w+)['"]\)/i,
    /boto3\.resource\(['"](\w+)['"]\)/i,
    /\.(get_|\w+_)\w*\(\s*['"](\w+?)['"]/i,
    /\.(list_|describe_|get_|create_|delete_|update_|put_|start_|stop_)(\w+)/i,
  ],
  aliyun: [
    /client\s*=\s*\w+Client\(/i,
    /\.do_(\w+)/i,
    /request\(['"](\w+)['"]/i,
  ],
  tencent: [
    /client\s*=\s*\w+Client\(/i,
    /\.(\w+)\s*\(/i,
  ],
  gcp: [
    /google\.cloud\.(\w+)/i,
    /\.(\w+)\s*\(/i,
  ],
};

class ParseService {
  parseScript(scriptId: number): ApiCall[] {
    const script = scriptRepository.getById(scriptId);
    if (!script) throw new Error('Script not found');

    scriptRepository.clearApiCalls(scriptId);
    const calls: ApiCall[] = [];

    const lines = script.content.split('\n');
    const platform = script.cloud_platform;
    const pattern = cloudPatterns[platform];
    const sdks = sdkPatterns[platform];

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimLine = line.trim();
      if (!trimLine || trimLine.startsWith('#') || trimLine.startsWith('//') || trimLine.startsWith('/*')) {
        return;
      }

      const cliMatch = trimLine.match(pattern.prefix);
      if (cliMatch) {
        const serviceRaw = cliMatch[1].toLowerCase();
        const actionRaw = cliMatch[2];
        const service = pattern.serviceMap[serviceRaw] || serviceRaw.toUpperCase();
        calls.push({
          id: 0,
          script_id: scriptId,
          service,
          action: actionRaw,
          resource: '*',
          source: 'static',
          line_number: lineNum,
          context: trimLine.slice(0, 100),
        });
      }

      for (const sdkPattern of sdks) {
        const sdkMatch = trimLine.match(sdkPattern);
        if (sdkMatch) {
          let service = 'SDK';
          let action = sdkMatch[1] || sdkMatch[2] || 'call';
          if (sdkMatch.length > 2 && sdkMatch[2]) {
            service = pattern.serviceMap[sdkMatch[1]] || sdkMatch[1];
            action = sdkMatch[2];
          }
          if (action && action.length > 2) {
            calls.push({
              id: 0,
              script_id: scriptId,
              service,
              action,
              resource: '*',
              source: 'static',
              line_number: lineNum,
              context: trimLine.slice(0, 100),
            });
          }
        }
      }
    });

    const uniqueCalls = calls.filter((c, i, arr) =>
      i === arr.findIndex(x => x.service === c.service && x.action === c.action)
    );

    const savedCalls = uniqueCalls.map(c => scriptRepository.addApiCall(c));

    activityRepository.create('parse', `解析脚本 ${script.name}，识别到 ${savedCalls.length} 个API调用`, { scriptId });

    return savedCalls;
  }

  parseRuntimeLog(scriptId: number, logContent: string): ApiCall[] {
    const script = scriptRepository.getById(scriptId);
    if (!script) throw new Error('Script not found');

    scriptRepository.addRuntimeLog({ script_id: scriptId, content: logContent });

    const platform = script.cloud_platform;
    const pattern = cloudPatterns[platform];
    const calls: ApiCall[] = [];

    const lines = logContent.split('\n');
    lines.forEach((line, idx) => {
      const cliMatch = line.match(pattern.prefix);
      if (cliMatch) {
        const serviceRaw = cliMatch[1].toLowerCase();
        const actionRaw = cliMatch[2];
        const service = pattern.serviceMap[serviceRaw] || serviceRaw.toUpperCase();
        calls.push({
          id: 0,
          script_id: scriptId,
          service,
          action: actionRaw,
          resource: '*',
          source: 'dynamic',
          line_number: idx + 1,
          context: line.slice(0, 100),
        });
      }
    });

    const existing = scriptRepository.getApiCalls(scriptId);
    const existingKeys = new Set(existing.map(e => `${e.service}:${e.action}`));

    const newCalls = calls.filter(c => !existingKeys.has(`${c.service}:${c.action}`));
    const uniqueNewCalls = newCalls.filter((c, i, arr) =>
      i === arr.findIndex(x => x.service === c.service && x.action === c.action)
    );

    const savedCalls = uniqueNewCalls.map(c => scriptRepository.addApiCall(c));

    activityRepository.create('runtime_log', `导入运行日志，新增 ${savedCalls.length} 个动态API调用`, { scriptId });

    return savedCalls;
  }

  detectDynamicMiss(scriptId: number): { reason: string; impact: string; nextAction: string; context: string[] } {
    const script = scriptRepository.getById(scriptId);
    if (!script) throw new Error('Script not found');

    const contexts: string[] = [];
    const lines = script.content.split('\n');

    const dynamicIndicators = [
      { pattern: /eval\s*\(/i, label: 'eval动态执行' },
      { pattern: /exec\s*\(/i, label: 'exec执行' },
      { pattern: /\$\{.*\}/, label: '变量替换' },
      { pattern: /\$\(.*\)/, label: '命令替换' },
      { pattern: /\`.+\`/, label: '反引号执行' },
      { pattern: /subprocess|Popen|system\(/i, label: '子进程调用' },
      { pattern: /getattr|__import__/, label: 'Python动态导入' },
    ];

    lines.forEach((line, idx) => {
      for (const ind of dynamicIndicators) {
        if (ind.pattern.test(line)) {
          contexts.push(`行${idx + 1}: ${ind.label} - ${line.trim().slice(0, 60)}`);
        }
      }
    });

    const logs = scriptRepository.getRuntimeLogs(scriptId);
    const hasLogs = logs.length > 0;

    if (contexts.length > 0 || !hasLogs) {
      return {
        reason: !hasLogs
          ? '未提供运行日志，无法验证脚本实际执行的API调用'
          : `脚本中发现 ${contexts.length} 处动态执行特征，可能存在静态解析遗漏`,
        impact: '部分真实API调用可能未被识别，导致最小权限集不完整，脚本运行时出现权限不足',
        nextAction: !hasLogs
          ? '上传脚本运行时的完整日志，或在生产环境执行后抓取CloudTrail/ActionTrail记录'
          : '结合运行日志补充API调用，或手动添加可疑调用并标记为例外',
        context: contexts.slice(0, 10),
      };
    }

    return { reason: '', impact: '', nextAction: '', context: [] };
  }
}

export default new ParseService();
