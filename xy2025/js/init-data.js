const InitData = {
    templates: [
        {
            id: 'perfunctory_1',
            scenario: 'perfunctory',
            content: '好的好的，我知道了~',
            description: '简单敷衍回复'
        },
        {
            id: 'perfunctory_2',
            scenario: 'perfunctory',
            content: '嗯嗯，原来是这样。',
            description: '表示理解'
        },
        {
            id: 'perfunctory_3',
            scenario: 'perfunctory',
            content: '哈哈哈，确实如此。',
            description: '附和型敷衍'
        },
        {
            id: 'perfunctory_4',
            scenario: 'perfunctory',
            content: '说的是呢~',
            description: '简洁附和'
        },
        {
            id: 'perfunctory_5',
            scenario: 'perfunctory',
            content: '我也觉得是这样。',
            description: '认同型敷衍'
        },
        {
            id: 'refuse_1',
            scenario: 'refuse',
            content: '不好意思，我今天不太方便，下次吧。',
            description: '委婉拒绝邀请'
        },
        {
            id: 'refuse_2',
            scenario: 'refuse',
            content: '谢谢你的好意，但我现在确实不需要。',
            description: '拒绝好意'
        },
        {
            id: 'refuse_3',
            scenario: 'refuse',
            content: '这件事我不太方便帮忙，你可以问问其他人。',
            description: '拒绝帮忙'
        },
        {
            id: 'refuse_4',
            scenario: 'refuse',
            content: '我觉得这个不太适合我，还是算了吧。',
            description: '拒绝提议'
        },
        {
            id: 'excuse_1',
            scenario: 'excuse',
            content: '最近确实比较忙，等有空了再说吧。',
            description: '用忙碌推脱'
        },
        {
            id: 'excuse_2',
            scenario: 'excuse',
            content: '家里有点事需要处理，这次就不去了。',
            description: '家庭原因'
        },
        {
            id: 'excuse_3',
            scenario: 'excuse',
            content: '身体不太舒服，想早点休息。',
            description: '身体原因'
        },
        {
            id: 'excuse_4',
            scenario: 'excuse',
            content: '已经有其他安排了，实在不好意思。',
            description: '已有安排'
        },
        {
            id: 'colleague_1',
            scenario: 'colleague',
            content: '你好，打扰了，想请教一下这个问题怎么处理？',
            description: '请教问题'
        },
        {
            id: 'colleague_2',
            scenario: 'colleague',
            content: '这个方案我觉得你做得很好，学习了。',
            description: '赞美同事'
        },
        {
            id: 'colleague_3',
            scenario: 'colleague',
            content: '辛苦你了，这个项目多亏了你的帮助。',
            description: '感谢帮助'
        },
        {
            id: 'colleague_4',
            scenario: 'colleague',
            content: '周末过得怎么样？有什么有趣的事吗？',
            description: '周一寒暄'
        },
        {
            id: 'favor_1',
            scenario: 'favor',
            content: '上次的事真的很感谢，这份小礼物请收下。',
            description: '还礼话术'
        },
        {
            id: 'favor_2',
            scenario: 'favor',
            content: '举手之劳，不用这么客气。',
            description: '客气回应'
        },
        {
            id: 'favor_3',
            scenario: 'favor',
            content: '谢谢你的礼物，太贴心了！',
            description: '感谢收礼'
        },
        {
            id: 'favor_4',
            scenario: 'favor',
            content: '一点心意，不成敬意。',
            description: '送礼客套'
        },
        {
            id: 'icebreaker_1',
            scenario: 'icebreaker',
            content: '你这件衣服真好看，在哪里买的？',
            description: '赞美破冰'
        },
        {
            id: 'icebreaker_2',
            scenario: 'icebreaker',
            content: '今天天气不错，挺适合出来的。',
            description: '天气话题'
        },
        {
            id: 'icebreaker_3',
            scenario: 'icebreaker',
            content: '你平时有什么兴趣爱好吗？',
            description: '兴趣话题'
        },
        {
            id: 'icebreaker_4',
            scenario: 'icebreaker',
            content: '最近有看什么好看的剧吗？推荐一下。',
            description: '娱乐话题'
        },
        {
            id: 'gift_1',
            scenario: 'gift',
            content: '这是我的一点心意，希望你喜欢。',
            description: '通用送礼'
        },
        {
            id: 'gift_2',
            scenario: 'gift',
            content: '听说你最近需要这个，特意准备的。',
            description: '贴心送礼'
        },
        {
            id: 'gift_3',
            scenario: 'gift',
            content: '生日快乐！愿你新的一岁一切顺利。',
            description: '生日祝福'
        },
        {
            id: 'gift_4',
            scenario: 'gift',
            content: '中秋快乐，一点小礼物不成敬意。',
            description: '节日送礼'
        },
        {
            id: 'quarrel_1',
            scenario: 'quarrel',
            content: '刚才我可能有点激动，让我们冷静一下再谈。',
            description: '建议冷静'
        },
        {
            id: 'quarrel_2',
            scenario: 'quarrel',
            content: '我理解你的感受，我们能不能换个方式沟通？',
            description: '共情缓和'
        },
        {
            id: 'quarrel_3',
            scenario: 'quarrel',
            content: '这件事可能我们都有做得不对的地方。',
            description: '各让一步'
        },
        {
            id: 'quarrel_4',
            scenario: 'quarrel',
            content: '先不说这个了，我们都冷静一下。',
            description: '暂停话题'
        },
        {
            id: 'apology_1',
            scenario: 'apology',
            content: '这件事是我做得不对，真心向你道歉。',
            description: '真诚道歉'
        },
        {
            id: 'apology_2',
            scenario: 'apology',
            content: '我理解你的感受，换作是我也会生气。',
            description: '共情道歉'
        },
        {
            id: 'apology_3',
            scenario: 'apology',
            content: '我已经认识到问题了，以后不会再这样了。',
            description: '承诺改进'
        },
        {
            id: 'apology_4',
            scenario: 'apology',
            content: '对不起，让你受委屈了。',
            description: '情绪安抚'
        },
        {
            id: 'confession_1',
            scenario: 'confession',
            content: '谢谢你的喜欢，但我现在还不想谈恋爱。',
            description: '以不想谈恋爱为由'
        },
        {
            id: 'confession_2',
            scenario: 'confession',
            content: '你是个很好的人，但我对你没有那种感觉。',
            description: '好人卡'
        },
        {
            id: 'confession_3',
            scenario: 'confession',
            content: '我觉得我们更适合做朋友，你觉得呢？',
            description: '建议做朋友'
        },
        {
            id: 'confession_4',
            scenario: 'confession',
            content: '不好意思，我已经有喜欢的人了。',
            description: '已有心仪对象'
        },
        {
            id: 'remind_1',
            scenario: 'remind',
            content: '打扰一下，上次说的那件事现在进展如何了？',
            description: '温和询问'
        },
        {
            id: 'remind_2',
            scenario: 'remind',
            content: '方便的时候帮我处理一下这件事可以吗？麻烦你了。',
            description: '礼貌请求'
        },
        {
            id: 'remind_3',
            scenario: 'remind',
            content: '那个事情有点急，能麻烦你尽快处理吗？',
            description: '紧急提醒'
        },
        {
            id: 'remind_4',
            scenario: 'remind',
            content: '不知道你那边怎么样了，有需要我配合的地方吗？',
            description: '主动关心'
        }
    ],

    sampleRelationships: [
        {
            id: 'sample_1',
            name: '张三',
            category: 'friend',
            personality: '开朗、幽默、重义气',
            taboo: '不要拿他的身高开玩笑',
            birthday: '1995-03-15',
            notes: '喜欢打篮球，经常组织活动'
        },
        {
            id: 'sample_2',
            name: '李四',
            category: 'colleague',
            personality: '严谨、认真、有些固执',
            taboo: '不喜欢别人质疑他的专业能力',
            notes: '技术很强，但沟通需要注意方式'
        },
        {
            id: 'sample_3',
            name: '王五',
            category: 'enemy',
            personality: '自私、爱占便宜、喜欢背后说人坏话',
            taboo: '不要和他有任何利益往来',
            notes: '尽量远离，减少接触'
        }
    ],

    sampleAvoidItems: [
        {
            id: 'sample_avoid_1',
            personId: 'sample_1',
            personName: '张三',
            type: 'joke',
            content: '不要拿他的身高开玩笑，他会真的生气'
        },
        {
            id: 'sample_avoid_2',
            personId: 'sample_2',
            personName: '李四',
            type: 'sensitive',
            content: '不要在他面前提起去年项目失败的事'
        }
    ],

    sampleFavors: [
        {
            id: 'sample_favor_1',
            personName: '张三',
            type: 'given',
            amount: 500,
            event: '结婚红包',
            date: '2024-05-20',
            notes: '随了500元红包'
        },
        {
            id: 'sample_favor_2',
            personName: '李四',
            type: 'received',
            amount: 200,
            event: '生日礼物',
            date: '2024-03-15',
            notes: '送了我一个手表，价值约200元'
        }
    ],

    sampleReminders: [
        {
            id: 'sample_reminder_1',
            personName: '妈妈',
            title: '妈妈生日',
            date: Utils.formatDate(new Date(Date.now() + 86400000 * 3)),
            type: 'birthday',
            notes: '记得买蛋糕和礼物'
        },
        {
            id: 'sample_reminder_2',
            personName: '张三',
            title: '张三生日',
            date: '2025-03-15',
            type: 'birthday',
            notes: '每年3月15日'
        }
    ],

    sampleCommunityPosts: [
        {
            id: 'sample_post_1',
            content: '今天遇到了一个很尴尬的社交场面，有人当众说我胖了，我该怎么回？',
            author: '匿名用户',
            avatar: '😅',
            likes: 12,
            comments: [
                {
                    id: 'c1',
                    content: '我一般会说："是啊，最近确实胖了点，正在减肥中"，然后转移话题',
                    createdAt: new Date(Date.now() - 3600000).toISOString()
                }
            ],
            createdAt: new Date(Date.now() - 7200000).toISOString()
        },
        {
            id: 'sample_post_2',
            content: '发现自己越来越喜欢独处了，以前很怕孤单，现在觉得一个人反而更舒服。这是正常的吗？',
            author: '孤独患者',
            avatar: '🌙',
            likes: 28,
            comments: [],
            createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
            id: 'sample_post_3',
            content: '同事总是蹭我的东西，小到纸巾，大到零食，又不好意思说，怎么办？',
            author: '好脾气的人',
            avatar: '😤',
            likes: 15,
            comments: [
                {
                    id: 'c2',
                    content: '直接说！"这个我自己也不够用了"，别不好意思',
                    createdAt: new Date(Date.now() - 1800000).toISOString()
                }
            ],
            createdAt: new Date(Date.now() - 172800000).toISOString()
        }
    ],

    initialize() {
        if (!Storage.getTemplates().length) {
            Storage.saveTemplates(this.templates);
        }
        
        if (!Storage.getRelationships().length) {
            Storage.saveRelationships(Utils.deepClone(this.sampleRelationships));
        }
        
        if (!Storage.getAvoidList().length) {
            Storage.saveAvoidList(Utils.deepClone(this.sampleAvoidItems));
        }
        
        if (!Storage.getFavors().length) {
            Storage.saveFavors(Utils.deepClone(this.sampleFavors));
        }
        
        if (!Storage.getReminders().length) {
            Storage.saveReminders(Utils.deepClone(this.sampleReminders));
        }
        
        if (!Storage.getCommunityPosts().length) {
            Storage.saveCommunityPosts(Utils.deepClone(this.sampleCommunityPosts));
        }
    }
};
