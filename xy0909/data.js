const AppData = {
    emotions: [
        {
            id: 'anxiety',
            name: '焦虑',
            icon: '😰',
            color: '#FF9500',
            description: '对未来的担忧和不安',
            relatedKeywords: ['紧张', '担心', '不安', '恐慌', '压力']
        },
        {
            id: 'grievance',
            name: '委屈',
            icon: '😢',
            color: '#FF2D55',
            description: '感到被误解或不公平对待',
            relatedKeywords: ['难过', '心酸', '冤枉', '委屈', '想哭']
        },
        {
            id: 'anger',
            name: '愤怒',
            icon: '😠',
            color: '#FF3B30',
            description: '强烈的不满和怒火',
            relatedKeywords: ['生气', '恼火', '愤怒', '不爽', '气炸']
        },
        {
            id: 'loneliness',
            name: '孤独',
            icon: '😔',
            color: '#5856D6',
            description: '感到孤立无援，缺乏陪伴',
            relatedKeywords: ['孤单', '寂寞', '空虚', '无助', '没人懂']
        },
        {
            id: 'exhaustion',
            name: '疲惫',
            icon: '😴',
            color: '#8E8E93',
            description: '身心俱疲，无力继续',
            relatedKeywords: ['累', '疲惫', '好累', '筋疲力尽', '透支']
        },
        {
            id: 'overthinking',
            name: '内耗',
            icon: '🤯',
            color: '#AF52DE',
            description: '自我纠结，反复思考',
            relatedKeywords: ['纠结', '内耗', '想太多', '矛盾', '犹豫不决']
        },
        {
            id: 'sadness',
            name: '悲伤',
            icon: '😭',
            color: '#007AFF',
            description: '深深的难过和失落',
            relatedKeywords: ['伤心', '难过', '悲伤', '失落', '心痛']
        },
        {
            id: 'frustration',
            name: '挫败',
            icon: '💔',
            color: '#FF6B6B',
            description: '目标未达成的失落感',
            relatedKeywords: ['失败', '挫败', '失望', '没做好', '搞砸了']
        }
    ],

    comfortMessages: {
        low: {
            anxiety: [
                "深呼吸，一切都会慢慢好起来的。",
                "你已经很努力了，给自己一点时间。",
                "焦虑是正常的，它说明你在乎。",
                "把担心的事情写下来，也许就没那么可怕了。",
                "一步一步来，你能处理好的。"
            ],
            grievance: [
                "我理解你的感受，被误解真的很难受。",
                "你的情绪是合理的，不用为此道歉。",
                "有时候说出来会好很多。",
                "你值得被理解和尊重。",
                "委屈不是软弱，它需要被看见。"
            ],
            anger: [
                "愤怒是一种信号，告诉我你在乎什么。",
                "先让自己冷静下来，好吗？",
                "你的感受是真实的，愤怒需要被表达。",
                "试试用语言表达，而不是用行动。",
                "愤怒过后，也许会有新的视角。"
            ],
            loneliness: [
                "即使一个人，你也不是孤单的。",
                "孤独感会过去的，现在先抱抱自己。",
                "你值得被陪伴和理解。",
                "有时候独处也是一种力量。",
                "慢慢会好的，你并不孤单。"
            ],
            exhaustion: [
                "累了就休息，这不是偷懒。",
                "你已经做得够多了，现在照顾好自己。",
                "身体需要休息，心灵也一样。",
                "好好睡一觉，明天会好一些。",
                "允许自己停下来，这很重要。"
            ],
            overthinking: [
                "想太多只会消耗你，试试专注当下。",
                "有些事情想不明白就先放一放。",
                "你的价值不在于完美的决策。",
                "试着接受不确定性，这也是生活的一部分。",
                "行动比完美的想法更重要。"
            ],
            sadness: [
                "难过的时候，允许自己哭出来。",
                "悲伤需要被看见，被接纳。",
                "时间会治愈，但现在先照顾好自己。",
                "你值得被温柔对待，包括自己。",
                "悲伤不是软弱，它是爱的证明。"
            ],
            frustration: [
                "失败不代表你不行，只是这次没成功。",
                "每个人都会遇到挫折，你不是一个人。",
                "从挫败中学习，下次会更好。",
                "你的价值不在于一次的成败。",
                "再试一次，或者换个方向试试。"
            ]
        },
        high: {
            anxiety: [
                "焦虑感很强，让我们先停下来。",
                "现在最需要的是让自己平静下来。",
                "先处理情绪，再处理事情。",
                "你现在需要的是安全和稳定。",
                "深呼吸，和我一起慢下来。"
            ],
            grievance: [
                "我感受到你深深的委屈，这太不容易了。",
                "你承受了太多，需要被好好看见。",
                "允许自己表达这份委屈，它值得被听见。",
                "你不需要一个人扛着这一切。",
                "我在这里，愿意倾听你的一切。"
            ],
            anger: [
                "愤怒在燃烧，先让它安全地释放。",
                "你现在很生气，这是可以理解的。",
                "找到一个安全的方式表达这份愤怒。",
                "愤怒之下，也许还有其他情绪。",
                "先照顾好自己，其他的以后再说。"
            ],
            loneliness: [
                "这份孤独感很深，你一定很辛苦。",
                "即使感觉没人懂，你也要好好照顾自己。",
                "孤独是暂时的，你值得被连接。",
                "现在先做一件让自己感到温暖的事。",
                "你并不孤单，即使感觉如此。"
            ],
            exhaustion: [
                "你已经到极限了，必须停下来休息。",
                "现在什么都不要想，先照顾好身体。",
                "疲惫是身体在求救，请认真对待。",
                "你需要的是彻底的休息，不是勉强坚持。",
                "给自己放个假，哪怕只有今天。"
            ],
            overthinking: [
                "内耗正在消耗你，必须停下来。",
                "你的大脑需要休息，停止思考循环。",
                "试试转移注意力，做一些不用动脑的事。",
                "你现在需要的是行动，不是思考。",
                "接受不完美，让自己从思考中解放。"
            ],
            sadness: [
                "这份悲伤很重，你需要好好释放。",
                "允许自己沉浸在悲伤中，这是疗愈的一部分。",
                "你不需要强迫自己\"好起来\"。",
                "悲伤需要时间，给它空间。",
                "我在这里陪伴你度过这段时光。"
            ],
            frustration: [
                "挫败感很强烈，这真的很难受。",
                "你努力了，但结果不如预期，这太让人难过了。",
                "允许自己感受这份挫败，然后慢慢放下。",
                "失败不定义你，你已经尽力了。",
                "给自己时间恢复，然后再考虑下一步。"
            ]
        }
    },

    breathingGuide: {
        phases: [
            { text: "吸气", duration: 4000, instruction: "慢慢吸气，数到4" },
            { text: "屏气", duration: 7000, instruction: "保持呼吸，数到7" },
            { text: "呼气", duration: 8000, instruction: "缓慢呼气，数到8" }
        ],
        cycles: 3,
        introMessage: "4-7-8呼吸法是一种有效的放松技巧。我们将进行3轮练习。",
        outroMessage: "做得很好！感觉怎么样？"
    },

    psychologicalHints: [
        "把烦恼写下来然后粉碎，是一种仪式化的心理暗示。它告诉潜意识：这些情绪已经被处理了。",
        "研究表明，表达性写作可以显著降低焦虑和抑郁水平。你已经迈出了重要的一步。",
        "情绪没有对错，它们只是信号。允许自己感受，然后让它们过去。",
        "粉碎这个动作象征着：我选择不再被这些想法困扰。这是一种赋权的行为。",
        "真正的治愈不是忘记，而是学会和情绪共处。你正在学习这一点。"
    ],

    quickReplies: [
        "谢谢你的倾听",
        "感觉好多了",
        "我只是需要说出来",
        "你说得对",
        "我会试试看",
        "其实也没那么糟"
    ],

    emotionBasedResponses: {
        anxiety: {
            acknowledge: [
                "焦虑是很常见的感受，很多人都会经历。",
                "我理解那种忐忑不安的感觉。",
                "对未来的担忧是正常的，但不要让它控制你。"
            ],
            support: [
                "试着把注意力集中在当下，而不是未来。",
                "深呼吸可以帮助你缓解焦虑。",
                "你已经做得很好了，焦虑并不代表软弱。"
            ],
            curious: [
                "这种焦虑感通常在什么情况下会出现？",
                "你觉得是什么触发了这次焦虑？",
                "这种感受持续多久了？"
            ]
        },
        grievance: {
            acknowledge: [
                "被误解或不公平对待的感觉真的很难受。",
                "我理解那种有苦说不出的委屈。",
                "你的情绪值得被看见和尊重。"
            ],
            support: [
                "表达出来是对的，不要把委屈都藏在心里。",
                "你不需要为自己的情绪道歉。",
                "被理解是每个人的基本需求。"
            ],
            curious: [
                "能告诉我发生了什么吗？",
                "这种感觉你藏在心里多久了？",
                "之前有和其他人说过这件事吗？"
            ]
        },
        anger: {
            acknowledge: [
                "愤怒是一种强烈的信号，它说明你在乎某些事。",
                "我理解那种怒火中烧的感觉。",
                "愤怒本身不是问题，如何表达才是关键。"
            ],
            support: [
                "找到一个安全的方式表达这份愤怒很重要。",
                "愤怒之下，可能还有其他情绪需要被看见。",
                "让自己冷静下来不是压抑，而是保护自己。"
            ],
            curious: [
                "是什么让你这么生气？",
                "这种情况经常发生吗？",
                "你平时如何处理愤怒的情绪？"
            ]
        },
        loneliness: {
            acknowledge: [
                "孤独的感觉真的很难熬。",
                "即使在人群中，也可能感到孤独。",
                "我在这里，你不是真正的一个人。"
            ],
            support: [
                "孤独感会过去的，你值得被陪伴。",
                "有时候独处也是一种力量，但要区分孤独和独处。",
                "慢慢会好的，先从接纳这份感受开始。"
            ],
            curious: [
                "这种孤独感是什么时候开始的？",
                "有没有什么事情让你感觉特别孤单？",
                "你平时喜欢做什么来打发时间？"
            ]
        },
        exhaustion: {
            acknowledge: [
                "身心俱疲的感觉真的很难受。",
                "我理解那种连说话都累的疲惫。",
                "疲惫是身体在发出信号。"
            ],
            support: [
                "休息不是偷懒，而是必要的。",
                "你已经做得够多了，现在需要照顾自己。",
                "允许自己停下来，这很重要。"
            ],
            curious: [
                "这种疲惫持续多久了？",
                "是什么让你这么累？",
                "最近有好好休息过吗？"
            ]
        },
        overthinking: {
            acknowledge: [
                "内耗真的很消耗人，我理解那种脑子停不下来的感觉。",
                "反复思考不是你的错，但它会消耗你的能量。",
                "想太多往往不是因为事情复杂，而是因为太在乎。"
            ],
            support: [
                "有时候行动比完美的想法更重要。",
                "接受不确定性也是一种能力。",
                "试着把注意力从思考转移到感受上。"
            ],
            curious: [
                "你通常在什么情况下会陷入内耗？",
                "这些反复的想法通常围绕什么主题？",
                "你觉得是什么让你停不下来？"
            ]
        },
        sadness: {
            acknowledge: [
                "悲伤是很沉重的感受，我理解。",
                "难过的时候，允许自己哭出来。",
                "悲伤需要时间，也需要空间。"
            ],
            support: [
                "悲伤不是软弱，它是爱的证明。",
                "你不需要强迫自己\"好起来\"。",
                "让情绪自然流动，这是疗愈的一部分。"
            ],
            curious: [
                "是什么让你这么难过？",
                "这种感觉持续多久了？",
                "你想和我多聊聊吗？"
            ]
        },
        frustration: {
            acknowledge: [
                "挫败的感觉真的很难受，努力了但没得到预期的结果。",
                "我理解那种不甘心的感觉。",
                "失败不代表你不行，只是这次没成功而已。"
            ],
            support: [
                "每个人都会遇到挫折，你不是一个人。",
                "从挫败中学习，下次会更好。",
                "你的价值不在于一次的成败。"
            ],
            curious: [
                "能告诉我发生了什么吗？",
                "这种挫败感对你影响大吗？",
                "你觉得下次可以有什么不同的做法？"
            ]
        }
    },

    contextBasedResponses: {
        work: [
            "工作压力真的很大，现在的职场环境确实不容易。",
            "职场中遇到困难是很常见的，你不是一个人在面对。",
            "有时候把工作和生活分开一点，可能会轻松一些。"
        ],
        relationship: [
            "人际关系确实很复杂，需要双方的努力。",
            "在关系中感到困惑是很正常的，沟通很重要。",
            "有时候适当的距离反而能让关系更健康。"
        ],
        family: [
            "家庭问题往往最让人纠结，因为掺杂了太多情感。",
            "和家人相处确实需要智慧和耐心。",
            "有时候改变自己比改变别人更容易。"
        ],
        study: [
            "学习压力真的很大，尤其是现在竞争这么激烈。",
            "找到适合自己的学习方法很重要。",
            "有时候休息一下，效率反而更高。"
        ],
        health: [
            "健康问题确实让人担忧，这是很正常的反应。",
            "身心是相连的，情绪也会影响身体状态。",
            "照顾好自己的身体，也是对自己负责。"
        ],
        money: [
            "经济压力确实让人焦虑，这是很实际的问题。",
            "钱的问题往往让人感到无力，但慢慢来总会好的。",
            "有时候和信任的人聊聊，可能会有新的想法。"
        ],
        future: [
            "对未来感到迷茫是很正常的，很多人都有这种感受。",
            "未来的不确定性既让人焦虑，也充满可能性。",
            "有时候不用想太远，先走好眼前的每一步。"
        ],
        self: [
            "自我认同确实是一个很深的话题，需要时间去探索。",
            "接受不完美的自己，也是一种成长。",
            "你比自己想象的要更强大。"
        ]
    },

    keywordCategories: {
        work: ['工作', '老板', '同事', '加班', '项目', '业绩', '公司', '职场', '辞职', '面试', '上班'],
        relationship: ['朋友', '恋人', '分手', '吵架', '误会', '爱情', '婚姻', '感情', '相处', '闺蜜', '对象'],
        family: ['家人', '父母', '爸妈', '孩子', '老公', '老婆', '亲戚', '家庭', '结婚', '婆媳'],
        study: ['学习', '考试', '作业', '论文', '考研', '留学', '成绩', '上课', '毕业', '学校'],
        health: ['身体', '生病', '医院', '健康', '失眠', '压力', '焦虑', '抑郁', '吃药', '看病'],
        money: ['钱', '工资', '房贷', '房租', '债务', '借钱', '穷', '没钱', '收入', '存款'],
        future: ['未来', '前途', '迷茫', '方向', '目标', '梦想', '人生', '意义', '选择', '决定'],
        self: ['自己', '我', '自卑', '自信', '价值', '能力', '没用', '优秀', '认可', '认同']
    },

    simulatedResponses: {
        general: [
            "我在听，请继续说。",
            "听起来你经历了很多。",
            "我理解你的感受。",
            "谢谢你愿意和我分享。",
            "那一定很难受。",
            "你现在感觉怎么样？",
            "我在这里陪伴你。",
            "慢慢说，不用急。",
            "能多说一点吗？",
            "我想了解更多。"
        ],
        supportive: [
            "你做得很好，能够表达出来需要勇气。",
            "我觉得你很坚强，能够面对这些情绪。",
            "你的感受是完全合理的。",
            "我欣赏你的坦诚。",
            "你不是一个人，很多人都有类似的经历。",
            "你已经很努力了。",
            "慢慢来，一切都会好的。",
            "你值得被理解和关心。"
        ],
        curious: [
            "能再多说一点吗？",
            "那是什么时候开始的？",
            "你觉得是什么让你有这种感觉？",
            "这种情况经常发生吗？",
            "你希望得到什么帮助吗？",
            "之前有过类似的感受吗？",
            "你觉得怎样才能让你感觉好一点？",
            "这种感受对你的生活影响大吗？"
        ],
        reflective: [
            "听起来你真的很不容易。",
            "我能感受到你内心的挣扎。",
            "这种感受一定让你很煎熬。",
            "你愿意说出来，这本身就是一种勇气。",
            "我在这里，你可以放心地说。"
        ]
    },

    partnerNames: [
        "星空下的旅人", "海边的贝壳", "城市夜归人", "森林中的鹿",
        "温暖的茶", "雨后的阳光", "安静的书桌", "街角的咖啡",
        "风中的蒲公英", "月光下的猫", "清晨的露珠", "山间的溪流"
    ],

    intensityDescriptions: {
        1: "非常轻微，几乎感觉不到",
        2: "很轻微，可以忽略",
        3: "轻微，但能感觉到",
        4: "有些明显",
        5: "中等程度",
        6: "比较明显，开始影响心情",
        7: "明显，需要关注",
        8: "强烈，影响日常生活",
        9: "非常强烈，难以忍受",
        10: "极度强烈，需要立即关注"
    },

    intensityHints: {
        low: [
            "情绪强度较低，适合通过倾诉或自我反思来处理。",
            "这是一个轻度的情绪波动，你有能力应对。",
            "轻微的情绪困扰，简单的放松可能就有帮助。",
            "情绪强度不高，正是练习情绪觉察的好时机。"
        ],
        high: [
            "情绪强度较高，建议先进行情绪调节再继续。",
            "强烈的情绪需要被认真对待，先照顾好自己。",
            "情绪波动较大，深呼吸可能会有帮助。",
            "高强度的情绪信号，停下来关注自己的感受。"
        ]
    }
};

