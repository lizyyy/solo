// 规则配置
const RULES = {
    materials: {
        solid_wood: { name: "实木", basePrice: 500, repairMultiplier: 1.5 },
        plywood: { name: "复合板", basePrice: 200, repairMultiplier: 1.0 },
        fabric: { name: "布艺", basePrice: 300, repairMultiplier: 1.2 },
        leather: { name: "皮革", basePrice: 600, repairMultiplier: 1.8 },
        metal: { name: "金属", basePrice: 400, repairMultiplier: 1.3 },
        glass: { name: "玻璃", basePrice: 250, repairMultiplier: 0.8 },
        rattan: { name: "藤编", basePrice: 350, repairMultiplier: 1.4 }
    },
    
    damageLevels: {
        0: { name: "无", multiplier: 0.0, description: "无明显破损" },
        1: { name: "轻微", multiplier: 0.2, description: "表面轻微划痕，不影响使用" },
        2: { name: "中等", multiplier: 0.5, description: "明显破损，需要部分修复" },
        3: { name: "严重", multiplier: 1.0, description: "严重损坏，需要全面修复" }
    },
    
    surfaceProcesses: {
        polish: { name: "抛光", price: 200, materials: ["solid_wood", "plywood", "metal"] },
        paint: { name: "喷漆", price: 400, materials: ["solid_wood", "plywood", "metal"] },
        stain: { name: "上色", price: 300, materials: ["solid_wood", "plywood"] },
        varnish: { name: "上清漆", price: 250, materials: ["solid_wood", "plywood"] },
        reupholstery: { name: "重新装裱", price: 800, materials: ["fabric", "leather"] },
        repair: { name: "维修补", price: 350, materials: ["solid_wood", "plywood", "metal", "rattan"] }
    },
    
    specialProcesses: {
        repair: { name: "维修加固", price: 200 },
        custom: { name: "定制配件", price: 300 },
        clean: { name: "深度清洁", price: 150 },
        restore: { name: "复古效果", price: 500 }
    },
    
    transport: {
        local: { name: "同城", price: 200 },
        near: { name: "近郊", price: 400 },
        far: { name: "远郊", price: 600 },
        long: { name: "长途", price: 1000 }
    },
    
    floorFee: {
        no: 0,
        yes: 150
    },
    
    agePenalty: {
        10: 0.1,
        20: 0.2,
        30: 0.3
    },
    
    sizeFactor: {
        small: 0.8,
        medium: 1.0,
        large: 1.5,
        extra_large: 2.0
    }
};

// 问题列表（脏数据记录）
let problemsList = [];
let problemIdCounter = 1;

// 内置样例数据
const SAMPLES = [
    {
        id: "sample_1",
        name: "老榆木餐桌",
        description: "使用20年的老榆木餐桌，表面有划痕，结构完好",
        furniture: {
            type: "wooden",
            name: "老榆木餐桌",
            material: "solid_wood",
            size: { length: 160, width: 80, height: 75 },
            age: 20
        },
        damages: {
            surface: { level: 2, desc: "桌面有多处划痕，边缘有掉漆" },
            structure: { level: 0, desc: "" },
            hardware: { level: 1, desc: "合页轻微松动" },
            other: { level: 0, desc: "" }
        },
        processes: {
            surface: "stain",
            special: ["repair", "restore"]
        },
        transport: {
            distance: "local",
            floor: "yes"
        },
        budget: 3000
    },
    {
        id: "sample_2",
        name: "现代布艺沙发",
        description: "使用5年的布艺沙发，坐垫塌陷，需要重新装裱",
        furniture: {
            type: "fabric",
            name: "现代布艺沙发",
            material: "fabric",
            size: { length: 220, width: 90, height: 85 },
            age: 5
        },
        damages: {
            surface: { level: 2, desc: "面料有污渍和磨损" },
            structure: { level: 1, desc: "坐垫弹簧轻微塌陷" },
            hardware: { level: 0, desc: "" },
            other: { level: 0, desc: "" }
        },
        processes: {
            surface: "reupholstery",
            special: ["clean", "repair"]
        },
        transport: {
            distance: "local",
            floor: "yes"
        },
        budget: 2500
    },
    {
        id: "sample_3",
        name: "工业风金属书架",
        description: "金属书架生锈严重，需要除锈喷漆",
        furniture: {
            type: "metal",
            name: "工业风金属书架",
            material: "metal",
            size: { length: 120, width: 35, height: 200 },
            age: 8
        },
        damages: {
            surface: { level: 3, desc: "大面积生锈，漆面脱落" },
            structure: { level: 1, desc: "连接处轻微变形" },
            hardware: { level: 2, desc: "部分螺丝锈蚀" },
            other: { level: 0, desc: "" }
        },
        processes: {
            surface: "paint",
            special: ["repair"]
        },
        transport: {
            distance: "near",
            floor: "no"
        },
        budget: 1500
    },
    {
        id: "sample_invalid",
        name: "脏数据样例",
        description: "包含各种问题的测试数据",
        furniture: {
            type: "",
            name: "",
            material: "invalid_material",
            size: { length: -50, width: "abc", height: null },
            age: -10
        },
        damages: {
            surface: { level: 99, desc: "" },
            structure: { level: "high", desc: "" },
            hardware: { level: 1, desc: "" },
            other: { level: 2, desc: "" }
        },
        processes: {
            surface: "invalid_process",
            special: ["nonexistent"]
        },
        transport: {
            distance: "invalid",
            floor: "yes"
        },
        budget: "not_a_number"
    }
];

