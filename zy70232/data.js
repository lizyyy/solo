const CONSTANTS = {
    SALT_LIMIT_PER_MEAL: 1.7,
    SALT_LIMIT_DAILY: 5.0,
    PROTEIN_PER_KG_LOW: 1.0,
    PROTEIN_PER_KG_HIGH: 1.2,
    MEALS_PER_DAY: 3,
    CATEGORY_MAP: {
        'main': '主菜',
        'side': '配菜',
        'soup': '汤品',
        'staple': '主食'
    },
    RULE_TYPE_MAP: {
        'allergy': '过敏原',
        'chronic': '慢性病忌口',
        'preference': '饮食偏好',
        'religious': '宗教饮食',
        'medicine': '药物冲突'
    },
    MEAL_TYPE_MAP: {
        'breakfast': '早餐',
        'lunch': '午餐',
        'dinner': '晚餐'
    },
    GENDER_MAP: {
        'male': '男',
        'female': '女'
    },
    PREFERENCE_MAP: {
        'normal': '普通',
        'soft': '软食',
        'liquid': '流食',
        'low-fat': '低脂',
        'low-sugar': '低糖'
    }
};

const SAMPLE_DATA = {
    success: {
        dishes: [
            {
                id: 'd1',
                name: '清蒸鲈鱼',
                category: 'main',
                salt: 1.2,
                protein: 18.5,
                cost: 8.50,
                ingredients: ['鱼', '鲈鱼', '姜', '葱'],
                description: '低盐清淡，富含优质蛋白'
            },
            {
                id: 'd2',
                name: '清炒时蔬',
                category: 'side',
                salt: 0.5,
                protein: 2.0,
                cost: 3.00,
                ingredients: ['青菜', '蔬菜', '时蔬', '油'],
                description: '新鲜时令蔬菜'
            },
            {
                id: 'd3',
                name: '紫菜蛋花汤',
                category: 'soup',
                salt: 0.8,
                protein: 6.0,
                cost: 2.50,
                ingredients: ['紫菜', '鸡蛋', '蛋'],
                description: '清淡营养汤品'
            },
            {
                id: 'd4',
                name: '软米饭',
                category: 'staple',
                salt: 0.0,
                protein: 5.0,
                cost: 1.50,
                ingredients: ['米', '米饭'],
                description: '适合老人的软米饭'
            },
            {
                id: 'd5',
                name: '小米粥',
                category: 'staple',
                salt: 0.0,
                protein: 2.5,
                cost: 1.00,
                ingredients: ['小米', '米'],
                description: '养胃小米粥'
            },
            {
                id: 'd6',
                name: '蒸蛋羹',
                category: 'main',
                salt: 0.3,
                protein: 8.0,
                cost: 2.00,
                ingredients: ['鸡蛋', '蛋'],
                description: '嫩滑蒸蛋'
            },
            {
                id: 'd7',
                name: '白灼虾',
                category: 'main',
                salt: 0.8,
                protein: 20.0,
                cost: 12.00,
                ingredients: ['虾', '海鲜', '姜', '葱'],
                description: '新鲜白灼虾'
            },
            {
                id: 'd8',
                name: '冬瓜汤',
                category: 'soup',
                salt: 0.4,
                protein: 1.5,
                cost: 1.80,
                ingredients: ['冬瓜', '蔬菜'],
                description: '清热解暑'
            },
            {
                id: 'd9',
                name: '清蒸鸡',
                category: 'main',
                salt: 1.0,
                protein: 25.0,
                cost: 7.50,
                ingredients: ['鸡', '鸡肉', '姜', '葱'],
                description: '高蛋白低脂肪'
            },
            {
                id: 'd10',
                name: '南瓜粥',
                category: 'staple',
                salt: 0.0,
                protein: 1.8,
                cost: 1.20,
                ingredients: ['南瓜', '米'],
                description: '香甜软糯'
            }
        ],
        elders: [
            {
                id: 'e1',
                name: '张大爷',
                gender: 'male',
                age: 72,
                weight: 65.0,
                budget: 15.00,
                preference: 'normal',
                ruleIds: [],
                notes: '身体健康，饮食正常'
            },
            {
                id: 'e2',
                name: '李奶奶',
                gender: 'female',
                age: 68,
                weight: 55.0,
                budget: 12.00,
                preference: 'soft',
                ruleIds: ['r1'],
                notes: '高血压，需低盐，海鲜过敏'
            },
            {
                id: 'e3',
                name: '王爷爷',
                gender: 'male',
                age: 80,
                weight: 58.0,
                budget: 18.00,
                preference: 'low-sugar',
                ruleIds: ['r2', 'r3'],
                notes: '糖尿病患者，低糖饮食'
            }
        ],
        rules: [
            {
                id: 'r1',
                name: '海鲜过敏',
                type: 'allergy',
                avoid: ['虾', '蟹', '海鲜', '扇贝', '蛤蜊'],
                include: [],
                description: '对所有海鲜类产品过敏'
            },
            {
                id: 'r2',
                name: '糖尿病忌口',
                type: 'chronic',
                avoid: ['糖', '白糖', '红糖', '蜂蜜', '甜点'],
                include: [],
                description: '避免高糖食物'
            },
            {
                id: 'r3',
                name: '素食偏好',
                type: 'preference',
                avoid: [],
                include: ['蔬菜', '青菜', '豆腐', '豆类', '菇'],
                description: '偏好素食'
            }
        ]
    },
    block: {
        dishes: [
            {
                id: 'd1',
                name: '红烧排骨',
                category: 'main',
                salt: 2.2,
                protein: 22.0,
                cost: 10.00,
                ingredients: ['猪肉', '排骨', '酱油', '糖'],
                description: '高盐高糖，不适合特殊人群'
            },
            {
                id: 'd2',
                name: '辣子鸡',
                category: 'main',
                salt: 2.5,
                protein: 20.0,
                cost: 12.00,
                ingredients: ['鸡', '鸡肉', '辣椒', '酱油', '糖'],
                description: '辛辣高盐'
            },
            {
                id: 'd3',
                name: '白灼虾',
                category: 'main',
                salt: 0.8,
                protein: 20.0,
                cost: 15.00,
                ingredients: ['虾', '海鲜', '姜', '葱'],
                description: '海鲜类'
            },
            {
                id: 'd4',
                name: '糖醋里脊',
                category: 'main',
                salt: 1.8,
                protein: 18.0,
                cost: 14.00,
                ingredients: ['猪肉', '里脊', '糖', '醋'],
                description: '高糖高盐'
            },
            {
                id: 'd5',
                name: '清炒时蔬',
                category: 'side',
                salt: 0.5,
                protein: 2.0,
                cost: 3.00,
                ingredients: ['青菜', '蔬菜', '时蔬', '油'],
                description: '新鲜时令蔬菜'
            },
            {
                id: 'd6',
                name: '软米饭',
                category: 'staple',
                salt: 0.0,
                protein: 5.0,
                cost: 1.50,
                ingredients: ['米', '米饭'],
                description: '适合老人的软米饭'
            },
            {
                id: 'd7',
                name: '紫菜蛋花汤',
                category: 'soup',
                salt: 0.8,
                protein: 6.0,
                cost: 2.50,
                ingredients: ['紫菜', '鸡蛋', '蛋'],
                description: '清淡营养汤品'
            },
            {
                id: 'd8',
                name: '奶油蛋糕',
                category: 'side',
                salt: 0.3,
                protein: 4.0,
                cost: 8.00,
                ingredients: ['糖', '奶油', '鸡蛋', '面粉'],
                description: '高糖高脂甜点'
            }
        ],
        elders: [
            {
                id: 'e1',
                name: '赵大爷',
                gender: 'male',
                age: 75,
                weight: 60.0,
                budget: 25.00,
                preference: 'normal',
                ruleIds: ['r1'],
                notes: '海鲜过敏，近期胃口不好'
            },
            {
                id: 'e2',
                name: '孙奶奶',
                gender: 'female',
                age: 70,
                weight: 58.0,
                budget: 10.00,
                preference: 'low-sugar',
                ruleIds: ['r2', 'r3'],
                notes: '糖尿病，预算有限'
            },
            {
                id: 'e3',
                name: '钱爷爷',
                gender: 'male',
                age: 82,
                weight: 70.0,
                budget: 20.00,
                preference: 'low-fat',
                ruleIds: ['r4'],
                notes: '高血压严重，必须低盐'
            }
        ],
        rules: [
            {
                id: 'r1',
                name: '海鲜过敏',
                type: 'allergy',
                avoid: ['虾', '蟹', '海鲜', '扇贝', '蛤蜊'],
                include: [],
                description: '对所有海鲜类产品过敏，严重者危及生命'
            },
            {
                id: 'r2',
                name: '糖尿病忌口',
                type: 'chronic',
                avoid: ['糖', '白糖', '红糖', '蜂蜜', '甜点', '奶油', '蛋糕'],
                include: [],
                description: '严格控制糖分摄入'
            },
            {
                id: 'r3',
                name: '低盐饮食',
                type: 'chronic',
                avoid: ['酱油', '盐', '咸菜'],
                include: [],
                description: '高血压患者，每日盐摄入不超过3克'
            },
            {
                id: 'r4',
                name: '极低盐饮食',
                type: 'chronic',
                avoid: ['酱油', '盐', '咸菜', '味精', '酱'],
                include: [],
                description: '严重高血压，每餐盐不超过0.5克'
            }
        ]
    }
};