class SessionManager {
    constructor() {
        this.storageKey = 'emotion_bin_sessions';
        this.maxSessions = 20;
    }

    createSession(data) {
        const session = {
            id: this.generateId(),
            createdAt: new Date().toISOString(),
            emotion: data.emotion,
            emotionId: data.emotionId,
            intensity: data.intensity,
            mode: data.mode,
            content: data.content.substring(0, 100),
            duration: data.duration || 0,
            messageCount: data.messageCount || 0,
            rating: data.rating || null
        };
        
        this.saveSession(session);
        return session;
    }

    saveSession(session) {
        let sessions = this.getSessions();
        sessions.unshift(session);
        
        if (sessions.length > this.maxSessions) {
            sessions = sessions.slice(0, this.maxSessions);
        }
        
        localStorage.setItem(this.storageKey, JSON.stringify(sessions));
    }

    getSessions() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    getLastSession() {
        const sessions = this.getSessions();
        return sessions.length > 0 ? sessions[0] : null;
    }

    clearSessions() {
        localStorage.removeItem(this.storageKey);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    updateSession(id, updates) {
        const sessions = this.getSessions();
        const index = sessions.findIndex(s => s.id === id);
        if (index !== -1) {
            sessions[index] = { ...sessions[index], ...updates };
            localStorage.setItem(this.storageKey, JSON.stringify(sessions));
            return sessions[index];
        }
        return null;
    }
}

class ChatSimulator {
    constructor() {
        this.responseDelay = { min: 800, max: 2000 };
        this.typingDelay = { min: 400, max: 1000 };
        this.currentEmotionId = null;
        this.originalContent = '';
        this.conversationStage = 0;
    }

