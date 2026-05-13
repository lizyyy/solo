const SAMPLES = {
    'clean': {
        id: 'clean',
        name: '✅ 完美发布样例',
        description: '所有规则通过，可直接发布',
        tag: 'tag-success',
        data: {
            date: '2026-05-12',
            slot: 'morning',
            programs: [
                {
                    id: 'p1',
                    title: '校园新闻播报',
                    duration: 15,
                    content: '各位同学早上好，今天是五月十二日，星期二。首先为您播报校园新闻：本周四将举行春季运动会，报名截止时间为本周三下午五点。图书馆三楼新增电子阅览室，欢迎同学们前往体验。'
                },
                {
                    id: 'p2',
                    title: '天气预报',
                    duration: 5,
                    content: '接下来是天气预报：今天晴转多云，最高气温26度，最低气温18度，东南风3级。明天有小雨，出行请带好雨具。'
                },
                {
                    id: 'p3',
                    title: '音乐欣赏',
                    duration: 20,
                    content: '接下来进入音乐欣赏时间。今天为大家带来三首经典校园歌曲，陪伴您度过美好的早晨时光。'
                },
                {
                    id: 'p4',
                    title: '早安问候',
                    duration: 10,
                    content: '新的一天，新的希望。愿每位同学都能保持积极向上的心态，勇敢面对学习和生活中的挑战。'
                },
                {
                    id: 'p5',
                    title: '温馨提示',
                    duration: 5,
                    content: '温馨提示：食堂二楼今日新增特色窗口，提供各类地方小吃，欢迎同学们品尝。'
                }
            ]
        }
    },
    'duration-warning': {
        id: 'duration-warning',
        name: '⚠️ 时长接近上限',
        description: '总时长接近时段上限，存在超时风险',
        tag: 'tag-warning',
        data: {
            date: '2026-05-12',
            slot: 'noon',
            programs: [
                {
                    id: 'p1',
                    title: '午间快讯',
                    duration: 10,
                    content: '中午好，欢迎收听午间快讯。今天上午学校召开了2026届毕业生就业工作会议，校长在会上强调了就业工作的重要性。'
                },
                {
                    id: 'p2',
                    title: '特别专题',
                    duration: 14,
                    content: '今天的特别专题，我们来聊聊大学生创新创业。近年来，学校高度重视创新创业教育，设立了专项基金支持学生项目。'
                },
                {
                    id: 'p3',
                    title: '轻松一刻',
                    duration: 5,
                    content: '最后让我们来听一首轻松愉快的歌曲，为下午的学习补充能量。'
                }
            ]
        }
    },
    'duration-exceed': {
        id: 'duration-exceed',
        name: '❌ 时长超出限制',
        description: '总时长超过时段上限，无法发布',
        tag: 'tag-danger',
        data: {
            date: '2026-05-12',
            slot: 'evening',
            programs: [
                {
                    id: 'p1',
                    title: '晚间新闻',
                    duration: 25,
                    content: '各位同学晚上好，欢迎收听晚间新闻。今天我们要播报的内容很多，请耐心收听。'
                },
                {
                    id: 'p2',
                    title: '人物专访',
                    duration: 30,
                    content: '接下来是人物专访环节，今天我们邀请到了刚刚获得全国大学生竞赛一等奖的张同学，来和我们分享他的获奖经历。'
                },
                {
                    id: 'p3',
                    title: '校园文化',
                    duration: 20,
                    content: '最后一个栏目是校园文化，让我们一起回顾本月校园文化节的精彩瞬间。'
                }
            ]
        }
    },
    'sensitive-found': {
        id: 'sensitive-found',
        name: '🔴 发现敏感词',
        description: '节目内容包含敏感词汇，需要处理',
        tag: 'tag-danger',
        data: {
            date: '2026-05-12',
            slot: 'morning',
            programs: [
                {
                    id: 'p1',
                    title: '校园新闻',
                    duration: 15,
                    content: '各位同学早上好。今天为大家播报的新闻包括：学校近期将举办一场重要的政治演讲活动，邀请了校外嘉宾来校讲座。另外，有学生在论坛上散布谣言，造成不良影响，学校正在调查处理。'
                },
                {
                    id: 'p2',
                    title: '音乐时间',
                    duration: 20,
                    content: '接下来进入音乐时间，为大家播放几首经典歌曲。'
                },
                {
                    id: 'p3',
                    title: '特别提醒',
                    duration: 10,
                    content: '特别提醒：近期有人传播非法内容，请同学们提高警惕，遇到可疑情况及时向老师报告。'
                }
            ]
        }
    },
    'complex-issues': {
        id: 'complex-issues',
        name: '🔧 综合问题样例',
        description: '包含时长、敏感词多种问题',
        tag: 'tag-danger',
        data: {
            date: '2026-05-13',
            slot: 'evening',
            programs: [
                {
                    id: 'p1',
                    title: '晚间播报',
                    duration: 40,
                    content: '各位同学晚上好，欢迎收听晚间播报。今天我们要讨论一些敏感话题，包括近期的一些政治事件。另外，有人散布虚假信息，声称学校要进行收费改革，这是不实谣言。'
                },
                {
                    id: 'p2',
                    title: '深度访谈',
                    duration: 35,
                    content: '接下来是深度访谈，我们来谈谈大家关心的问题。'
                }
            ]
        }
    },
    'dirty-data': {
        id: 'dirty-data',
        name: '🧪 脏数据测试样例',
        description: '空标题、NaN、负数时长等非法值',
        tag: 'tag-danger',
        data: {
            date: '2026-05-14',
            slot: 'morning',
            programs: [
                {
                    id: 'p1',
                    title: '',
                    duration: 10,
                    content: '这是一个没有标题的节目'
                },
                {
                    id: 'p2',
                    title: '   ',
                    duration: 15,
                    content: '标题只有空白字符'
                },
                {
                    id: 'p3',
                    title: '非法时长节目',
                    duration: -5,
                    content: '时长为负数'
                },
                {
                    id: 'p4',
                    title: '零时长节目',
                    duration: 0,
                    content: '时长为0'
                },
                {
                    id: 'p5',
                    title: '正常节目',
                    duration: 20,
                    content: '这是一个正常的节目'
                }
            ]
        }
    }
};