// 验证输入数据
function validateInput(data) {
    const errors = [];
    const warnings = [];
    const validData = {};
    
    // 家具类型
    if (!data.furniture.type) {
        errors.push({ field: "furniture.type", message: "家具类型未选择", value: data.furniture.type });
        addProblem("CRITICAL", "家具类型缺失", "必须选择家具类型才能计算报价", "furniture.type", data.furniture.type);
    } else if (!["wooden", "fabric", "metal", "mixed"].includes(data.furniture.type)) {
        errors.push({ field: "furniture.type", message: "无效的家具类型", value: data.furniture.type });
        addProblem("CRITICAL", "无效家具类型", `家具类型 "${data.furniture.type}" 不是有效选项`, "furniture.type", data.furniture.type);
    } else {
        validData.furnitureType = data.furniture.type;
    }
    
    // 家具名称
    if (!data.furniture.name || data.furniture.name.trim() === "") {
        warnings.push({ field: "furniture.name", message: "家具名称为空" });
        addProblem("WARNING", "家具名称缺失", "建议填写家具名称以便后续追踪", "furniture.name", data.furniture.name);
        validData.furnitureName = "未命名家具";
    } else {
        validData.furnitureName = data.furniture.name.trim();
    }
    
    // 材质
    if (!data.furniture.material) {
        errors.push({ field: "furniture.material", message: "材质未选择", value: data.furniture.material });
        addProblem("CRITICAL", "材质缺失", "必须选择材质才能计算报价", "furniture.material", data.furniture.material);
    } else if (!RULES.materials[data.furniture.material]) {
        errors.push({ field: "furniture.material", message: "无效的材质", value: data.furniture.material });
        addProblem("CRITICAL", "无效材质", `材质 "${data.furniture.material}" 不是有效选项`, "furniture.material", data.furniture.material);
    } else {
        validData.material = data.furniture.material;
        validData.materialInfo = RULES.materials[data.furniture.material];
    }
    
    // 尺寸验证
    validData.size = validateSize(data.furniture.size, errors, warnings);
    
    // 使用年限
    if (data.furniture.age === null || data.furniture.age === undefined || data.furniture.age === "") {
        warnings.push({ field: "furniture.age", message: "使用年限未填写，默认按10年计算" });
        addProblem("WARNING", "使用年限缺失", "未提供使用年限，将按默认值计算，可能影响报价准确性", "furniture.age", data.furniture.age);
        validData.age = 10;
    } else if (isNaN(data.furniture.age) || data.furniture.age < 0) {
        errors.push({ field: "furniture.age", message: "无效的使用年限", value: data.furniture.age });
        addProblem("CRITICAL", "无效使用年限", `使用年限 "${data.furniture.age}" 必须是大于等于0的数字`, "furniture.age", data.furniture.age);
    } else if (data.furniture.age > 100) {
        warnings.push({ field: "furniture.age", message: "使用年限超过100年，建议特殊评估" });
        addProblem("WARNING", "异常使用年限", `使用年限 ${data.furniture.age} 年过长，建议进行专业评估`, "furniture.age", data.furniture.age);
        validData.age = data.furniture.age;
    } else {
        validData.age = Number(data.furniture.age);
    }
    
    // 破损等级
    validData.damages = validateDamages(data.damages, errors, warnings);
    
    // 表面处理工艺
    if (!data.processes.surface) {
        errors.push({ field: "processes.surface", message: "表面处理工艺未选择", value: data.processes.surface });
        addProblem("CRITICAL", "表面处理工艺缺失", "必须选择表面处理工艺才能计算报价", "processes.surface", data.processes.surface);
    } else if (!RULES.surfaceProcesses[data.processes.surface]) {
        errors.push({ field: "processes.surface", message: "无效的表面处理工艺", value: data.processes.surface });
        addProblem("CRITICAL", "无效表面处理工艺", `工艺 "${data.processes.surface}" 不是有效选项`, "processes.surface", data.processes.surface);
    } else {
        const processInfo = RULES.surfaceProcesses[data.processes.surface];
        if (validData.material && !processInfo.materials.includes(validData.material)) {
            warnings.push({ 
                field: "processes.surface", 
                message: `工艺 "${processInfo.name}" 不适用于材质 "${validData.materialInfo.name}"` 
            });
            addProblem("WARNING", "工艺材质不匹配", 
                `工艺 "${processInfo.name}" 通常不适用于 "${validData.materialInfo.name}" 材质，请确认是否正确`, 
                "processes.surface", 
                data.processes.surface);
        }
        validData.surfaceProcess = data.processes.surface;
        validData.surfaceProcessInfo = processInfo;
    }
    
    // 特殊工艺
    validData.specialProcesses = [];
    if (data.processes.special && Array.isArray(data.processes.special)) {
        data.processes.special.forEach((proc, index) => {
            if (!RULES.specialProcesses[proc]) {
                warnings.push({ field: `processes.special[${index}]`, message: "无效的特殊工艺", value: proc });
                addProblem("WARNING", "无效特殊工艺", 
                    `特殊工艺 "${proc}" 不是有效选项，将被忽略`, 
                    `processes.special[${index}]`, 
                    proc);
            } else {
                validData.specialProcesses.push({
                    id: proc,
                    ...RULES.specialProcesses[proc]
                });
            }
        });
    }
    
    // 运输距离
    if (!data.transport.distance) {
        errors.push({ field: "transport.distance", message: "运输距离未选择", value: data.transport.distance });
        addProblem("CRITICAL", "运输距离缺失", "必须选择运输距离才能计算报价", "transport.distance", data.transport.distance);
    } else if (!RULES.transport[data.transport.distance]) {
        errors.push({ field: "transport.distance", message: "无效的运输距离", value: data.transport.distance });
        addProblem("CRITICAL", "无效运输距离", `运输距离 "${data.transport.distance}" 不是有效选项`, "transport.distance", data.transport.distance);
    } else {
        validData.transportDistance = data.transport.distance;
        validData.transportDistanceInfo = RULES.transport[data.transport.distance];
    }
    
    // 上楼费用
    if (data.transport.floor === undefined || data.transport.floor === null) {
        warnings.push({ field: "transport.floor", message: "上楼信息未填写，默认不计" });
        addProblem("WARNING", "上楼信息缺失", "未提供是否需要上楼，默认按无计算", "transport.floor", data.transport.floor);
        validData.floorFee = 0;
    } else if (RULES.floorFee[data.transport.floor] === undefined) {
        warnings.push({ field: "transport.floor", message: "无效的上楼选项", value: data.transport.floor });
        addProblem("WARNING", "无效上楼选项", `上楼选项 "${data.transport.floor}" 无效，默认按无计算`, "transport.floor", data.transport.floor);
        validData.floorFee = 0;
    } else {
        validData.floorFee = RULES.floorFee[data.transport.floor];
    }
    
    // 预算
    if (data.budget === null || data.budget === undefined || data.budget === "") {
        warnings.push({ field: "budget", message: "客户预算未填写" });
        addProblem("WARNING", "预算缺失", "未提供客户预算，无法进行预算匹配评估", "budget", data.budget);
        validData.budget = null;
    } else if (isNaN(data.budget) || data.budget < 0) {
        errors.push({ field: "budget", message: "无效的预算金额", value: data.budget });
        addProblem("CRITICAL", "无效预算", `预算 "${data.budget}" 必须是大于等于0的数字`, "budget", data.budget);
    } else {
        validData.budget = Number(data.budget);
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        validData
    };
}

