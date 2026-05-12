const sendLogs = [
  {
    id: 'send-001',
    email: 'john.doe@company.com',
    campaign: 'summer_sale_2024',
    sentAt: '2024-06-01T10:00:00Z',
    status: 'sent',
    source: 'enterprise_list'
  },
  {
    id: 'send-002',
    email: 'jane.smith@company.com',
    campaign: 'summer_sale_2024',
    sentAt: '2024-06-01T10:01:00Z',
    status: 'sent',
    source: 'enterprise_list'
  },
  {
    id: 'send-003',
    email: 'invalid.user@company.com',
    campaign: 'summer_sale_2024',
    sentAt: '2024-06-01T10:02:00Z',
    status: 'sent',
    source: 'enterprise_list'
  },
  {
    id: 'send-004',
    email: 'user123@gmail.com',
    campaign: 'summer_sale_2024',
    sentAt: '2024-06-01T10:03:00Z',
    status: 'sent',
    source: 'personal_list'
  },
  {
    id: 'send-005',
    email: 'test.user@outlook.com',
    campaign: 'summer_sale_2024',
    sentAt: '2024-06-01T10:04:00Z',
    status: 'sent',
    source: 'personal_list'
  },
  {
    id: 'send-006',
    email: 'busy.mailbox@techcorp.com',
    campaign: 'summer_sale_2024',
    sentAt: '2024-06-01T10:05:00Z',
    status: 'sent',
    source: 'enterprise_list'
  },
  {
    id: 'send-007',
    email: 'server.down@financebank.com',
    campaign: 'summer_sale_2024',
    sentAt: '2024-06-01T10:06:00Z',
    status: 'sent',
    source: 'enterprise_list'
  },
  {
    id: 'send-008',
    email: 'unsubscribed.user@yahoo.com',
    campaign: 'summer_sale_2024',
    sentAt: '2024-06-01T10:07:00Z',
    status: 'sent',
    source: 'personal_list'
  },
  {
    id: 'send-009',
    email: 'unknown.bounce@example.org',
    campaign: 'summer_sale_2024',
    sentAt: '2024-06-01T10:08:00Z',
    status: 'sent',
    source: 'unknown_source'
  },
  {
    id: 'send-010',
    email: 'policy.block@healthcare.org',
    campaign: 'summer_sale_2024',
    sentAt: '2024-06-01T10:09:00Z',
    status: 'sent',
    source: 'enterprise_list'
  }
];

const bounces = [
  {
    id: 'bounce-001',
    email: 'invalid.user@company.com',
    bounceCode: '550',
    message: '550 5.1.1 <invalid.user@company.com>: Recipient address rejected: User unknown in virtual mailbox table',
    timestamp: '2024-06-01T11:00:00Z',
    campaign: 'summer_sale_2024',
    source: 'enterprise_list'
  },
  {
    id: 'bounce-002',
    email: 'busy.mailbox@techcorp.com',
    bounceCode: '552',
    message: '552 5.2.2 <busy.mailbox@techcorp.com>: Recipient address rejected: Mailbox full',
    timestamp: '2024-06-01T11:05:00Z',
    campaign: 'summer_sale_2024',
    source: 'enterprise_list'
  },
  {
    id: 'bounce-003',
    email: 'server.down@financebank.com',
    bounceCode: '421',
    message: '421 4.3.2 Service not available, closing transmission channel',
    timestamp: '2024-06-01T11:10:00Z',
    campaign: 'summer_sale_2024',
    source: 'enterprise_list'
  },
  {
    id: 'bounce-004',
    email: 'unknown.bounce@example.org',
    bounceCode: null,
    message: 'Delivery failed - no bounce code available',
    timestamp: '2024-06-01T11:15:00Z',
    campaign: 'summer_sale_2024',
    source: 'unknown_source'
  },
  {
    id: 'bounce-005',
    email: 'policy.block@healthcare.org',
    bounceCode: '450',
    message: '450 4.7.1 <policy.block@healthcare.org>: Recipient address rejected: Policy rejection - too many connections from your IP',
    timestamp: '2024-06-01T11:20:00Z',
    campaign: 'summer_sale_2024',
    source: 'enterprise_list'
  },
  {
    id: 'bounce-006',
    email: 'test.user@outlook.com',
    bounceCode: '451',
    message: '451 4.7.0 Temporary server error. Please try again later.',
    timestamp: '2024-06-01T11:25:00Z',
    campaign: 'summer_sale_2024',
    source: 'personal_list'
  },
  {
    id: 'bounce-007',
    email: 'server.down@financebank.com',
    bounceCode: '421',
    message: '421 4.3.2 Service not available, closing transmission channel (2nd attempt)',
    timestamp: '2024-06-02T10:00:00Z',
    campaign: 'summer_sale_2024_retry',
    source: 'enterprise_list'
  },
  {
    id: 'bounce-008',
    email: 'server.down@financebank.com',
    bounceCode: '421',
    message: '421 4.3.2 Service not available, closing transmission channel (3rd attempt)',
    timestamp: '2024-06-03T10:00:00Z',
    campaign: 'summer_sale_2024_retry_2',
    source: 'enterprise_list'
  }
];

