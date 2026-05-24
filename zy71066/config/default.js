module.exports = {
  ticket: {
    patterns: [
      { name: 'JIRA', regex: /\b([A-Z]{2,10}-\d{3,7})\b/g, url: 'https://jira.example.com/browse/$1' },
      { name: 'GitLab', regex: /#(\d{1,7})\b/g, url: 'https://gitlab.example.com/issues/$1' },
      { name: 'GitHub', regex: /\bGH-(\d{1,7})\b/gi, url: 'https://github.com/example/repo/issues/$1' },
      { name: 'Trello', regex: /\bTR-(\w{8})\b/gi, url: 'https://trello.com/c/$1' },
      { name: '禅道', regex: /\b(BU|BUG|FEA|REQ|TASK)-(\d{1,6})\b/gi, url: 'https://zentao.example.com/$1-view-$2.html' }
    ],
    fallbackUrl: 'https://jira.example.com/browse/{ticket}'
  },

  modules: {
    'auth': ['登录', '认证', '权限', 'oauth', 'jwt', 'session'],
    'payment': ['支付', '账单', '订单', '退款', '充值', 'wallet'],
    'user': ['用户', '会员', '个人中心', 'profile', 'account'],
    'api': ['接口', 'api', 'rest', 'graphql', '接口文档'],
    'frontend': ['前端', '页面', 'ui', '样式', 'vue', 'react', 'css'],
    'backend': ['后端', '服务', '数据库', 'mysql', 'redis', '缓存'],
    'mobile': ['移动端', 'app', '小程序', 'h5'],
    'devops': ['部署', '运维', 'docker', 'k8s', 'ci/cd', '流水线']
  },

  risk: {
    levels: {
      high: { weight: 100, color: 'red' },
      medium: { weight: 50, color: 'yellow' },
      low: { weight: 10, color: 'green' }
    },
    keywords: {
      high: ['删库', 'drop table', 'rm -rf', '密码', '密钥', 'token', 'sql注入', 'xss', 'csrf'],
      medium: ['重构', '迁移', '升级', '降级', '兼容', '性能', '死锁', '超时', '重试'],
      low: ['优化', '修复', '完善', '改进', '调整', '文案', '注释', '日志']
    },
    safeContexts: ['修复', '解决', '已修复', '已解决', '防止', '避免']
  },

  output: {
    dir: './output',
    formats: ['terminal', 'json', 'markdown'],
    jsonFilename: 'changelog-analysis.json',
    markdownFilename: 'changelog-report.md'
  },

  validation: {
    requiredInputs: ['changelog'],
    maxChangelogSize: 1024 * 1024
  },

  exitCodes: {
    SUCCESS: 0,
    ERROR_INVALID_ARGS: 1,
    ERROR_FILE_NOT_FOUND: 2,
    ERROR_PARSE_FAILED: 3,
    ERROR_VALIDATION_FAILED: 4,
    ERROR_OUTPUT_FAILED: 5,
    WARNING_MISSING_TICKETS: 10,
    WARNING_HIGH_RISK: 11
  }
};
