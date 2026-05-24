import { AppConfig } from '../types';

export const defaultConfig: AppConfig = {
  providers: [
    {
      name: 'tencent',
      patterns: ['qq.com', 'exmail.qq.com'],
      smtpPatterns: ['qq.com', 'tencent'],
      mailboxNotExist: [
        'Mailbox not found',
        'Recipient address rejected',
        'User unknown',
        '邮箱不存在',
        '收件人不存在',
        'no such user',
        '550 User.*not found',
        '550.*Invalid recipient'
      ],
      policyRejection: [
        'SPF check failed',
        'DMARC check failed',
        'IP reputation',
        '被拒收',
        '拒绝接收',
        'policy rejection',
        '550.*rejected',
        '554.*rejected',
        'IP.*blocked',
        '黑名单',
        'blocklisted'
      ],
      contentBlocked: [
        'spam detected',
        '垃圾邮件',
        '内容被拦',
        '内容违规',
        'spam',
        'virus detected',
        '恶意内容',
        'spam content',
        '552.*spam',
        '550.*spam'
      ],
      temporaryFailure: [
        'temporarily deferred',
        'try again later',
        '临时失败',
        '稍后重试',
        '450',
        '451',
        '452',
        '421',
        'timeout',
        'connection refused'
      ]
    },
    {
      name: 'alibaba',
      patterns: ['aliyun.com', 'alibaba-inc.com'],
      smtpPatterns: ['aliyun', 'alibaba'],
      mailboxNotExist: [
        'Recipient mailbox does not exist',
        '收件人邮箱不存在',
        'User not found',
        '550.*not exist'
      ],
      policyRejection: [
        '反垃圾策略',
        '发送频率限制',
        'frequency limit',
        'policy deny'
      ],
      contentBlocked: [
        '内容包含违禁词',
        '垃圾邮件内容',
        'spam content'
      ],
      temporaryFailure: [
        '系统繁忙',
        'system busy',
        '4xx'
      ]
    },
    {
      name: 'netease',
      patterns: ['163.com', '126.com', 'yeah.net'],
      smtpPatterns: ['163', '126', 'netease'],
      mailboxNotExist: [
        '用户不存在',
        'User not exist',
        '550 User not found'
      ],
      policyRejection: [
        'IP被封禁',
        '垃圾邮件',
        'spam rejected'
      ],
      contentBlocked: [
        '内容违规',
        '包含敏感词'
      ],
      temporaryFailure: [
        '连接超时',
        'connection timeout'
      ]
    },
    {
      name: 'gmail',
      patterns: ['gmail.com'],
      smtpPatterns: ['google', 'gmail'],
      mailboxNotExist: [
        'The email account that you tried to reach does not exist',
        '550-5.1.1',
        'Recipient address rejected'
      ],
      policyRejection: [
        'Our system has detected',
        '550-5.7.1',
        'SPF fail',
        'DMARC fail'
      ],
      contentBlocked: [
        'this message is likely spam',
        'phishing',
        'malware'
      ],
      temporaryFailure: [
        'Temporary System Problem',
        '421',
        '451',
        'Please try again'
      ]
    }
  ],
  output: {
    defaultDir: './bounce-reports',
    formats: ['json', 'markdown', 'summary']
  },
  retry: {
    temporaryFailureHours: 4,
    maxRetries: 3,
    policyRetryHours: 24
  }
};

export const smtpCodeMappings: Record<string, { category: string; reason: string }> = {
  '550': { category: 'mailbox_not_exist', reason: '邮箱不存在或被拒绝' },
  '551': { category: 'policy_rejection', reason: '用户非本地' },
  '552': { category: 'content_blocked', reason: '存储不足或内容过大' },
  '553': { category: 'mailbox_not_exist', reason: '邮箱名不合法' },
  '554': { category: 'policy_rejection', reason: '事务失败/策略拒绝' },
  '450': { category: 'temporary_failure', reason: '邮箱忙/临时不可用' },
  '451': { category: 'temporary_failure', reason: '本地处理错误' },
  '452': { category: 'temporary_failure', reason: '系统存储不足' },
  '421': { category: 'temporary_failure', reason: '服务不可用' },
  '5.1.0': { category: 'mailbox_not_exist', reason: '地址无效' },
  '5.1.1': { category: 'mailbox_not_exist', reason: '邮箱不存在' },
  '5.1.2': { category: 'mailbox_not_exist', reason: '域名错误' },
  '5.2.0': { category: 'content_blocked', reason: '内容被拒收' },
  '5.2.1': { category: 'mailbox_not_exist', reason: '邮箱禁用' },
  '5.2.2': { category: 'content_blocked', reason: '邮箱已满' },
  '5.3.0': { category: 'policy_rejection', reason: '系统策略' },
  '5.7.0': { category: 'policy_rejection', reason: '安全策略拒绝' },
  '5.7.1': { category: 'policy_rejection', reason: '转发拒绝/权限不足' },
  '5.7.5': { category: 'policy_rejection', reason: '安全策略问题' }
};
