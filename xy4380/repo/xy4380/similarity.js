const CATEGORY_KEYWORDS = {
    '电子产品': ['手机', '电脑', '笔记本', '平板', 'ipad', '耳机', '蓝牙', '充电器', '充电宝', '相机', '手表', '智能'],
    '箱包类': ['行李箱', '拉杆箱', '背包', '双肩包', '手提包', '公文包', '钱包', '书包', '袋子', '箱包'],
    '衣物类': ['外套', '衣服', '裤子', '帽子', '围巾', '手套', '大衣', '毛衣', '衬衫', '夹克'],
    '证件类': ['身份证', '护照', '驾驶证', '学生证', '工作证', '名片', '银行卡', '信用卡'],
    '首饰类': ['项链', '戒指', '手链', '耳环', '手镯', '首饰', '珠宝', '钻石', '黄金'],
    '文件类': ['文件', '合同', '票据', '发票', '机票', '登机牌', '车票', '资料', '证书'],
    '生活用品': ['钥匙', '眼镜', '雨伞', '水杯', '保温杯', '化妆品', '护肤品', '药品']
};

const COLOR_KEYWORDS = {
    '黑色': ['黑', '黑色', 'black', 'dark'],
    '白色': ['白', '白色', 'white', 'light'],
    '红色': ['红', '红色', 'red'],
    '蓝色': ['蓝', '蓝色', 'blue'],
    '绿色': ['绿', '绿色', 'green'],
    '黄色': ['黄', '黄色', 'yellow'],
    '紫色': ['紫', '紫色', 'purple'],
    '灰色': ['灰', '灰色', 'gray', 'grey'],
    '棕色': ['棕', '棕色', '咖啡色', 'brown'],
    '粉色': ['粉', '粉色', 'pink'],
    '银色': ['银', '银色', 'silver'],
    '金色': ['金', '金色', 'gold']
};

const BRAND_KEYWORDS = {
    '苹果': ['苹果', 'apple', 'iphone', 'mac', 'ipad', 'airpods'],
    '华为': ['华为', 'huawei', 'mate', 'p系列'],
    '三星': ['三星', 'samsung', 'galaxy'],
    '小米': ['小米', 'xiaomi', 'mi'],
    '耐克': ['耐克', 'nike'],
    '阿迪': ['阿迪', 'adidas'],
    '新秀丽': ['新秀丽', 'samsonite'],
    '路易威登': ['lv', 'louis vuitton', '路易威登'],
    '古驰': ['gucci', '古驰'],
    '香奈儿': ['chanel', '香奈儿']
};

function extractKeywords(text) {
    if (!text) return [];
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/[\s，。！？、；：""''（）()【】\[\]、.,!?;:'"]+/).filter(w => w.length >= 2);
    return [...new Set(words)];
}

function extractCategories(text, tags = []) {
    const categories = new Set();
    const combinedText = (text || '') + ' ' + (tags || []).join(' ');
    const lowerText = combinedText.toLowerCase();
    
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                categories.add(category);
                break;
            }
        }
    }
    
    return Array.from(categories);
}

function extractColors(text, tags = []) {
    const colors = new Set();
    const combinedText = (text || '') + ' ' + (tags || []).join(' ');
    const lowerText = combinedText.toLowerCase();
    
    for (const [color, keywords] of Object.entries(COLOR_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                colors.add(color);
                break;
            }
        }
    }
    
    return Array.from(colors);
}

function extractBrands(text, tags = []) {
    const brands = new Set();
    const combinedText = (text || '') + ' ' + (tags || []).join(' ');
    const lowerText = combinedText.toLowerCase();
    
    for (const [brand, keywords] of Object.entries(BRAND_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                brands.add(brand);
                break;
            }
        }
    }
    
    return Array.from(brands);
}

