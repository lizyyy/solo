import { v4 as uuidv4 } from 'uuid';
import { FoulAppeal, AppealStatus, FoulType, FoulSeverity } from '../types';
import { setAppeals } from '../store/dataStore';

export function generateSampleData(): FoulAppeal[] {
  const now = new Date();
  const sampleAppeals: FoulAppeal[] = [];

  sampleAppeals.push({
    id: uuidv4(),
    appealNumber: 'BSK-APL-2024-0001',
    gameInfo: {
      gameId: uuidv4(),
      leagueName: '2024年朝阳区社区篮球联赛',
      division: '甲组',
      round: '小组赛第三轮',
      gameDate: '2024-05-15',
      gameTime: '19:00',
      venue: '朝阳体育中心篮球场1号场',
      homeTeam: '三里屯街道篮球队',
      awayTeam: '望京街道篮球队',
      quarter: 4,
      gameMinute: 8,
      gameSecond: 42,
      scoreAtTime: { home: 78, away: 75 }
    },
    foulDetail: {
      foulId: uuidv4(),
      foulType: FoulType.PERSONAL,
      severity: FoulSeverity.MODERATE,
      description: '进攻方球员突破上篮时被防守方拉拽手臂，失去平衡摔倒',
      fouler: {
        playerNumber: '12',
        playerName: '张伟',
        teamName: '望京街道篮球队',
        position: '大前锋',
        foulsBefore: 3
      },
      victim: {
        playerNumber: '7',
        playerName: '李明',
        teamName: '三里屯街道篮球队',
        position: '得分后卫',
        foulsBefore: 1
      },
      referees: ['王强', '刘芳'],
      videoEvidence: ['video_Q3_0842_foul12.mp4', 'photo_foul_123.jpg'],
      witnessPlayers: ['陈刚', '赵磊']
    },
    appealContent: {
      appealingTeam: '三里屯街道篮球队',
      teamRepresentative: {
        name: '周建国',
        role: '球队经理',
        phone: '13800138001',
        email: 'zhoujianguo@sanlitun.com'
      },
      appealReason: '当值裁判仅判普通犯规，但根据比赛录像显示，防守球员张伟的拉拽动作明显超出正常防守范围，且直接导致我方球员李明在空中失去平衡重重摔倒在地，存在伤人意图。根据联赛规则第17条第3款，此行为应被判罚恶意犯规。',
      appealBasis: ['联赛竞赛规则第17条第3款：恶意犯规定义及处罚', 'CBA裁判手册关于犯规升级的判定标准'],
      requestedOutcome: '请求将该次犯规升级为恶意犯规，对张伟追加禁赛一场的处罚，并由联赛组委会通报批评',
      supportingDocuments: ['比赛录像片段.mp4', '裁判报告扫描件.pdf', '球队申诉书.docx'],
      additionalNotes: '该犯规发生在比赛关键时刻，直接影响比赛走向，对我方球队士气造成严重打击'
    },
    status: AppealStatus.APPROVED,
    currentReviewer: '孙裁判长',
    reviewHistory: [
      {
        reviewerId: 'r001',
        reviewerName: '孙裁判长',
        reviewTime: '2024-05-16T10:30:00Z',
        reviewResult: 'approved',
        reviewComments: '经审看比赛录像，申诉内容属实。防守球员动作确实过大且存在伤人风险，同意升级为恶意犯规，按规定执行禁赛处罚。',
        requiredActions: ['由竞赛部发布正式处罚通知']
      }
    ],
    auditLogs: [
      {
        action: 'create',
        operatorId: 'tm001',
        operatorName: '周建国',
        operatorRole: 'team_manager',
        timestamp: '2024-05-15T21:30:00Z',
        changes: { appeal: { old: null, new: 'created' } }
      },
      {
        action: 'submit',
        operatorId: 'tm001',
        operatorName: '周建国',
        operatorRole: 'team_manager',
        timestamp: '2024-05-15T21:35:00Z',
        changes: { status: { old: 'draft', new: 'submitted' } }
      },
      {
        action: 'review',
        operatorId: 'r001',
        operatorName: '孙裁判长',
        operatorRole: 'referee_chief',
        timestamp: '2024-05-16T10:30:00Z',
        changes: { status: { old: 'under_review', new: 'approved' } }
      }
    ],
    createdAt: '2024-05-15T21:30:00Z',
    updatedAt: '2024-05-16T10:30:00Z',
    submittedAt: '2024-05-15T21:35:00Z',
    resolvedAt: '2024-05-16T10:30:00Z',
    crossReferencedAppeals: [],
    consistencyScore: 95,
    tags: ['malicious-foul', 'key-moment']
  });

  sampleAppeals.push({
    id: uuidv4(),
    appealNumber: 'BSK-APL-2024-0002',
    gameInfo: {
      gameId: uuidv4(),
      leagueName: '2024年海淀区社区篮球联赛',
      division: '乙组',
      round: '半决赛',
      gameDate: '2024-05-18',
      gameTime: '18:30',
      venue: '海淀体育馆副场',
      homeTeam: '中关村街道代表队',
      awayTeam: '五道口街道代表队',
      quarter: 2,
      gameMinute: 5,
      gameSecond: 18,
      scoreAtTime: { home: 32, away: 28 }
    },
    foulDetail: {
      foulId: uuidv4(),
      foulType: FoulType.TECHNICAL,
      severity: FoulSeverity.MINOR,
      description: '替补席球员对裁判判罚不满，大声辱骂裁判',
      fouler: {
        playerNumber: 'T',
        playerName: '替补席',
        teamName: '五道口街道代表队',
        position: '替补席',
        foulsBefore: 0
      },
      referees: ['赵敏', '钱伟'],
      videoEvidence: ['bench_technical_foul.mp4']
    },
    appealContent: {
      appealingTeam: '五道口街道代表队',
      teamRepresentative: {
        name: '吴队长',
        role: 'team_captain',
        phone: '13900139002',
        email: 'wuduizhang@wudaokou.com'
      },
      appealReason: '我方替补席球员确实言语不当，但根据联赛规则，首次技术犯规应先给予警告，而非直接判罚技术犯规。当时裁判情绪激动，未给予任何警告直接判罚，此举过于严厉，请求撤销该次技术犯规。',
      appealBasis: ['联赛纪律准则第8条：首次违规以教育为主'],
      requestedOutcome: '请求撤销该次技术犯规，改为口头警告记录在案',
      supportingDocuments: ['证人证言.pdf'],
      additionalNotes: ''
    },
    status: AppealStatus.NEEDS_MORE_INFO,
    currentReviewer: '郑审核员',
    reviewHistory: [
      {
        reviewerId: 'r002',
        reviewerName: '郑审核员',
        reviewTime: '2024-05-19T14:00:00Z',
        reviewResult: 'needs_info',
        reviewComments: '申诉材料不够完整，请提供当时现场的完整录像，以及当值裁判的书面说明。',
        requiredActions: ['补充完整比赛录像', '联系当值裁判提供情况说明']
      }
    ],
    auditLogs: [
      {
        action: 'create',
        operatorId: 'tc002',
        operatorName: '吴队长',
        operatorRole: 'team_captain',
        timestamp: '2024-05-18T20:00:00Z',
        changes: { appeal: { old: null, new: 'created' } }
      },
      {
        action: 'submit',
        operatorId: 'tc002',
        operatorName: '吴队长',
        operatorRole: 'team_captain',
        timestamp: '2024-05-18T20:05:00Z',
        changes: { status: { old: 'draft', new: 'submitted' } }
      },
      {
        action: 'review',
        operatorId: 'r002',
        operatorName: '郑审核员',
        operatorRole: 'league_reviewer',
        timestamp: '2024-05-19T14:00:00Z',
        changes: { status: { old: 'under_review', new: 'needs_more_info' } }
      }
    ],
    createdAt: '2024-05-18T20:00:00Z',
    updatedAt: '2024-05-19T14:00:00Z',
    submittedAt: '2024-05-18T20:05:00Z',
    crossReferencedAppeals: [],
    consistencyScore: 60,
    tags: ['technical-foul', 'needs-evidence']
  });

  const crossRefFoulId = uuidv4();
  const gameId = uuidv4();

  sampleAppeals.push({
    id: uuidv4(),
    appealNumber: 'BSK-APL-2024-0003',
    gameInfo: {
      gameId: gameId,
      leagueName: '2024年丰台区企业篮球邀请赛',
      division: '公开组',
      round: '四分之一决赛',
      gameDate: '2024-05-20',
      gameTime: '20:00',
      venue: '丰台科技园篮球场',
      homeTeam: '百度篮球队',
      awayTeam: '腾讯篮球队',
      quarter: 4,
      gameMinute: 2,
      gameSecond: 30,
      scoreAtTime: { home: 85, away: 83 }
    },
    foulDetail: {
      foulId: crossRefFoulId,
      foulType: FoulType.OFFENSIVE,
      severity: FoulSeverity.MAJOR,
      description: '进攻方掩护时肘部击中防守球员面部',
      fouler: {
        playerNumber: '23',
        playerName: '王中锋',
        teamName: '百度篮球队',
        position: '中锋',
        foulsBefore: 2
      },
      victim: {
        playerNumber: '5',
        playerName: '李后卫',
        teamName: '腾讯篮球队',
        position: '控球后卫',
        foulsBefore: 2
      },
      referees: ['黄主裁', '朱副裁'],
      videoEvidence: ['elbow_hit_Q4.mp4']
    },
    appealContent: {
      appealingTeam: '腾讯篮球队',
      teamRepresentative: {
        name: '马经理',
        role: 'team_manager',
        phone: '13700137003',
        email: 'manager@tencent-basketball.com'
      },
      appealReason: '我方球员李后卫在防守时被对方中锋王中锋用肘部直接击中面部，导致鼻梁骨骨折当场出血，但裁判仅判进攻犯规，未升级判罚。根据规则，使用伤人动作应直接判罚违反体育道德犯规。',
      appealBasis: ['FIBA规则第36条：违反体育道德的犯规'],
      requestedOutcome: '将普通进攻犯规升级为违反体育道德犯规，并追加相应处罚',
      supportingDocuments: ['医院诊断证明.pdf', '受伤照片.jpg', '比赛录像片段.mp4'],
      additionalNotes: '球员李后卫已被送往医院治疗，预计缺席后续比赛'
    },
    status: AppealStatus.UNDER_REVIEW,
    currentReviewer: '林裁判长',
    reviewHistory: [
      {
        reviewerId: 'r003',
        reviewerName: '林裁判长',
        reviewTime: '2024-05-21T09:15:00Z',
        reviewResult: 'pending',
        reviewComments: '正在审核医疗证明和比赛录像，稍后给出结论'
      }
    ],
    auditLogs: [
      {
        action: 'create',
        operatorId: 'tm003',
        operatorName: '马经理',
        operatorRole: 'team_manager',
        timestamp: '2024-05-20T22:00:00Z',
        changes: { appeal: { old: null, new: 'created' } }
      },
      {
        action: 'submit',
        operatorId: 'tm003',
        operatorName: '马经理',
        operatorRole: 'team_manager',
        timestamp: '2024-05-20T22:10:00Z',
        changes: { status: { old: 'draft', new: 'submitted' } }
      }
    ],
    createdAt: '2024-05-20T22:00:00Z',
    updatedAt: '2024-05-21T09:15:00Z',
    submittedAt: '2024-05-20T22:10:00Z',
    crossReferencedAppeals: [],
    consistencyScore: 90,
    tags: ['injury', 'cross-reference']
  });

  sampleAppeals.push({
    id: uuidv4(),
    appealNumber: 'BSK-APL-2024-0004',
    gameInfo: {
      gameId: gameId,
      leagueName: '2024年丰台区企业篮球邀请赛',
      division: '公开组',
      round: '四分之一决赛',
      gameDate: '2024-05-20',
      gameTime: '20:00',
      venue: '丰台科技园篮球场',
      homeTeam: '百度篮球队',
      awayTeam: '腾讯篮球队',
      quarter: 4,
      gameMinute: 2,
      gameSecond: 30,
      scoreAtTime: { home: 85, away: 83 }
    },
    foulDetail: {
      foulId: crossRefFoulId,
      foulType: FoulType.DEFENSIVE,
      severity: FoulSeverity.MINOR,
      description: '防守球员假摔试图制造进攻犯规',
      fouler: {
        playerNumber: '5',
        playerName: '李后卫',
        teamName: '腾讯篮球队',
        position: '控球后卫',
        foulsBefore: 2
      },
      victim: {
        playerNumber: '23',
        playerName: '王中锋',
        teamName: '百度篮球队',
        position: '中锋',
        foulsBefore: 2
      },
      referees: ['黄主裁', '朱副裁'],
      videoEvidence: ['defensive_flop.mp4']
    },
    appealContent: {
      appealingTeam: '百度篮球队',
      teamRepresentative: {
        name: '熊领队',
        role: 'team_manager',
        phone: '13600136004',
        email: 'leader@baidu-basketball.com'
      },
      appealReason: '从多角度录像回放可以清晰看到，腾讯队5号球员在防守时有明显的假摔动作，试图骗取进攻犯规。裁判被假动作误导判我方进攻犯规，这是误判。请求撤销对我方的进攻犯规。',
      appealBasis: ['联赛反假摔条例第3条'],
      requestedOutcome: '撤销进攻犯规判罚，改判防守方假摔技术犯规',
      supportingDocuments: ['多角度录像汇总.mp4', '技术分析报告.pdf'],
      additionalNotes: '该判罚直接导致我方球权丢失，输掉了比赛'
    },
    status: AppealStatus.SUBMITTED,
    reviewHistory: [],
    auditLogs: [
      {
        action: 'create',
        operatorId: 'tm004',
        operatorName: '熊领队',
        operatorRole: 'team_manager',
        timestamp: '2024-05-20T22:30:00Z',
        changes: { appeal: { old: null, new: 'created' } }
      },
      {
        action: 'submit',
        operatorId: 'tm004',
        operatorName: '熊领队',
        operatorRole: 'team_manager',
        timestamp: '2024-05-20T22:40:00Z',
        changes: { status: { old: 'draft', new: 'submitted' } }
      }
    ],
    createdAt: '2024-05-20T22:30:00Z',
    updatedAt: '2024-05-20T22:40:00Z',
    submittedAt: '2024-05-20T22:40:00Z',
    crossReferencedAppeals: [sampleAppeals[2].id],
    consistencyScore: 85,
    tags: ['flop', 'cross-reference']
  });

  sampleAppeals[2].crossReferencedAppeals = [sampleAppeals[3].id];

  sampleAppeals.push({
    id: uuidv4(),
    appealNumber: 'BSK-APL-2024-0005',
    gameInfo: {
      gameId: uuidv4(),
      leagueName: '2024年通州区中老年篮球友谊赛',
      division: '50岁以上组',
      round: '常规赛',
      gameDate: '2024-05-22',
      gameTime: '09:30',
      venue: '通州老干部活动中心',
      homeTeam: '通州老友队',
      awayTeam: '朝阳夕阳红队',
      quarter: 3,
      gameMinute: 10,
      gameSecond: 15,
      scoreAtTime: { home: 45, away: 42 }
    },
    foulDetail: {
      foulId: uuidv4(),
      foulType: FoulType.PERSONAL,
      severity: FoulSeverity.MINOR,
      description: '防守时手部轻微接触',
      fouler: {
        playerNumber: '15',
        playerName: '老王',
        teamName: '朝阳夕阳红队',
        position: '中锋',
        foulsBefore: 1
      },
      victim: {
        playerNumber: '9',
        playerName: '老张',
        teamName: '通州老友队',
        position: '前锋',
        foulsBefore: 0
      },
      referees: ['杨老师', '徐老师']
    },
    appealContent: {
      appealingTeam: '朝阳夕阳红队',
      teamRepresentative: {
        name: '老郭',
        role: 'team_captain',
        phone: '13500135005',
        email: 'laoguo@夕阳红.com'
      },
      appealReason: '我们是友谊赛，大家都是50多岁的老同志，打球以锻炼身体为主。这次接触非常轻微，完全不影响进攻动作，裁判吹罚过于严格。希望能够取消这次犯规记录，让大家更开心地打球。',
      appealBasis: ['友谊赛精神：鼓励参与为主'],
      requestedOutcome: '取消该次犯规记录',
      supportingDocuments: [],
      additionalNotes: ''
    },
    status: AppealStatus.REJECTED,
    currentReviewer: '何老师',
    reviewHistory: [
      {
        reviewerId: 'r005',
        reviewerName: '何老师',
        reviewTime: '2024-05-22T11:00:00Z',
        reviewResult: 'rejected',
        reviewComments: '感谢您对友谊赛精神的理解。但为了保证比赛的公平性和一致性，裁判的现场判罚需要得到尊重。该判罚符合比赛规则，无法取消。希望大家继续享受比赛！',
        requiredActions: []
      }
    ],
    auditLogs: [
      {
        action: 'create',
        operatorId: 'tc005',
        operatorName: '老郭',
        operatorRole: 'team_captain',
        timestamp: '2024-05-22T10:30:00Z',
        changes: { appeal: { old: null, new: 'created' } }
      },
      {
        action: 'submit',
        operatorId: 'tc005',
        operatorName: '老郭',
        operatorRole: 'team_captain',
        timestamp: '2024-05-22T10:35:00Z',
        changes: { status: { old: 'draft', new: 'submitted' } }
      }
    ],
    createdAt: '2024-05-22T10:30:00Z',
    updatedAt: '2024-05-22T11:00:00Z',
    submittedAt: '2024-05-22T10:35:00Z',
    resolvedAt: '2024-05-22T11:00:00Z',
    crossReferencedAppeals: [],
    consistencyScore: 55,
    tags: ['friendly-match', 'rejected']
  });

  sampleAppeals.push({
    id: uuidv4(),
    appealNumber: 'BSK-APL-2024-0006',
    gameInfo: {
      gameId: uuidv4(),
      leagueName: '2024年东城区青年篮球联赛',
      division: 'U18组',
      round: '总决赛G2',
      gameDate: '2024-05-25',
      gameTime: '15:00',
      venue: '东单体育中心',
      homeTeam: '东城青年队',
      awayTeam: '西城青年队',
      quarter: 1,
      gameMinute: 6,
      gameSecond: 40,
      scoreAtTime: { home: 12, away: 10 }
    },
    foulDetail: {
      foulId: uuidv4(),
      foulType: FoulType.FLAGRANT,
      severity: FoulSeverity.MAJOR,
      description: '快攻中战术犯规拉人',
      fouler: {
        playerNumber: '4',
        playerName: '小将A',
        teamName: '西城青年队',
        position: '后卫',
        foulsBefore: 0
      },
      victim: {
        playerNumber: '11',
        playerName: '快攻球员',
        teamName: '东城青年队',
        position: '前锋',
        foulsBefore: 0
      },
      referees: ['陈国际级', '国家级'],
      videoEvidence: ['flagrant_foul_Q1.mp4']
    },
    appealContent: {
      appealingTeam: '西城青年队',
      teamRepresentative: {
        name: '刘教练',
        role: 'team_manager',
        phone: '13400134006',
        email: 'coach@xicheng.com'
      },
      appealReason: '我方球员在快攻中的战术犯规，虽然确实拉了对方球员，但动作幅度不大，且第一时间表示歉意，没有伤人意图。裁判直接判罚夺权犯规（取消比赛资格）过于严厉，对年轻球员的成长不利。',
      appealBasis: ['青少年篮球比赛指导意见：保护球员成长'],
      requestedOutcome: '将夺权犯规降级为普通故意犯规，取消禁赛处罚',
      supportingDocuments: ['检讨书.docx', '球员认错视频.mp4'],
      additionalNotes: '该球员是首次参加大型比赛，认错态度诚恳'
    },
    status: AppealStatus.DRAFT,
    reviewHistory: [],
    auditLogs: [
      {
        action: 'create',
        operatorId: 'tm006',
        operatorName: '刘教练',
        operatorRole: 'team_manager',
        timestamp: '2024-05-25T17:00:00Z',
        changes: { appeal: { old: null, new: 'created' } }
      }
    ],
    createdAt: '2024-05-25T17:00:00Z',
    updatedAt: '2024-05-25T17:00:00Z',
    crossReferencedAppeals: [],
    consistencyScore: 70,
    tags: ['youth', 'flagrant', 'draft']
  });

  return sampleAppeals;
}

export function seedDatabase(): void {
  const sampleData = generateSampleData();
  setAppeals(sampleData);
  console.log(`已加载 ${sampleData.length} 条犯规申诉样例数据`);
  console.log('数据状态分布:');
  const statusCount: Record<string, number> = {};
  sampleData.forEach(a => {
    statusCount[a.status] = (statusCount[a.status] || 0) + 1;
  });
  console.log(statusCount);
  console.log(`跨引用申诉: ${sampleData.filter(a => a.crossReferencedAppeals.length > 0).length} 条`);
}

seedDatabase();
