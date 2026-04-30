import type {
  Player,
  NewsItem,
  Match,
  Product,
  Activity,
  Message,
  Honor,
  HistoryItem,
  User
} from '@/types'

export const mockPlayers: Player[] = [
  {
    id: 'p1',
    name: '李明',
    nickname: 'StarLight',
    avatar: 'https://loremflickr.com/200/200/gamer,esports,player',
    position: '中单',
    game: '英雄联盟',
    achievements: ['2023全球总决赛冠军', '2024LPL春季赛MVP', '连续三届最佳中单'],
    joinDate: '2021-03-15',
    description: '被誉为"中路魔术师"的天才选手，擅长刺客型英雄，对线期极具压制力，团战中总能找到最佳切入时机。'
  },
  {
    id: 'p2',
    name: '王浩',
    nickname: 'Thunder',
    avatar: 'https://loremflickr.com/200/200/gaming,young,man',
    position: '打野',
    game: '英雄联盟',
    achievements: ['2023全球总决赛冠军', '2023最佳打野选手', '野区控制率第一'],
    joinDate: '2020-08-20',
    description: '野区的统治者，擅长节奏型打野，地图意识超群，总能在关键时刻出现在需要的位置。'
  },
  {
    id: 'p3',
    name: '陈晓',
    nickname: 'Frost',
    avatar: 'https://loremflickr.com/200/200/professional,man,portrait',
    position: '上单',
    game: '英雄联盟',
    achievements: ['2023全球总决赛冠军', '2024LPL春季赛最佳上单'],
    joinDate: '2022-01-10',
    description: '团队的坚实后盾，擅长坦克型英雄，对线稳健，团战保护能力一流。'
  },
  {
    id: 'p4',
    name: '林雨',
    nickname: 'Swift',
    avatar: 'https://loremflickr.com/200/200/asian,young,man',
    position: 'ADC',
    game: '英雄联盟',
    achievements: ['2023全球总决赛冠军', '2023年度最佳ADC', 'KDA之王'],
    joinDate: '2021-06-05',
    description: '输出机器，擅长后期carry型英雄，团战站位精准，输出环境创造能力极强。'
  },
  {
    id: 'p5',
    name: '赵阳',
    nickname: 'Guardian',
    avatar: 'https://loremflickr.com/200/200/man,technology,tech',
    position: '辅助',
    game: '英雄联盟',
    achievements: ['2023全球总决赛冠军', '2024LPL春季赛最佳辅助'],
    joinDate: '2020-11-15',
    description: '团队的大脑，擅长开团型和保护型辅助，视野控制出色，指挥决策能力一流。'
  }
]

