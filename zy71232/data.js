const GameData = {
    paints: [
        { id: 'p1', name: '钛白', category: 'paint', color: '白色', colorCode: '#FFFFFF', price: 15, brand: '马利', grade: 'basic', desc: '基础款白色颜料，覆盖力中等' },
        { id: 'p2', name: '钛白（大师级）', category: 'paint', color: '白色', colorCode: '#FFFFFF', price: 45, brand: '温莎牛顿', grade: 'premium', desc: '大师级白色，覆盖力强，耐光性好' },
        { id: 'p3', name: '柠檬黄', category: 'paint', color: '黄色', colorCode: '#FFF44F', price: 18, brand: '马利', grade: 'basic', desc: '明亮的黄色，透明度高' },
        { id: 'p4', name: '柠檬黄（大师级）', category: 'paint', color: '黄色', colorCode: '#FFF44F', price: 52, brand: '史明克', grade: 'premium', desc: '大师级柠檬黄，色彩纯净' },
        { id: 'p5', name: '大红', category: 'paint', color: '红色', colorCode: '#E23D28', price: 18, brand: '马利', grade: 'basic', desc: '正红色，饱和度高' },
        { id: 'p6', name: '朱砂红', category: 'paint', color: '红色', colorCode: '#C41E3A', price: 58, brand: '史明克', grade: 'premium', desc: '传统朱砂色，色泽沉稳' },
        { id: 'p7', name: '群青', category: 'paint', color: '蓝色', colorCode: '#1C1CF0', price: 22, brand: '马利', grade: 'basic', desc: '经典蓝色，用途广泛' },
        { id: 'p8', name: '普鲁士蓝', category: 'paint', color: '蓝色', colorCode: '#003153', price: 48, brand: '温莎牛顿', grade: 'premium', desc: '深邃的蓝色，历史悠久' },
        { id: 'p9', name: '翠绿', category: 'paint', color: '绿色', colorCode: '#00A86B', price: 20, brand: '马利', grade: 'basic', desc: '鲜艳的绿色，适合风景画' },
        { id: 'p10', name: '橄榄绿', category: 'paint', color: '绿色', colorCode: '#808000', price: 42, brand: '史明克', grade: 'premium', desc: '自然的橄榄绿色，质感细腻' },
        { id: 'p11', name: '紫罗兰', category: 'paint', color: '紫色', colorCode: '#8F00FF', price: 25, brand: '马利', grade: 'basic', desc: '标准紫色，调和性好' },
        { id: 'p12', name: '深紫', category: 'paint', color: '紫色', colorCode: '#4B0082', price: 55, brand: '温莎牛顿', grade: 'premium', desc: '浓郁的深紫色，耐光性极佳' },
        { id: 'p13', name: '赭石', category: 'paint', color: '棕色', colorCode: '#80461B', price: 16, brand: '马利', grade: 'basic', desc: '天然矿物色，适合打底' },
        { id: 'p14', name: '生褐', category: 'paint', color: '棕色', colorCode: '#6B4423', price: 40, brand: '史明克', grade: 'premium', desc: '专业级褐色，稳定性好' },
        { id: 'p15', name: '炭黑', category: 'paint', color: '黑色', colorCode: '#101010', price: 15, brand: '马利', grade: 'basic', desc: '基础黑色，遮盖力强' },
        { id: 'p16', name: '象牙黑', category: 'paint', color: '黑色', colorCode: '#2C2C2C', price: 38, brand: '温莎牛顿', grade: 'premium', desc: '柔和的黑色，适合细腻表现' },
        { id: 'p17', name: '橙色', category: 'paint', color: '橙色', colorCode: '#FF7F00', price: 19, brand: '马利', grade: 'basic', desc: '明亮的橙色，充满活力' },
        { id: 'p18', name: '镉橙', category: 'paint', color: '橙色', colorCode: '#ED872D', price: 60, brand: '史明克', grade: 'premium', desc: '专业级镉橙，色彩持久' },
        { id: 'p19', name: '肉色', category: 'paint', color: '肉色', colorCode: '#FFDBAC', price: 20, brand: '马利', grade: 'basic', desc: '人像画专用基础肉色' },
        { id: 'p20', name: '玫瑰红', category: 'paint', color: '红色', colorCode: '#FF007F', price: 45, brand: '温莎牛顿', grade: 'premium', desc: '浪漫的玫瑰红色，透明感好' },
    ],

    papers: [
        { id: 'pa1', name: '8K素描纸', category: 'paper', spec: '8K 160g', sheets: 20, price: 12, brand: '马利', grade: 'basic', desc: '入门级素描纸，适合练习' },
        { id: 'pa2', name: '8K素描纸（专业）', category: 'paper', spec: '8K 200g', sheets: 20, price: 28, brand: '康颂', grade: 'premium', desc: '专业级素描纸，纹理细腻' },
        { id: 'pa3', name: '4K素描纸', category: 'paper', spec: '4K 160g', sheets: 20, price: 18, brand: '马利', grade: 'basic', desc: '大尺寸入门素描纸' },
        { id: 'pa4', name: '4K素描纸（专业）', category: 'paper', spec: '4K 200g', sheets: 20, price: 45, brand: '康颂', grade: 'premium', desc: '专业级4K素描纸，耐擦性好' },
        { id: 'pa5', name: '8K水彩纸', category: 'paper', spec: '8K 300g', sheets: 10, price: 35, brand: '马利', grade: 'basic', desc: '入门级水彩纸，中粗纹理' },
        { id: 'pa6', name: '8K水彩纸（专业）', category: 'paper', spec: '8K 300g', sheets: 10, price: 85, brand: '阿诗', grade: 'premium', desc: '顶级水彩纸，收藏级品质' },
        { id: 'pa7', name: '4K水彩纸', category: 'paper', spec: '4K 300g', sheets: 10, price: 55, brand: '康颂', grade: 'basic', desc: '大尺寸水彩纸，性价比高' },
        { id: 'pa8', name: '4K水彩纸（专业）', category: 'paper', spec: '4K 640g', sheets: 5, price: 120, brand: '阿诗', grade: 'premium', desc: '厚重水彩纸，适合多层渲染' },
        { id: 'pa9', name: '16K速写本', category: 'paper', spec: '16K 120g', sheets: 60, price: 25, brand: '遵爵', grade: 'basic', desc: '便携速写本，随时记录灵感' },
        { id: 'pa10', name: '8K速写本', category: 'paper', spec: '8K 140g', sheets: 40, price: 45, brand: '遵爵', grade: 'premium', desc: '高品质速写本，适合创作' },
        { id: 'pa11', name: '水彩本', category: 'paper', spec: '32K 200g', sheets: 30, price: 38, brand: '康颂', grade: 'basic', desc: '口袋水彩本，随身携带' },
        { id: 'pa12', name: '色粉纸', category: 'paper', spec: '8K 160g', sheets: 15, price: 32, brand: '马利', grade: 'basic', desc: '色粉画专用纸，有纹理' },
    ],

    tools: [
        { id: 't1', name: 'HB铅笔', category: 'tool', type: '铅笔', price: 3, brand: '中华', grade: 'basic', desc: '中等硬度铅笔，适合起稿' },
        { id: 't2', name: '2B铅笔', category: 'tool', type: '铅笔', price: 3, brand: '中华', grade: 'basic', desc: '软性铅笔，适合素描' },
        { id: 't3', name: '4B铅笔', category: 'tool', type: '铅笔', price: 3, brand: '中华', grade: 'basic', desc: '较软铅笔，适合深色' },
        { id: 't4', name: '6B铅笔', category: 'tool', type: '铅笔', price: 4, brand: '中华', grade: 'basic', desc: '软质铅笔，适合暗部' },
        { id: 't5', name: '专业铅笔套装', category: 'tool', type: '铅笔', price: 58, brand: '三菱', grade: 'premium', desc: '包含2H-8B共10支，专业品质' },
        { id: 't6', name: '圆头水彩笔4号', category: 'tool', type: '水彩笔', price: 15, brand: '马利', grade: 'basic', desc: '入门级尼龙毛水彩笔' },
        { id: 't7', name: '圆头水彩笔8号', category: 'tool', type: '水彩笔', price: 18, brand: '马利', grade: 'basic', desc: '入门级尼龙毛水彩笔' },
        { id: 't8', name: '松鼠毛水彩笔6号', category: 'tool', type: '水彩笔', price: 85, brand: '达芬奇', grade: 'premium', desc: '顶级松鼠毛，吸水性极佳' },
        { id: 't9', name: '平涂笔12号', category: 'tool', type: '水彩笔', price: 25, brand: '马利', grade: 'basic', desc: '适合大面积铺色' },
        { id: 't10', name: '勾线笔', category: 'tool', type: '勾线笔', price: 12, brand: '樱花', grade: 'basic', desc: '0.5mm针管勾线笔' },
        { id: 't11', name: '可塑橡皮', category: 'tool', type: '橡皮', price: 5, brand: '马利', grade: 'basic', desc: '可塑橡皮，适合提亮' },
        { id: 't12', name: '绘图橡皮', category: 'tool', type: '橡皮', price: 3, brand: '樱花', grade: 'basic', desc: '硬橡皮，擦除干净' },
        { id: 't13', name: '自动橡皮', category: 'tool', type: '橡皮', price: 18, brand: '三菱', grade: 'premium', desc: '笔式自动橡皮，精准擦除' },
        { id: 't14', name: '美工刀', category: 'tool', type: '刀具', price: 8, brand: '得力', grade: 'basic', desc: '基础美工刀' },
        { id: 't15', name: '胶带', category: 'tool', type: '胶带', price: 6, brand: '得力', grade: 'basic', desc: '美纹纸胶带，不伤纸' },
        { id: 't16', name: '调色盘', category: 'tool', type: '调色盘', price: 15, brand: '马利', grade: 'basic', desc: '24格陶瓷调色盘' },
        { id: 't17', name: '折叠水桶', category: 'tool', type: '水桶', price: 12, brand: '马利', grade: 'basic', desc: '便携折叠洗笔筒' },
        { id: 't18', name: '洗笔器', category: 'tool', type: '水桶', price: 35, brand: '温莎牛顿', grade: 'premium', desc: '专业不锈钢洗笔器' },
        { id: 't19', name: '素描板', category: 'tool', type: '画板', price: 35, brand: '马利', grade: 'basic', desc: '8K便携素描板' },
        { id: 't20', name: '画架', category: 'tool', type: '画架', price: 120, brand: '马利', grade: 'premium', desc: '铝合金折叠画架' },
        { id: 't21', name: '彩色铅笔12色', category: 'tool', type: '彩铅', price: 28, brand: '马利', grade: 'basic', desc: '基础12色彩铅' },
        { id: 't22', name: '彩色铅笔36色', category: 'tool', type: '彩铅', price: 68, brand: '马可', grade: 'premium', desc: '专业36色油性彩铅' },
        { id: 't23', name: '色粉笔12色', category: 'tool', type: '色粉', price: 35, brand: '马利', grade: 'basic', desc: '基础12色色粉笔' },
        { id: 't24', name: '色粉笔24色', category: 'tool', type: '色粉', price: 88, brand: '史明克', grade: 'premium', desc: '专业24色色粉笔' },
    ],

    levels: [
        {
            id: 1,
            title: '静物素描入门',
            theme: '静物素描',
            difficulty: 1,
            budget: 150,
            description: '学习静物素描的基础，只需要最基本的工具',
            requiredColors: ['黑色', '白色'],
            requiredTools: ['铅笔', '橡皮'],
            requiredPaper: '4K素描纸',
            suggestedItems: ['t1', 't2', 't3', 't11', 'pa3'],
            scoring: {
                budgetWeight: 40,
                colorWeight: 30,
                toolWeight: 20,
                efficiencyWeight: 10
            },
            passScore: 60
        },
        {
            id: 2,
            title: '色彩基础练习',
            theme: '色彩基础',
            difficulty: 2,
            budget: 280,
            description: '认识三原色，学习基础色彩搭配',
            requiredColors: ['红色', '黄色', '蓝色', '白色', '黑色'],
            requiredTools: ['水彩笔', '调色盘', '水桶'],
            requiredPaper: '8K水彩纸',
            suggestedItems: ['p1', 'p3', 'p5', 'p7', 'p15', 't6', 't16', 't17', 'pa5'],
            scoring: {
                budgetWeight: 35,
                colorWeight: 35,
                toolWeight: 20,
                efficiencyWeight: 10
            },
            passScore: 65
        },
        {
            id: 3,
            title: '风景写生',
            theme: '风景画',
            difficulty: 2,
            budget: 400,
            description: '户外风景写生，需要便携的工具和合适的颜色',
            requiredColors: ['蓝色', '绿色', '黄色', '棕色', '白色'],
            requiredTools: ['水彩笔', '调色盘', '水桶', '画架'],
            requiredPaper: '8K水彩纸',
            suggestedItems: ['p1', 'p3', 'p7', 'p9', 'p13', 't6', 't7', 't16', 't17', 't20', 'pa6'],
            scoring: {
                budgetWeight: 30,
                colorWeight: 35,
                toolWeight: 25,
                efficiencyWeight: 10
            },
            passScore: 65
        },
        {
            id: 4,
            title: '人物肖像',
            theme: '人物画',
            difficulty: 3,
            budget: 500,
            description: '人物肖像画需要肉色调和细腻的工具',
            requiredColors: ['肉色', '红色', '棕色', '黑色', '白色', '黄色'],
            requiredTools: ['水彩笔', '调色盘', '水桶', '勾线笔'],
            requiredPaper: '4K水彩纸',
            suggestedItems: ['p1', 'p3', 'p5', 'p13', 'p15', 'p19', 'p20', 't6', 't7', 't8', 't10', 't16', 't17', 'pa8'],
            scoring: {
                budgetWeight: 25,
                colorWeight: 40,
                toolWeight: 25,
                efficiencyWeight: 10
            },
            passScore: 70
        },
        {
            id: 5,
            title: '创意插画',
            theme: '创意插画',
            difficulty: 3,
            budget: 600,
            description: '自由创作，需要丰富的颜色和多种工具',
            requiredColors: ['红色', '黄色', '蓝色', '绿色', '紫色', '橙色', '白色', '黑色'],
            requiredTools: ['彩铅', '勾线笔', '橡皮'],
            requiredPaper: '8K素描纸',
            suggestedItems: ['p1', 'p3', 'p5', 'p7', 'p9', 'p11', 'p17', 'p15', 't10', 't11', 't22', 'pa2'],
            scoring: {
                budgetWeight: 20,
                colorWeight: 40,
                toolWeight: 30,
                efficiencyWeight: 10
            },
            passScore: 70
        },
        {
            id: 6,
            title: '毕业创作',
            theme: '综合创作',
            difficulty: 4,
            budget: 800,
            description: '综合运用所有知识，完成一幅完整作品',
            requiredColors: ['红色', '黄色', '蓝色', '绿色', '紫色', '橙色', '棕色', '白色', '黑色'],
            requiredTools: ['铅笔', '水彩笔', '调色盘', '水桶', '橡皮', '画架'],
            requiredPaper: '4K水彩纸',
            suggestedItems: ['p1', 'p3', 'p5', 'p7', 'p9', 'p11', 'p13', 'p15', 'p17', 't5', 't6', 't7', 't8', 't11', 't16', 't18', 't20', 'pa8'],
            scoring: {
                budgetWeight: 25,
                colorWeight: 35,
                toolWeight: 30,
                efficiencyWeight: 10
            },
            passScore: 75
        }
    ],

    colorMap: {
        '白色': '#FFFFFF',
        '黑色': '#101010',
        '红色': '#E23D28',
        '黄色': '#FFF44F',
        '蓝色': '#1C1CF0',
        '绿色': '#00A86B',
        '紫色': '#8F00FF',
        '橙色': '#FF7F00',
        '棕色': '#80461B',
        '肉色': '#FFDBAC'
    },

    categoryIcons: {
        'paint': '🎨',
        'paper': '📄',
        'tool': '✏️'
    },

    statusLabels: {
        'approved': '已处理',
        'pending': '待确认',
        'rejected': '需退回',
        'incomplete': '字段不齐'
    },

    requiredFields: [
        'levelId',
        'courseTheme',
        'budget',
        'totalSpent',
        'items',
        'score'
    ]
};
