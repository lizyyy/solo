
// 应用数据层 - 数据结构和初始化

const AppData = {
    // 针对不同话题的示例评论模板
    topicCommentTemplates: {
        1: [
            { content: "这个话题我有话要说！现在的年轻人压力太大了，不是不想结婚，是结不起啊！", time: "2小时前" },
            { content: "作为过来人，结婚真的需要勇气！房贷、车贷、育儿成本，三座大山压得人喘不过气。", time: "3小时前" },
            { content: "最新数据显示，结婚率连续8年下降，生育率也在走低，这是一个社会现象，需要从多方面分析。", time: "5小时前" },
            { content: "我身边很多朋友都不结婚，不是不想，是真的没有条件。", time: "8小时前" },
            { content: "现在的年轻人更追求自我价值实现，结婚不再是必选项。", time: "1天前" }
        ],
        2: [
            { content: "月薪一万在一线城市真的很难，房租就要占掉一半！", time: "2小时前" },
            { content: "我在上海，月薪一万，扣除社保和房租，剩下的只够吃饭。", time: "3小时前" },
            { content: "看怎么定义'生活'了，如果只是生存是够的，要想享受生活很难。", time: "5小时前" },
            { content: "刚毕业的时候月薪五千都能活，现在月薪一万反而不够用，消费观变了。", time: "8小时前" },
            { content: "一线城市的机会多，虽然钱不够花，但能学到东西。", time: "1天前" }
        ],
        6: [
            { content: "996真的太反人类了，工作和生活完全失衡！", time: "1小时前" },
            { content: "我之前在互联网公司就是996，身体垮了之后果断辞职。", time: "2小时前" },
            { content: "现在很多公司把996当成福报，真的很无语。", time: "4小时前" },
            { content: "效率才是关键，不是靠堆时间。", time: "6小时前" },
            { content: "希望劳动法能真正保护劳动者的权益。", time: "1天前" }
        ],
        7: [
            { content: "不是想躺平，是努力了也看不到希望。", time: "1小时前" },
            { content: "现在的房价和物价，普通人再努力也赶不上。", time: "3小时前" },
            { content: "躺平是一种无奈的选择，也是对不合理社会压力的无声抗议。", time: "5小时前" },
            { content: "努力不一定成功，但不努力一定很舒服。", time: "7小时前" },
            { content: "每个人都有选择自己生活方式的权利。", time: "1天前" }
        ],
        12: [
            { content: "短视频确实让人沉迷，刷着刷着一天就过去了。", time: "2小时前" },
            { content: "这要看怎么用，短视频也能学到很多东西。", time: "3小时前" },
            { content: "算法推荐太可怕了，一直给你推你喜欢的内容，让人失去思考能力。", time: "5小时前" },
            { content: "我现在已经卸载了，太浪费时间了。", time: "8小时前" },
            { content: "任何事物都有两面性，关键在于使用者。", time: "1天前" }
        ],
        31: [
            { content: "游戏是精神鸦片？这个说法太极端了。", time: "1小时前" },
            { content: "我玩游戏是为了放松，工作压力那么大，需要一个出口。", time: "2小时前" },
            { content: "游戏成瘾确实是个问题，但不能一棒子打死所有游戏。", time: "4小时前" },
            { content: "现在电竞都成产业了，游戏也能成为职业。", time: "6小时前" },
            { content: "关键在于自律，和游戏本身关系不大。", time: "1天前" }
        ]
    },

    // 生成50个社会热点话题
    initTopics: function() {
        const topics = [
            { id: 1, title: "年轻人为何越来越不想结婚？", category: "社会", viewCount: 156, likeCount: 34, commentCount: 8 },
            { id: 2, title: "月薪一万在一线城市能生活吗？", category: "经济", viewCount: 124, likeCount: 28, commentCount: 7 },
            { id: 3, title: "外卖员的未来在哪里？", category: "职业", viewCount: 102, likeCount: 23, commentCount: 6 },
            { id: 4, title: "双减政策后，家长更焦虑了？", category: "教育", viewCount: 98, likeCount: 21, commentCount: 5 },
            { id: 5, title: "网红经济是泡沫吗？", category: "经济", viewCount: 145, likeCount: 32, commentCount: 8 },
            { id: 6, title: "996工作制应该被取消吗？", category: "职场", viewCount: 189, likeCount: 45, commentCount: 12 },
            { id: 7, title: "为什么现在的年轻人爱躺平？", category: "社会", viewCount: 167, likeCount: 41, commentCount: 10 },
            { id: 8, title: "直播带货的商品真的便宜吗？", category: "消费", viewCount: 112, likeCount: 25, commentCount: 6 },
            { id: 9, title: "学区房还值得投资吗？", category: "房产", viewCount: 134, likeCount: 30, commentCount: 7 },
            { id: 10, title: "整容是自信的开始还是焦虑的体现？", category: "美妆", viewCount: 90, likeCount: 19, commentCount: 5 },
            { id: 11, title: "宠物经济为什么这么火？", category: "生活", viewCount: 128, likeCount: 28, commentCount: 7 },
            { id: 12, title: "短视频是否正在毁掉年轻人？", category: "娱乐", viewCount: 198, likeCount: 47, commentCount: 13 },
            { id: 13, title: "年轻人为什么热衷于超前消费？", category: "消费", viewCount: 115, likeCount: 26, commentCount: 6 },
            { id: 14, title: "职场PUA真的存在吗？", category: "职场", viewCount: 142, likeCount: 33, commentCount: 8 },
            { id: 15, title: "丁克家族会后悔吗？", category: "家庭", viewCount: 107, likeCount: 24, commentCount: 6 },
            { id: 16, title: "奶茶店为什么开了又关？", category: "创业", viewCount: 89, likeCount: 18, commentCount: 4 },
            { id: 17, title: "为什么大家都在考公？", category: "职场", viewCount: 156, likeCount: 36, commentCount: 9 },
            { id: 18, title: "医美行业真的暴利吗？", category: "美妆", viewCount: 131, likeCount: 30, commentCount: 8 },
            { id: 19, title: "年轻人为什么爱攒钱？", category: "理财", viewCount: 105, likeCount: 23, commentCount: 6 },
            { id: 20, title: "在线教育还能翻身吗？", category: "教育", viewCount: 92, likeCount: 20, commentCount: 5 },
            { id: 21, title: "为什么现在的人越来越社恐？", category: "心理", viewCount: 168, likeCount: 40, commentCount: 10 },
            { id: 22, title: "直播打赏是不是智商税？", category: "娱乐", viewCount: 136, likeCount: 31, commentCount: 8 },
            { id: 23, title: "年轻人的夜生活是什么样的？", category: "生活", viewCount: 118, likeCount: 27, commentCount: 7 },
            { id: 24, title: "程序员的35岁危机是真的吗？", category: "职场", viewCount: 174, likeCount: 42, commentCount: 11 },
            { id: 25, title: "为什么现在的孩子越来越早熟？", category: "教育", viewCount: 109, likeCount: 25, commentCount: 6 },
            { id: 26, title: "二手经济为什么这么火？", category: "消费", viewCount: 94, likeCount: 21, commentCount: 5 },
            { id: 27, title: "相亲市场的鄙视链是怎样的？", category: "情感", viewCount: 152, likeCount: 35, commentCount: 9 },
            { id: 28, title: "自媒体还能赚钱吗？", category: "创业", viewCount: 125, likeCount: 29, commentCount: 7 },
            { id: 29, title: "为什么年轻人不想生孩子？", category: "社会", viewCount: 183, likeCount: 44, commentCount: 12 },
            { id: 30, title: "保健品行业的水有多深？", category: "健康", viewCount: 110, likeCount: 25, commentCount: 6 },
            { id: 31, title: "游戏真的是精神鸦片吗？", category: "娱乐", viewCount: 192, likeCount: 46, commentCount: 13 },
            { id: 32, title: "北漂沪漂的意义在哪里？", category: "职场", viewCount: 146, likeCount: 33, commentCount: 8 },
            { id: 33, title: "为什么现在的人爱去寺庙？", category: "生活", viewCount: 104, likeCount: 23, commentCount: 6 },
            { id: 34, title: "奶茶为什么这么上瘾？", category: "美食", viewCount: 97, likeCount: 22, commentCount: 5 },
            { id: 35, title: "年轻人为什么爱穿汉服？", category: "时尚", viewCount: 89, likeCount: 19, commentCount: 5 },
            { id: 36, title: "独居青年的生活是怎样的？", category: "生活", viewCount: 138, likeCount: 31, commentCount: 8 },
            { id: 37, title: "为什么现在的人越来越不喜欢社交？", category: "心理", viewCount: 172, likeCount: 41, commentCount: 11 },
            { id: 38, title: "直播电商的未来会怎样？", category: "经济", viewCount: 121, likeCount: 28, commentCount: 7 },
            { id: 39, title: "年轻人为什么爱养猫？", category: "生活", viewCount: 143, likeCount: 32, commentCount: 8 },
            { id: 40, title: "为什么现在的人爱买彩票？", category: "娱乐", viewCount: 107, likeCount: 24, commentCount: 6 },
            { id: 41, title: "职场新人应该先存钱还是先投资？", category: "理财", viewCount: 128, likeCount: 29, commentCount: 7 },
            { id: 42, title: "为什么现在的人越来越喜欢独处？", category: "心理", viewCount: 156, likeCount: 36, commentCount: 9 },
            { id: 43, title: "网红打卡点真的值得去吗？", category: "旅游", viewCount: 112, likeCount: 25, commentCount: 6 },
            { id: 44, title: "年轻人为什么爱喝奶茶？", category: "美食", viewCount: 134, likeCount: 30, commentCount: 8 },
            { id: 45, title: "为什么现在的人爱刷短视频？", category: "娱乐", viewCount: 189, likeCount: 45, commentCount: 12 },
            { id: 46, title: "年轻人为什么爱熬夜？", category: "生活", viewCount: 163, likeCount: 38, commentCount: 10 },
            { id: 47, title: "为什么现在的人爱追星？", category: "娱乐", viewCount: 120, likeCount: 27, commentCount: 7 },
            { id: 48, title: "职场中要不要讨好领导？", category: "职场", viewCount: 147, likeCount: 34, commentCount: 8 },
            { id: 49, title: "为什么现在的人爱用表情包？", category: "社交", viewCount: 102, likeCount: 23, commentCount: 6 },
            { id: 50, title: "年轻人为什么爱薅羊毛？", category: "消费", viewCount: 118, likeCount: 27, commentCount: 7 }
        ];
        
        // 热度公式：浏览*2 + 点赞*5 + 评论*10
        // 评论权重最高，因为代表活跃讨论
        return topics.map(topic => ({
            ...topic,
            heatScore: topic.viewCount * 2 + topic.likeCount * 5 + topic.commentCount * 10
        }));
    },

    // 计算话题热度
    calculateHeat: function(topic) {
        return topic.viewCount * 2 + topic.likeCount * 5 + topic.commentCount * 10;
    },

    // 初始化用户数据
    initCurrentUser: function() {
        return {
            id: 'user_001',
            name: '八卦小达人',
            avatar: '😎',
            tags: ['资深八卦er', '热点追踪者', '吐槽达人'],
            bio: '热爱八卦，生活才有乐趣！',
            score: 0,
            friends: [],
            likedTopics: [],
            collectedTopics: [],
            joinedTopics: []
        };
    },

    // 初始化好友数据
    initFriends: function() {
        return [
            { id: 'friend_001', name: '吃瓜群众甲', avatar: '🤔', tags: ['资深瓜友', '深夜唠嗑'], bio: '没有我不知道的瓜！', status: '在线' },
            { id: 'friend_002', name: '吐槽小能手', avatar: '🤣', tags: ['毒舌', '段子手'], bio: '每天不吐槽浑身难受', status: '在线' },
            { id: 'friend_003', name: '热点雷达', avatar: '📡', tags: ['新闻控', '消息灵通'], bio: '永远第一个知道热点', status: '离线' },
            { id: 'friend_004', name: '深夜树洞', avatar: '🌙', tags: ['倾听者', '暖心'], bio: '你的秘密我来守护', status: '在线' }
        ];
    },

    // 初始化评论数据 - 根据话题ID使用不同的模板
    initComments: function(topicId) {
        const friends = [
            { userId: 'friend_001', userName: '吃瓜群众甲', avatar: '🤔' },
            { userId: 'friend_002', userName: '吐槽小能手', avatar: '🤣' },
            { userId: 'friend_003', userName: '热点雷达', avatar: '📡' },
            { userId: 'friend_004', userName: '深夜树洞', avatar: '🌙' }
        ];
        
        // 检查是否有特定话题的模板
        const templates = AppData.topicCommentTemplates[topicId];
        
        if (templates) {
            return templates.map((template, index) => ({
                id: `c_${topicId}_${index + 1}`,
                ...friends[index % friends.length],
                content: template.content,
                likeCount: Math.floor(Math.random() * 200) + 50,
                dislikeCount: Math.floor(Math.random() * 20) + 1,
                time: template.time
            }));
        }
        
        // 默认评论模板 - 通用内容
        const defaultComments = [
            { content: "这个话题很有意思，值得深入探讨！", time: "2小时前" },
            { content: "我觉得每个人都有不同的看法，理性讨论最重要。", time: "3小时前" },
            { content: "确实是现在社会的热点问题，希望能有更多人关注。", time: "5小时前" }
        ];
        
        return defaultComments.map((comment, index) => ({
            id: `c_${topicId}_${index + 1}`,
            ...friends[index % friends.length],
            content: comment.content,
            likeCount: Math.floor(Math.random() * 150) + 30,
            dislikeCount: Math.floor(Math.random() * 15),
            time: comment.time
        }));
    },

    // 初始化积分排行榜
    initRankings: function() {
        return [
            { rank: 1, userId: 'top_1', name: '八卦之王', avatar: '👑', score: 98765, tags: ['传奇八卦er'] },
            { rank: 2, userId: 'top_2', name: '话题终结者', avatar: '🎯', score: 87654, tags: ['热点猎人'] },
            { rank: 3, userId: 'top_3', name: '资深吐槽帝', avatar: '💬', score: 76543, tags: ['吐槽达人'] },
            { rank: 4, userId: 'top_4', name: '瓜田守望者', avatar: '🍉', score: 65432, tags: ['吃瓜专业户'] },
            { rank: 5, userId: 'top_5', name: '深夜八卦人', avatar: '🌙', score: 54321, tags: ['夜猫子'] },
            { rank: 6, userId: 'top_6', name: '热点挖掘机', avatar: '🚜', score: 43210, tags: ['深度挖掘'] },
            { rank: 7, userId: 'top_7', name: '评论区常客', avatar: '💭', score: 32109, tags: ['活跃用户'] },
            { rank: 8, userId: 'top_8', name: '隐形八卦王', avatar: '🕶️', score: 21098, tags: ['低调大佬'] },
            { rank: 9, userId: 'top_9', name: '萌新八卦er', avatar: '🐣', score: 10987, tags: ['新人'] },
            { rank: 10, userId: 'top_10', name: '路人甲', avatar: '👤', score: 5678, tags: ['路过'] }
        ];
    },

    // 初始化吐槽叠叠乐数据
    initComplaintStacks: function() {
        return {
            totalLayers: 0,
            stacks: [
                { id: 'stack_001', title: '今天又加班到深夜', layers: [
                    { id: 'layer_001', content: '真的无语，老板一句话，全公司都要陪他加班！', userId: 'user_001', userName: '八卦小达人', avatar: '😎' },
                    { id: 'layer_002', content: '加班费一分没有，还美其名曰"年轻人要多奋斗"', userId: 'friend_001', userName: '吃瓜群众甲', avatar: '🤔' },
                    { id: 'layer_003', content: '回家地铁都停了，打车钱还不给报', userId: 'friend_002', userName: '吐槽小能手', avatar: '🤣' }
                ], layerCount: 3 }
            ]
        };
    }
};

