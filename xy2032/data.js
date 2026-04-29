// 身体小电量 - 数据文件
// 包含所有业务数据和配置

// ==========================================
// 身体部位数据
// ==========================================
const bodyParts = [
    { id: 'head', name: '头部', icon: '🧠', symptoms: ['头痛', '头晕', '偏头痛', '失眠', '记忆力下降', '精神紧张'] },
    { id: 'eye', name: '眼睛', icon: '👁️', symptoms: ['眼疲劳', '干涩', '视力模糊', '眼睛疼痛', '发红发痒', '流泪'] },
    { id: 'ear', name: '耳朵', icon: '👂', symptoms: ['耳鸣', '耳痛', '听力下降', '耳道痒', '耳闷', '流脓'] },
    { id: 'nose', name: '鼻子', icon: '👃', symptoms: ['鼻塞', '流鼻涕', '打喷嚏', '鼻出血', '嗅觉下降', '鼻子痒'] },
    { id: 'throat', name: '喉咙', icon: '🗣️', symptoms: ['喉咙痛', '声音嘶哑', '咳嗽', '有痰', '异物感', '口干'] },
    { id: 'teeth', name: '牙齿', icon: '🦷', symptoms: ['牙痛', '牙龈出血', '牙齿敏感', '口臭', '牙龈肿痛', '牙齿松动'] },
    { id: 'neck', name: '颈椎', icon: '💆', symptoms: ['颈部酸痛', '僵硬', '活动受限', '头晕', '手麻', '肩背放射痛'] },
    { id: 'shoulder', name: '肩膀', icon: '💪', symptoms: ['肩痛', '活动受限', '抬臂困难', '夜间痛', '僵硬', '无力'] },
    { id: 'chest', name: '胸口', icon: '❤️', symptoms: ['胸闷', '胸痛', '心悸', '气短', '心慌', '呼吸不畅'] },
    { id: 'stomach', name: '肠胃', icon: '🫁', symptoms: ['胃痛', '胃胀', '胃酸过多', '消化不良', '腹泻', '便秘'] },
    { id: 'waist', name: '腰部', icon: '🦵', symptoms: ['腰痛', '腰酸', '活动受限', '下肢放射痛', '麻木', '无力'] },
    { id: 'limbs', name: '四肢', icon: '🦶', symptoms: ['关节痛', '肌肉酸痛', '麻木', '肿胀', '无力', '抽筋'] },
    { id: 'skin', name: '皮肤', icon: '🧴', symptoms: ['瘙痒', '红疹', '干燥', '脱皮', '痘痘', '过敏'] },
    { id: 'gynecology', name: '妇科', icon: '👩', symptoms: ['月经不调', '痛经', '白带异常', '小腹疼痛', '腰酸', '乳房胀痛'] },
    { id: 'sleep', name: '睡眠', icon: '😴', symptoms: ['入睡困难', '易醒', '多梦', '早醒', '睡眠浅', '白天嗜睡'] }
];