function validateSize(size, errors, warnings) {
    const validSize = {
        length: null,
        width: null,
        height: null,
        volume: null,
        category: "medium"
    };
    
    const fields = ["length", "width", "height"];
    
    fields.forEach(field => {
        const value = size[field];
        if (value === null || value === undefined || value === "") {
            warnings.push({ field: `furniture.size.${field}`, message: `${field}尺寸未填写` });
            addProblem("WARNING", `尺寸缺失`, `${field}尺寸未填写，可能影响报价准确性`, `furniture.size.${field}`, value);
        } else if (isNaN(value) || Number(value) <= 0) {
            errors.push({ field: `furniture.size.${field}`, message: `无效的${field}尺寸`, value });
            addProblem("CRITICAL", `无效尺寸`, `${field}尺寸 "${value}" 必须是大于0的数字`, `furniture.size.${field}`, value);
        } else {
            validSize[field] = Number(value);
        }
    });
    
    if (validSize.length && validSize.width && validSize.height) {
        validSize.volume = validSize.length * validSize.width * validSize.height;
        
        const total = validSize.length + validSize.width + validSize.height;
        if (total < 150) {
            validSize.category = "small";
        } else if (total < 300) {
            validSize.category = "medium";
        } else if (total < 500) {
            validSize.category = "large";
        } else {
            validSize.category = "extra_large";
        }
    }
    
    return validSize;
}

