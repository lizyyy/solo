import mongoose from 'mongoose';
import ReleaseRequest from '../models/ReleaseRequest';
import AffectedService from '../models/AffectedService';
import ApprovalOpinion from '../models/ApprovalOpinion';
import GrayBatch from '../models/GrayBatch';
import RollbackAction from '../models/RollbackAction';

const initData = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/cloud-release-approval');
    console.log('Connected to MongoDB');
    
    await ReleaseRequest.deleteMany({});
    await AffectedService.deleteMany({});
    await ApprovalOpinion.deleteMany({});
    await GrayBatch.deleteMany({});
    await RollbackAction.deleteMany({});
    console.log('Cleared existing data');
    
    const requests = [
      {
        requestId: 'REQ000001',
        title: '用户服务配置更新',
        description: '更新用户服务的Redis配置参数',
        applicant: '张三',
        department: '技术部',
        status: 'completed',
        priority: 'high',
        type: 'config',
        changeHistory: []
      },
      {
        requestId: 'REQ000002',
        title: '订单数据库迁移',
        description: '将订单数据从MySQL迁移到PostgreSQL',
        applicant: '李四',
        department: '数据部',
        status: 'processing',
        priority: 'critical',
        type: 'database',
        changeHistory: []
      },
      {
        requestId: 'REQ000003',
        title: '支付服务代码发布',
        description: '发布新版本支付服务，修复已知bug',
        applicant: '王五',
        department: '技术部',
        status: 'pending',
        priority: 'medium',
        type: 'code',
        changeHistory: []
      },
      {
        requestId: 'REQ000004',
        title: '消息队列资源扩容',
        description: '增加Kafka集群节点数量',
        applicant: '赵六',
        department: '运维部',
        status: 'rolled_back',
        priority: 'high',
        type: 'resource',
        changeHistory: []
      },
      {
        requestId: 'REQ000005',
        title: '日志服务配置优化',
        description: '优化日志收集和存储配置',
        applicant: '钱七',
        department: '运维部',
        status: 'approved',
        priority: 'low',
        type: 'config',
        changeHistory: []
      }
    ];
    
    await ReleaseRequest.insertMany(requests);
    console.log('Inserted release requests');
    
    const services = [
      { requestId: 'REQ000001', serviceName: '用户服务', serviceId: 'user-service-01', environment: 'prod', impactLevel: 'high', expectedDowntime: 5, actualDowntime: 3, status: 'completed' },
      { requestId: 'REQ000001', serviceName: '认证服务', serviceId: 'auth-service-01', environment: 'prod', impactLevel: 'medium', expectedDowntime: 2, actualDowntime: 1, status: 'completed' },
      { requestId: 'REQ000002', serviceName: '订单服务', serviceId: 'order-service-01', environment: 'prod', impactLevel: 'critical', expectedDowntime: 30, actualDowntime: 25, status: 'processing' },
      { requestId: 'REQ000002', serviceName: '支付服务', serviceId: 'pay-service-01', environment: 'prod', impactLevel: 'critical', expectedDowntime: 10, actualDowntime: 8, status: 'pending' },
      { requestId: 'REQ000003', serviceName: '支付网关', serviceId: 'pay-gateway-01', environment: 'staging', impactLevel: 'medium', expectedDowntime: 5, status: 'pending' },
      { requestId: 'REQ000004', serviceName: 'Kafka节点1', serviceId: 'kafka-01', environment: 'prod', impactLevel: 'high', expectedDowntime: 15, actualDowntime: 20, status: 'failed' },
      { requestId: 'REQ000004', serviceName: 'Kafka节点2', serviceId: 'kafka-02', environment: 'prod', impactLevel: 'high', expectedDowntime: 15, actualDowntime: 18, status: 'failed' },
      { requestId: 'REQ000005', serviceName: 'ELK服务', serviceId: 'elk-service-01', environment: 'prod', impactLevel: 'low', expectedDowntime: 0, status: 'pending' }
    ];
    
    await AffectedService.insertMany(services);
    console.log('Inserted affected services');
    
    const opinions = [
      { requestId: 'REQ000001', approver: '王总监', approverRole: '技术总监', opinion: 'approved', comments: '配置合理，同意发布', approvalTime: new Date() },
      { requestId: 'REQ000001', approver: '李经理', approverRole: '运维经理', opinion: 'approved', comments: '已评估影响，准备就绪', approvalTime: new Date() },
      { requestId: 'REQ000002', approver: '王总监', approverRole: '技术总监', opinion: 'approved', comments: '数据迁移方案可行，注意监控', approvalTime: new Date() },
      { requestId: 'REQ000004', approver: '王总监', approverRole: '技术总监', opinion: 'approved', comments: '扩容必要，注意回滚准备', approvalTime: new Date() },
      { requestId: 'REQ000005', approver: '李经理', approverRole: '运维经理', opinion: 'need_modification', comments: '需要补充具体配置参数', approvalTime: new Date() }
    ];
    
    await ApprovalOpinion.insertMany(opinions);
    console.log('Inserted approval opinions');
    
    const batches = [
      { requestId: 'REQ000001', batchNumber: 1, batchName: '灰度批次1', targetPercentage: 10, actualPercentage: 10, startTime: new Date(Date.now() - 3600000), endTime: new Date(Date.now() - 3300000), status: 'completed', instanceCount: 2, successCount: 2, failedCount: 0 },
      { requestId: 'REQ000001', batchNumber: 2, batchName: '灰度批次2', targetPercentage: 50, actualPercentage: 50, startTime: new Date(Date.now() - 3000000), endTime: new Date(Date.now() - 2700000), status: 'completed', instanceCount: 5, successCount: 5, failedCount: 0 },
      { requestId: 'REQ000001', batchNumber: 3, batchName: '全量发布', targetPercentage: 100, actualPercentage: 100, startTime: new Date(Date.now() - 2400000), endTime: new Date(Date.now() - 1800000), status: 'completed', instanceCount: 10, successCount: 10, failedCount: 0 },
      { requestId: 'REQ000002', batchNumber: 1, batchName: '灰度批次1', targetPercentage: 5, actualPercentage: 5, startTime: new Date(Date.now() - 1200000), status: 'processing', instanceCount: 1, successCount: 0, failedCount: 0 },
      { requestId: 'REQ000004', batchNumber: 1, batchName: '灰度批次1', targetPercentage: 20, actualPercentage: 20, startTime: new Date(Date.now() - 7200000), endTime: new Date(Date.now() - 6600000), status: 'failed', instanceCount: 2, successCount: 0, failedCount: 2 }
    ];
    
    await GrayBatch.insertMany(batches);
    console.log('Inserted gray batches');
    
    const rollbacks = [
      {
        requestId: 'REQ000004',
        triggeredBy: '张运维',
        triggerTime: new Date(Date.now() - 6000000),
        reason: 'Kafka节点启动失败，出现Broker ID冲突',
        reasonCategory: 'service_exception',
        affectedBatches: ['650000000000000000000001'],
        rollbackScope: 'full',
        status: 'completed',
        startTime: new Date(Date.now() - 6000000),
        endTime: new Date(Date.now() - 5400000),
        rollbackDetails: [
          { serviceName: 'Kafka节点1', beforeVersion: 'v2.8.0', afterVersion: 'v2.7.1', status: 'completed' },
          { serviceName: 'Kafka节点2', beforeVersion: 'v2.8.0', afterVersion: 'v2.7.1', status: 'completed' }
        ]
      }
    ];
    
    await RollbackAction.insertMany(rollbacks);
    console.log('Inserted rollback actions');
    
    console.log('Data initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing data:', error);
    process.exit(1);
  }
};

initData();