    setEmotion(emotionId) {
        this.currentEmotionId = emotionId;
    }

    setOriginalContent(content) {
        this.originalContent = content || '';
    }

    async simulateResponse(userMessage, conversationHistory) {
        await this.delay(this.getRandomDelay(this.typingDelay));
        
        const response = this.generateResponse(userMessage, conversationHistory);
        
        await this.delay(this.getRandomDelay(this.responseDelay));
        
        return response;
    }

    generateResponse(userMessage, history) {
        const messageLower = userMessage.toLowerCase();

        if (this.isThankYou(messageLower)) {
            return this.getThankYouResponse();
        }

        if (this.isGreeting(messageLower)) {
            return this.getGreetingResponse();
        }

        if (this.isAgreement(messageLower)) {
            return this.getAgreementResponse();
        }

        const contextCategory = this.detectContextCategory(userMessage) || 
                               this.detectContextCategory(this.originalContent);

        const emotionResponses = this.getEmotionBasedResponses();
        const userTurns = this.countUserTurns(history);

        if (userTurns === 0) {
            return this.getFirstResponse(userMessage, contextCategory, emotionResponses);
        } else if (userTurns <= 2) {
            return this.getEarlyResponse(userMessage, contextCategory, emotionResponses);
        } else if (userTurns <= 4) {
            return this.getMiddleResponse(userMessage, contextCategory, emotionResponses);
        } else {
            return this.getLateResponse(userMessage, contextCategory, emotionResponses);
        }
    }