// 数据存储工具
const Storage = {
    PREFIX: 'bagua_dawang_',

    get: function(key) {
        const data = localStorage.getItem(this.PREFIX + key);
        return data ? JSON.parse(data) : null;
    },

    set: function(key, value) {
        localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
    },

    remove: function(key) {
        localStorage.removeItem(this.PREFIX + key);
    },

    // 初始化应用数据
    initAppData: function() {
        // 话题数据
        if (!this.get('topics')) {
            this.set('topics', AppData.initTopics());
        }
        
        // 当前用户
        if (!this.get('currentUser')) {
            this.set('currentUser', AppData.initCurrentUser());
        }
        
        // 好友列表
        if (!this.get('friends')) {
            this.set('friends', AppData.initFriends());
        }
        
        // 排行榜
        if (!this.get('rankings')) {
            this.set('rankings', AppData.initRankings());
        }
        
        // 吐槽叠叠乐
        if (!this.get('complaintStacks')) {
            this.set('complaintStacks', AppData.initComplaintStacks());
        }
        
        // 消息数据
        if (!this.get('messages')) {
            this.set('messages', this.initMessages());
        }
        
        // 主题设置
        if (!this.get('theme')) {
            this.set('theme', 'light');
        }
    },

    // 获取话题（按热度排序）
    getTopicsByHeat: function() {
        const topics = this.get('topics') || [];
        return topics.sort((a, b) => b.heatScore - a.heatScore);
    },

    // 获取单个话题
    getTopicById: function(id) {
        const topics = this.get('topics') || [];
        return topics.find(t => t.id === id);
    },

    // 获取话题评论
    getTopicComments: function(topicId) {
        const comments = this.get(`comments_${topicId}`);
        if (!comments) {
            const newComments = AppData.initComments(topicId);
            this.set(`comments_${topicId}`, newComments);
            
            // 同步更新话题的评论数量，确保一致性
            const topics = this.get('topics');
            const topic = topics.find(t => t.id === topicId);
            if (topic) {
                topic.commentCount = newComments.length;
                // 重新计算热度
                topic.heatScore = AppData.calculateHeat(topic);
                this.set('topics', topics);
            }
            
            return newComments;
        }
        return comments;
    },

    // 添加评论
    addComment: function(topicId, comment) {
        const comments = this.getTopicComments(topicId);
        comments.unshift(comment);
        this.set(`comments_${topicId}`, comments);
        
        // 更新话题的评论数和重新计算热度
        const topics = this.get('topics');
        const topic = topics.find(t => t.id === topicId);
        if (topic) {
            topic.commentCount += 1;
            // 重新计算热度：浏览*2 + 点赞*5 + 评论*10
            topic.heatScore = AppData.calculateHeat(topic);
            this.set('topics', topics);
        }
        
        return comments;
    },

    // 点赞/取消点赞评论
    toggleCommentLike: function(topicId, commentId, isLike) {
        const comments = this.getTopicComments(topicId);
        const comment = comments.find(c => c.id === commentId);
        if (comment) {
            if (isLike) {
                comment.likeCount += 1;
            } else {
                comment.dislikeCount += 1;
            }
            this.set(`comments_${topicId}`, comments);
        }
        return comments;
    },

    // 点赞话题
    toggleTopicLike: function(topicId) {
        const currentUser = this.get('currentUser');
        const topics = this.get('topics');
        const topic = topics.find(t => t.id === topicId);
        
        if (topic) {
            const isLiked = currentUser.likedTopics.includes(topicId);
            if (isLiked) {
                // 取消点赞
                currentUser.likedTopics = currentUser.likedTopics.filter(id => id !== topicId);
                topic.likeCount -= 1;
            } else {
                // 点赞
                currentUser.likedTopics.push(topicId);
                topic.likeCount += 1;
            }
            
            // 重新计算热度：浏览*2 + 点赞*5 + 评论*10
            topic.heatScore = AppData.calculateHeat(topic);
            
            this.set('currentUser', currentUser);
            this.set('topics', topics);
        }
        
        return this.get('currentUser');
    },

    // 收藏话题
    toggleTopicCollect: function(topicId) {
        const currentUser = this.get('currentUser');
        const isCollected = currentUser.collectedTopics.includes(topicId);
        
        if (isCollected) {
            currentUser.collectedTopics = currentUser.collectedTopics.filter(id => id !== topicId);
        } else {
            currentUser.collectedTopics.push(topicId);
        }
        
        this.set('currentUser', currentUser);
        return currentUser;
    },

    // 增加积分（浏览话题获得5分）
    addScore: function(points) {
        const currentUser = this.get('currentUser');
        currentUser.score += points;
        this.set('currentUser', currentUser);
        return currentUser;
    },

    // 记录参与的话题
    joinTopic: function(topicId) {
        const currentUser = this.get('currentUser');
        if (!currentUser.joinedTopics.includes(topicId)) {
            currentUser.joinedTopics.push(topicId);
            // 加5分
            currentUser.score += 5;
            this.set('currentUser', currentUser);
        }
        return currentUser;
    },

    // 添加吐槽层
    addComplaintLayer: function(stackId, content) {
        const stacks = this.get('complaintStacks');
        const stack = stacks.stacks.find(s => s.id === stackId);
        
        if (stack) {
            const currentUser = this.get('currentUser');
            const layer = {
                id: `layer_${Date.now()}`,
                content: content,
                userId: currentUser.id,
                userName: currentUser.name,
                avatar: currentUser.avatar
            };
            stack.layers.push(layer);
            stack.layerCount += 1;
            stacks.totalLayers += 1;
            this.set('complaintStacks', stacks);
        }
        
        return stacks;
    },

    // 创建新的吐槽栈
    createComplaintStack: function(title) {
        const stacks = this.get('complaintStacks');
        const currentUser = this.get('currentUser');
        const newStack = {
            id: `stack_${Date.now()}`,
            title: title,
            layers: [],
            layerCount: 0
        };
        stacks.stacks.unshift(newStack);
        this.set('complaintStacks', stacks);
        return newStack;
    },

    // 添加好友
    addFriend: function(friendId) {
        const currentUser = this.get('currentUser');
        const friends = this.get('friends');
        
        if (!currentUser.friends.includes(friendId)) {
            currentUser.friends.push(friendId);
            this.set('currentUser', currentUser);
        }
        
        return currentUser;
    },

    // 获取好友信息
    getFriendInfo: function(friendId) {
        const friends = this.get('friends');
        return friends.find(f => f.id === friendId);
    },

    // 初始化消息数据
    initMessages: function() {
        return {
            // 会话列表：key是会话ID，value是会话信息
            conversations: {
                'conv_friend_001': {
                    id: 'conv_friend_001',
                    targetUserId: 'friend_001',
                    lastMessage: '今晚有空一起吃瓜吗？',
                    lastTime: '刚刚',
                    unreadCount: 2,
                    messages: [
                        { id: 'msg_1', from: 'friend_001', content: '嗨！最近有什么瓜吗？', time: '10:00', type: 'text' },
                        { id: 'msg_2', from: 'user_001', content: '有啊，最近那个明星离婚的事情', time: '10:05', type: 'text' },
                        { id: 'msg_3', from: 'friend_001', content: '真的假的？快说说详细情况！', time: '10:06', type: 'text' },
                        { id: 'msg_4', from: 'user_001', content: '好像是因为财产问题，闹得挺大的', time: '10:10', type: 'text' },
                        { id: 'msg_5', from: 'friend_001', content: '今晚有空一起吃瓜吗？', time: '刚刚', type: 'text' }
                    ]
                },
                'conv_friend_002': {
                    id: 'conv_friend_002',
                    targetUserId: 'friend_002',
                    lastMessage: '哈哈哈笑死我了！',
                    lastTime: '5分钟前',
                    unreadCount: 1,
                    messages: [
                        { id: 'msg_1', from: 'friend_002', content: '今天老板又在画饼了，说年底给我们涨工资', time: '09:00', type: 'text' },
                        { id: 'msg_2', from: 'user_001', content: '画饼不可怕，可怕的是真信了', time: '09:05', type: 'text' },
                        { id: 'msg_3', from: 'friend_002', content: '哈哈哈笑死我了！', time: '5分钟前', type: 'text' }
                    ]
                }
            }
        };
    },

    // 获取会话列表
    getConversations: function() {
        let messages = this.get('messages');
        if (!messages) {
            messages = this.initMessages();
            this.set('messages', messages);
        }
        return messages.conversations;
    },

    // 获取单个会话
    getConversation: function(convId) {
        const messages = this.get('messages') || this.initMessages();
        return messages.conversations[convId] || null;
    },

    // 创建新会话
    createConversation: function(friendId) {
        let messages = this.get('messages');
        if (!messages) {
            messages = this.initMessages();
        }
        
        const convId = `conv_${friendId}`;
        if (!messages.conversations[convId]) {
            const friend = this.getFriendInfo(friendId);
            messages.conversations[convId] = {
                id: convId,
                targetUserId: friendId,
                lastMessage: '',
                lastTime: '',
                unreadCount: 0,
                messages: []
            };
            this.set('messages', messages);
        }
        return messages.conversations[convId];
    },

    // 发送消息
    sendMessage: function(convId, content) {
        let messages = this.get('messages');
        if (!messages) {
            messages = this.initMessages();
        }
        
        const conv = messages.conversations[convId];
        if (!conv) return null;
        
        const currentUser = this.get('currentUser');
        const newMessage = {
            id: `msg_${Date.now()}`,
            from: currentUser.id,
            content: content,
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            type: 'text'
        };
        
        conv.messages.push(newMessage);
        conv.lastMessage = content;
        conv.lastTime = '刚刚';
        
        this.set('messages', messages);
        return { conv, message: newMessage };
    },

    // 模拟好友回复（简单的AI回复）
    simulateFriendReply: function(convId) {
        let messages = this.get('messages');
        if (!messages) return null;
        
        const conv = messages.conversations[convId];
        if (!conv) return null;
        
        const replies = [
            '哈哈，确实！',
            '你说得对！',
            '我也这么觉得！',
            '有意思！',
            '真的吗？继续说！',
            '666',
            '哈哈哈笑死我了',
            '那后来呢？',
            '太八卦了我喜欢',
            '🍉🍉🍉'
        ];
        
        const friend = this.getFriendInfo(conv.targetUserId);
        if (!friend) return null;
        
        setTimeout(() => {
            const reply = {
                id: `msg_${Date.now() + 1}`,
                from: conv.targetUserId,
                content: replies[Math.floor(Math.random() * replies.length)],
                time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                type: 'text'
            };
            
            let msgs = Storage.get('messages');
            if (msgs && msgs.conversations[convId]) {
                msgs.conversations[convId].messages.push(reply);
                msgs.conversations[convId].lastMessage = reply.content;
                msgs.conversations[convId].lastTime = '刚刚';
                Storage.set('messages', msgs);
            }
        }, 1000 + Math.random() * 2000);
        
        return true;
    },

    // 清除会话未读
    clearUnread: function(convId) {
        let messages = this.get('messages');
        if (messages && messages.conversations[convId]) {
            messages.conversations[convId].unreadCount = 0;
            this.set('messages', messages);
        }
    }
};
