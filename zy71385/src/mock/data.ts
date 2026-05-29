import type {
  FeatureFlag,
  CodeReference,
  EnvironmentStatus,
  RiskAssessment,
  CleanupLog,
  Report,
  RuleConfig,
  FlagWithDetails,
} from '../types';
import { daysAgo } from '../utils/dateUtils';
import { assessRisk, getDefaultRules } from '../utils/riskCalculator';

const flagNames = [
  '新用户注册流程优化', '支付通道灰度', '首页推荐算法v2', '商品详情页改版',
  '优惠券系统重构', '订单拆分逻辑', '物流追踪功能', '客服机器人接入',
  '会员等级体系', '积分商城上线', '活动页AB测试', '搜索联想优化',
  '图片懒加载', '缓存策略优化', '数据库读写分离', '消息队列迁移',
  '登录方式升级', '第三方账号绑定', '实名认证流程', '风控规则调整',
  '营销弹窗控制', '商品评论审核', '退换货流程优化', '发票系统升级',
  '地址库更新', '时区支持扩展', '多语言切换', '主题色定制',
  '性能监控开关', '错误采样率调整', '埋点上报优化', 'CDN切换',
  '移动端适配', '小程序版本兼容', 'H5页面试点', 'PWA功能开启',
  'AI推荐接入', '智能客服升级', '语音搜索功能', 'AR试穿试点',
  '直播功能开关', '短视频挂载', '社交分享优化', 'Push通知策略',
  '短信通道切换', '邮件模板更新', '站内信改版', '帮助中心重构',
  '协议版本升级', '安全加固措施',
];

const owners = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', null, null];

