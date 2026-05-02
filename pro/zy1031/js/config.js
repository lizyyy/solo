/**
 * 羽毛球训练复盘工具配置文件
 */

const CONFIG = {
    // 羽毛球场地尺寸（单位：米）
    court: {
        singles: {
            width: 5.18,  // 单打场地宽度
            length: 13.4   // 单打场地长度
        },
        doubles: {
            width: 6.1,   // 双打场地宽度
            length: 13.4  // 双打场地长度
        },
        netHeight: 1.55,  // 网高
        serviceLine: 1.98, // 发球线距离网的距离
        shortServiceLine: 0.76  // 前发球线
    },
    
    // 数据字段配置
    fields: {
        required: ['球员', '拍型', '落点X', '落点Y', '回合结果'],
        optional: ['时间段', '备注', '训练日期']
    },
    
    // 落点坐标范围（相对于场地中心）
    coordinates: {
        minX: -3.5,
        maxX: 3.5,
        minY: -7.5,
        maxY: 7.5
    },
    
    // 拍型枚举
    shotTypes: [
        '高远球',
        '平高球',
        '杀球',
        '吊球',
        '搓球',
        '推球',
        '勾球',
        '扑球',
        '挑球',
        '接杀',
        '抽球',
        '挡网'
    ],
    
    // 回合结果枚举
    resultTypes: [
        '得分',
        '失分',
        '继续'
    ],
    
    // 时间段枚举
    timePeriods: [
        '热身',
        '开场',
        '相持',
        '收尾',
        '其他'
    ],
    
    // 热力图配置
    heatmap: {
        radius: 0.3,  // 热点半径（米）
        maxOpacity: 0.8,
        minOpacity: 0.1,
        blur: 0.2
    },
    
    // 颜色配置
    colors: {
        primary: '#2563eb',
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
        info: '#2563eb',
        neutral: '#6b7280',
        heatmap: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
    },
    
    // 本地存储键名
    storage: {
        trainingData: 'badminton_training_data',
        notes: 'badminton_notes',
        settings: 'badminton_settings'
    },
    
    // 导出配置
    export: {
        reportTitle: '羽毛球训练复盘报告',
        includeHeatmapDescription: true,
        includeStatistics: true,
        includeProblems: true,
        includeSuggestions: true
    }
};

// 场地区域定义（用于分析落点分布）
const COURT_ZONES = {
    singles: [
        { name: '左前场', xMin: -2.59, xMax: 0, yMin: -6.7, yMax: -3.0 },
        { name: '右前场', xMin: 0, xMax: 2.59, yMin: -6.7, yMax: -3.0 },
        { name: '左中场', xMin: -2.59, xMax: 0, yMin: -3.0, yMax: 3.0 },
        { name: '右中场', xMin: 0, xMax: 2.59, yMin: -3.0, yMax: 3.0 },
        { name: '左后场', xMin: -2.59, xMax: 0, yMin: 3.0, yMax: 6.7 },
        { name: '右后场', xMin: 0, xMax: 2.59, yMin: 3.0, yMax: 6.7 }
    ],
    doubles: [
        { name: '左前场', xMin: -3.05, xMax: 0, yMin: -6.7, yMax: -3.0 },
        { name: '右前场', xMin: 0, xMax: 3.05, yMin: -6.7, yMax: -3.0 },
        { name: '左中场', xMin: -3.05, xMax: 0, yMin: -3.0, yMax: 3.0 },
        { name: '右中场', xMin: 0, xMax: 3.05, yMin: -3.0, yMax: 3.0 },
        { name: '左后场', xMin: -3.05, xMax: 0, yMin: 3.0, yMax: 6.7 },
        { name: '右后场', xMin: 0, xMax: 3.05, yMin: 3.0, yMax: 6.7 }
    ]
};

// 拍型与技术类别映射
const SHOT_TYPE_CATEGORIES = {
    '进攻': ['杀球', '扑球', '抽球'],
    '防守': ['接杀', '挡网', '挑球'],
    '网前': ['搓球', '勾球', '推球', '挡网'],
    '后场': ['高远球', '平高球', '杀球', '吊球'],
    '过渡': ['吊球', '挡网', '挑球']
};

// 默认示例数据配置
const SAMPLE_DATA_CONFIG = {
    players: ['张三', '李四', '王五', '赵六'],
    trainingDates: ['2026-05-01', '2026-05-03'],
    shotCountPerSession: 150
};