function validateDamages(damages, errors, warnings) {
    const validDamages = {
        surface: { level: 0, desc: "", info: RULES.damageLevels[0] },
        structure: { level: 0, desc: "", info: RULES.damageLevels[0] },
        hardware: { level: 0, desc: "", info: RULES.damageLevels[0] },
        other: { level: 0, desc: "", info: RULES.damageLevels[0] }
    };
    
    const types = ["surface", "structure", "hardware", "other"];
    
    types.forEach(type => {
        if (damages[type]) {
            const level = damages[type].level;
            const desc = damages[type].desc || "";
            
            if (level === null || level === undefined || level === "") {
                validDamages[type].level = 0;
                validDamages[type].info = RULES.damageLevels[0];
            } else if (isNaN(level) || !RULES.damageLevels[level]) {
                errors.push({ field: `damages.${type}.level`, message: "无效的破损等级", value: level });
                addProblem("CRITICAL", "无效破损等级", 
                    `${type}破损等级 "${level}" 必须是0-3之间的数字`, 
                    `damages.${type}.level`, 
                    level);
            } else {
                const numLevel = Number(level);
                validDamages[type].level = numLevel;
                validDamages[type].info = RULES.damageLevels[numLevel];
            }
            
            validDamages[type].desc = desc;
            
            if (numLevel > 0 && (!desc || desc.trim() === "")) {
                warnings.push({ field: `damages.${type}.desc`, message: `存在破损但未填写描述` });
                addProblem("WARNING", "破损描述缺失", 
                    `${type}有破损但未填写描述，建议补充详细信息`, 
                    `damages.${type}.desc`, 
                    desc);
            }
        }
    });
    
    return validDamages;
}