export const mockNews: NewsItem[] = [
  {
    id: 'n1',
    title: '星芒战队2:0完胜雷霆，晋级LPL春季赛总决赛',
    summary: '在昨日进行的LPL春季赛季后赛半决赛中，星芒战队以2:0的比分完胜雷霆战队，成功晋级总决赛。中单StarLight表现出色，连续两局获得MVP。',
    cover: 'https://loremflickr.com/600/338/esports,tournament,arena',
    category: 'news',
    publishDate: '2024-04-20',
    views: 12580,
    content: '在昨日进行的LPL春季赛季后赛半决赛中，星芒战队展现出了强大的统治力，以2:0的比分完胜雷霆战队，成功晋级即将到来的总决赛。\n\n第一局比赛中，星芒战队选择了一套偏后期的阵容，中单StarLight使用阿卡丽在对线期就建立了巨大优势，15分钟就拿下了4个人头。最终在32分钟时，星芒战队凭借完美的团战配合拿下第一局。\n\n第二局比赛，雷霆战队试图通过前期节奏来打破星芒的防线，但打野Thunder的盲僧多次关键Gank成功化解了危机。最终StarLight的妖姬在团战中斩获三杀，帮助队伍2:0锁定胜局。\n\n赛后采访中，StarLight表示："我们整个团队配合得非常好，每个人都在自己的位置上做到了最好。总决赛我们会继续保持这种状态，争取拿下冠军！"\n\n总决赛将于4月28日在上海电竞中心举行，星芒战队将迎战闪电战队与烈焰战队之间的胜者。'
  },
  {
    id: 'n2',
    title: '【战报】星芒 vs 闪电：决胜局惊险翻盘，3:2挺进四强',
    summary: '这是一场惊心动魄的BO5对决，星芒战队在先失两局的情况下连扳三局，最终以3:2的比分逆转闪电战队，成功晋级季后赛四强。',
    cover: 'https://loremflickr.com/600/338/gaming,competition,stage',
    category: 'match_report',
    publishDate: '2024-04-15',
    views: 28960,
    content: '## 比赛回顾\n\n### 第一局\n闪电战队选用了一套前期节奏极强的阵容，打野在3分钟就来到下路Gank成功，拿下一血。星芒战队试图通过团战找回节奏，但闪电的控制链太过完美，星芒遗憾告负。\n\n### 第二局\n星芒调整了阵容，选择了一套偏发育的后期阵容。但闪电战队没有给星芒喘息的机会，15分钟就拿下了三条小龙，25分钟经济差拉开到8000。星芒再失一局。\n\n### 第三局\n关键的第三局，星芒战队终于找回了状态。中单StarLight的劫在对线期就完成了单杀，打野Thunder的盲僧多次精准R闪开团。星芒扳回一局。\n\n### 第四局\n乘胜追击的星芒战队气势如虹，上单Frost的奥恩多次关键大招击飞多人，ADC Swift的卡莎在团战中疯狂输出。星芒再扳一局，比分来到2:2。\n\n### 第五局\n决胜局双方都极为谨慎，前20分钟双方人头比仅为2:2。关键的大龙团战中，辅助Guardian的锤石闪现一勾勾中对方ADC，星芒战队顺势拿下大龙并一波结束比赛。\n\n## 选手评分\n- StarLight: 9.5分（MVP）\n- Thunder: 9.0分\n- Frost: 8.5分\n- Swift: 9.0分\n- Guardian: 9.5分\n\n恭喜星芒战队完成惊天大逆转！'
  },
  {
    id: 'n3',
    title: '星芒电竞俱乐部五周年庆典活动即将开启',
    summary: '为庆祝俱乐部成立五周年，我们将举办一系列线上线下活动，包括粉丝见面会、抽奖活动、限定周边发售等，精彩内容不容错过！',
    cover: 'https://loremflickr.com/600/338/celebration,party,event',
    category: 'news',
    publishDate: '2024-04-10',
    views: 8750,
    content: '亲爱的星芒粉丝们：\n\n时光荏苒，星芒电竞俱乐部即将迎来成立五周年的重要时刻！在这五年里，我们从一支默默无闻的小战队，成长为享誉全球的顶级电竞俱乐部。这一切都离不开每一位粉丝的支持与陪伴。\n\n为了感谢大家的厚爱，我们将在5月1日至5月7日举办"星芒五周年，感恩有你"系列庆典活动。\n\n## 活动内容\n\n### 1. 线上粉丝见面会（5月1日 19:00）\n所有选手将在线上与粉丝互动，回答粉丝提问，进行趣味小游戏。参与互动的粉丝有机会获得选手签名周边。\n\n### 2. 五周年限定周边发售（5月2日 10:00）\n限量发售五周年纪念T恤、徽章套装、选手签名海报等限定周边。\n\n### 3. 积分翻倍活动（5月1日-5月7日）\n活动期间，在商城消费可获得双倍积分，评论分享也可获得额外积分奖励。\n\n### 4. 幸运大抽奖（5月4日 20:00）\n一等奖（1名）：与所有选手线下共进晚餐\n二等奖（5名）：选手签名全套外设\n三等奖（20名）：五周年限定周边大礼包\n\n更多活动详情，请持续关注我们的官方动态！\n\n星芒电竞俱乐部\n2024年4月10日'
  },
  {
    id: 'n4',
    title: '【专访】StarLight：我只是做了我该做的事',
    summary: '在拿下全球总决赛冠军后，我们的中单选手StarLight接受了独家专访，分享了他的心路历程和对未来的展望。',
    cover: 'https://loremflickr.com/600/338/interview,esports,player',
    category: 'news',
    publishDate: '2024-04-05',
    views: 15620,
    content: 'Q：首先恭喜你拿下全球总决赛冠军，同时也获得了总决赛MVP。现在心情如何？\n\nA：其实还是挺平静的，因为我们整个团队为这个目标努力了很久。当水晶爆掉的那一刻，更多的是一种释然吧，感觉所有的付出都有了回报。当然也很开心，这是我职业生涯至今最重要的一个冠军。\n\nQ：你觉得你们能夺冠的关键是什么？\n\nA：我觉得是团队的凝聚力。我们五个人在一起打了快两年了，彼此之间非常默契。比赛中遇到困难的时候，我们不会互相指责，而是一起想办法解决。这一点我觉得非常重要。\n\nQ：决赛中你的阿卡丽表现非常惊艳，那波五杀是怎么做到的？\n\nA：其实那波团战我只是做了我该做的事。当时队友们都在前面扛伤害，给我创造了很好的输出环境。我只是抓住了机会，把技能都放了出去。五杀确实是意料之外，但能帮助队伍赢下比赛才是最重要的。\n\nQ：对未来有什么规划？\n\nA：先好好休息一下吧，这一年确实挺累的。然后就是准备新赛季，争取能够卫冕。当然，也希望能在其他国际赛事中也能取得好成绩。\n\nQ：最后有什么想对粉丝说的吗？\n\nA：非常感谢大家一直以来的支持。无论是我们赢的时候还是输的时候，你们都在我们身边。没有你们的支持，我们走不到今天。未来我们会继续努力，争取为大家带来更多精彩的比赛！'
  }
]