const retries = [
  {
    id: 'retry-001',
    email: 'test.user@outlook.com',
    originalBounceId: 'bounce-006',
    attemptedAt: '2024-06-02T09:00:00Z',
    success: true,
    message: 'Retry successful - email delivered',
    campaign: 'summer_sale_2024_retry'
  },
  {
    id: 'retry-002',
    email: 'server.down@financebank.com',
    originalBounceId: 'bounce-003',
    attemptedAt: '2024-06-02T09:30:00Z',
    success: false,
    message: 'Retry failed - service still unavailable',
    campaign: 'summer_sale_2024_retry'
  },
  {
    id: 'retry-003',
    email: 'server.down@financebank.com',
    originalBounceId: 'bounce-007',
    attemptedAt: '2024-06-03T09:30:00Z',
    success: false,
    message: 'Retry failed again - service still unavailable',
    campaign: 'summer_sale_2024_retry_2'
  },
  {
    id: 'retry-004',
    email: 'policy.block@healthcare.org',
    originalBounceId: 'bounce-005',
    attemptedAt: '2024-06-02T14:00:00Z',
    success: true,
    message: 'Retry successful after rate limit period',
    campaign: 'summer_sale_2024_retry'
  }
];

const sources = [
  {
    id: 'source-001',
    name: 'enterprise_list',
    description: '企业客户名单 - 2024年Q1获取',
    createdAt: '2024-01-15T00:00:00Z',
    emails: [
      'john.doe@company.com',
      'jane.smith@company.com',
      'invalid.user@company.com',
      'busy.mailbox@techcorp.com',
      'server.down@financebank.com',
      'policy.block@healthcare.org'
    ],
    totalEmails: 6,
    validEmails: 2,
    bounceCount: 4
  },
  {
    id: 'source-002',
    name: 'personal_list',
    description: '个人邮箱名单 - 网站注册获取',
    createdAt: '2024-03-20T00:00:00Z',
    emails: [
      'user123@gmail.com',
      'test.user@outlook.com',
      'unsubscribed.user@yahoo.com'
    ],
    totalEmails: 3,
    validEmails: 1,
    bounceCount: 1
  },
  {
    id: 'source-003',
    name: 'unknown_source',
    description: '来源不明的名单',
    createdAt: '2024-05-10T00:00:00Z',
    emails: [
      'unknown.bounce@example.org'
    ],
    totalEmails: 1,
    validEmails: 0,
    bounceCount: 1
  }
];

const unsubscribed = [
  'unsubscribed.user@yahoo.com'
];

module.exports = {
  sendLogs,
  bounces,
  retries,
  sources,
  unsubscribed
};