// ==========================================
// 健康分析数据
// ==========================================
const healthAnalysis = {
    // 根据症状生成分析
    generateAnalysis: function(bodyPart, selectedSymptoms, painLevel, duration, description) {
        const part = bodyParts.find(p => p.id === bodyPart);
        const partName = part ? part.name : '身体';
        
        let analysis = {
            title: `${partName}健康状况分析`,
            content: [],
            severity: '',
            severityClass: '',
            relief: [],
            diet: {
                avoid: [],
                recommend: []
            },
            medical: {
                need: false,
                advice: ''
            },
            battery: 85
        };

        // 基础分析
        analysis.content.push(`根据您选择的症状：${selectedSymptoms.join('、')}，结合疼痛程度和持续时间，我们为您进行以下分析：`);
        
        // 根据不同部位生成特定分析
        switch(bodyPart) {
            case 'head':
                analysis.content.push('头痛是常见症状，可能由多种原因引起，包括：');
                analysis.content.push('• 紧张性头痛：最常见，通常由压力、焦虑或肌肉紧张引起');
                analysis.content.push('• 偏头痛：通常伴随恶心、呕吐或对光敏感');
                analysis.content.push('• 丛集性头痛：剧烈疼痛，通常在一侧眼睛周围');
                analysis.content.push('• 继发性头痛：由其他疾病引起，如感冒、高血压等');
                break;
                
            case 'eye':
                analysis.content.push('眼部不适可能与以下因素有关：');
                analysis.content.push('• 视疲劳：长时间使用电子设备是主要原因');
                analysis.content.push('• 干眼症：泪液分泌不足或蒸发过快');
                analysis.content.push('• 结膜炎：病毒或细菌感染引起的炎症');
                analysis.content.push('• 视力问题：近视、远视或散光未矫正');
                break;
                
            case 'stomach':
                analysis.content.push('肠胃不适通常与以下因素相关：');
                analysis.content.push('• 饮食不当：暴饮暴食、辛辣刺激或不洁食物');
                analysis.content.push('• 胃酸过多：可能导致烧心、反酸');
                analysis.content.push('• 胃肠功能紊乱：压力、焦虑可能影响消化功能');
                analysis.content.push('• 肠道感染：病毒或细菌引起的腹泻、呕吐');
                break;
                
            case 'neck':
            case 'shoulder':
            case 'waist':
            case 'limbs':
                analysis.content.push('肌肉骨骼疼痛通常由以下原因引起：');
                analysis.content.push('• 肌肉劳损：长时间保持同一姿势或过度使用');
                analysis.content.push('• 关节炎：关节软骨磨损引起的炎症');
                analysis.content.push('• 椎间盘问题：颈椎或腰椎间盘突出压迫神经');
                analysis.content.push('• 运动损伤：扭伤、拉伤或骨折');
                break;
                
            case 'sleep':
                analysis.content.push('睡眠问题可能影响身心健康，常见原因包括：');
                analysis.content.push('• 心理因素：压力、焦虑、抑郁是主要原因');
                analysis.content.push('• 环境因素：噪音、光线、温度不适');
                analysis.content.push('• 生活习惯：睡前使用电子设备、咖啡因摄入');
                analysis.content.push('• 健康问题：疼痛、呼吸问题或其他疾病');
                break;
                
            default:
                analysis.content.push('您的症状可能与多种因素有关，建议：');
                analysis.content.push('• 注意观察症状变化');
                analysis.content.push('• 保持良好的生活习惯');
                analysis.content.push('• 如症状持续或加重，请及时就医');
        }

        // 轻重判断
        if (painLevel <= 2 && duration <= 3) {
            analysis.severity = '轻度';
            analysis.severityClass = 'severity-mild';
        } else if (painLevel <= 3 && duration <= 7) {
            analysis.severity = '中度';
            analysis.severityClass = 'severity-moderate';
        } else {
            analysis.severity = '较重';
            analysis.severityClass = 'severity-severe';
            analysis.medical.need = true;
        }
        
        // 使用新的综合电量计算方法（基于本次自查的临时电量）
        analysis.battery = DataManager.calculateCheckupBattery(
            bodyPart, 
            selectedSymptoms, 
            painLevel, 
            duration
        );

        // 居家缓解办法
        analysis.relief = this.generateReliefTips(bodyPart, painLevel);

        // 饮食建议
        analysis.diet = this.generateDietAdvice(bodyPart);

        // 就医建议
        if (analysis.medical.need || painLevel >= 4 || duration >= 14) {
            analysis.medical.need = true;
            analysis.medical.advice = `根据您的症状（疼痛程度${painLevel}级，持续${duration}天），建议您尽快就医检查。以下情况需要特别注意：`;
            analysis.medical.advice += '<ul>';
            analysis.medical.advice += '<li>疼痛持续加重或无法忍受</li>';
            analysis.medical.advice += '<li>伴随发热、呕吐等其他症状</li>';
            analysis.medical.advice += '<li>症状影响日常生活和工作</li>';
            analysis.medical.advice += '<li>自行处理后无改善</li>';
            analysis.medical.advice += '</ul>';
            analysis.medical.advice += '建议您前往正规医院就诊，进行详细检查以明确诊断。';
        } else {
            analysis.medical.advice = '目前您的症状较轻，可以先尝试居家护理观察。如果出现以下情况，建议及时就医：';
            analysis.medical.advice += '<ul>';
            analysis.medical.advice += '<li>症状持续超过7天</li>';
            analysis.medical.advice += '<li>疼痛程度明显加重</li>';
            analysis.medical.advice += '<li>出现新的症状</li>';
            analysis.medical.advice += '<li>发热、恶心等全身症状</li>';
            analysis.medical.advice += '</ul>';
        }

        return analysis;
    },

    // 生成缓解建议
    generateReliefTips: function(bodyPart, painLevel) {
        let tips = [];
        
        // 通用建议
        tips.push('**休息与放松**');
        tips.push('• 保证充足的睡眠，每天7-8小时');
        tips.push('• 避免过度劳累，适当休息');
        tips.push('• 可尝试深呼吸、冥想等放松技巧');
        
        // 特定部位建议
        switch(bodyPart) {
            case 'head':
                tips.push('**头部护理**');
                tips.push('• 在安静、光线柔和的环境中休息');
                tips.push('• 可进行头部按摩，放松头皮肌肉');
                tips.push('• 避免强光、噪音等刺激');
                tips.push('• 保持规律作息，避免熬夜');
                if (painLevel >= 3) {
                    tips.push('• 如疼痛剧烈，可考虑服用止痛药（请遵医嘱）');
                }
                break;
                
            case 'eye':
                tips.push('**眼部护理**');
                tips.push('• 遵循20-20-20原则：每20分钟看20英尺外20秒');
                tips.push('• 使用人工泪液缓解眼干');
                tips.push('• 热敷眼睛，促进血液循环');
                tips.push('• 调整屏幕亮度和对比度，减少眩光');
                tips.push('• 保证充足睡眠，让眼睛充分休息');
                break;
                
            case 'stomach':
                tips.push('**肠胃护理**');
                tips.push('• 暂时避免辛辣、油腻、刺激性食物');
                tips.push('• 少食多餐，避免暴饮暴食');
                tips.push('• 选择易消化的食物，如粥、面条等');
                tips.push('• 保持水分摄入，但避免冰水');
                tips.push('• 注意腹部保暖，避免受凉');
                if (painLevel >= 3) {
                    tips.push('• 如持续呕吐或腹泻，请及时就医');
                }
                break;
                
            case 'neck':
            case 'shoulder':
            case 'waist':
            case 'limbs':
                tips.push('**肌肉骨骼护理**');
                tips.push('• 适当休息，避免剧烈运动');
                tips.push('• 可进行热敷，促进血液循环');
                tips.push('• 尝试温和的拉伸运动，避免强行活动');
                tips.push('• 保持正确姿势，避免长时间低头或久坐');
                tips.push('• 可使用支撑枕或靠垫改善姿势');
                if (painLevel >= 3) {
                    tips.push('• 如疼痛持续或出现麻木，请及时就医检查');
                }
                break;
                
            case 'sleep':
                tips.push('**睡眠改善建议**');
                tips.push('• 建立规律的睡眠时间表，即使周末也要保持');
                tips.push('• 睡前1小时避免使用电子设备');
                tips.push('• 保持卧室安静、黑暗、凉爽');
                tips.push('• 睡前可进行放松活动，如阅读、温水浴');
                tips.push('• 避免下午3点后摄入咖啡因');
                tips.push('• 限制白天小睡时间，不超过30分钟');
                break;
                
            case 'ear':
                tips.push('**耳部护理**');
                tips.push('• 避免用棉签或其他物品掏耳朵，以免损伤耳道');
                tips.push('• 保持耳部干燥，游泳或洗澡后及时擦干');
                tips.push('• 避免长时间暴露在噪音环境中，必要时佩戴耳塞');
                tips.push('• 不要用力擤鼻涕，以免影响中耳');
                tips.push('• 如出现耳鸣或听力下降，及时就医检查');
                if (painLevel >= 3) {
                    tips.push('• 如耳痛剧烈或流脓，请立即就医');
                }
                break;
                
            case 'nose':
                tips.push('**鼻部护理**');
                tips.push('• 用生理盐水洗鼻，保持鼻腔清洁湿润');
                tips.push('• 擤鼻涕时按住一侧鼻孔，轻轻擤另一侧');
                tips.push('• 保持室内空气湿润，可使用加湿器');
                tips.push('• 避免接触过敏原和刺激性气味');
                tips.push('• 多喝水，保持身体水分充足');
                tips.push('• 如鼻塞严重，可尝试蒸汽吸入');
                break;
                
            case 'throat':
                tips.push('**咽喉护理**');
                tips.push('• 多喝温水，保持咽喉湿润');
                tips.push('• 用温盐水漱口，缓解咽喉不适');
                tips.push('• 避免大声喊叫或长时间说话');
                tips.push('• 保持室内空气湿润，避免干燥');
                tips.push('• 避免辛辣、刺激性食物和饮料');
                tips.push('• 可尝试蜂蜜水（1岁以下婴儿禁用）');
                if (painLevel >= 3) {
                    tips.push('• 如吞咽困难或发热，请及时就医');
                }
                break;
                
            case 'teeth':
                tips.push('**牙齿护理**');
                tips.push('• 保持正确的刷牙方式，每天至少刷牙两次');
                tips.push('• 使用牙线清洁牙缝，每天至少一次');
                tips.push('• 用温盐水漱口，缓解牙龈不适');
                tips.push('• 避免过冷、过热、过甜的食物');
                tips.push('• 如牙痛持续，避免用患侧咀嚼');
                tips.push('• 定期进行口腔检查');
                if (painLevel >= 3) {
                    tips.push('• 如牙痛剧烈或肿胀，请立即就医');
                }
                break;
                
            case 'chest':
                tips.push('**胸部不适护理**');
                tips.push('• 立即停止活动，坐下或躺下休息');
                tips.push('• 保持冷静，避免紧张和焦虑');
                tips.push('• 松开紧身衣物，保持呼吸顺畅');
                tips.push('• 如胸闷持续，可尝试缓慢深呼吸');
                tips.push('• 避免饱食、寒冷刺激和情绪激动');
                tips.push('• 记录症状发作的时间和持续时间');
                if (painLevel >= 3) {
                    tips.push('⚠️ 重要：如出现剧烈胸痛、胸闷、呼吸困难、出冷汗等症状，请立即拨打急救电话！');
                }
                break;
                
            case 'skin':
                tips.push('**皮肤护理**');
                tips.push('• 保持皮肤清洁，但避免过度清洗');
                tips.push('• 使用温和的清洁产品，避免刺激性肥皂');
                tips.push('• 保持皮肤湿润，使用适合肤质的保湿产品');
                tips.push('• 避免搔抓皮肤，以免抓破引起感染');
                tips.push('• 穿宽松、透气的棉质衣物');
                tips.push('• 避免接触过敏原和刺激性物质');
                tips.push('• 如瘙痒严重，可尝试冷敷');
                if (painLevel >= 3) {
                    tips.push('• 如皮肤出现红肿、化脓或发热，请及时就医');
                }
                break;
                
            case 'gynecology':
                tips.push('**妇科护理**');
                tips.push('• 保持外阴清洁，每天用温水清洗');
                tips.push('• 穿棉质透气内裤，勤换勤洗');
                tips.push('• 避免使用刺激性洗液和香皂');
                tips.push('• 注意经期卫生，勤换卫生巾');
                tips.push('• 经期避免剧烈运动和性生活');
                tips.push('• 保持良好的生活习惯，避免熬夜和过度劳累');
                tips.push('• 如白带异常或瘙痒持续，及时就医检查');
                if (painLevel >= 3) {
                    tips.push('• 如出现剧烈腹痛或异常出血，请立即就医');
                }
                break;
                
            default:
                tips.push('**一般护理建议**');
                tips.push('• 密切观察症状变化');
                tips.push('• 保持良好的个人卫生');
                tips.push('• 均衡饮食，保证营养摄入');
                tips.push('• 适度运动，增强体质');
        }
        
        return tips;
    },

    // 生成饮食建议
    generateDietAdvice: function(bodyPart) {
        let advice = {
            avoid: [],
            recommend: []
        };

        // 通用忌口
        advice.avoid.push({
            name: '辛辣食物',
            emoji: '🌶️',
            desc: '辣椒、花椒、大蒜等刺激性食物可能加重炎症'
        });
        advice.avoid.push({
            name: '油腻食物',
            emoji: '🍟',
            desc: '油炸食品、肥肉等加重消化负担'
        });
        advice.avoid.push({
            name: '酒精',
            emoji: '🍺',
            desc: '酒精可能影响药物效果，加重肝脏负担'
        });

        // 通用推荐
        advice.recommend.push({
            name: '充足饮水',
            emoji: '💧',
            desc: '每天饮用1500-2000ml温水，促进新陈代谢'
        });
        advice.recommend.push({
            name: '新鲜蔬果',
            emoji: '🥗',
            desc: '富含维生素和纤维素，增强免疫力'
        });

        // 特定部位饮食建议
        switch(bodyPart) {
            case 'head':
                advice.avoid.push({
                    name: '咖啡因',
                    emoji: '☕',
                    desc: '咖啡、浓茶可能加重头痛和失眠'
                });
                advice.avoid.push({
                    name: '腌制食品',
                    emoji: '🥓',
                    desc: '含亚硝酸盐的食物可能诱发偏头痛'
                });
                advice.recommend.push({
                    name: '富含镁的食物',
                    emoji: '🥬',
                    desc: '菠菜、南瓜籽、杏仁等有助于缓解头痛'
                });
                advice.recommend.push({
                    name: 'B族维生素',
                    emoji: '🥚',
                    desc: '全谷物、瘦肉、豆类有助于神经系统健康'
                });
                break;
                
            case 'eye':
                advice.avoid.push({
                    name: '高糖食物',
                    emoji: '🍬',
                    desc: '过多糖分可能影响眼部健康'
                });
                advice.recommend.push({
                    name: '富含维生素A',
                    emoji: '🥕',
                    desc: '胡萝卜、肝脏、蛋黄保护视力'
                });
                advice.recommend.push({
                    name: '叶黄素食物',
                    emoji: '🥬',
                    desc: '菠菜、羽衣甘蓝保护视网膜'
                });
                advice.recommend.push({
                    name: '蓝莓',
                    emoji: '🫐',
                    desc: '富含花青素，改善眼疲劳'
                });
                break;
                
            case 'stomach':
                advice.avoid.push({
                    name: '生冷食物',
                    emoji: '🧊',
                    desc: '冰淇淋、生鱼片刺激胃黏膜'
                });
                advice.avoid.push({
                    name: '咖啡浓茶',
                    emoji: '☕',
                    desc: '刺激胃酸分泌，加重不适'
                });
                advice.avoid.push({
                    name: '碳酸饮料',
                    emoji: '🥤',
                    desc: '产生气体，加重胃胀'
                });
                advice.recommend.push({
                    name: '粥类',
                    emoji: '🍚',
                    desc: '小米粥、南瓜粥易消化，养胃'
                });
                advice.recommend.push({
                    name: '山药',
                    emoji: '🥔',
                    desc: '健脾养胃，保护胃黏膜'
                });
                advice.recommend.push({
                    name: '益生菌',
                    emoji: '🥛',
                    desc: '酸奶、发酵食品调节肠道菌群'
                });
                break;
                
            case 'neck':
            case 'shoulder':
            case 'waist':
            case 'limbs':
                advice.avoid.push({
                    name: '高嘌呤食物',
                    emoji: '🦐',
                    desc: '海鲜、动物内脏可能加重关节痛'
                });
                advice.recommend.push({
                    name: '富含钙的食物',
                    emoji: '🥛',
                    desc: '牛奶、豆制品、虾皮强健骨骼'
                });
                advice.recommend.push({
                    name: '富含维生素D',
                    emoji: '🐟',
                    desc: '鱼类、蛋黄促进钙吸收'
                });
                advice.recommend.push({
                    name: 'Omega-3',
                    emoji: '🐟',
                    desc: '深海鱼、亚麻籽抗炎止痛'
                });
                break;
                
            case 'sleep':
                advice.avoid.push({
                    name: '咖啡因',
                    emoji: '☕',
                    desc: '下午3点后避免咖啡、茶、可乐'
                });
                advice.avoid.push({
                    name: ' heavy晚餐',
                    emoji: '🍖',
                    desc: '睡前2-3小时避免大量进食'
                });
                advice.recommend.push({
                    name: '富含色氨酸',
                    emoji: '🍌',
                    desc: '香蕉、牛奶、坚果帮助入睡'
                });
                advice.recommend.push({
                    name: '甘菊茶',
                    emoji: '🍵',
                    desc: '安神助眠，放松神经'
                });
                advice.recommend.push({
                    name: '杏仁',
                    emoji: '🌰',
                    desc: '含镁和褪黑素，改善睡眠质量'
                });
                break;
                
            case 'gynecology':
                advice.avoid.push({
                    name: '寒凉食物',
                    emoji: '🧊',
                    desc: '冰淇淋、西瓜等加重宫寒'
                });
                advice.avoid.push({
                    name: '辛辣刺激',
                    emoji: '🌶️',
                    desc: '可能加重痛经和炎症'
                });
                advice.recommend.push({
                    name: '红枣',
                    emoji: '🫘',
                    desc: '补血益气，改善气血不足'
                });
                advice.recommend.push({
                    name: '红糖姜茶',
                    emoji: '🍵',
                    desc: '暖宫驱寒，缓解痛经'
                });
                advice.recommend.push({
                    name: '豆制品',
                    emoji: '🫘',
                    desc: '含植物雌激素，调节内分泌'
                });
                break;
        }

        return advice;
    }
};