export const mockMatches: Match[] = [
  {
    id: 'm1',
    opponent: '闪电战队',
    opponentLogo: 'https://loremflickr.com/100/100/logo,shield,team',
    game: '英雄联盟',
    date: '2024-04-28',
    time: '19:00',
    status: 'upcoming',
    tournament: 'LPL春季赛总决赛',
    venue: '上海电竞中心'
  },
  {
    id: 'm2',
    opponent: '雷霆战队',
    opponentLogo: 'https://loremflickr.com/100/100/thunder,storm,lightning',
    game: '英雄联盟',
    date: '2024-04-20',
    time: '17:00',
    status: 'finished',
    result: 'win',
    score: { our: 2, opponent: 0 },
    tournament: 'LPL春季赛季后赛半决赛',
    venue: '杭州电竞馆'
  },
  {
    id: 'm3',
    opponent: '闪电战队',
    opponentLogo: 'https://loremflickr.com/100/100/logo,shield,team',
    game: '英雄联盟',
    date: '2024-04-15',
    time: '18:00',
    status: 'finished',
    result: 'win',
    score: { our: 3, opponent: 2 },
    tournament: 'LPL春季赛季后赛八强赛',
    venue: '深圳电竞中心'
  },
  {
    id: 'm4',
    opponent: '烈焰战队',
    opponentLogo: 'https://loremflickr.com/100/100/fire,flame,hot',
    game: '英雄联盟',
    date: '2024-04-10',
    time: '19:00',
    status: 'finished',
    result: 'win',
    score: { our: 2, opponent: 1 },
    tournament: 'LPL春季赛常规赛',
    venue: '线上赛'
  },
  {
    id: 'm5',
    opponent: '寒冰战队',
    opponentLogo: 'https://loremflickr.com/100/100/ice,snow,cold',
    game: '英雄联盟',
    date: '2024-04-05',
    time: '17:00',
    status: 'finished',
    result: 'lose',
    score: { our: 1, opponent: 2 },
    tournament: 'LPL春季赛常规赛',
    venue: '线上赛'
  },
  {
    id: 'm6',
    opponent: '狂风战队',
    opponentLogo: 'https://loremflickr.com/100/100/wind,storm,fast',
    game: '英雄联盟',
    date: '2024-04-01',
    time: '18:00',
    status: 'finished',
    result: 'win',
    score: { our: 2, opponent: 0 },
    tournament: 'LPL春季赛常规赛',
    venue: '北京电竞馆'
  }
]