const descriptions = [
  '控制新用户注册流程的AB测试开关',
  '支付宝和微信支付通道的灰度切换',
  '首页推荐算法第二版的灰度发布',
  '商品详情页UI改版的功能开关',
  '优惠券计算系统重构后的兼容开关',
  '大订单自动拆分的逻辑控制',
  '物流信息实时追踪功能开关',
  '智能客服机器人自动回复功能',
  '会员等级计算和权益发放',
  '积分商城商品兑换功能开关',
  '大促活动页面的AB测试分组',
  '搜索框输入联想词的优化开关',
  '商品图片懒加载性能优化',
  'Redis缓存穿透防护策略',
  '主从数据库读写分离开关',
  'RabbitMQ向Kafka迁移的灰度',
  '手机号+验证码登录方式',
  '微信/支付宝第三方账号快捷登录',
  '用户实名认证和KYC流程',
  '交易反欺诈风控规则调整',
  '首页营销弹窗显示控制',
  '商品评论自动审核和人工审核',
  '退换货在线申请流程优化',
  '电子发票自动开具系统',
  '三级地址库数据更新',
  '多时区订单时间显示支持',
  '多语言文案切换功能',
  '用户自定义主题色功能',
  '前端性能指标监控开关',
  '线上错误日志采样率',
  '用户行为埋点上报优化',
  'CDN服务商切换灰度',
  '移动端H5页面适配',
  '小程序新旧版本兼容',
  'H5页面新功能试点',
  '渐进式Web应用功能',
  'AI个性化推荐接入',
  '智能客服NLP模型升级',
  '语音搜索功能开关',
  'AR商品试穿功能试点',
  '直播带货功能开关',
  '短视频商品挂载功能',
  '社交平台分享优化',
  'Push通知发送策略调整',
  '短信服务商通道切换',
  '营销邮件模板更新',
  '站内信通知系统改版',
  '帮助中心知识库重构',
  '用户服务协议版本升级',
  'XSS/CSRF安全加固措施',
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function generateMockFlags(): FeatureFlag[] {
  const flags: FeatureFlag[] = [];
  
  for (let i = 0; i < 50; i++) {
    const launchDaysAgo = i < 20 ? 200 + Math.floor(Math.random() * 100) : // 20条超180天
                          i < 35 ? 90 + Math.floor(Math.random() * 90) :    // 15条90-180天
                          Math.floor(Math.random() * 60);                 // 15条<60天
    
    const status = i < 25 ? 'active' : 
                   i < 40 ? 'deprecated' : 
                   i < 45 ? 'pending_cleanup' : 'inactive';
    
    flags.push({
      id: `flag-${i + 1}`,
      name: flagNames[i],
      key: `feature.${flagNames[i].toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`,
      description: descriptions[i],
      owner: i < 45 ? owners[i % owners.length] : null,
      launchDate: daysAgo(launchDaysAgo),
      createdAt: daysAgo(launchDaysAgo + 30),
      updatedAt: daysAgo(Math.floor(Math.random() * 30)),
      status,
    });
  }
  
  return flags;
}

export function generateMockCodeReferences(flags: FeatureFlag[]): CodeReference[] {
  const refs: CodeReference[] = [];
  const files = [
    'src/components/Checkout.tsx', 'src/services/PaymentService.ts', 
    'src/pages/HomePage.tsx', 'src/components/ProductCard.tsx',
    'src/utils/couponCalculator.ts', 'src/services/OrderService.ts',
    'src/hooks/useLogistics.ts', 'src/components/ChatBot.tsx',
    'src/utils/memberLevels.ts', 'src/services/PointsService.ts',
    'src/pages/ActivityPage.tsx', 'src/components/SearchBox.tsx',
    'src/components/ProductImage.tsx', 'src/utils/cacheStrategy.ts',
    'src/config/database.ts', 'src/services/MessageQueue.ts',
    'src/pages/LoginPage.tsx', 'src/services/AuthService.ts',
    'src/pages/VerifyPage.tsx', 'src/services/RiskService.ts',
    'src/components/MarketingPopup.tsx', 'src/components/CommentSection.tsx',
    'src/pages/ReturnPage.tsx', 'src/services/InvoiceService.ts',
    'src/utils/addressLookup.ts', 'src/utils/timezone.ts',
    'src/i18n/translate.ts', 'src/theme/ThemeProvider.tsx',
    'src/monitoring/performance.ts', 'src/monitoring/errorTracker.ts',
    'src/analytics/tracker.ts', 'src/config/cdn.ts',
    'src/mobile/App.tsx', 'src/miniprogram/app.ts',
    'src/h5/App.tsx', 'src/pwa/register.ts',
    'src/services/AIRecommend.ts', 'src/services/AIChat.ts',
    'src/components/VoiceSearch.tsx', 'src/components/ARTryOn.tsx',
    'src/components/LiveStream.tsx', 'src/components/ShortVideo.tsx',
    'src/utils/socialShare.ts', 'src/services/NotificationService.ts',
    'src/services/SMSService.ts', 'src/services/EmailService.ts',
    'src/components/Inbox.tsx', 'src/components/HelpCenter.tsx',
    'src/pages/TermsPage.tsx', 'src/security/xssProtection.ts',
  ];
  
  flags.forEach((flag, index) => {
    if (index < 20) {
      // 20条无引用（低风险可清理）
    } else if (index < 35) {
      // 15条有静态引用，部分已注释
      const refCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < refCount; i++) {
        const isCommented = Math.random() > 0.5;
        refs.push({
          id: `ref-${generateId()}`,
          flagId: flag.id,
          filePath: files[(index * 3 + i) % files.length],
          lineNumber: Math.floor(Math.random() * 200) + 10,
          matchType: 'static',
          codeSnippet: isCommented 
            ? `// if (featureFlagService.isEnabled('${flag.key}')) {`
            : `if (featureFlagService.isEnabled('${flag.key}')) {`,
          confidence: 0.95,
        });
      }
    } else if (index < 45) {
      // 10条有疑似动态引用
      refs.push({
        id: `ref-${generateId()}`,
        flagId: flag.id,
        filePath: files[(index * 3) % files.length],
        lineNumber: Math.floor(Math.random() * 200) + 10,
        matchType: 'suspected',
        codeSnippet: `const flagKey = \`feature.\${featureName}\`;`,
        confidence: 0.6,
      });
      if (Math.random() > 0.5) {
        refs.push({
          id: `ref-${generateId()}`,
          flagId: flag.id,
          filePath: files[(index * 3 + 1) % files.length],
          lineNumber: Math.floor(Math.random() * 200) + 10,
          matchType: 'static',
          codeSnippet: `if (getFlag('${flag.key}')) {`,
          confidence: 0.9,
        });
      }
    } else {
      // 5条有明确动态引用（阻塞）
      refs.push({
        id: `ref-${generateId()}`,
        flagId: flag.id,
        filePath: files[(index * 3) % files.length],
        lineNumber: Math.floor(Math.random() * 200) + 10,
        matchType: 'dynamic',
        codeSnippet: `const flagValue = getFlag(flagKeyFromConfig);`,
        confidence: 0.85,
      });
      refs.push({
        id: `ref-${generateId()}`,
        flagId: flag.id,
        filePath: files[(index * 3 + 1) % files.length],
        lineNumber: Math.floor(Math.random() * 200) + 10,
        matchType: 'dynamic',
        codeSnippet: `flags[featureKey] = config.features[featureKey];`,
        confidence: 0.8,
      });
    }
  });
  
  return refs;
}