    getFirstResponse(userMessage, contextCategory, emotionResponses) {
        const responses = [];

        if (emotionResponses && emotionResponses.acknowledge) {
            responses.push(...emotionResponses.acknowledge);
        }

        if (contextCategory && AppData.contextBasedResponses[contextCategory]) {
            responses.push(...AppData.contextBasedResponses[contextCategory]);
        }

        if (responses.length === 0) {
            return "我在听，请继续说。";
        }

        const baseResponse = this.randomFrom(responses);
        return baseResponse + " 愿意告诉我更多吗？";
    }

    getEarlyResponse(userMessage, contextCategory, emotionResponses) {
        const hasNegative = this.containsNegativeWords(userMessage);
        
        if (hasNegative && emotionResponses && emotionResponses.support) {
            return this.randomFrom(emotionResponses.support);
        }

        if (this.isQuestion(userMessage)) {
            if (emotionResponses && emotionResponses.curious) {
                return this.randomFrom(emotionResponses.curious);
            }
            return this.randomFrom(AppData.simulatedResponses.curious);
        }

        const responses = [];
        if (emotionResponses && emotionResponses.acknowledge) {
            responses.push(...emotionResponses.acknowledge);
        }
        if (emotionResponses && emotionResponses.support) {
            responses.push(...emotionResponses.support);
        }

        if (contextCategory && AppData.contextBasedResponses[contextCategory]) {
            responses.push(...AppData.contextBasedResponses[contextCategory]);
        }

        if (responses.length === 0) {
            return this.randomFrom(AppData.simulatedResponses.general);
        }

        return this.randomFrom(responses);
    }