export const mockProducts: Product[] = [
  {
    id: 'prod1',
    name: '星芒五周年纪念T恤',
    price: 199,
    originalPrice: 299,
    image: 'https://loremflickr.com/300/300/tshirt,clothing,fashion',
    category: 'clothing',
    description: '星芒电竞俱乐部五周年限定纪念T恤，采用优质纯棉面料，透气舒适。胸前印有五周年专属logo，袖口绣有选手签名，收藏价值极高。',
    stock: 999,
    sales: 568,
    tags: ['限量', '五周年', '签名款']
  },
  {
    id: 'prod2',
    name: 'StarLight选手限定徽章',
    price: 49,
    image: 'https://loremflickr.com/300/300/badge,pin,collectible',
    category: 'badge',
    description: '中单选手StarLight限定徽章，采用珐琅工艺制作，色彩鲜艳不易褪色。背面配有安全别针，可佩戴在衣物或背包上。',
    stock: 2000,
    sales: 1245,
    tags: ['选手周边', '收藏']
  },
  {
    id: 'prod3',
    name: '星芒战队主题键帽套装',
    price: 129,
    originalPrice: 159,
    image: 'https://loremflickr.com/300/300/keyboard,keycaps,mechanical',
    category: 'keycap',
    description: '星芒战队主题PBT键帽套装，包含104键标准配列。采用五面热升华工艺，图案清晰耐磨。配色为战队标志性的粉紫渐变。',
    stock: 500,
    sales: 320,
    tags: ['电竞外设', 'PBT材质']
  },
  {
    id: 'prod4',
    name: '2023全球总决赛夺冠纪念海报',
    price: 39,
    image: 'https://loremflickr.com/300/400/poster,print,trophy',
    category: 'poster',
    description: '2023全球总决赛夺冠纪念海报，高清印刷，尺寸为60x90cm。记录了战队夺冠的精彩瞬间，是粉丝必入的收藏佳品。',
    stock: 5000,
    sales: 3560,
    tags: ['夺冠纪念', '高清印刷']
  },
  {
    id: 'prod5',
    name: '星芒战队连帽卫衣',
    price: 299,
    originalPrice: 399,
    image: 'https://loremflickr.com/300/300/hoodie,sweater,casual',
    category: 'clothing',
    description: '星芒战队官方连帽卫衣，加绒加厚款，适合秋冬穿着。胸前大logo采用刺绣工艺，质感非凡。袖口和下摆有罗纹收口，防风保暖。',
    stock: 800,
    sales: 456,
    tags: ['秋冬款', '加绒加厚', '刺绣logo']
  },
  {
    id: 'prod6',
    name: '全套选手徽章礼盒',
    price: 249,
    originalPrice: 299,
    image: 'https://loremflickr.com/300/300/giftbox,present,collectible',
    category: 'badge',
    description: '包含五名首发选手的限定徽章礼盒，采用精美礼盒包装，附赠收藏证书。每枚徽章都有独立编号，限量发售1000套。',
    stock: 200,
    sales: 156,
    tags: ['限量礼盒', '全套收藏', '独立编号']
  },
  {
    id: 'prod7',
    name: '选手签名限定海报',
    price: 99,
    image: 'https://loremflickr.com/300/400/autograph,signature,poster',
    category: 'poster',
    description: '选手亲笔签名限定海报，每位选手限量50张。配有精美相框，适合展示收藏。下单时请备注选手姓名。',
    stock: 200,
    sales: 120,
    tags: ['亲笔签名', '限量', '含相框']
  },
  {
    id: 'prod8',
    name: 'RGB背光机械键盘',
    price: 599,
    originalPrice: 799,
    image: 'https://loremflickr.com/300/300/keyboard,mechanical,gaming',
    category: 'keycap',
    description: '星芒战队联名款机械键盘，采用Cherry MX轴体，支持1680万色RGB背光。附赠战队主题键帽一套，支持全键无冲。',
    stock: 300,
    sales: 189,
    tags: ['联名款', 'Cherry轴', 'RGB背光']
  }
]