export function generateMockEnvironmentStatuses(flags: FeatureFlag[]): EnvironmentStatus[] {
  const statuses: EnvironmentStatus[] = [];
  const environments: ('dev' | 'staging' | 'production')[] = ['dev', 'staging', 'production'];
  
  flags.forEach((flag, index) => {
    environments.forEach(env => {
      let enabled = true;
      let grayUsers = 0;
      let grayPercentage = 100;
      
      if (index < 20) {
        // 20条全量开启，无灰度（低风险）
        enabled = true;
        grayUsers = 0;
        grayPercentage = 100;
      } else if (index < 35) {
        // 15条少量灰度（中风险）
        enabled = true;
        grayUsers = Math.floor(Math.random() * 10);
        grayPercentage = 95 + Math.random() * 5;
      } else if (index < 45) {
        // 10条较多灰度或环境不一致（高风险）
        if (env === 'production') {
          enabled = Math.random() > 0.3;
          grayUsers = Math.floor(Math.random() * 50) + 10;
          grayPercentage = 50 + Math.random() * 40;
        } else {
          enabled = true;
          grayUsers = 0;
          grayPercentage = 100;
        }
      } else {
        // 5条大量灰度（阻塞）
        enabled = true;
        grayUsers = Math.floor(Math.random() * 200) + 100;
        grayPercentage = 30 + Math.random() * 40;
      }
      
      statuses.push({
        id: `env-${flag.id}-${env}`,
        flagId: flag.id,
        environment: env,
        enabled,
        value: enabled ? 'on' : 'off',
        grayUsers,
        grayPercentage,
        lastChecked: daysAgo(Math.floor(Math.random() * 2)),
      });
    });
  });
  
  return statuses;
}

export function generateRiskAssessments(
  flags: FeatureFlag[],
  codeRefs: CodeReference[],
  envStatuses: EnvironmentStatus[],
  rules: RuleConfig[] = getDefaultRules()
): RiskAssessment[] {
  return flags.map(flag => {
    const refs = codeRefs.filter(r => r.flagId === flag.id);
    const envs = envStatuses.filter(e => e.flagId === flag.id);
    return assessRisk(flag, refs, envs, rules);
  });
}

export function generateMockCleanupLogs(flags: FeatureFlag[]): CleanupLog[] {
  const logs: CleanupLog[] = [];
  const operators = ['张三', '李四', '王五', '系统'];
  const actions: ('import' | 'scan' | 'assess' | 'delete' | 'rollback')[] = ['import', 'scan', 'assess', 'delete', 'rollback'];
  
  for (let i = 0; i < 20; i++) {
    const flag = flags[Math.floor(Math.random() * flags.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    logs.push({
      id: `log-${generateId()}`,
      flagId: flag.id,
      action,
      operator: operators[Math.floor(Math.random() * operators.length)],
      timestamp: daysAgo(Math.floor(Math.random() * 30)),
      beforeSnapshot: { status: flag.status, owner: flag.owner },
      afterSnapshot: action === 'delete' ? { status: 'inactive' } : { status: 'active' },
      note: action === 'delete' ? '批量清理过期开关' : '例行扫描评估',
    });
  }
  
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function generateMockReports(flags: FeatureFlag[], assessments: RiskAssessment[]): Report[] {
  const reports: Report[] = [];
  
  for (let i = 0; i < 5; i++) {
    const safeToDelete = assessments.filter(a => a.suggestedAction === 'safe_delete').length;
    const needVerification = assessments.filter(a => a.suggestedAction === 'verify_first').length;
    const doNotDelete = assessments.filter(a => a.suggestedAction === 'do_not_delete').length;
    const blockers = assessments.filter(a => a.level === 'blocker').length;
    
    reports.push({
      id: `report-${generateId()}`,
      title: `月度功能开关清理报告 - ${2024}年${12 - i}月`,
      type: 'cleanup',
      generatedAt: daysAgo(i * 30),
      generatedBy: '系统自动生成',
      summary: {
        totalFlags: flags.length,
        safeToDelete: safeToDelete - i * 2,
        needVerification: needVerification + i,
        doNotDelete: doNotDelete,
        blockers,
      },
      flagIds: flags.slice(0, 20).map(f => f.id),
    });
  }
  
  return reports;
}

export function getMockFlagsWithDetails(): FlagWithDetails[] {
  const flags = generateMockFlags();
  const codeRefs = generateMockCodeReferences(flags);
  const envStatuses = generateMockEnvironmentStatuses(flags);
  const assessments = generateRiskAssessments(flags, codeRefs, envStatuses);
  
  return flags.map(flag => {
    const refs = codeRefs.filter(r => r.flagId === flag.id);
    const envs = envStatuses.filter(e => e.flagId === flag.id);
    const assessment = assessments.find(a => a.flagId === flag.id);
    
    return {
      ...flag,
      riskLevel: assessment?.level,
      suggestedAction: assessment?.suggestedAction,
      codeReferences: refs,
      environmentStatuses: envs,
      riskReasons: assessment?.reasons || [],
    };
  });
}

export const mockRules = getDefaultRules();