const SENSITIVE_WORDS = [
    '政治演讲',
    '散布谣言',
    '非法内容',
    '敏感话题',
    '政治事件',
    '虚假信息',
    '不实谣言',
    '收费改革',
    '可疑情况'
];

const TIME_SLOTS = {
    'morning': {
        name: '早间',
        display: '07:00-08:00',
        duration: 60,
        warningThreshold: 55,
        maxDuration: 60
    },
    'noon': {
        name: '午间',
        display: '12:00-12:30',
        duration: 30,
        warningThreshold: 27,
        maxDuration: 30
    },
    'evening': {
        name: '晚间',
        display: '18:00-19:00',
        duration: 60,
        warningThreshold: 55,
        maxDuration: 60
    }
};

const RULES = [
    {
        id: 'duration-single',
        category: '时长',
        icon: '⏱️',
        description: '单个节目时长不超过30分钟'
    },
    {
        id: 'duration-valid',
        category: '时长',
        icon: '🔢',
        description: '时长必须是大于0的有效数字（非NaN、非负）'
    },
    {
        id: 'duration-total',
        category: '时长',
        icon: '📊',
        description: '节目单总时长不得超过时段上限'
    },
    {
        id: 'duration-warning',
        category: '时长',
        icon: '⚠️',
        description: '总时长达到时段90%时发出警告'
    },
    {
        id: 'title-required',
        category: '标题',
        icon: '📝',
        description: '节目标题不能为空或纯空白字符'
    },
    {
        id: 'sensitive-scan',
        category: '敏感词',
        icon: '🔍',
        description: '所有节目内容必须通过敏感词扫描'
    },
    {
        id: 'sensitive-highlight',
        category: '敏感词',
        icon: '🔴',
        description: '敏感词需高亮显示并标注上下文'
    },
    {
        id: 'publish-gate',
        category: '发布',
        icon: '🚪',
        description: '所有检查通过后才能发布'
    },
    {
        id: 'issue-tracking',
        category: '问题',
        icon: '📋',
        description: '问题数据不静默跳过，进入问题列表'
    },
    {
        id: 'withdraw-support',
        category: '发布',
        icon: '↩️',
        description: '支持已发布节目单撤回'
    }
];
