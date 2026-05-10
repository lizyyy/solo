"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatusName = exports.getSampleTypeName = exports.getMaterialTypeName = exports.defaultCountryRules = void 0;
exports.defaultCountryRules = [
    {
        countryCode: 'US',
        countryName: '美国',
        requiredMaterials: ['invoice', 'composition', 'declaration'],
        additionalRequirements: [
            {
                name: '商业发票',
                description: '需包含详细的货物描述、价值、原产地信息',
                mandatory: true
            },
            {
                name: '海关发票编号',
                description: '对于价值超过2500美元的货物需要提供',
                mandatory: false
            }
        ],
        valueThreshold: 2500,
        notes: '美国海关对样品价值超过800美元的货物征收关税，样品声明需注明"无商业价值"'
    },
    {
        countryCode: 'EU',
        countryName: '欧盟',
        requiredMaterials: ['invoice', 'composition', 'declaration'],
        additionalRequirements: [
            {
                name: 'EORI号',
                description: '欧盟境内贸易商需提供EORI号',
                mandatory: true
            },
            {
                name: 'CE认证',
                description: '电气、机械等产品需提供CE认证',
                mandatory: false
            }
        ],
        valueThreshold: 22,
        notes: '欧盟对低于22欧元的样品免征增值税和关税'
    },
    {
        countryCode: 'JP',
        countryName: '日本',
        requiredMaterials: ['invoice', 'composition', 'declaration'],
        additionalRequirements: [
            {
                name: '输入许可',
                description: '特定商品需要日本厚生劳动省许可',
                mandatory: false
            }
        ],
        valueThreshold: 10000,
        notes: '日本海关对低于10000日元的样品简化通关'
    },
    {
        countryCode: 'CN',
        countryName: '中国',
        requiredMaterials: ['invoice', 'composition', 'declaration'],
        additionalRequirements: [
            {
                name: '海关编码',
                description: '准确的HS编码',
                mandatory: true
            }
        ],
        valueThreshold: 50,
        notes: '中国海关对低于50元人民币的样品免征关税'
    },
    {
        countryCode: 'AU',
        countryName: '澳大利亚',
        requiredMaterials: ['invoice', 'composition', 'declaration'],
        additionalRequirements: [
            {
                name: '检疫声明',
                description: '动植物产品需提供检疫声明',
                mandatory: false
            }
        ],
        valueThreshold: 1000,
        notes: '澳大利亚对低于1000澳元的样品简化通关'
    },
    {
        countryCode: 'UK',
        countryName: '英国',
        requiredMaterials: ['invoice', 'composition', 'declaration'],
        additionalRequirements: [
            {
                name: 'EORI号（英国）',
                description: '英国独立的EORI号',
                mandatory: true
            }
        ],
        valueThreshold: 135,
        notes: '英国脱欧后实施独立的海关规则'
    }
];
const getMaterialTypeName = (type) => {
    const names = {
        invoice: '商业发票',
        composition: '成分说明',
        declaration: '用途声明'
    };
    return names[type] || type;
};
exports.getMaterialTypeName = getMaterialTypeName;
const getSampleTypeName = (type) => {
    const names = {
        electronic: '电子产品',
        textile: '纺织品',
        chemical: '化工品',
        food: '食品',
        medical: '医疗用品',
        general: '一般商品'
    };
    return names[type] || type;
};
exports.getSampleTypeName = getSampleTypeName;
const getStatusName = (status) => {
    const names = {
        passed: '通过',
        failed: '未通过',
        pending: '待处理',
        manual_review: '需人工审核'
    };
    return names[status] || status;
};
exports.getStatusName = getStatusName;