export const mockActivities: Activity[] = [
  {
    id: 'act1',
    title: '星芒五周年粉丝见面会',
    cover: 'https://loremflickr.com/600/338/meeting,event,fans',
    type: 'meetup',
    description: '星芒电竞俱乐部成立五周年，诚邀各位粉丝参加线下见面会！所有首发选手将到场与粉丝互动，现场还有抽奖环节，奖品包括选手签名外设、限定周边等。',
    startTime: '2024-05-01 14:00',
    endTime: '2024-05-01 18:00',
    maxParticipants: 200,
    currentParticipants: 156,
    status: 'upcoming'
  },
  {
    id: 'act2',
    title: '总决赛应援活动',
    cover: 'https://loremflickr.com/600/338/support,cheering,crowd',
    type: 'support',
    description: 'LPL春季赛总决赛即将开打！参与应援活动，为星芒战队加油助威！发布带话题#星芒冲冠#的应援内容，即可获得积分奖励，优质内容还有机会获得限定周边。',
    startTime: '2024-04-25 00:00',
    endTime: '2024-04-28 23:59',
    maxParticipants: 9999,
    currentParticipants: 3580,
    status: 'ongoing'
  },
  {
    id: 'act3',
    title: '五周年幸运大抽奖',
    cover: 'https://loremflickr.com/600/338/lottery,prize,giveaway',
    type: 'lottery',
    description: '星芒五周年，好礼送不停！所有会员用户均可参与抽奖，每位用户每天有3次抽奖机会。奖品包括：与选手共进晚餐、签名外设、限定周边、积分奖励等。',
    startTime: '2024-05-01 00:00',
    endTime: '2024-05-07 23:59',
    maxParticipants: 9999,
    currentParticipants: 0,
    status: 'upcoming'
  }
]

export const mockMessages: Message[] = [
  {
    id: 'msg1',
    userId: 'u1',
    userName: '小星星',
    userAvatar: 'https://loremflickr.com/100/100/girl,cute,smile',
    content: '恭喜星芒战队晋级总决赛！昨天的比赛太精彩了，StarLight的阿卡丽真的秀翻全场！永远支持你们，总决赛加油！💪💪💪',
    createTime: '2024-04-21 10:30',
    likes: 256,
    replies: []
  },
  {
    id: 'msg2',
    userId: 'u2',
    userName: '电竞少女',
    userAvatar: 'https://loremflickr.com/100/100/asian,girl,young',
    content: 'Thunder的盲僧真的是世界顶级！那几波R闪太关键了，每次看他打野都是一种享受。希望总决赛能继续看到他的精彩表现！',
    createTime: '2024-04-21 11:15',
    likes: 189,
    replies: [
      {
        id: 'msg2-1',
        userId: 'u3',
        userName: '打野爱好者',
        userAvatar: 'https://loremflickr.com/100/100/boy,teen,happy',
        content: '同意！Thunder的野区控制真的太强了，每次Gank的时机都拿捏得恰到好处。',
        createTime: '2024-04-21 12:00',
        likes: 45,
        replies: []
      }
    ]
  },
  {
    id: 'msg3',
    userId: 'u4',
    userName: '老粉一枚',
    userAvatar: 'https://loremflickr.com/100/100/man,mature,friendly',
    content: '从星芒刚成立就开始关注了，看着你们一步步走到今天，真的很欣慰。五周年快乐！希望你们能一直保持这份热爱，继续为我们带来精彩的比赛。永远支持星芒！❤️',
    createTime: '2024-04-20 20:45',
    likes: 520,
    replies: []
  },
  {
    id: 'msg4',
    userId: 'u5',
    userName: 'Swift的小迷妹',
    userAvatar: 'https://loremflickr.com/100/100/girl,pretty,adorable',
    content: 'Swift太帅了！团战站位永远那么完美，输出打得又高又稳。好想买他的签名海报啊，可惜手速太慢没抢到😭 下次补货是什么时候呀？',
    createTime: '2024-04-19 16:20',
    likes: 134,
    replies: []
  }
]