// ==========================================
// 治愈小语录
// ==========================================
const healingQuotes = [
    "身体是革命的本钱，好好照顾自己哦！",
    "今天也要好好吃饭、好好睡觉、好好爱自己 💖",
    "你的身体正在努力为你工作，请给它一点温柔和关爱",
    "每一次呼吸都是生命的礼物，感恩每一个健康的日子",
    "病痛是身体的信号，倾听它、理解它、善待它",
    "慢慢来，身体的恢复需要时间和耐心",
    "你比想象中更强大，你的身体也在努力康复中 💪",
    "今天的小小不适，是明天健康的提醒",
    "好好休息，是对身体最好的投资",
    "保持好心情，是最好的良药 😊",
    "你的健康是最珍贵的财富，好好珍惜",
    "身体会记得你对它的好，好好爱护自己",
    "每一个健康的日子，都是值得庆祝的",
    "学会与身体对话，它会告诉你需要什么",
    "温柔对待自己，身体会回馈你健康和活力"
];

// ==========================================
// 健康指南数据
// ==========================================
const healthGuides = {
    head: [
        {
            title: '如何缓解紧张性头痛',
            content: '紧张性头痛是最常见的头痛类型，通常由压力、焦虑或长时间保持同一姿势引起。缓解方法包括：1) 找一个安静、光线柔和的环境休息；2) 进行温和的头部按摩，从太阳穴开始，顺时针按摩；3) 热敷颈部和肩部，放松肌肉；4) 练习深呼吸和冥想，缓解压力；5) 保持规律作息，避免熬夜。如果头痛频繁发作，建议咨询医生。'
        },
        {
            title: '改善睡眠质量的小技巧',
            content: '良好的睡眠对头部健康至关重要。建议：1) 建立规律的睡眠时间表，即使周末也要保持；2) 睡前1小时避免使用电子设备，蓝光会抑制褪黑素分泌；3) 保持卧室安静、黑暗、凉爽，使用遮光窗帘；4) 睡前可进行放松活动，如阅读纸质书、温水浴；5) 避免下午3点后摄入咖啡因；6) 如失眠持续，建议咨询专业医生。'
        },
        {
            title: '预防偏头痛的生活方式',
            content: '偏头痛患者可以通过以下方式减少发作：1) 识别并避免触发因素，如某些食物（巧克力、奶酪、红酒）、压力、睡眠不足；2) 保持规律的饮食和睡眠；3) 定期进行有氧运动，如散步、游泳；4) 学会压力管理技巧；5) 记录头痛日记，帮助识别触发因素；6) 在医生指导下使用预防性药物。'
        }
    ],
    eye: [
        {
            title: '保护眼睛的20-20-20法则',
            content: '长时间使用电子设备容易导致眼疲劳。建议遵循20-20-20法则：每使用电子设备20分钟，看20英尺（约6米）外的物体20秒。这样可以让眼睛的睫状肌得到放松，减少眼疲劳。此外，还应注意：1) 保持正确的坐姿，眼睛与屏幕保持50-70厘米距离；2) 调整屏幕亮度，使其与环境光线相适应；3) 定期眨眼，保持眼睛湿润。'
        },
        {
            title: '缓解眼疲劳的实用方法',
            content: '眼疲劳是现代人常见的问题，可以通过以下方法缓解：1) 热敷：用温热的毛巾敷在眼睛上，每次10-15分钟，促进眼部血液循环；2) 眼保健操：定期做眼保健操，按摩眼部周围穴位；3) 人工泪液：如眼睛干涩，可使用不含防腐剂的人工泪液；4) 远眺：每隔一段时间向远处眺望；5) 充足睡眠：保证每天7-8小时睡眠，让眼睛充分休息。'
        },
        {
            title: '对眼睛有益的营养素',
            content: '保护眼睛需要摄入足够的营养素：1) 维生素A：胡萝卜、肝脏、蛋黄、菠菜，维持正常视力；2) 叶黄素和玉米黄质：菠菜、羽衣甘蓝、玉米，保护视网膜；3) 维生素C：橙子、猕猴桃、草莓，抗氧化；4) 维生素E：坚果、种子、植物油，保护细胞；5) Omega-3脂肪酸：深海鱼、亚麻籽，减轻炎症。均衡饮食是保护眼睛的基础。'
        }
    ],
    stomach: [
        {
            title: '养胃的饮食习惯',
            content: '良好的饮食习惯是保护肠胃的关键：1) 定时定量：三餐规律，避免暴饮暴食；2) 细嚼慢咽：充分咀嚼，减轻胃的负担；3) 少食多餐：如消化功能较弱，可改为5-6餐；4) 避免刺激性食物：减少辛辣、油腻、生冷食物；5) 注意食物温度：避免过烫或过冰；6) 饭后不要立即躺下：保持直立30分钟；7) 戒烟限酒：烟酒都会损伤胃黏膜。'
        },
        {
            title: '缓解胃痛的家庭疗法',
            content: '胃痛发作时可以尝试以下方法：1) 休息：找一个舒适的位置休息，避免剧烈运动；2) 热敷：用热水袋或热毛巾敷在胃部，缓解痉挛；3) 喝温水：小口饮用温水，避免冰水或烫水；4) 避免进食：如胃痛剧烈，可暂时禁食1-2小时；5) 放松心情：压力会加重胃痛，尝试深呼吸；6) 如胃痛持续超过24小时或伴随呕吐、黑便，应立即就医。'
        },
        {
            title: '改善消化不良的建议',
            content: '消化不良常见症状包括胃胀、嗳气、食欲不振等。改善方法：1) 调整饮食结构：增加膳食纤维摄入，如全麦、蔬果；2) 避免产气食物：豆类、洋葱、碳酸饮料可能加重胃胀；3) 适度运动：饭后散步促进消化；4) 管理压力：焦虑会影响消化功能；5) 补充益生菌：酸奶或益生菌补充剂调节肠道菌群；6) 如症状持续，建议就医检查是否有幽门螺杆菌感染。'
        }
    ],
    muscle: [
        {
            title: '缓解肌肉酸痛的方法',
            content: '肌肉酸痛通常由运动或长时间保持同一姿势引起。缓解方法：1) 休息：让肌肉得到充分休息；2) 热敷：用热毛巾或热水袋敷在酸痛部位，促进血液循环；3) 轻度拉伸：进行温和的拉伸运动，避免强行伸展；4) 按摩：轻柔按摩酸痛部位，放松肌肉；5) 补充水分：保持充足水分，帮助代谢废物排出；6) 适当活动：完全不动可能加重僵硬，可进行轻度活动。'
        },
        {
            title: '预防颈椎病的日常习惯',
            content: '颈椎病是现代人的常见病，预防很重要：1) 保持正确坐姿：坐直，肩膀放松，眼睛与屏幕平视；2) 定时活动：每小时起身活动5分钟，转动颈部；3) 选择合适枕头：枕头高度以一拳为宜，支撑颈椎自然曲度；4) 避免长时间低头：看手机时举到与眼睛平齐；5) 颈部锻炼：定期进行颈部伸展运动；6) 注意保暖：避免颈部受凉。'
        },
        {
            title: '腰痛的自我护理',
            content: '腰痛是常见问题，多数可通过自我护理缓解：1) 适当休息：但避免长时间卧床，可进行轻度活动；2) 热敷或冷敷：急性疼痛48小时内冷敷，之后热敷；3) 保持正确姿势：站立和坐姿都要保持腰部自然曲线；4) 核心锻炼：加强腹部和背部肌肉，支撑脊柱；5) 控制体重：减轻腰椎负担；6) 如腰痛伴随麻木、无力或大小便问题，应立即就医。'
        }
    ]
};