    getMiddleResponse(userMessage, contextCategory, emotionResponses) {
        if (this.isQuestion(userMessage)) {
            if (emotionResponses && emotionResponses.curious) {
                return this.randomFrom(emotionResponses.curious);
            }
            return this.randomFrom(AppData.simulatedResponses.curious);
        }

        const rand = Math.random();
        const responses = [];

        if (emotionResponses) {
            if (rand < 0.4 && emotionResponses.support) {
                return this.randomFrom(emotionResponses.support);
            }
            if (rand < 0.7 && emotionResponses.acknowledge) {
                return this.randomFrom(emotionResponses.acknowledge);
            }
            if (emotionResponses.curious) {
                return this.randomFrom(emotionResponses.curious);
            }
        }

        if (contextCategory && AppData.contextBasedResponses[contextCategory]) {
            return this.randomFrom(AppData.contextBasedResponses[contextCategory]);
        }

        return this.randomFrom(AppData.simulatedResponses.general);
    }

    getLateResponse(userMessage, contextCategory, emotionResponses) {
        const rand = Math.random();

        if (rand < 0.3) {
            return this.randomFrom(AppData.simulatedResponses.reflective);
        }

        if (rand < 0.5 && emotionResponses && emotionResponses.support) {
            return this.randomFrom(emotionResponses.support);
        }

        if (rand < 0.7) {
            return this.randomFrom(AppData.simulatedResponses.supportive);
        }

        return this.randomFrom(AppData.simulatedResponses.general);
    }

