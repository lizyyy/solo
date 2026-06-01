import { Notification, Version, Source, Comment } from '../types';

const now = new Date();

export const sampleNotifications: Notification[] = [
  {
    id: 'notif_001',
    title: '小提琴替补 - 张小明',
    status: 'confirmed',
    studentName: '张小明',
    instrument: '小提琴',
    piece: '贝多芬第五交响曲 - 第一乐章',
    rehearsalTime: '2024-06-15 19:00',
    reason: '原小提琴手李华因感冒发烧请假，张小明近期练习进度良好，老师评估可以胜任替补位置。根据曲目表第3条，该段落难度适中，张小明在最近三次排练中表现稳定。',
    createdAt: new Date(now.getTime() - 86400000 * 3).toISOString(),
    updatedAt: new Date(now.getTime() - 86400000).toISOString(),
    currentVersion: 2
  },
  {
    id: 'notif_002',
    title: '大提琴替补 - 王小红',
    status: 'pending',
    studentName: '王小红',
    instrument: '大提琴',
    piece: '德沃夏克第九交响曲',
    rehearsalTime: '2024-06-18 18:30',
    reason: '原大提琴手需参加学校考试，暂由王小红替补。需确认本周排练时间。',
    createdAt: new Date(now.getTime() - 86400000).toISOString(),
    updatedAt: new Date(now.getTime() - 3600000).toISOString(),
    currentVersion: 1
  }
];

export const sampleVersions: Record<string, Version[]> = {
  'notif_001': [
    {
      id: 'v_001_1',
      notificationId: 'notif_001',
      versionNumber: 1,
      snapshot: {
        title: '小提琴替补 - 张小明',
        status: 'pending',
        studentName: '张小明',
        instrument: '小提琴',
        piece: '贝多芬第五交响曲',
        reason: '原小提琴手李华因感冒发烧请假，张小明近期练习进度良好。'
      },
      modifiedBy: '小温（琴房前台）',
      modifiedAt: new Date(now.getTime() - 86400000 * 3).toISOString(),
      changeReason: '初始创建：收到李华请假通知，安排张小明替补',
      diff: []
    },
    {
      id: 'v_001_2',
      notificationId: 'notif_001',
      versionNumber: 2,
      snapshot: {
        title: '小提琴替补 - 张小明',
        status: 'confirmed',
        studentName: '张小明',
        instrument: '小提琴',
        piece: '贝多芬第五交响曲 - 第一乐章',
        rehearsalTime: '2024-06-15 19:00',
        reason: '原小提琴手李华因感冒发烧请假，张小明近期练习进度良好，老师评估可以胜任替补位置。根据曲目表第3条，该段落难度适中，张小明在最近三次排练中表现稳定。'
      },
      modifiedBy: '小温（琴房前台）',
      modifiedAt: new Date(now.getTime() - 86400000).toISOString(),
      changeReason: '老师确认：曲目表已更新，排练时间已确认，补充老师评估意见',
      diff: [
        { field: 'status', oldValue: 'pending', newValue: 'confirmed', action: 'update' },
        { field: 'piece', oldValue: '贝多芬第五交响曲', newValue: '贝多芬第五交响曲 - 第一乐章', action: 'update' },
        { field: 'rehearsalTime', oldValue: undefined, newValue: '2024-06-15 19:00', action: 'add' },
        { field: 'reason', oldValue: '原小提琴手李华因感冒发烧请假，张小明近期练习进度良好。', newValue: '原小提琴手李华因感冒发烧请假，张小明近期练习进度良好，老师评估可以胜任替补位置。根据曲目表第3条，该段落难度适中，张小明在最近三次排练中表现稳定。', action: 'update' }
      ]
    }
  ],
  'notif_002': [
    {
      id: 'v_002_1',
      notificationId: 'notif_002',
      versionNumber: 1,
      snapshot: {
        title: '大提琴替补 - 王小红',
        status: 'pending',
        studentName: '王小红',
        instrument: '大提琴',
        piece: '德沃夏克第九交响曲',
        rehearsalTime: '2024-06-18 18:30',
        reason: '原大提琴手需参加学校考试，暂由王小红替补。需确认本周排练时间。'
      },
      modifiedBy: '小温（琴房前台）',
      modifiedAt: new Date(now.getTime() - 86400000).toISOString(),
      changeReason: '初始创建：收到学校考试冲突通知，安排替补',
      diff: []
    }
  ]
};

export const sampleSources: Record<string, Source[]> = {
  'notif_001': [
    {
      id: 'src_001_1',
      notificationId: 'notif_001',
      type: 'repertoire',
      name: '6月排练曲目表.pdf',
      description: '本月排练曲目安排，第3条为贝多芬第五交响曲第一乐章',
      reference: '文件编号：REP-2024-06-003',
      uploadTime: new Date(now.getTime() - 86400000 * 3).toISOString(),
      uploadedBy: '小温（琴房前台）'
    },
    {
      id: 'src_001_2',
      notificationId: 'notif_001',
      type: 'audio',
      name: '张小明_练习录音_0610.mp3',
      description: '张小明6月10日提交的练习录音，老师已审核',
      reference: '音频文件路径：/recordings/20240610/',
      uploadTime: new Date(now.getTime() - 86400000 * 2).toISOString(),
      uploadedBy: '陈老师'
    },
    {
      id: 'src_001_3',
      notificationId: 'notif_001',
      type: 'chat',
      name: '排练群_请假截图',
      description: '李华在排练群发布的请假消息截图',
      reference: '微信截图_20240612_093025',
      uploadTime: new Date(now.getTime() - 86400000 * 3).toISOString(),
      uploadedBy: '小温（琴房前台）'
    }
  ],
  'notif_002': [
    {
      id: 'src_002_1',
      notificationId: 'notif_002',
      type: 'contract',
      name: '大提琴手_考试安排.pdf',
      description: '学校期末考试时间表，6月17-19日有考试',
      reference: '学校教务处通知',
      uploadTime: new Date(now.getTime() - 86400000).toISOString(),
      uploadedBy: '小温（琴房前台）'
    }
  ]
};

export const sampleComments: Record<string, Comment[]> = {
  'notif_001': [
    {
      id: 'cmt_001_1',
      notificationId: 'notif_001',
      content: '老师已听张小明的录音，音准和节奏都没问题，可以上。注意第一乐章第23小节的弓法，需要提醒一下。',
      author: '陈老师',
      createdAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
      type: 'decision'
    },
    {
      id: 'cmt_001_2',
      notificationId: 'notif_001',
      content: '群里收到张妈妈的回复，确认张小明周六晚上可以参加排练。',
      author: '小温（琴房前台）',
      createdAt: new Date(now.getTime() - 86400000 * 1.5).toISOString(),
      type: 'supplement'
    }
  ],
  'notif_002': [
    {
      id: 'cmt_002_1',
      notificationId: 'notif_002',
      content: '等王小红妈妈确认时间，她可能周五晚上有课。',
      author: '小温（琴房前台）',
      createdAt: new Date(now.getTime() - 3600000).toISOString(),
      type: 'annotation'
    }
  ]
};