function jaccardSimilarity(setA, setB) {
    if (setA.length === 0 && setB.length === 0) return 1;
    if (setA.length === 0 || setB.length === 0) return 0;
    
    const intersection = setA.filter(x => setB.includes(x)).length;
    const union = new Set([...setA, ...setB]).size;
    
    return intersection / union;
}

function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    
    return dp[m][n];
}

function stringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1;
    const distance = levenshteinDistance(s1, s2);
    return 1 - distance / maxLen;
}

function calculateMatch(item, claim) {
    const itemText = (item.description || '') + ' ' + (item.tags || []).join(' ');
    const claimText = (claim.description || '') + ' ' + (claim.tags || []).join(' ');
    
    const itemKeywords = extractKeywords(itemText);
    const claimKeywords = extractKeywords(claimText);
    
    const itemCategories = extractCategories(item.description, item.tags);
    const claimCategories = extractCategories(claim.description, claim.tags);
    
    const itemColors = extractColors(item.description, item.tags);
    const claimColors = extractColors(claim.description, claim.tags);
    
    const itemBrands = extractBrands(item.description, item.tags);
    const claimBrands = extractBrands(claim.description, claim.tags);
    
    const categoryScore = jaccardSimilarity(itemCategories, claimCategories);
    const colorScore = jaccardSimilarity(itemColors, claimColors);
    const brandScore = jaccardSimilarity(itemBrands, claimBrands);
    const keywordScore = jaccardSimilarity(itemKeywords, claimKeywords);
    const textSimilarity = stringSimilarity(itemText, claimText);
    
    const conflicts = [];
    const matchingPoints = [];
    
    if (itemCategories.length > 0 && claimCategories.length > 0) {
        const commonCategories = itemCategories.filter(c => claimCategories.includes(c));
        if (commonCategories.length > 0) {
            matchingPoints.push(`物品类别匹配: ${commonCategories.join('、')}`);
        } else {
            conflicts.push(`类别不匹配: 物品类别为${itemCategories.join('、')}，认领描述为${claimCategories.join('、')}`);
        }
    }
    
    if (itemColors.length > 0 && claimColors.length > 0) {
        const commonColors = itemColors.filter(c => claimColors.includes(c));
        if (commonColors.length > 0) {
            matchingPoints.push(`颜色匹配: ${commonColors.join('、')}`);
        } else {
            conflicts.push(`颜色不匹配: 物品颜色为${itemColors.join('、')}，认领描述为${claimColors.join('、')}`);
        }
    }
    
    if (itemBrands.length > 0 && claimBrands.length > 0) {
        const commonBrands = itemBrands.filter(b => claimBrands.includes(b));
        if (commonBrands.length > 0) {
            matchingPoints.push(`品牌匹配: ${commonBrands.join('、')}`);
        } else {
            conflicts.push(`品牌不匹配: 物品品牌为${itemBrands.join('、')}，认领描述为${claimBrands.join('、')}`);
        }
    }
    
    if (item.foundDate && claim.lostDate) {
        const foundDate = new Date(item.foundDate);
        const lostDate = new Date(claim.lostDate);
        const dateDiff = Math.abs(foundDate - lostDate) / (1000 * 60 * 60 * 24);
        
        if (dateDiff <= 1) {
            matchingPoints.push('丢失/发现日期接近');
        } else if (dateDiff > 7) {
            conflicts.push(`日期差距较大: 发现日期${item.foundDate}，丢失日期${claim.lostDate}`);
        }
    }
    
    if (item.location && claim.lostLocation) {
        const locScore = stringSimilarity(item.location, claim.lostLocation);
        if (locScore > 0.5) {
            matchingPoints.push(`地点描述相似: ${item.location} vs ${claim.lostLocation}`);
        } else if (locScore < 0.2 && item.location && claim.lostLocation) {
            conflicts.push(`地点描述差异: ${item.location} vs ${claim.lostLocation}`);
        }
    }
    
    const categoryWeight = 0.35;
    const colorWeight = 0.25;
    const brandWeight = 0.2;
    const keywordWeight = 0.1;
    const textWeight = 0.1;
    
    let hasCategory = itemCategories.length > 0 || claimCategories.length > 0;
    let hasColor = itemColors.length > 0 || claimColors.length > 0;
    let hasBrand = itemBrands.length > 0 || claimBrands.length > 0;
    
    let usedWeight = 0;
    if (hasCategory) usedWeight += categoryWeight;
    if (hasColor) usedWeight += colorWeight;
    if (hasBrand) usedWeight += brandWeight;
    usedWeight += keywordWeight + textWeight;
    
    let overallScore = 0;
    if (usedWeight > 0) {
        overallScore = (
            (hasCategory ? categoryScore * categoryWeight : 0) +
            (hasColor ? colorScore * colorWeight : 0) +
            (hasBrand ? brandScore * brandWeight : 0) +
            keywordScore * keywordWeight +
            textSimilarity * textWeight
        ) / usedWeight;
    }
    
    let riskLevel = 'low';
    let riskReasons = [];
    
    if (conflicts.length > 0) {
        riskLevel = 'high';
        riskReasons.push(`存在 ${conflicts.length} 个冲突点`);
    }
    
    if (overallScore >= 0.8) {
        riskLevel = 'low';
    } else if (overallScore >= 0.5) {
        if (conflicts.length === 0) {
            riskLevel = 'medium';
            riskReasons.push('匹配度中等，需要人工确认');
        } else {
            riskLevel = 'high';
        }
    } else {
        if (matchingPoints.length > 0) {
            riskLevel = 'high';
            riskReasons.push('匹配度低但存在部分匹配点，需警惕冒领');
        } else {
            riskLevel = 'medium';
            riskReasons.push('匹配度较低');
        }
    }
    
    if (claim.passengerName && item.passengerName) {
        if (claim.passengerName !== item.passengerName) {
            riskLevel = 'high';
            conflicts.push(`乘客姓名不一致: 物品记录为${item.passengerName}，认领人为${claim.passengerName}`);
        }
    }
    
    if (claim.flightNumber && item.flightNumber) {
        if (claim.flightNumber !== item.flightNumber) {
            riskLevel = 'high';
            conflicts.push(`航班号不一致: 物品记录为${item.flightNumber}，认领人为${claim.flightNumber}`);
        }
    }
    
    return {
        overallScore: Math.round(overallScore * 100) / 100,
        categoryScore: Math.round(categoryScore * 100) / 100,
        colorScore: Math.round(colorScore * 100) / 100,
        brandScore: Math.round(brandScore * 100) / 100,
        keywordScore: Math.round(keywordScore * 100) / 100,
        textSimilarity: Math.round(textSimilarity * 100) / 100,
        itemCategories,
        claimCategories,
        itemColors,
        claimColors,
        itemBrands,
        claimBrands,
        matchingPoints,
        conflicts,
        riskLevel,
        riskReasons
    };
}

function autoMatchAll(db) {
    const items = db.getAllItems().filter(i => i.status === 'pending');
    const claims = db.getAllClaims().filter(c => c.status === 'pending');
    
    const results = [];
    
    for (const item of items) {
        for (const claim of claims) {
            const match = calculateMatch(item, claim);
            db.saveMatchResult(item.id, claim.claimId, match);
            
            if (match.overallScore >= 0.5) {
                results.push({
                    itemId: item.id,
                    itemPhoto: item.photoUrl,
                    claimId: claim.claimId,
                    claimPassenger: claim.passengerName,
                    ...match
                });
            }
        }
    }
    
    results.sort((a, b) => b.overallScore - a.overallScore);
    
    return {
        totalComparisons: items.length * claims.length,
        potentialMatches: results.length,
        matches: results
    };
}

module.exports = {
    calculateMatch,
    autoMatchAll,
    extractCategories,
    extractColors,
    extractBrands,
    extractKeywords,
    jaccardSimilarity,
    stringSimilarity
};