    countUserTurns(history) {
        return history.filter(msg => msg.sender === 'user').length;
    }

    containsNegativeWords(text) {
        const negativeKeywords = [
            '哭', '难过', '伤心', '痛苦', '难受', '委屈', '焦虑', 
            '愤怒', '生气', '累', '疲惫', '孤独', '寂寞', '郁闷', 
            '烦躁', '失望', '绝望', '恐惧', '害怕', '担心', '压力',
            '失败', '糟糕', '不好', '不幸', '悲哀', '悲伤', '忧伤'
        ];
        return negativeKeywords.some(keyword => text.includes(keyword));
    }

    isThankYou(text) {
        const thankKeywords = ['谢谢', '感谢', '谢了', '多谢'];
        return thankKeywords.some(keyword => text.includes(keyword));
    }

    isGreeting(text) {
        const greetKeywords = ['你好', '嗨', '哈喽', 'hi', 'hello', '在吗'];
        return greetKeywords.some(keyword => text.toLowerCase().includes(keyword));
    }

    isAgreement(text) {
        const agreeKeywords = ['对', '是的', '没错', '嗯', '哦', '好', '同意', '就是'];
        return agreeKeywords.some(keyword => text.includes(keyword)) && text.length < 10;
    }

    isQuestion(text) {
        return text.includes('?') || text.includes('？');
    }

    getThankYouResponse() {
        const responses = [
            "不客气，能陪伴你我也很开心。",
            "谢谢你愿意和我分享。",
            "希望你感觉好一些了。",
            "能帮到你我也很高兴。",
            "随时可以再来倾诉。"
        ];
        return this.randomFrom(responses);
    }

    getGreetingResponse() {
        const emotionId = this.currentEmotionId;
        if (!emotionId) {
            return "你好，我在听。你想聊聊什么？";
        }

        const emotion = AppData.emotions.find(e => e.id === emotionId);
        if (!emotion) {
            return "你好，我在听。请告诉我你的感受。";
        }

        return `我理解${emotion.name}的感觉一定不好受。愿意和我说说发生了什么吗？`;
    }

