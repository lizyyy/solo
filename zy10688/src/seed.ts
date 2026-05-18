import { initDB } from './db';
import { importRecords } from './services/whitelistService';
import { WhitelistStatus } from './types';

const seedData = [
  {
    account: 'zhang.san@example.com',
    reason: '核心业务系统运维账号，日常合规审核豁免',
    validFrom: '2024-01-01T00:00:00.000Z',
    validTo: '2024-12-31T23:59:59.000Z',
    auditor: 'li.si@example.com',
    createdBy: 'data-migration-script',
    status: WhitelistStatus.ACTIVE,
    remark: '2024年度白名单申请-IT运维部'
  },
  {
    account: 'wang.wu@example.com',
    reason: '财务系统批处理账号，夜间自动任务豁免',
    validFrom: '2024-01-01T00:00:00.000Z',
    validTo: '2024-06-30T23:59:59.000Z',
    auditor: 'zhao.liu@example.com',
    createdBy: 'data-migration-script',
    status: WhitelistStatus.PENDING_EXPIRE,
    remark: '6月到期待审核，已提交失效申请'
  },
  {
    account: 'chen.qi@example.com',
    reason: '临时测试账号，渗透测试期间豁免',
    validFrom: '2024-03-01T00:00:00.000Z',
    validTo: '2024-03-15T23:59:59.000Z',
    auditor: 'zhou.ba@example.com',
    createdBy: 'data-migration-script',
    status: WhitelistStatus.EXPIRED,
    remark: '渗透测试完成，已过期失效'
  },
  {
    account: 'liu.jiu@example.com',
    reason: '客服系统VIP账号，客户投诉紧急处理豁免',
    validFrom: '2024-02-01T00:00:00.000Z',
    validTo: '2024-08-31T23:59:59.000Z',
    auditor: 'wu.shi@example.com',
    createdBy: 'data-migration-script',
    status: WhitelistStatus.RESTORE_REQUESTED,
    remark: '原有效期内误操作失效，申请恢复'
  },
  {
    account: 'sun.yi@example.com',
    reason: '大数据分析平台ETL任务账号',
    validFrom: '2024-01-01T00:00:00.000Z',
    validTo: '2024-12-31T23:59:59.000Z',
    auditor: 'qian.er@example.com',
    createdBy: 'data-migration-script',
    status: WhitelistStatus.ACTIVE,
    remark: '年度数据同步任务专用'
  },
  {
    account: 'li.san@example.com',
    reason: '日志收集系统专用采集账号',
    validFrom: '2024-01-15T00:00:00.000Z',
    validTo: '2024-07-15T23:59:59.000Z',
    auditor: 'zhang.si@example.com',
    createdBy: 'data-migration-script',
    status: WhitelistStatus.EXPIRED,
    remark: '系统架构升级后已废弃'
  },
  {
    account: 'zhou.wu@example.com',
    reason: '安全扫描工具专用账号',
    validFrom: '2024-02-20T00:00:00.000Z',
    validTo: '2024-08-20T23:59:59.000Z',
    auditor: 'wang.liu@example.com',
    createdBy: 'data-migration-script',
    status: WhitelistStatus.ACTIVE,
    remark: '每周安全合规扫描'
  },
  {
    account: 'wu.zheng@example.com',
    reason: 'API网关测试账号',
    validFrom: '2024-03-10T00:00:00.000Z',
    validTo: '2024-09-10T23:59:59.000Z',
    auditor: 'feng.yi@example.com',
    createdBy: 'data-migration-script',
    status: WhitelistStatus.PENDING_EXPIRE,
    remark: '新网关上线后需失效'
  }
];

const seed = async () => {
  try {
    await initDB();
    console.log('开始导入种子数据...');
    
    const result = await importRecords(seedData);
    
    console.log(`\n种子数据导入完成:`);
    console.log(`- 成功: ${result.success} 条`);
    console.log(`- 失败: ${result.failed} 条`);
    
    if (result.errors.length > 0) {
      console.log(`\n错误详情:`);
      result.errors.forEach(err => {
        console.log(`  行${err.row} ${err.account}: ${err.reason}`);
      });
    }
    
    console.log('\n白名单数据统计:');
    console.log(`- ACTIVE (生效中): ${seedData.filter(s => s.status === WhitelistStatus.ACTIVE).length}`);
    console.log(`- PENDING_EXPIRE (失效待审): ${seedData.filter(s => s.status === WhitelistStatus.PENDING_EXPIRE).length}`);
    console.log(`- EXPIRED (已失效): ${seedData.filter(s => s.status === WhitelistStatus.EXPIRED).length}`);
    console.log(`- RESTORE_REQUESTED (恢复申请): ${seedData.filter(s => s.status === WhitelistStatus.RESTORE_REQUESTED).length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('种子数据导入失败:', error);
    process.exit(1);
  }
};

seed();