// 计算报价
function calculateQuotation(validData) {
    const breakdown = [];
    let total = 0;
    
    // 基础价格（基于材质）
    let basePrice = validData.materialInfo.basePrice;
    breakdown.push({
        category: "基础费用",
        item: `材质基础费 (${validData.materialInfo.name})`,
        price: basePrice,
        description: `基于材质 ${validData.materialInfo.name} 的基础翻新价格`
    });
    total += basePrice;
    
    // 尺寸系数
    const sizeFactor = RULES.sizeFactor[validData.size.category];
    if (sizeFactor !== 1.0) {
        const sizeAdjustment = basePrice * (sizeFactor - 1);
        breakdown.push({
            category: "基础费用",
            item: `尺寸调整 (${validData.size.category})`,
            price: sizeAdjustment,
            description: `家具尺寸分类为 ${validData.size.category}，系数 ${sizeFactor}`
        });
        total += sizeAdjustment;
    }
    
    // 年限折旧系数
    let agePenalty = 0;
    if (validData.age >= 30) {
        agePenalty = RULES.agePenalty[30];
    } else if (validData.age >= 20) {
        agePenalty = RULES.agePenalty[20];
    } else if (validData.age >= 10) {
        agePenalty = RULES.agePenalty[10];
    }
    
    if (agePenalty > 0) {
        const ageAdjustment = basePrice * agePenalty;
        breakdown.push({
            category: "基础费用",
            item: `年限折旧调整`,
            price: ageAdjustment,
            description: `使用年限 ${validData.age} 年，折旧系数 ${agePenalty * 100}%`
        });
        total += ageAdjustment;
    }
    
    // 破损修复费用
    const damageTypes = [
        { key: "surface", name: "表面破损" },
        { key: "structure", name: "结构问题" },
        { key: "hardware", name: "五金配件" },
        { key: "other", name: "其他问题" }
    ];
    
    damageTypes.forEach(({ key, name }) => {
        const damage = validData.damages[key];
        if (damage.level > 0) {
            const damageCost = basePrice * validData.materialInfo.repairMultiplier * damage.info.multiplier;
            breakdown.push({
                category: "破损修复",
                item: `${name}修复`,
                price: damageCost,
                description: `${name}等级：${damage.info.name} (系数 ${damage.info.multiplier})`
            });
            total += damageCost;
        }
    });
    
    // 表面处理工艺
    if (validData.surfaceProcessInfo) {
        breakdown.push({
            category: "工艺费用",
            item: `表面处理 - ${validData.surfaceProcessInfo.name}`,
            price: validData.surfaceProcessInfo.price,
            description: `选用 ${validData.surfaceProcessInfo.name} 工艺`
        });
        total += validData.surfaceProcessInfo.price;
    }
    
    // 特殊工艺
    validData.specialProcesses.forEach(proc => {
        breakdown.push({
            category: "工艺费用",
            item: `特殊工艺 - ${proc.name}`,
            price: proc.price,
            description: `选用 ${proc.name} 工艺`
        });
        total += proc.price;
    });
    
    // 运输费用
    if (validData.transportDistanceInfo) {
        breakdown.push({
            category: "运输费用",
            item: `运输费 (${validData.transportDistanceInfo.name})`,
            price: validData.transportDistanceInfo.price,
            description: `运输距离：${validData.transportDistanceInfo.name}`
        });
        total += validData.transportDistanceInfo.price;
    }
    
    if (validData.floorFee > 0) {
        breakdown.push({
            category: "运输费用",
            item: "上楼服务费",
            price: validData.floorFee,
            description: "需要人工搬运上楼"
        });
        total += validData.floorFee;
    }
    
    // 预算检查
    let budgetStatus = null;
    if (validData.budget !== null) {
        const ratio = total / validData.budget;
        if (ratio <= 0.8) {
            budgetStatus = {
                level: "success",
                message: `报价 ${total.toFixed(2)} 元 低于预算 ${validData.budget} 元，有充足余量`,
                ratio: ratio
            };
        } else if (ratio <= 1.0) {
            budgetStatus = {
                level: "warning",
                message: `报价 ${total.toFixed(2)} 元 接近预算 ${validData.budget} 元，请谨慎确认`,
                ratio: ratio
            };
        } else {
            budgetStatus = {
                level: "danger",
                message: `报价 ${total.toFixed(2)} 元 超出预算 ${validData.budget} 元，建议与客户沟通调整方案`,
                ratio: ratio
            };
        }
    }
    
    return {
        breakdown,
        total,
        budgetStatus,
        timestamp: new Date().toISOString()
    };
}

// 添加问题
function addProblem(severity, title, description, source, value) {
    problemsList.push({
        id: problemIdCounter++,
        severity: severity === "CRITICAL" ? "critical" : "warning",
        title,
        description,
        source,
        value,
        timestamp: new Date().toISOString()
    });
}

// UI 函数
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabId = tab.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
            
            if (tabId === 'rules') {
                renderRules();
            } else if (tabId === 'problems') {
                renderProblems();
            } else if (tabId === 'samples') {
                renderSamples();
            } else if (tabId === 'verification') {
                renderVerification();
            }
        });
    });
}