// ==========================================
// 通用饮食指南
// ==========================================
const generalDietGuide = {
    avoid: [
        { name: '加工食品', emoji: '🍔', desc: '含添加剂和防腐剂，影响健康' },
        { name: '高盐食物', emoji: '🧂', desc: '过量钠会导致水肿和高血压' },
        { name: '高糖食品', emoji: '🍰', desc: '过多糖分影响代谢和免疫' },
        { name: '油炸食品', emoji: '🍟', desc: '高脂肪加重消化负担' }
    ],
    recommend: [
        { name: '全谷物', emoji: '🌾', desc: '燕麦、糙米、全麦面包，富含膳食纤维' },
        { name: '优质蛋白', emoji: '🥚', desc: '鸡蛋、瘦肉、鱼类、豆制品' },
        { name: '彩虹蔬果', emoji: '🌈', desc: '各种颜色的蔬果提供不同营养素' },
        { name: '健康脂肪', emoji: '🥑', desc: '牛油果、坚果、橄榄油' }
    ]
};

// ==========================================
// 示例评论数据
// ==========================================
const sampleComments = {
    1: [
        {
            id: 1,
            username: '程序员小张',
            avatar: '张',
            content: '深有同感！我也是程序员，颈椎问题困扰我很久了。请问你用的是什么牌子的人体工学椅？',
            createdAt: '2026-04-26 10:20:00'
        },
        {
            id: 2,
            username: '康复中的小明',
            avatar: '明',
            content: '颈椎操真的有用吗？我也想试试，但是怕动作不对反而加重。',
            createdAt: '2026-04-25 18:45:00'
        },
        {
            id: 3,
            username: '中医爱好者',
            avatar: '中',
            content: '建议可以配合艾灸，艾灸大椎穴对颈椎问题很有帮助。我自己就是这么调理的。',
            createdAt: '2026-04-25 16:30:00'
        }
    ],
    2: [
        {
            id: 1,
            username: '健康生活',
            avatar: '健',
            content: '说得太好了！健康确实是一种生活态度，不是一时兴起的运动。',
            createdAt: '2026-04-25 08:15:00'
        },
        {
            id: 2,
            username: '宝妈小王',
            avatar: '宝',
            content: '作为宝妈，真的深有体会。以前总把孩子放在第一位，现在才明白只有自己健康才能更好地照顾家人。',
            createdAt: '2026-04-24 14:20:00'
        }
    ],
    3: [
        {
            id: 1,
            username: '曾经失眠的人',
            avatar: '曾',
            content: '我以前也失眠很严重，后来看了医生，诊断是焦虑症。建议你也去看看医生，不要自己硬扛。',
            createdAt: '2026-04-24 07:30:00'
        },
        {
            id: 2,
            username: '睡眠专家',
            avatar: '睡',
            content: '建议你记录睡眠日记，看看是什么原因导致的失眠。另外，睡前2小时不要看手机，蓝光会影响褪黑素分泌。',
            createdAt: '2026-04-23 23:15:00'
        },
        {
            id: 3,
            username: '瑜伽老师',
            avatar: '瑜',
            content: '试试睡前瑜伽的婴儿式和倒箭式，对放松身心很有帮助。',
            createdAt: '2026-04-23 22:50:00'
        }
    ],
    4: [
        {
            id: 1,
            username: '胃病患者',
            avatar: '胃',
            content: '请问你是吃中药还是西药调理的？我也有胃病，想参考一下。',
            createdAt: '2026-04-23 11:20:00'
        },
        {
            id: 2,
            username: '营养师',
            avatar: '营',
            content: '养胃确实是持久战。建议你可以试试猴头菇煲汤，对胃黏膜修复很有帮助。',
            createdAt: '2026-04-22 18:45:00'
        }
    ],
    5: [
        {
            id: 1,
            username: '中医学习者',
            avatar: '中',
            content: '请问怎么判断自己是什么体质呢？有没有简单的测试方法？',
            createdAt: '2026-04-22 14:30:00'
        }
    ]
};

