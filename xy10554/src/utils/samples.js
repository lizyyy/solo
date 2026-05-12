const fs = require('fs');
const path = require('path');
const { 
  ContentRecord, 
  ChannelStatus, 
  ReferencePage, 
  CacheConfig,
  STATUS,
  CHANNEL_TYPE
} = require('../models/content');

const Store = require('../utils/store');

class SampleDataGenerator {
  static createNewsSample() {
    return new ContentRecord({
      id: 'news-001',
      title: '公司发布2024年全新产品战略',
      type: 'news',
      contentUrl: 'https://example.com/news/2024-strategy',
      version: 1,
      status: STATUS.ACTIVE,
      author: '品牌部-李明',
      owner: '张明',
      publishedAt: '2024-03-15T09:00:00+08:00',
      channels: [
        new ChannelStatus({
          channelName: '官网首页',
          channelType: CHANNEL_TYPE.OFFICIAL_WEBSITE,
          url: 'https://example.com/news/2024-strategy',
          status: STATUS.ACTIVE,
          cacheStatus: 'active',
          owner: '张三'
        }),
        new ChannelStatus({
          channelName: '公众号',
          channelType: CHANNEL_TYPE.WECHAT,
          url: 'https://mp.weixin.qq.com/s/example-strategy',
          status: STATUS.ACTIVE,
          cacheStatus: 'unknown',
          owner: '李四'
        }),
        new ChannelStatus({
          channelName: '合作媒体A',
          channelType: CHANNEL_TYPE.COOPERATION,
          url: 'https://partner-a.com/news/strategy',
          status: STATUS.ACTIVE,
          cacheStatus: 'unknown',
          owner: '王五'
        })
      ],
      referencePages: [
        new ReferencePage({
          url: 'https://example.com/about',
          title: '关于我们',
          status: STATUS.PENDING,
          hasLink: null,
          owner: '赵六'
        }),
        new ReferencePage({
          url: 'https://example.com/products',
          title: '产品中心',
          status: STATUS.PENDING,
          hasLink: null,
          owner: '孙七'
        })
      ],
      metadata: {
        source: '品牌发布会',
        priority: 'high'
      }
    });
  }

  static createEventSample() {
    return new ContentRecord({
      id: 'event-001',
      title: '2024开发者大会活动页面',
      type: 'event',
      contentUrl: 'https://example.com/events/dev-conference-2024',
      version: 2,
      status: STATUS.ACTIVE,
      author: '市场部-王芳',
      owner: '李华',
      publishedAt: '2024-02-20T14:30:00+08:00',
      channels: [
        new ChannelStatus({
          channelName: '活动专题页',
          channelType: CHANNEL_TYPE.OFFICIAL_WEBSITE,
          url: 'https://example.com/events/dev-conference-2024',
          status: STATUS.UNPUBLISHED,
          cacheStatus: 'active',
          unpublishAttempts: 2,
          owner: '周八'
        }),
        new ChannelStatus({
          channelName: 'APP推送',
          channelType: CHANNEL_TYPE.APP,
          url: 'app://event/2024-conference',
          status: STATUS.UNPUBLISHED,
          cacheStatus: 'purged',
          owner: '吴九'
        }),
        new ChannelStatus({
          channelName: '合作平台B',
          channelType: CHANNEL_TYPE.COOPERATION,
          url: 'https://partner-b.com/events/dev-con',
          status: STATUS.ACTIVE,
          cacheStatus: 'unknown',
          owner: '郑十'
        })
      ],
      referencePages: [
        new ReferencePage({
          url: 'https://example.com/home',
          title: '首页Banner',
          status: STATUS.ACTIVE,
          hasLink: true,
          owner: '冯十一'
        })
      ],
      metadata: {
        eventDate: '2024-04-15',
        attendees: 500
      }
    });
  }

  static createProductSample() {
    return new ContentRecord({
      id: 'product-001',
      title: '新功能说明文档',
      type: 'product',
      contentUrl: 'https://example.com/products/new-features',
      version: 3,
      status: STATUS.ACTIVE,
      author: '产品部-陈刚',
      owner: '',
      publishedAt: '2024-01-10T10:00:00+08:00',
      channels: [
        new ChannelStatus({
          channelName: '帮助中心',
          channelType: CHANNEL_TYPE.OFFICIAL_WEBSITE,
          url: 'https://help.example.com/new-features',
          status: STATUS.ACTIVE,
          cacheStatus: 'unknown',
          owner: '褚十二'
        }),
        new ChannelStatus({
          channelName: '内部知识库',
          channelType: CHANNEL_TYPE.INTRANET,
          url: 'https://intranet.example.com/docs/new-features',
          status: STATUS.ACTIVE,
          cacheStatus: 'unknown',
          owner: ''
        })
      ],
      referencePages: [
        new ReferencePage({
          url: 'https://example.com/blog',
          title: '博客',
          status: STATUS.PENDING,
          hasLink: null,
          owner: '卫十三'
        }),
        new ReferencePage({
          url: 'https://example.com/changelog',
          title: '更新日志',
          status: STATUS.PENDING,
          hasLink: null,
          owner: '蒋十四'
        })
      ],
      metadata: {
        productVersion: '3.0',
        department: '产品线A'
      }
    });
  }

  static createProblematicSample() {
    return new ContentRecord({
      id: 'problem-001',
      title: '有问题的撤稿案例',
      type: 'news',
      contentUrl: 'https://example.com/news/problematic',
      version: 1,
      status: STATUS.PARTIAL,
      author: '测试用户',
      owner: '',
      publishedAt: '2024-01-01T00:00:00+08:00',
      channels: [
        new ChannelStatus({
          channelName: '官网频道',
          channelType: CHANNEL_TYPE.OFFICIAL_WEBSITE,
          url: 'https://example.com/news/problematic',
          status: STATUS.UNPUBLISHED,
          cacheStatus: 'active',
          unpublishAttempts: 3,
          errors: ['缓存清理失败'],
          owner: ''
        }),
        new ChannelStatus({
          channelName: '合作媒体C',
          channelType: CHANNEL_TYPE.COOPERATION,
          url: 'https://partner-c.com/news/problem',
          status: STATUS.ACTIVE,
          cacheStatus: 'unknown',
          errors: ['合作方未响应'],
          owner: ''
        })
      ],
      referencePages: [
        new ReferencePage({
          url: 'https://example.com/archive',
          title: '新闻存档',
          status: STATUS.ACTIVE,
          hasLink: true,
          owner: ''
        })
      ],
      metadata: {}
    });
  }

  static loadAllSamples(store) {
    const samples = [
      this.createNewsSample(),
      this.createEventSample(),
      this.createProductSample(),
      this.createProblematicSample()
    ];

    samples.forEach(sample => {
      store.addContent(sample);
    });

    return samples.length;
  }

  static exportToFile(sample, filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(sample.toJSON(), null, 2), 'utf8');
  }
}

module.exports = SampleDataGenerator;