function renderRules() {
    const container = document.getElementById('rules-content');
    
    let html = `
        <div class="rule-section">
            <h3>材质规则</h3>
            <ul>
                ${Object.entries(RULES.materials).map(([key, value]) => `
                    <li>
                        <div class="rule-item">
                            <span class="rule-name">${value.name}:</span>
                            <span class="rule-value">基础价 ¥${value.basePrice}，修复系数 ${value.repairMultiplier}x</span>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
        
        <div class="rule-section">
            <h3>破损等级规则</h3>
            <ul>
                ${Object.entries(RULES.damageLevels).map(([key, value]) => `
                    <li>
                        <div class="rule-item">
                            <span class="rule-name">等级 ${key} (${value.name}):</span>
                            <span class="rule-value">系数 ${value.multiplier} - ${value.description}</span>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
        
        <div class="rule-section">
            <h3>表面处理工艺</h3>
            <ul>
                ${Object.entries(RULES.surfaceProcesses).map(([key, value]) => `
                    <li>
                        <div class="rule-item">
                            <span class="rule-name">${value.name}:</span>
                            <span class="rule-value">¥${value.price}，适用材质: ${value.materials.map(m => RULES.materials[m]?.name || m).join(', ')}</span>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
        
        <div class="rule-section">
            <h3>特殊工艺</h3>
            <ul>
                ${Object.entries(RULES.specialProcesses).map(([key, value]) => `
                    <li>
                        <div class="rule-item">
                            <span class="rule-name">${value.name}:</span>
                            <span class="rule-value">¥${value.price}</span>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
        
        <div class="rule-section">
            <h3>运输规则</h3>
            <ul>
                ${Object.entries(RULES.transport).map(([key, value]) => `
                    <li>
                        <div class="rule-item">
                            <span class="rule-name">${value.name}:</span>
                            <span class="rule-value">¥${value.price}</span>
                        </div>
                    </li>
                `).join('')}
            </ul>
            <ul style="margin-top: 10px;">
                <li>
                    <div class="rule-item">
                        <span class="rule-name">上楼服务费:</span>
                        <span class="rule-value">¥${RULES.floorFee.yes}</span>
                    </div>
                </li>
            </ul>
        </div>
        
        <div class="rule-section">
            <h3>尺寸系数</h3>
            <ul>
                ${Object.entries(RULES.sizeFactor).map(([key, value]) => `
                    <li>
                        <div class="rule-item">
                            <span class="rule-name">${key}:</span>
                            <span class="rule-value">系数 ${value}x</span>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
        
        <div class="rule-section">
            <h3>年限折旧</h3>
            <ul>
                ${Object.entries(RULES.agePenalty).map(([key, value]) => `
                    <li>
                        <div class="rule-item">
                            <span class="rule-name">≥${key}年:</span>
                            <span class="rule-value">增加 ${value * 100}%</span>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
    
    container.innerHTML = html;
}

function renderProblems() {
    const container = document.getElementById('problems-list');
    
    if (problemsList.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无问题数据，请先提交报价或加载脏数据样例</p>';
        return;
    }
    
    const html = problemsList.map(problem => `
        <div class="problem-item ${problem.severity}">
            <h4>[${problem.severity.toUpperCase()}] ${problem.title}</h4>
            <p>${problem.description}</p>
            <p class="source">来源: ${problem.source} | 原始值: ${JSON.stringify(problem.value)}</p>
            <p class="source">时间: ${new Date(problem.timestamp).toLocaleString()}</p>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function renderSamples() {
    const container = document.getElementById('samples-list');
    
    const html = SAMPLES.map(sample => `
        <div class="sample-card">
            <h3>${sample.name}</h3>
            <p class="sample-desc">${sample.description}</p>
            <button onclick="loadSample('${sample.id}')">加载此样例</button>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function loadSample(sampleId) {
    const sample = SAMPLES.find(s => s.id === sampleId);
    if (!sample) return;
    
    // 清空问题列表
    problemsList = [];
    
    // 填充表单
    document.getElementById('furniture-type').value = sample.furniture.type;
    document.getElementById('furniture-name').value = sample.furniture.name;
    document.getElementById('material').value = sample.furniture.material;
    document.getElementById('length').value = sample.furniture.size.length;
    document.getElementById('width').value = sample.furniture.size.width;
    document.getElementById('height').value = sample.furniture.size.height;
    document.getElementById('age').value = sample.furniture.age;
    
    // 填充破损等级
    const damageSelects = document.querySelectorAll('.damage-level');
    damageSelects.forEach(select => {
        const type = select.dataset.type;
        select.value = sample.damages[type].level;
    });
    
    const damageDescs = document.querySelectorAll('.damage-desc');
    const damageTypes = ['surface', 'structure', 'hardware', 'other'];
    damageDescs.forEach((input, index) => {
        input.value = sample.damages[damageTypes[index]].desc;
    });
    
    // 填充工艺
    document.getElementById('surface-process').value = sample.processes.surface;
    
    const specialCheckboxes = document.querySelectorAll('.special-process');
    specialCheckboxes.forEach(checkbox => {
        checkbox.checked = sample.processes.special.includes(checkbox.value);
    });
    
    // 填充运输
    document.getElementById('transport-distance').value = sample.transport.distance;
    document.getElementById('transport-floor').value = sample.transport.floor;
    document.getElementById('budget').value = sample.budget;
    
    // 切换到报价页面
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="quotation"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById('quotation').classList.add('active');
    
    // 自动计算报价
    document.getElementById('calculate-btn').click();
}

function collectFormData() {
    const damageLevels = {};
    const damageDescs = {};
    
    document.querySelectorAll('.damage-level').forEach(select => {
        const type = select.dataset.type;
        damageLevels[type] = Number(select.value);
    });
    
    const descs = document.querySelectorAll('.damage-desc');
    const damageTypes = ['surface', 'structure', 'hardware', 'other'];
    descs.forEach((input, index) => {
        damageDescs[damageTypes[index]] = input.value;
    });
    
    const specialProcesses = [];
    document.querySelectorAll('.special-process:checked').forEach(checkbox => {
        specialProcesses.push(checkbox.value);
    });
    
    return {
        furniture: {
            type: document.getElementById('furniture-type').value,
            name: document.getElementById('furniture-name').value,
            material: document.getElementById('material').value,
            size: {
                length: document.getElementById('length').value,
                width: document.getElementById('width').value,
                height: document.getElementById('height').value
            },
            age: document.getElementById('age').value
        },
        damages: {
            surface: { level: damageLevels.surface, desc: damageDescs.surface },
            structure: { level: damageLevels.structure, desc: damageDescs.structure },
            hardware: { level: damageLevels.hardware, desc: damageDescs.hardware },
            other: { level: damageLevels.other, desc: damageDescs.other }
        },
        processes: {
            surface: document.getElementById('surface-process').value,
            special: specialProcesses
        },
        transport: {
            distance: document.getElementById('transport-distance').value,
            floor: document.getElementById('transport-floor').value
        },
        budget: document.getElementById('budget').value
    };
}

function renderValidationResult(errors, warnings) {
    const container = document.getElementById('input-validation');
    
    if (errors.length === 0 && warnings.length === 0) {
        container.innerHTML = `
            <div class="validation-item success">
                <strong>✓ 所有输入验证通过</strong>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    if (errors.length > 0) {
        html += errors.map(err => `
            <div class="validation-item error">
                <strong>✗ 错误:</strong> ${err.message}
                ${err.value !== undefined ? ` (值: ${JSON.stringify(err.value)})` : ''}
            </div>
        `).join('');
    }
    
    if (warnings.length > 0) {
        html += warnings.map(warn => `
            <div class="validation-item warning">
                <strong>⚠ 警告:</strong> ${warn.message}
                ${warn.value !== undefined ? ` (值: ${JSON.stringify(warn.value)})` : ''}
            </div>
        `).join('');
    }
    
    container.innerHTML = html;
}

function renderQuotationResult(quotation) {
    const container = document.getElementById('quotation-result');
    
    const grouped = {};
    quotation.breakdown.forEach(item => {
        if (!grouped[item.category]) {
            grouped[item.category] = [];
        }
        grouped[item.category].push(item);
    });
    
    let html = `
        <div class="quotation-breakdown">
    `;
    
    Object.entries(grouped).forEach(([category, items]) => {
        html += `
            <h3>${category}</h3>
        `;
        items.forEach(item => {
            html += `
                <div class="item">
                    <span>${item.item}</span>
                    <span>¥${item.price.toFixed(2)}</span>
                </div>
            `;
        });
    });
    
    html += `
            <div class="quotation-total">
                总计: ¥${quotation.total.toFixed(2)}
            </div>
        </div>
    `;
    
    if (quotation.budgetStatus) {
        html += `
            <div class="budget-check ${quotation.budgetStatus.level}">
                ${quotation.budgetStatus.message}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function renderVerification() {
    const container = document.getElementById('verification-content');
    
    const tests = [
        {
            name: "样例1: 老榆木餐桌",
            description: "实木材质，中等表面磨损，20年使用年限",
            expected: "应该产生材质基础费 + 年限折旧 + 破损修复 + 工艺费用",
            sampleId: "sample_1",
            check: (quotation) => {
                const hasSolidWood = quotation.breakdown.some(i => i.item.includes("实木"));
                const hasAgeAdjustment = quotation.breakdown.some(i => i.item.includes("年限折旧"));
                const hasProcesses = quotation.breakdown.some(i => i.category === "工艺费用");
                return hasSolidWood && hasAgeAdjustment && hasProcesses;
            }
        },
        {
            name: "样例2: 现代布艺沙发",
            description: "布艺材质，需要重新装裱",
            expected: "应该包含重新装裱工艺费用",
            sampleId: "sample_2",
            check: (quotation) => {
                return quotation.breakdown.some(i => i.item.includes("重新装裱"));
            }
        },
        {
            name: "样例3: 工业风金属书架",
            description: "金属材质，严重生锈",
            expected: "应该包含严重破损修复费用",
            sampleId: "sample_3",
            check: (quotation) => {
                return quotation.breakdown.some(i => i.category === "破损修复" && i.description && i.description.includes("严重"));
            }
        },
        {
            name: "脏数据样例",
            description: "包含各种无效输入",
            expected: "应该产生问题列表并标记所有错误",
            sampleId: "sample_invalid",
            check: (quotation, validationResult) => {
                return validationResult.errors.length > 0 || problemsList.length > 0;
            }
        }
    ];
    
    const results = tests.map(test => {
        const sample = SAMPLES.find(s => s.id === test.sampleId);
        const validationResult = validateInput({
            furniture: sample.furniture,
            damages: sample.damages,
            processes: sample.processes,
            transport: sample.transport,
            budget: sample.budget
        });
        
        let quotation = null;
        let passed = false;
        
        if (validationResult.isValid) {
            quotation = calculateQuotation(validationResult.validData);
            try {
                passed = test.check(quotation, validationResult);
            } catch (e) {
                passed = false;
            }
        } else {
            try {
                passed = test.check(null, validationResult);
            } catch (e) {
                passed = false;
            }
        }
        
        return {
            ...test,
            passed,
            quotation,
            validationResult
        };
    });
    
    const passedCount = results.filter(r => r.passed).length;
    
    let html = `
        <h3>验证结果: ${passedCount}/${results.length} 通过</h3>
        <table class="verification-table">
            <thead>
                <tr>
                    <th>测试用例</th>
                    <th>描述</th>
                    <th>预期</th>
                    <th>状态</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    results.forEach(result => {
        html += `
            <tr>
                <td>${result.name}</td>
                <td>${result.description}</td>
                <td>${result.expected}</td>
                <td class="status-${result.passed ? 'pass' : 'fail'}">
                    ${result.passed ? '✓ 通过' : '✗ 失败'}
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
        
        <div style="margin-top: 30px;">
            <h3>问题列表验证</h3>
            <p>当前问题列表共有 ${problemsList.length} 条记录</p>
            ${problemsList.length > 0 ? `
                <p>问题类型分布:</p>
                <ul>
                    <li>严重错误 (CRITICAL): ${problemsList.filter(p => p.severity === 'critical').length}</li>
                    <li>警告 (WARNING): ${problemsList.filter(p => p.severity === 'warning').length}</li>
                </ul>
            ` : '<p class="empty-state">暂无问题记录</p>'}
        </div>
    `;
    
    container.innerHTML = html;
}

function initButtons() {
    document.getElementById('calculate-btn').addEventListener('click', () => {
        const data = collectFormData();
        const validationResult = validateInput(data);
        
        renderValidationResult(validationResult.errors, validationResult.warnings);
        
        if (validationResult.isValid) {
            const quotation = calculateQuotation(validationResult.validData);
            renderQuotationResult(quotation);
        } else {
            document.getElementById('quotation-result').innerHTML = `
                <div class="validation-item error">
                    <strong>无法计算报价</strong><br>
                    请修复上述错误后重试
                </div>
            `;
        }
    });
    
    document.getElementById('clear-btn').addEventListener('click', () => {
        document.querySelectorAll('input, select').forEach(el => {
            if (el.type === 'checkbox') {
                el.checked = false;
            } else {
                el.value = '';
            }
        });
        
        document.getElementById('transport-floor').value = 'no';
        
        document.querySelectorAll('.damage-level').forEach(select => {
            select.value = '0';
        });
        
        document.getElementById('quotation-result').innerHTML = '<p class="empty-state">请填写数据后点击计算报价</p>';
        document.getElementById('input-validation').innerHTML = '<p class="empty-state">暂无验证结果</p>';
    });
    
    document.getElementById('load-sample-btn').addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.tab-btn[data-tab="samples"]').classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById('samples').classList.add('active');
        renderSamples();
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initButtons();
    renderRules();
});