// 示例帖子数据
// ==========================================
const samplePosts = [
    {
        id: 1,
        type: 'experience',
        username: '养生达人小李',
        avatar: '李',
        title: '我的三年颈椎病康复之路',
        content: '作为一个程序员，我曾经深受颈椎病困扰。每天下班脖子僵硬得像石头，有时候还会头晕手麻。看了很多医生，做了各种治疗，总结出一些实用的方法：\n\n1. 每小时必须起身活动5分钟，做颈部拉伸\n2. 换了人体工学椅和升降桌，站坐交替\n3. 每天睡前做15分钟颈椎操\n4. 定期去正规医院做推拿理疗\n5. 最重要的是：保持正确姿势！\n\n现在我的颈椎已经好多了，分享给同样受困扰的朋友们！',
        tags: ['颈椎病', '上班族', '康复经验', '颈椎保养'],
        likes: 156,
        comments: 3,
        shares: 28,
        liked: false,
        createdAt: '2026-04-25 14:30:00'
    },
    {
        id: 2,
        type: 'thought',
        username: '健康生活家',
        avatar: '健',
        title: '健康其实是一种生活态度',
        content: '最近感悟很深：健康不是一蹴而就的事情，而是每天的小选择累积的结果。\n\n以前总觉得"等有空了再养生"，结果小病拖成了大病。现在我明白了：\n\n• 每天多喝一杯水，不是小事\n• 每晚早睡30分钟，不是小事\n• 每周运动3次，不是小事\n• 保持好心情，更是大事\n\n健康投资，越早开始越好。从今天开始，对自己好一点！',
        tags: ['健康观念', '生活态度', '养生感悟'],
        likes: 234,
        comments: 2,
        shares: 67,
        liked: false,
        createdAt: '2026-04-24 09:15:00'
    },
    {
        id: 3,
        type: 'question',
        username: '失眠患者小王',
        avatar: '失',
        title: '求助！长期失眠怎么办？',
        content: '已经失眠快半年了，每天躺在床上翻来覆去到凌晨两三点才能睡着，早上又起不来，白天精神恍惚，工作效率严重下降。\n\n试过很多方法：\n• 睡前喝牛奶 ❌ 没用\n• 吃褪黑素 ❌ 有依赖感\n• 睡前运动 ❌ 反而更精神\n• 冥想 ❌ 越想越清醒\n\n有没有同样受失眠困扰的朋友？求分享有效的方法！真的太痛苦了...',
        tags: ['失眠', '睡眠问题', '求助', '健康问答'],
        likes: 89,
        comments: 3,
        shares: 15,
        liked: false,
        createdAt: '2026-04-23 22:45:00'
    },
    {
        id: 4,
        type: 'experience',
        username: '胃病康复者',
        avatar: '胃',
        title: '从胃溃疡到健康肠胃，我的经验分享',
        content: '两年前查出胃溃疡，那个痛真是刻骨铭心。住过院，吃过各种药，现在终于养好了。分享一下我的养胃经验：\n\n【饮食方面】\n• 绝对禁酒、咖啡、浓茶\n• 辛辣、生冷、油腻完全忌口\n• 少食多餐，每天5-6餐\n• 主食以粥、面条、馒头为主\n• 多吃山药、南瓜、小米\n\n【生活习惯】\n• 规律作息，绝不熬夜\n• 饭后散步15分钟\n• 保持好心情，压力大真的会影响胃\n• 定期复查\n\n养胃是持久战，需要耐心！',
        tags: ['胃病', '胃溃疡', '养胃', '饮食调理'],
        likes: 312,
        comments: 2,
        shares: 156,
        liked: false,
        createdAt: '2026-04-22 16:20:00'
    },
    {
        id: 5,
        type: 'thought',
        username: '中医爱好者',
        avatar: '中',
        title: '中医说的"体质"到底是什么？',
        content: '最近在研究中医体质理论，觉得很有意思。中医把人分为九种体质：\n\n1. 平和体质：最健康的体质，面色红润、精力充沛\n2. 气虚体质：容易疲劳、气短懒言、爱出汗\n3. 阳虚体质：怕冷、手脚冰凉、喜热饮\n4. 阴虚体质：口干舌燥、怕热、易失眠\n5. 痰湿体质：肥胖、痰多、胸闷\n6. 湿热体质：长痘、口臭、大便黏腻\n7. 血瘀体质：面色暗沉、易长斑、痛经\n8. 气郁体质：情绪低落、多愁善感\n9. 特禀体质：容易过敏\n\n了解自己的体质，才能更好地养生！大家是什么体质呢？',
        tags: ['中医', '体质', '养生知识', '健康科普'],
        likes: 198,
        comments: 1,
        shares: 87,
        liked: false,
        createdAt: '2026-04-21 10:00:00'
    }
];