class DataStore {
    constructor() {
        this.storageKey = 'community_canteen_data';
        this.init();
    }

    init() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                this.data = JSON.parse(stored);
            } catch (e) {
                this.data = this.getEmptyData();
            }
        } else {
            this.data = this.getEmptyData();
        }
    }

    getEmptyData() {
        return {
            dishes: [],
            elders: [],
            rules: [],
            plans: []
        };
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    }

    loadSample(type) {
        const sample = SAMPLE_DATA[type];
        if (sample) {
            this.data = {
                dishes: [...sample.dishes],
                elders: [...sample.elders],
                rules: [...sample.rules],
                plans: []
            };
            this.save();
            return true;
        }
        return false;
    }

    clear() {
        this.data = this.getEmptyData();
        this.save();
    }

    getDishes() {
        return this.data.dishes;
    }

    getDishById(id) {
        return this.data.dishes.find(d => d.id === id);
    }

    addDish(dish) {
        dish.id = 'd_' + Date.now();
        this.data.dishes.push(dish);
        this.save();
        return dish;
    }

    updateDish(id, dish) {
        const index = this.data.dishes.findIndex(d => d.id === id);
        if (index !== -1) {
            this.data.dishes[index] = { ...this.data.dishes[index], ...dish };
            this.save();
            return true;
        }
        return false;
    }

    deleteDish(id) {
        this.data.dishes = this.data.dishes.filter(d => d.id !== id);
        this.save();
    }

    getElders() {
        return this.data.elders;
    }

    getElderById(id) {
        return this.data.elders.find(e => e.id === id);
    }

    addElder(elder) {
        elder.id = 'e_' + Date.now();
        this.data.elders.push(elder);
        this.save();
        return elder;
    }

    updateElder(id, elder) {
        const index = this.data.elders.findIndex(e => e.id === id);
        if (index !== -1) {
            this.data.elders[index] = { ...this.data.elders[index], ...elder };
            this.save();
            return true;
        }
        return false;
    }

    deleteElder(id) {
        this.data.elders = this.data.elders.filter(e => e.id !== id);
        this.save();
    }

    getRules() {
        return this.data.rules;
    }

    getRuleById(id) {
        return this.data.rules.find(r => r.id === id);
    }

    getRulesByIds(ids) {
        return this.data.rules.filter(r => ids.includes(r.id));
    }

    addRule(rule) {
        rule.id = 'r_' + Date.now();
        this.data.rules.push(rule);
        this.save();
        return rule;
    }

    updateRule(id, rule) {
        const index = this.data.rules.findIndex(r => r.id === id);
        if (index !== -1) {
            this.data.rules[index] = { ...this.data.rules[index], ...rule };
            this.save();
            return true;
        }
        return false;
    }

    deleteRule(id) {
        this.data.rules = this.data.rules.filter(r => r.id !== id);
        this.data.elders.forEach(elder => {
            if (elder.ruleIds && elder.ruleIds.includes(id)) {
                elder.ruleIds = elder.ruleIds.filter(rid => rid !== id);
            }
        });
        this.save();
    }

    getPlans() {
        return this.data.plans;
    }

    getPlanById(id) {
        return this.data.plans.find(p => p.id === id);
    }

    addPlan(plan) {
        plan.id = 'p_' + Date.now();
        plan.createdAt = new Date().toISOString();
        this.data.plans.push(plan);
        this.save();
        return plan;
    }

    updatePlan(id, plan) {
        const index = this.data.plans.findIndex(p => p.id === id);
        if (index !== -1) {
            this.data.plans[index] = { ...this.data.plans[index], ...plan };
            this.save();
            return true;
        }
        return false;
    }

    deletePlan(id) {
        this.data.plans = this.data.plans.filter(p => p.id !== id);
        this.save();
    }

    getPlansByDateRange(startDate, endDate) {
        return this.data.plans.filter(p => {
            const planDate = new Date(p.date);
            const start = new Date(startDate);
            const end = new Date(endDate);
            return planDate >= start && planDate <= end;
        });
    }

    getPlansByElder(elderId) {
        return this.data.plans.filter(p => p.elderId === elderId);
    }
}

const dataStore = new DataStore();