export const mockHonors: Honor[] = [
  {
    id: 'h1',
    title: '全球总决赛冠军',
    tournament: '2023英雄联盟全球总决赛',
    date: '2023-11-05',
    icon: '🏆'
  },
  {
    id: 'h2',
    title: 'LPL春季赛冠军',
    tournament: '2023LPL春季赛',
    date: '2023-04-28',
    icon: '🥇'
  },
  {
    id: 'h3',
    title: 'LPL夏季赛冠军',
    tournament: '2022LPL夏季赛',
    date: '2022-09-10',
    icon: '🥇'
  },
  {
    id: 'h4',
    title: 'MSI季中邀请赛亚军',
    tournament: '2023MSI季中邀请赛',
    date: '2023-05-21',
    icon: '🥈'
  },
  {
    id: 'h5',
    title: '德玛西亚杯冠军',
    tournament: '2022德玛西亚杯',
    date: '2022-12-26',
    icon: '🏆'
  }
]

export const mockHistory: HistoryItem[] = [
  {
    id: 'hist1',
    year: '2019',
    title: '星芒初现',
    description: '星芒电竞俱乐部在上海正式成立，最初只有英雄联盟一支战队。虽然起步艰难，但我们怀揣着电竞梦想，踏上了征程。',
    image: 'https://loremflickr.com/400/300/startup,business,team'
  },
  {
    id: 'hist2',
    year: '2020',
    title: '崭露头角',
    description: '经过一年的打磨，星芒战队开始在各大赛事中崭露头角。我们拿下了首个次级联赛冠军，并成功晋级LPL。这是我们梦想的起点。',
    image: 'https://loremflickr.com/400/300/achievement,success,trophy'
  },
  {
    id: 'hist3',
    year: '2021',
    title: '阵容成型',
    description: 'StarLight、Thunder、Swift等核心选手相继加入，星芒战队的黄金阵容正式成型。在LPL的首个赛季，我们就取得了第四名的好成绩。',
    image: 'https://loremflickr.com/400/300/team,group,friends'
  },
  {
    id: 'hist4',
    year: '2022',
    title: '首夺桂冠',
    description: '这是丰收的一年！我们先后拿下了LPL夏季赛冠军和德玛西亚杯冠军。俱乐部也在这一年完成了A轮融资，开始向多元化发展。',
    image: 'https://loremflickr.com/400/300/victory,celebration,win'
  },
  {
    id: 'hist5',
    year: '2023',
    title: '登顶世界',
    description: '最难忘的一年！我们不仅卫冕了LPL春季赛冠军，更在全球总决赛中力克强敌，首次捧起了召唤师杯。星芒之名，响彻全球！',
    image: 'https://loremflickr.com/400/300/champion,world,trophy'
  },
  {
    id: 'hist6',
    year: '2024',
    title: '持续辉煌',
    description: '站在新的起点，我们不忘初心。俱乐部规模不断扩大，粉丝群体日益增长。我们将继续努力，为所有支持星芒的粉丝带来更多荣耀！',
    image: 'https://loremflickr.com/400/300/future,forward,vision'
  }
]

export const mockUser: User = {
  id: 'user001',
  nickname: '星芒小粉丝',
  avatar: 'https://loremflickr.com/100/100/cute,girl,profile',
  phone: '138****8888',
  level: 4,
  levelName: '钻石粉丝',
  points: 3560,
  nextLevelPoints: 5000,
  favoriteProducts: ['prod1', 'prod3'],
  favoritePlayers: ['p1', 'p4']
}
