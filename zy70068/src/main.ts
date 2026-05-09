import { busFacade } from './services/BusNotificationFacade';
import { lineService } from './services/LineService';
import { reportService } from './services/ReportService';
import { receiptService } from './services/ReceiptService';
import { detourService } from './services/DetourService';
import { notificationService } from './services/NotificationService';

console.log('校车绕行通知服务已启动');
console.log('');
console.log('可用服务：');
console.log('  - lineService: 线路版本管理');
console.log('  - detourService: 绕行事件管理');
console.log('  - notificationService: 通知服务（去重+重试）');
console.log('  - receiptService: 司机回执服务');
console.log('  - reportService: 运行报告服务');
console.log('  - busFacade: 统一接口（推荐使用）');
console.log('');
console.log('运行演示：npm run demo');

export {
  busFacade,
  lineService,
  detourService,
  notificationService,
  receiptService,
  reportService,
};
