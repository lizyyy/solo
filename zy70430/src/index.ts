import { RequestSizeGuardrail } from './guardrail';
import { ReportExporter } from './exporter';

export { RequestSizeGuardrail, ReportExporter };
export * from './types';

if (require.main === module) {
  console.log('请求大小护栏服务');
  console.log('运行 npm test 执行自检脚本');
  console.log('运行 npm run export 导出复核报告');
}
