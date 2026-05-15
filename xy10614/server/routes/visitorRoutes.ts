import express, { Request, Response } from 'express';
import { visitorService } from '../services/VisitorService';
import { store } from '../database/store';
import { APIResponse, VisitorStatus } from '../../shared/types';
import dayjs from 'dayjs';

const router = express.Router();

router.post('/init-demo', async (req: Request, res: Response) => {
  try {
    const results: string[] = [];
    
    results.push('=== 场景一：正常完成流程 ===');
    const visitor1 = visitorService.createVisitor({
      visitorName: '张三',
      visitorPhone: '13800138001',
      visitorIdCard: '110101199001011234',
      visitorPlate: '京A12345',
      visitorCompany: '科技有限公司',
      hostName: '李四',
      hostPhone: '13900139001',
      hostDepartment: '研发部',
      visitReason: '项目对接会议',
      expectedVisitDate: dayjs().format('YYYY-MM-DD'),
      expectedVisitTime: '09:00:00'
    }, 'admin', '管理员');
    results.push(`1. 创建访客预约: ${visitor1.visitorName}`);
    
    visitorService.hostConfirm(visitor1.id, true, '李四', '被访人');
    results.push('2. 被访人确认同意');
    
    visitorService.verifyPlateEntry(visitor1.id, '京A12345', 'security', '安保人员');
    results.push('3. 车牌校验通过，成功入园');
    
    const qrcode1 = visitorService.generateQRCode(visitor1.id, 'admin', '管理员');
    results.push(`4. 生成门禁二维码: ${qrcode1.qrcode}`);
    
    visitorService.scanQRCode(visitor1.id, qrcode1.qrcode, 'security', '安保人员');
    results.push('5. 扫描门禁二维码成功');
    
    visitorService.checkout(visitor1.id, 'manual', 'security', '安保人员');
    results.push('6. 离园核销成功');
    
    results.push('\n=== 场景二：被规则挡住（黑名单拦截）===');
    visitorService.addToBlacklist(
      '王五',
      '13800138002',
      '110101199002025678',
      '多次违规闯入',
      'admin',
      '管理员'
    );
    results.push('1. 将王五加入黑名单');
    
    try {
      visitorService.createVisitor({
        visitorName: '王五',
        visitorPhone: '13800138002',
        visitorIdCard: '110101199002025678',
        visitorPlate: '京B67890',
        visitorCompany: '贸易公司',
        hostName: '赵六',
        hostPhone: '13900139002',
        hostDepartment: '市场部',
        visitReason: '商务洽谈',
        expectedVisitDate: dayjs().format('YYYY-MM-DD'),
        expectedVisitTime: '10:00:00'
      }, 'admin', '管理员');
    } catch (e: any) {
      results.push(`2. 黑名单访客创建预约被拦截: ${e.message}`);
    }
    
    const visitor2 = visitorService.createVisitor({
      visitorName: '钱七',
      visitorPhone: '13800138003',
      visitorPlate: '京C11111',
      visitorCompany: '咨询公司',
      hostName: '孙八',
      hostPhone: '13900139003',
      hostDepartment: '财务部',
      visitReason: '审计工作',
      expectedVisitDate: dayjs().format('YYYY-MM-DD'),
      expectedVisitTime: '14:00:00'
    }, 'admin', '管理员');
    results.push(`3. 创建正常访客预约: ${visitor2.visitorName}`);
    
    visitorService.hostConfirm(visitor2.id, false, '孙八', '被访人', '时间冲突，改期');
    results.push('4. 被访人拒绝预约');
    
    results.push('\n=== 场景三：人工复核（车牌不匹配）===');
    const visitor3 = visitorService.createVisitor({
      visitorName: '周九',
      visitorPhone: '13800138004',
      visitorPlate: '京D22222',
      visitorCompany: '设计公司',
      hostName: '吴十',
      hostPhone: '13900139004',
      hostDepartment: '设计部',
      visitReason: '设计方案讨论',
      expectedVisitDate: dayjs().format('YYYY-MM-DD'),
      expectedVisitTime: '15:00:00'
    }, 'admin', '管理员');
    results.push(`1. 创建访客预约: ${visitor3.visitorName} (预约车牌: 京D22222)`);
    
    visitorService.hostConfirm(visitor3.id, true, '吴十', '被访人');
    results.push('2. 被访人确认同意');
    
    try {
      visitorService.verifyPlateEntry(visitor3.id, '京E99999', 'security', '安保人员');
    } catch (e: any) {
      results.push('3. 实际车牌京E99999与预约不符，进入人工复核');
    }
    
    visitorService.manualReview(visitor3.id, true, 'admin', '管理员', '核实确为预约访客，放行');
    results.push('4. 管理员人工复核通过');
    
    results.push('\n=== 场景四：重复提交防护 ===');
    const visitor4 = visitorService.createVisitor({
      visitorName: '郑十一',
      visitorPhone: '13800138005',
      visitorPlate: '京F33333',
      visitorCompany: '物流公司',
      hostName: '冯十二',
      hostPhone: '13900139005',
      hostDepartment: '物流部',
      visitReason: '送货',
      expectedVisitDate: dayjs().format('YYYY-MM-DD'),
      expectedVisitTime: '16:00:00'
    }, 'admin', '管理员');
    results.push(`1. 创建访客预约: ${visitor4.visitorName}`);
    
    visitorService.hostConfirm(visitor4.id, true, '冯十二', '被访人');
    results.push('2. 被访人确认同意');
    
    visitorService.verifyPlateEntry(visitor4.id, '京F33333', 'security', '安保人员');
    results.push('3. 第一次车牌校验通过');
    
    visitorService.generateQRCode(visitor4.id, 'admin', '管理员');
    results.push('4. 生成门禁二维码');
    
    results.push('\n=== 黑名单变更追踪 ===');
    const allBlacklist = store.getAllBlacklist();
    if (allBlacklist.length > 0) {
      visitorService.removeFromBlacklist(allBlacklist[0].id, 'admin', '管理员', '已完成整改，解除限制');
      results.push('1. 移除黑名单记录，导出时可追踪责任人和影响记录');
    }
    
    res.json({ 
      success: true, 
      data: {
        message: '演示场景初始化成功',
        visitors: store.getAllVisitors().length,
        logs: store.getAllOperationLogs().length,
        results
      } 
    } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/visitors', (req: Request, res: Response) => {
  try {
    const { data, operator, operatorRole } = req.body;
    const visitor = visitorService.createVisitor(data, operator, operatorRole);
    res.json({ success: true, data: visitor } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.get('/visitors/:id', (req: Request, res: Response) => {
  try {
    const visitor = store.getVisitor(req.params.id);
    if (!visitor) {
      return res.status(404).json({ success: false, error: '访客记录不存在' } as APIResponse);
    }
    res.json({ success: true, data: visitor } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.get('/visitors', (req: Request, res: Response) => {
  try {
    const visitors = store.getAllVisitors();
    res.json({ success: true, data: visitors } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/visitors/:id/host-confirm', (req: Request, res: Response) => {
  try {
    const { confirmed, operator, operatorRole, rejectReason } = req.body;
    const confirmation = visitorService.hostConfirm(req.params.id, confirmed, operator, operatorRole, rejectReason);
    res.json({ success: true, data: confirmation } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/visitors/:id/plate-entry', (req: Request, res: Response) => {
  try {
    const { plateNumber, operator, operatorRole } = req.body;
    const entry = visitorService.verifyPlateEntry(req.params.id, plateNumber, operator, operatorRole);
    res.json({ success: true, data: entry } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/visitors/:id/generate-qrcode', (req: Request, res: Response) => {
  try {
    const { operator, operatorRole } = req.body;
    const qrcode = visitorService.generateQRCode(req.params.id, operator, operatorRole);
    res.json({ success: true, data: qrcode } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/visitors/:id/scan-qrcode', (req: Request, res: Response) => {
  try {
    const { qrcode, operator, operatorRole } = req.body;
    const result = visitorService.scanQRCode(req.params.id, qrcode, operator, operatorRole);
    res.json({ success: true, data: result } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/visitors/:id/checkout', (req: Request, res: Response) => {
  try {
    const { checkoutType, operator, operatorRole } = req.body;
    const checkout = visitorService.checkout(req.params.id, checkoutType, operator, operatorRole);
    res.json({ success: true, data: checkout } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/visitors/:id/manual-review', (req: Request, res: Response) => {
  try {
    const { approved, operator, operatorRole, reason } = req.body;
    const visitor = visitorService.manualReview(req.params.id, approved, operator, operatorRole, reason);
    res.json({ success: true, data: visitor } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.get('/visitors/:id/timeline', (req: Request, res: Response) => {
  try {
    const timeline = visitorService.getTimeline(req.params.id);
    res.json({ success: true, data: timeline } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/blacklist', (req: Request, res: Response) => {
  try {
    const { visitorName, visitorPhone, visitorIdCard, reason, addedBy, operatorRole } = req.body;
    const record = visitorService.addToBlacklist(visitorName, visitorPhone, visitorIdCard, reason, addedBy, operatorRole);
    res.json({ success: true, data: record } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.delete('/blacklist/:id', (req: Request, res: Response) => {
  try {
    const { removedBy, operatorRole, reason } = req.body;
    const record = visitorService.removeFromBlacklist(req.params.id, removedBy, operatorRole, reason);
    if (!record) {
      return res.status(404).json({ success: false, error: '黑名单记录不存在' } as APIResponse);
    }
    res.json({ success: true, data: record } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.get('/blacklist', (req: Request, res: Response) => {
  try {
    const blacklist = store.getAllBlacklist();
    res.json({ success: true, data: blacklist } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/security-report', (req: Request, res: Response) => {
  try {
    const { reportDate, generatedBy, operatorRole } = req.body;
    const report = visitorService.generateSecurityReport(reportDate, generatedBy, operatorRole);
    res.json({ success: true, data: report } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.get('/security-reports', (req: Request, res: Response) => {
  try {
    const reports = store.getAllSecurityReports();
    res.json({ success: true, data: reports } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

export default router;