// ==========================================
// 数据存储管理
// ==========================================
const DataManager = {
    // 存储键名
    KEYS: {
        DIARY: 'body_diary',
        CHECKIN: 'pain_checkin',
        PROFILE: 'user_profile',
        POSTS: 'social_posts',
        COMMENTS: 'post_comments',
        REMINDERS: 'reminders',
        CURRENT_BATTERY: 'current_battery'
    },

    // 初始化数据
    init: function() {
        // 初始化日记
        if (!localStorage.getItem(this.KEYS.DIARY)) {
            localStorage.setItem(this.KEYS.DIARY, JSON.stringify([]));
        }

        // 初始化打卡记录
        if (!localStorage.getItem(this.KEYS.CHECKIN)) {
            localStorage.setItem(this.KEYS.CHECKIN, JSON.stringify([]));
        }

        // 初始化用户资料
        if (!localStorage.getItem(this.KEYS.PROFILE)) {
            const defaultProfile = {
                height: 170,
                weight: 65,
                constitution: 'balanced',
                gender: 'female',
                lastPeriod: null,
                periodCycle: 28,
                periodDuration: 5
            };
            localStorage.setItem(this.KEYS.PROFILE, JSON.stringify(defaultProfile));
        }

        // 初始化帖子（添加示例帖子）
        if (!localStorage.getItem(this.KEYS.POSTS)) {
            localStorage.setItem(this.KEYS.POSTS, JSON.stringify(samplePosts));
            // 同时初始化评论数据
            localStorage.setItem(this.KEYS.COMMENTS, JSON.stringify(sampleComments));
        } else {
            // 如果已有帖子数据，检查并同步评论数
            this.syncPostComments();
        }

        // 初始化提醒设置
        if (!localStorage.getItem(this.KEYS.REMINDERS)) {
            const defaultReminders = {
                sleep: true,
                water: true,
                heat: false,
                stretch: false
            };
            localStorage.setItem(this.KEYS.REMINDERS, JSON.stringify(defaultReminders));
        }

        // 初始化电量（使用综合计算方法）
        if (!localStorage.getItem(this.KEYS.CURRENT_BATTERY)) {
            const battery = this.calculateOverallBattery();
            localStorage.setItem(this.KEYS.CURRENT_BATTERY, battery.toString());
        } else {
            // 每次启动时重新计算综合电量
            const battery = this.calculateOverallBattery();
            localStorage.setItem(this.KEYS.CURRENT_BATTERY, battery.toString());
        }
    },

    // 同步帖子的评论数（解决评论数量不一致问题）
    syncPostComments: function() {
        const posts = JSON.parse(localStorage.getItem(this.KEYS.POSTS) || '[]');
        const allComments = JSON.parse(localStorage.getItem(this.KEYS.COMMENTS) || '{}');
        
        let needUpdate = false;
        
        posts.forEach(post => {
            const actualComments = allComments[post.id] || [];
            if (post.comments !== actualComments.length) {
                post.comments = actualComments.length;
                needUpdate = true;
            }
        });
        
        if (needUpdate) {
            localStorage.setItem(this.KEYS.POSTS, JSON.stringify(posts));
        }
    },

    // ==========================================
    // 综合身体电量计算系统
    // ==========================================
    // 计算综合身体电量（基于历史记录和恢复情况）
    calculateOverallBattery: function() {
        const diaries = this.getDiaries();
        const checkins = this.getCheckins();
        
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        // 获取最近7天的记录
        const recentDiaries = diaries.filter(d => new Date(d.createdAt) > sevenDaysAgo);
        const recentCheckins = checkins.filter(c => new Date(c.createdAt) > sevenDaysAgo);
        
        // 基础电量
        let baseBattery = 85;
        
        // ==========================================
        // 1. 基于最近自查记录的电量扣减
        // ==========================================
        if (recentDiaries.length > 0) {
            // 按部位分组统计
            const partStats = {};
            
            recentDiaries.forEach(diary => {
                const part = diary.bodyPart || 'unknown';
                if (!partStats[part]) {
                    partStats[part] = {
                        count: 0,
                        totalBattery: 0,
                        maxPainLevel: 0,
                        latestDate: null
                    };
                }
                
                partStats[part].count++;
                partStats[part].totalBattery += (diary.battery || 70);
                partStats[part].maxPainLevel = Math.max(partStats[part].maxPainLevel, diary.painLevel || 1);
                
                const diaryDate = new Date(diary.createdAt);
                if (!partStats[part].latestDate || diaryDate > partStats[part].latestDate) {
                    partStats[part].latestDate = diaryDate;
                }
            });
            
            // 计算每个部位对电量的影响
            const affectedParts = Object.keys(partStats).length;
            
            // 多个部位有问题 = 更严重
            let partPenalty = 0;
            let avgRecentBattery = 0;
            let maxPainLevel = 0;
            
            Object.values(partStats).forEach(stat => {
                avgRecentBattery += stat.totalBattery / stat.count;
                maxPainLevel = Math.max(maxPainLevel, stat.maxPainLevel);
                
                // 根据最近一次记录的时间计算恢复
                const daysSinceLatest = (now - stat.latestDate) / (24 * 60 * 60 * 1000);
                const recoveryBonus = Math.min(daysSinceLatest * 2, 15); // 每天恢复2%，最多恢复15%
                
                // 疼痛程度扣减
                const painPenalty = stat.maxPainLevel * 3; // 每级疼痛扣3%
                
                // 频繁发作扣减
                const frequencyPenalty = stat.count * 2; // 每次发作扣2%
                
                partPenalty += (painPenalty + frequencyPenalty - recoveryBonus);
            });
            
            avgRecentBattery = avgRecentBattery / Object.keys(partStats).length;
            
            // 多个部位同时有问题，额外扣减
            if (affectedParts >= 3) {
                partPenalty += 15; // 3个或以上部位，额外扣15%
            } else if (affectedParts >= 2) {
                partPenalty += 8; // 2个部位，额外扣8%
            }
            
            // 综合计算
            baseBattery = Math.min(100, Math.max(30, 
                avgRecentBattery - partPenalty + this.getDailyRecoveryBonus()
            ));
        }
        
        // ==========================================
        // 2. 基于疼痛打卡记录的电量影响
        // ==========================================
        if (recentCheckins.length > 0) {
            const totalPainLevel = recentCheckins.reduce((sum, c) => sum + (c.painLevel || 1), 0);
            const avgPainLevel = totalPainLevel / recentCheckins.length;
            
            // 持续疼痛扣减
            const painPenalty = avgPainLevel * 2;
            const frequencyPenalty = recentCheckins.length * 1.5;
            
            baseBattery = Math.max(30, baseBattery - painPenalty - frequencyPenalty);
        }
        
        // ==========================================
        // 3. 每日恢复机制
        // ==========================================
        // 如果今天没有任何不适记录，给予恢复奖励
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const todayDiaries = diaries.filter(d => new Date(d.createdAt) >= todayStart);
        const todayCheckins = checkins.filter(c => new Date(c.createdAt) >= todayStart);
        
        if (todayDiaries.length === 0 && todayCheckins.length === 0) {
            // 今天没有不适，恢复5%
            baseBattery = Math.min(100, baseBattery + 5);
        }
        
        // 确保电量在合理范围内
        return Math.round(Math.max(20, Math.min(100, baseBattery)));
    },

    // 获取每日恢复奖励（基于上次不适记录的时间）
    getDailyRecoveryBonus: function() {
        const diaries = this.getDiaries();
        const checkins = this.getCheckins();
        
        const now = new Date();
        let lastUnhealthyDate = null;
        
        // 找到最近的一次不适记录
        diaries.forEach(d => {
            const dDate = new Date(d.createdAt);
            if (!lastUnhealthyDate || dDate > lastUnhealthyDate) {
                lastUnhealthyDate = dDate;
            }
        });
        
        checkins.forEach(c => {
            const cDate = new Date(c.createdAt);
            if (!lastUnhealthyDate || cDate > lastUnhealthyDate) {
                lastUnhealthyDate = cDate;
            }
        });
        
        if (!lastUnhealthyDate) {
            // 没有任何不适记录，完全健康
            return 10;
        }
        
        // 计算距离上次不适的天数
        const daysSinceLast = (now - lastUnhealthyDate) / (24 * 60 * 60 * 1000);
        
        // 恢复曲线：
        // - 1天内：+0%
        // - 1-3天：每天+2%
        // - 3-7天：每天+3%
        // - 7天以上：+15%（完全恢复）
        
        if (daysSinceLast < 1) {
            return 0;
        } else if (daysSinceLast < 3) {
            return Math.round(daysSinceLast * 2);
        } else if (daysSinceLast < 7) {
            return Math.round(4 + (daysSinceLast - 2) * 3);
        } else {
            return 15;
        }
    },

    // 单次自查时计算该次的临时电量（用于结果页面显示）
    calculateCheckupBattery: function(bodyPart, selectedSymptoms, painLevel, duration) {
        // 基础电量
        let battery = 85;
        
        // 1. 症状数量影响
        const symptomCount = selectedSymptoms.length;
        battery -= symptomCount * 3; // 每个症状扣3%
        
        // 2. 疼痛程度影响
        battery -= (painLevel - 1) * 5; // 每级疼痛扣5%（轻度扣0，重度扣20）
        
        // 3. 持续时间影响
        if (duration > 7) {
            battery -= 15; // 超过1周，扣15%
        } else if (duration > 3) {
            battery -= 8; // 3-7天，扣8%
        } else if (duration > 1) {
            battery -= 3; // 2-3天，扣3%
        }
        
        // 4. 部位权重（某些部位更重要）
        const highPriorityParts = ['chest', 'head', 'heart', 'lungs'];
        if (highPriorityParts.includes(bodyPart)) {
            battery -= 10; // 重要部位额外扣10%
        }
        
        const mediumPriorityParts = ['stomach', 'neck', 'waist', 'gynecology'];
        if (mediumPriorityParts.includes(bodyPart)) {
            battery -= 5; // 中等部位额外扣5%
        }
        
        // 确保电量在合理范围内
        return Math.max(20, Math.min(95, battery));
    },

    // 更新综合电量（在保存日记后调用）
    updateOverallBattery: function() {
        const battery = this.calculateOverallBattery();
        this.setCurrentBattery(battery);
        return battery;
    },

    // 保存日记
    saveDiary: function(entry) {
        const diary = JSON.parse(localStorage.getItem(this.KEYS.DIARY) || '[]');
        const newEntry = {
            id: Date.now(),
            ...entry,
            createdAt: new Date().toISOString()
        };
        diary.unshift(newEntry);
        localStorage.setItem(this.KEYS.DIARY, JSON.stringify(diary));
        return newEntry;
    },

    // 获取所有日记
    getDiaries: function() {
        return JSON.parse(localStorage.getItem(this.KEYS.DIARY) || '[]');
    },

    // 保存打卡记录
    saveCheckin: function(checkin) {
        const checkins = JSON.parse(localStorage.getItem(this.KEYS.CHECKIN) || '[]');
        const newCheckin = {
            id: Date.now(),
            ...checkin,
            createdAt: new Date().toISOString()
        };
        checkins.unshift(newCheckin);
        localStorage.setItem(this.KEYS.CHECKIN, JSON.stringify(checkins));
        return newCheckin;
    },

    // 获取所有打卡记录
    getCheckins: function() {
        return JSON.parse(localStorage.getItem(this.KEYS.CHECKIN) || '[]');
    },

    // 保存用户资料
    saveProfile: function(profile) {
        localStorage.setItem(this.KEYS.PROFILE, JSON.stringify(profile));
    },

    // 获取用户资料
    getProfile: function() {
        return JSON.parse(localStorage.getItem(this.KEYS.PROFILE) || '{}');
    },

    // 获取所有帖子
    getPosts: function() {
        return JSON.parse(localStorage.getItem(this.KEYS.POSTS) || '[]');
    },

    // 保存帖子
    savePost: function(post) {
        const posts = JSON.parse(localStorage.getItem(this.KEYS.POSTS) || '[]');
        const newPost = {
            id: Date.now(),
            ...post,
            likes: 0,
            comments: 0,
            shares: 0,
            liked: false,
            createdAt: new Date().toISOString()
        };
        posts.unshift(newPost);
        localStorage.setItem(this.KEYS.POSTS, JSON.stringify(posts));
        return newPost;
    },

    // 点赞帖子
    likePost: function(postId) {
        const posts = JSON.parse(localStorage.getItem(this.KEYS.POSTS) || '[]');
        const post = posts.find(p => p.id === postId);
        if (post) {
            if (post.liked) {
                post.likes--;
                post.liked = false;
            } else {
                post.likes++;
                post.liked = true;
            }
            localStorage.setItem(this.KEYS.POSTS, JSON.stringify(posts));
        }
        return post;
    },

    // 分享帖子
    sharePost: function(postId) {
        const posts = JSON.parse(localStorage.getItem(this.KEYS.POSTS) || '[]');
        const post = posts.find(p => p.id === postId);
        if (post) {
            post.shares++;
            localStorage.setItem(this.KEYS.POSTS, JSON.stringify(posts));
        }
        return post;
    },

    // 获取帖子的所有评论
    getComments: function(postId) {
        const allComments = JSON.parse(localStorage.getItem(this.KEYS.COMMENTS) || '{}');
        return allComments[postId] || [];
    },

    // 添加评论
    addComment: function(postId, comment) {
        const allComments = JSON.parse(localStorage.getItem(this.KEYS.COMMENTS) || '{}');
        
        if (!allComments[postId]) {
            allComments[postId] = [];
        }
        
        const newComment = {
            id: Date.now(),
            ...comment,
            createdAt: new Date().toISOString()
        };
        
        allComments[postId].unshift(newComment);
        localStorage.setItem(this.KEYS.COMMENTS, JSON.stringify(allComments));
        
        // 更新帖子的评论数
        const posts = JSON.parse(localStorage.getItem(this.KEYS.POSTS) || '[]');
        const post = posts.find(p => p.id === postId);
        if (post) {
            post.comments = allComments[postId].length;
            localStorage.setItem(this.KEYS.POSTS, JSON.stringify(posts));
        }
        
        return newComment;
    },

    // 保存提醒设置
    saveReminders: function(reminders) {
        localStorage.setItem(this.KEYS.REMINDERS, JSON.stringify(reminders));
    },

    // 获取提醒设置
    getReminders: function() {
        return JSON.parse(localStorage.getItem(this.KEYS.REMINDERS) || '{}');
    },

    // 获取当前电量
    getCurrentBattery: function() {
        return parseInt(localStorage.getItem(this.KEYS.CURRENT_BATTERY) || '85');
    },

    // 设置当前电量
    setCurrentBattery: function(level) {
        localStorage.setItem(this.KEYS.CURRENT_BATTERY, level.toString());
    },

    // 获取统计数据
    getStats: function() {
        const diaries = this.getDiaries();
        const checkins = this.getCheckins();
        const battery = this.getCurrentBattery();

        // 计算健康天数（近30天内没有不适记录的天数）
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentCheckins = checkins.filter(c => new Date(c.createdAt) > thirtyDaysAgo);
        const healthyDays = 30 - recentCheckins.length;

        // 计算平均电量
        let avgBattery = battery;
        if (diaries.length > 0) {
            const totalBattery = diaries.reduce((sum, d) => sum + (d.battery || 85), 0);
            avgBattery = Math.round(totalBattery / diaries.length);
        }

        return {
            avgBattery: avgBattery,
            checkCount: diaries.length,
            checkinDays: checkins.length,
            healthyDays: Math.max(0, healthyDays)
        };
    }
};

