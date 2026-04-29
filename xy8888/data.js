const gameData = {
    chapters: [
        {
            id: 1,
            name: "电话诈骗",
            icon: "📞",
            description: "识破冒充公检法、医保社保等电话诈骗",
            completed: false,
            levels: [
                {
                    id: 1,
                    icon: "👮",
                    scenario: "您接到一个自称是公安局的电话，对方说您涉嫌洗钱案件，要求您把钱转到'安全账户'进行核查。",
                    options: [
                        {
                            id: 1,
                            text: "按要求转账到安全账户",
                            isCorrect: false,
                            feedback: "这是典型的冒充公检法诈骗！公检法机关不会通过电话办案，更不会要求转账。"
                        },
                        {
                            id: 2,
                            text: "挂断电话，拨打110咨询",
                            isCorrect: true,
                            feedback: "正确！遇到此类情况，应直接挂断并拨打官方电话咨询，不要相信陌生来电。"
                        },
                        {
                            id: 3,
                            text: "先配合'调查'，看看对方说什么",
                            isCorrect: false,
                            feedback: "危险！一旦开始配合，骗子就会一步步引导您转账。遇到公检法电话，直接挂断是最安全的做法。"
                        },
                        {
                            id: 4,
                            text: "按对方要求去ATM机操作",
                            isCorrect: false,
                            feedback: "这是诈骗！骗子会让您在ATM机上操作英文界面，实际是在转账。遇到此类情况，立即挂断电话。"
                        }
                    ],
                    tip: "公检法机关不会通过电话要求转账。遇到'安全账户'、'资金核查'等说法，100%是诈骗。"
                },
                {
                    id: 2,
                    icon: "🏥",
                    scenario: "您接到自称社保局的电话，说您的医保卡被停用，需要提供身份证号和银行卡号来'核实身份'。",
                    options: [
                        {
                            id: 1,
                            text: "提供个人信息配合核实",
                            isCorrect: false,
                            feedback: "危险！社保局不会通过电话索要银行卡和身份证信息，这是典型的诈骗手段。"
                        },
                        {
                            id: 2,
                            text: "挂断电话，去社区社保点咨询",
                            isCorrect: true,
                            feedback: "做得好！涉及社保、医保问题，应亲自到社区或社保局咨询，不要轻信电话。"
                        },
                        {
                            id: 3,
                            text: "告诉对方自己记不住，让对方过会儿再打",
                            isCorrect: false,
                            feedback: "骗子可能会继续纠缠或派同伙上门。最好直接挂断，然后亲自去社保点核实。"
                        },
                        {
                            id: 4,
                            text: "问对方工作证号以核实身份",
                            isCorrect: false,
                            feedback: "骗子会编造各种证件号来欺骗您。不要试图'核实'，直接挂断并亲自去社保点才是正确做法。"
                        }
                    ],
                    tip: "社保、医保部门不会通过电话索要银行卡号、密码等敏感信息。请务必亲自到现场或拨打官方电话确认。"
                },
                {
                    id: 3,
                    icon: "👨‍👩‍👧",
                    scenario: "您接到一个电话，对方哭着说自己是您的子女，在外面出了车祸/被绑架，急需用钱，让您立刻打钱。",
                    options: [
                        {
                            id: 1,
                            text: "立刻打钱救急",
                            isCorrect: false,
                            feedback: "这是'冒充亲友'诈骗！骗子利用您的亲情和慌张心理行骗。请务必冷静核实。"
                        },
                        {
                            id: 2,
                            text: "先挂断，联系子女或其他家人确认",
                            isCorrect: true,
                            feedback: "非常正确！遇到此类情况，一定要冷静，通过子女常用手机号或联系其他家人核实情况。"
                        },
                        {
                            id: 3,
                            text: "在电话里问对方一些私事确认身份",
                            isCorrect: false,
                            feedback: "骗子可能通过各种渠道了解到您家的私事信息。不要在电话里核实，直接拨打子女常用手机号确认。"
                        },
                        {
                            id: 4,
                            text: "让对方让'警察'或'医生'来接电话",
                            isCorrect: false,
                            feedback: "骗子的同伙会扮演各种角色来配合演戏。不要相信，直接挂断并联系您真正的子女。"
                        }
                    ],
                    tip: "遇到'子女出事'的电话，第一反应应该是冷静核实，而不是立即打钱。可以拨打子女常用手机号或联系配偶、其他子女确认。"
                }
            ]
        },
        {
            id: 2,
            name: "保健品骗局",
            icon: "💊",
            description: "警惕虚假宣传、免费讲座等保健品诈骗",
            completed: false,
            levels: [
                {
                    id: 1,
                    icon: "🎉",
                    scenario: "小区门口有人发传单，邀请您参加'免费健康讲座'，到场就送鸡蛋、大米等礼品，讲座上还推销一种'能治高血压、糖尿病'的神奇保健品。",
                    options: [
                        {
                            id: 1,
                            text: "去听讲座，顺便领礼品，合适就买",
                            isCorrect: false,
                            feedback: "这是典型的'礼品诱骗'！骗子先送小礼品获取信任，再夸大保健品功效进行推销。"
                        },
                        {
                            id: 2,
                            text: "不去参加，治病要去正规医院",
                            isCorrect: true,
                            feedback: "明智！正规保健品不能治病，疾病治疗应在医生指导下进行，不要轻信所谓的'神奇功效'。"
                        },
                        {
                            id: 3,
                            text: "只去领礼品，不买东西",
                            isCorrect: false,
                            feedback: "骗子很擅长'洗脑'，很多人一开始只想着领礼品，但听完讲座后就被忽悠着买了。最好的做法是根本不去。"
                        },
                        {
                            id: 4,
                            text: "去听听看他们说什么，增长知识",
                            isCorrect: false,
                            feedback: "这些讲座本质就是销售骗局，所谓的'健康知识'都是被歪曲的。想了解健康知识，应该去正规医院或社区卫生中心。"
                        }
                    ],
                    tip: "保健品不是药品，不能替代药物治疗疾病。凡是宣称能治病的保健品，都是虚假宣传。"
                },
                {
                    id: 2,
                    icon: "👨‍⚕️",
                    scenario: "有人自称'老中医'、'专家'上门拜访，说您有'潜伏的严重疾病'，需要购买他们的'独家秘方'才能治好，否则后果很严重。",
                    options: [
                        {
                            id: 1,
                            text: "相信专家，购买秘方",
                            isCorrect: false,
                            feedback: "这是'冒充专家'诈骗！真正的医生不会上门推销药品，更不会用'后果严重'来恐吓您买药。"
                        },
                        {
                            id: 2,
                            text: "请他离开，去医院做正规检查",
                            isCorrect: true,
                            feedback: "做得对！身体不适应该去正规医院检查，不要相信所谓的'老中医'、'专家'上门推销。"
                        },
                        {
                            id: 3,
                            text: "让他先诊断一下，看看说得对不对",
                            isCorrect: false,
                            feedback: "骗子通过观察您的外表就能说出一些老年人常见的症状，让您觉得'很准'。不要相信，直接请他离开。"
                        },
                        {
                            id: 4,
                            text: "先少买一点试试效果",
                            isCorrect: false,
                            feedback: "一旦您买了第一次，骗子就会继续推销更多产品。所谓的'独家秘方'往往是廉价的普通食品或无效药物。"
                        }
                    ],
                    tip: "正规医生不会上门推销药品或保健品。遇到陌生人上门'看病'，请直接拒绝并提醒邻居注意。"
                },
                {
                    id: 3,
                    icon: "💰",
                    scenario: "您在公园认识的'朋友'向您推荐一款'投资保健品'，说投入一定金额，不仅能免费吃保健品，还能获得高额利息回报。",
                    options: [
                        {
                            id: 1,
                            text: "跟着朋友一起投资",
                            isCorrect: false,
                            feedback: "这是'保健品+投资'的双重诈骗！骗子先用免费保健品吸引您，再以高额回报为诱饵骗取您的钱财。"
                        },
                        {
                            id: 2,
                            text: "不投资，保健品消费要理性",
                            isCorrect: true,
                            feedback: "非常明智！凡是承诺'高额回报'的保健品投资，都是诈骗。保健品是用来消费的，不是投资品。"
                        },
                        {
                            id: 3,
                            text: "先投少量钱试试水",
                            isCorrect: false,
                            feedback: "骗子往往会先给您一点'甜头'，让您觉得靠谱，然后怂恿您投入更多。一旦大额投入，就再也拿不回来了。"
                        },
                        {
                            id: 4,
                            text: "让朋友先投，看到收益再跟进",
                            isCorrect: false,
                            feedback: "您的'朋友'很可能是骗子的同伙，或者已经被骗了但还在帮骗子'拉人头'。最好的做法是完全不参与。"
                        }
                    ],
                    tip: "记住：保健品是用来消费的，不是用来投资的。凡是承诺'保本付息'、'高额回报'的保健品项目，100%是诈骗。"
                }
            ]
        },
        {
            id: 3,
            name: "投资骗局",
            icon: "💰",
            description: "识别高收益投资、养老项目等投资陷阱",
            completed: false,
            levels: [
                {
                    id: 1,
                    icon: "📈",
                    scenario: "您在微信群里认识了一个'投资导师'，他向您推荐一款'稳赚不赔'的投资项目，承诺每月有20%的收益，还发了很多别人赚钱的截图。",
                    options: [
                        {
                            id: 1,
                            text: "跟着导师投资，抓住赚钱机会",
                            isCorrect: false,
                            feedback: "这是典型的'投资诈骗'！高收益必然伴随高风险，'稳赚不赔'的投资根本不存在。群里的'赚钱截图'都是伪造的。"
                        },
                        {
                            id: 2,
                            text: "不参与，天上不会掉馅饼",
                            isCorrect: true,
                            feedback: "正确！正规投资不会承诺'稳赚不赔'，更不会有20%这么高的月收益。高收益承诺的背后，一定是诈骗陷阱。"
                        },
                        {
                            id: 3,
                            text: "先投一点试试，赚了再加",
                            isCorrect: false,
                            feedback: "这是骗子的常用套路！先让您小赚几笔建立信任，等您大额投入后就卷款跑路。不要抱有侥幸心理。"
                        },
                        {
                            id: 4,
                            text: "让导师先证明自己的实力",
                            isCorrect: false,
                            feedback: "骗子会伪造各种'证据'来证明自己，但这些都是假的。真正的投资需要通过正规渠道，而不是微信群里的陌生人推荐。"
                        }
                    ],
                    tip: "记住三句话：高收益=高风险，稳赚不赔=诈骗，承诺高额回报=不要相信。投资理财请到正规银行、证券公司办理。"
                },
                {
                    id: 2,
                    icon: "🏠",
                    scenario: "有人向您推荐一个'养老公寓投资项目'，说只要一次性投资20万，以后可以免费住公寓，还能按月领取'分红'。",
                    options: [
                        {
                            id: 1,
                            text: "考虑投资，为养老做准备",
                            isCorrect: false,
                            feedback: "这是'养老诈骗'的一种！骗子利用老年人'养老焦虑'心理，以'养老公寓'、'养老床位'为幌子非法集资，最终血本无归。"
                        },
                        {
                            id: 2,
                            text: "不投资，养老规划要咨询子女或正规机构",
                            isCorrect: true,
                            feedback: "做得好！养老项目投资需谨慎，一定要和子女商量，或咨询正规养老机构，不要轻信陌生人的推荐。"
                        },
                        {
                            id: 3,
                            text: "去项目现场看看再决定",
                            isCorrect: false,
                            feedback: "骗子会带您去看一些已经建好的场所，甚至让您'体验'一下，但这些都是精心安排的骗局。本质还是非法集资。"
                        },
                        {
                            id: 4,
                            text: "问问其他已经投资的人怎么样",
                            isCorrect: false,
                            feedback: "您能联系到的'投资者'很可能是骗子的同伙。即使是真实的投资者，他们也可能和您一样被蒙在鼓里，直到骗子跑路才发现真相。"
                        }
                    ],
                    tip: '以"养老公寓"、"养老床位"、"养老基地"等名义承诺高额回报的投资项目，绝大多数是非法集资骗局。'
                },
                {
                    id: 3,
                    icon: "🎁",
                    scenario: "您接到电话，说您被'幸运抽中'，获得了价值几万元的'养老大礼包'，但需要先交几千元的'个人所得税'或'手续费'才能领取。",
                    options: [
                        {
                            id: 1,
                            text: "交税/手续费领取大礼包",
                            isCorrect: false,
                            feedback: "这是'中奖诈骗'！骗子利用老年人的贪小便宜心理，以'中奖'为幌子，要求先交钱再领奖，交钱后就再也联系不上了。"
                        },
                        {
                            id: 2,
                            text: "不信天上掉馅饼，挂断电话",
                            isCorrect: true,
                            feedback: "非常正确！正规中奖活动不会要求先交钱。凡是要求先交'税费'、'手续费'、'保证金'才能领奖的，都是诈骗。"
                        },
                        {
                            id: 3,
                            text: "让对方把奖品寄过来，到付税费",
                            isCorrect: false,
                            feedback: "骗子不会真的寄奖品。他们会找各种理由让您先转账，比如'必须先交税才能发货'。记住：任何要求先交钱的中奖都是诈骗。"
                        },
                        {
                            id: 4,
                            text: "让对方提供中奖证明再考虑",
                            isCorrect: false,
                            feedback: "骗子会伪造各种'官方证明'、'公证处文件'来欺骗您。不要试图核实，直接挂断电话。真正的中奖不需要您先交钱。"
                        }
                    ],
                    tip: "记住：正规中奖活动不会要求中奖者先交钱。遇到'先交钱再领奖'的情况，请直接挂断电话，这100%是诈骗。"
                }
            ]
        }
    ],

    getChapterById: function(chapterId) {
        return this.chapters.find(chapter => chapter.id === chapterId);
    },

    getLevelById: function(chapterId, levelId) {
        const chapter = this.getChapterById(chapterId);
        if (!chapter) return null;
        return chapter.levels.find(level => level.id === levelId);
    },

    getShuffledOptions: function(chapterId, levelId) {
        const level = this.getLevelById(chapterId, levelId);
        if (!level) return [];
        
        const options = [...level.options];
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        return options;
    },

    getTotalLevels: function() {
        return this.chapters.reduce((total, chapter) => total + chapter.levels.length, 0);
    },

    markChapterCompleted: function(chapterId) {
        const chapter = this.getChapterById(chapterId);
        if (chapter) {
            chapter.completed = true;
        }
    },

    getCompletedChaptersCount: function() {
        return this.chapters.filter(chapter => chapter.completed).length;
    },

    isAllChaptersCompleted: function() {
        return this.chapters.every(chapter => chapter.completed);
    },

    resetGame: function() {
        this.chapters.forEach(chapter => {
            chapter.completed = false;
        });
    }
};