    getAgreementResponse() {
        const responses = [
            "嗯，我理解。",
            "我也是这么觉得的。",
            "对，继续说。",
            "我在听，请继续。",
            "没错，然后呢？"
        ];
        return this.randomFrom(responses);
    }

    getOpeningByEmotion() {
        const emotionId = this.currentEmotionId;
        if (!emotionId) {
            return this.randomFrom([
                "你好，我在听。你想聊聊什么？",
                "欢迎来到树洞。有什么想分享的吗？",
                "我在这里陪伴你。愿意告诉我发生了什么吗？"
            ]);
        }

        const emotion = AppData.emotions.find(e => e.id === emotionId);
        if (!emotion) {
            return "你好，我在听。请告诉我你的感受。";
        }

        const emotionResponses = AppData.emotionBasedResponses[emotionId];
        if (emotionResponses && emotionResponses.acknowledge) {
            return this.randomFrom(emotionResponses.acknowledge) + " 愿意告诉我更多吗？";
        }

        return `我理解${emotion.name}的感觉一定不好受。愿意和我说说吗？`;
    }

    detectContextCategory(text) {
        if (!text || text.trim() === '') return null;

        const categories = Object.keys(AppData.keywordCategories);
        const matchCounts = {};

        for (const category of categories) {
            const keywords = AppData.keywordCategories[category];
            let count = 0;
            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    count++;
                }
            }
            if (count > 0) {
                matchCounts[category] = count;
            }
        }

        const matchedCategories = Object.keys(matchCounts);
        if (matchedCategories.length === 0) return null;

        matchedCategories.sort((a, b) => matchCounts[b] - matchCounts[a]);
        return matchedCategories[0];
    }

    getEmotionBasedResponses() {
        const emotionId = this.currentEmotionId;
        if (!emotionId) return null;
        return AppData.emotionBasedResponses[emotionId];
    }

    getRandomDelay(range) {
        return range.min + Math.random() * (range.max - range.min);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    randomFrom(arr) {
        if (!arr || arr.length === 0) return "我在听，请继续说。";
        return arr[Math.floor(Math.random() * arr.length)];
    }
}

class MatchingSimulator {
    constructor() {
        this.matchTimeRange = { min: 3000, max: 8000 };
        this.successRate = 0.9;
    }

    async startMatching(onProgress) {
        const matchTime = this.matchTimeRange.min + 
            Math.random() * (this.matchTimeRange.max - this.matchTimeRange.min);
        
        const steps = 5;
        const stepTime = matchTime / steps;
        
        for (let i = 1; i <= steps; i++) {
            await this.delay(stepTime);
            if (onProgress) {
                onProgress(i, steps);
            }
        }

        if (Math.random() < this.successRate) {
            return {
                success: true,
                partner: this.generatePartner()
            };
        } else {
            return {
                success: false,
                reason: "暂时没有找到匹配的倾听者，请稍后再试"
            };
        }
    }

    generatePartner() {
        const name = this.randomFrom(AppData.partnerNames);
        const initial = name.charAt(0);
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
        const color = this.randomFrom(colors);
        
        return {
            name,
            initial,
            color,
            id: this.generateId()
        };
    }

    generateId() {
        return 'partner_' + Date.now().toString(36);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    randomFrom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}

class EmotionFeedbackGenerator {
    getComfortMessage(emotionId, intensity) {
        const isHigh = intensity >= 6;
        const level = isHigh ? 'high' : 'low';
        
        const messages = AppData.comfortMessages[level][emotionId] || 
                        AppData.comfortMessages[level].anxiety;
        
        return this.randomFrom(messages);
    }

    getFeedbackType(intensity) {
        return intensity >= 6 ? 'high' : 'low';
    }

    getFeedbackTitle(intensity) {
        return intensity >= 6 ? '情绪调节建议' : '暖心安慰';
    }

    getIntensityHint(intensity) {
        const isHigh = intensity >= 6;
        const hints = isHigh ? AppData.intensityHints.high : AppData.intensityHints.low;
        return this.randomFrom(hints);
    }

    getPsychologicalHint() {
        return this.randomFrom(AppData.psychologicalHints);
    }

    randomFrom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}