// ==========================================
// 工具函数
// ==========================================
const Utils = {
    // 格式化日期
    formatDate: function(dateString, format = 'full') {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        switch(format) {
            case 'date':
                return `${year}年${month}月${day}日`;
            case 'time':
                return `${hours}:${minutes}`;
            case 'full':
            default:
                return `${year}年${month}月${day}日 ${hours}:${minutes}`;
        }
    },

    // 获取今天日期
    getTodayDate: function() {
        const today = new Date();
        return `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    },

    // 计算BMI
    calculateBMI: function(height, weight) {
        if (!height || !weight || height <= 0 || weight <= 0) {
            return { value: 0, status: '未知', class: '' };
        }

        const heightInMeters = height / 100;
        const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
        let status, className;

        if (bmi < 18.5) {
            status = '偏瘦';
            className = 'underweight';
        } else if (bmi < 24) {
            status = '正常';
            className = 'normal';
        } else if (bmi < 28) {
            status = '偏胖';
            className = 'overweight';
        } else {
            status = '肥胖';
            className = 'obese';
        }

        return { value: bmi, status, className };
    },

    // 计算经期
    calculatePeriod: function(lastPeriodDate, cycleDays) {
        if (!lastPeriodDate || !cycleDays) {
            return { nextPeriod: '请设置经期数据', status: '未知' };
        }

        const lastDate = new Date(lastPeriodDate);
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + cycleDays);

        const today = new Date();
        const daysUntilNext = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));

        let status;
        if (daysUntilNext < 0) {
            status = '经期已延迟，建议检查';
        } else if (daysUntilNext <= 3) {
            status = `经期即将到来（${daysUntilNext}天后）`;
        } else if (daysUntilNext <= 7) {
            status = `排卵期（${daysUntilNext}天后来月经）`;
        } else {
            status = '安全期';
        }

        const formattedNextDate = `${nextDate.getFullYear()}年${nextDate.getMonth() + 1}月${nextDate.getDate()}日`;

        return {
            nextPeriod: formattedNextDate,
            status: status
        };
    },

    // 获取随机治愈语录
    getRandomQuote: function() {
        const index = Math.floor(Math.random() * healingQuotes.length);
        return healingQuotes[index];
    },

    // 获取疼痛程度标签
    getPainLevelLabel: function(level) {
        const labels = ['', '轻微', '轻度', '中度', '重度', '剧烈'];
        return labels[level] || '未知';
    },

    // 获取疼痛程度样式类
    getPainLevelClass: function(level) {
        if (level <= 2) return 'pain-mild';
        if (level <= 3) return 'pain-moderate';
        return 'pain-severe';
    },

    // 获取帖子类型标签
    getPostTypeLabel: function(type) {
        const labels = {
            'experience': '养生经验',
            'thought': '想法分享',
            'question': '健康问答'
        };
        return labels[type] || '其他';
    },

    // 获取帖子类型样式类
    getPostTypeClass: function(type) {
        return type;
    }
};

// 初始化数据管理器
DataManager.init();
