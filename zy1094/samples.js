import { Utils } from './utils.js';

export const SampleData = {
    validOrderCSV: `订单编号,客户名称,下单日期,订单金额,单价,数量,订单状态,是否加急
ORD2024001,张三,2024-01-15,1500,300,5,已支付,否
ORD2024002,李四,2024-01-16,2000,200,10,待支付,是
ORD2024003,王五,2024-01-17,800,800,1,已完成,否
ORD2024004,赵六,2024-01-18,3500,500,7,已发货,是
ORD2024005,钱七,2024-01-19,1200,600,2,待支付,否`,

    validOrderJSON: [
        {
            "订单编号": "ORD2024001",
            "客户名称": "张三",
            "下单日期": "2024-01-15",
            "订单金额": 1500,
            "单价": 300,
            "数量": 5,
            "订单状态": "已支付",
            "是否加急": "否"
        },
        {
            "订单编号": "ORD2024002",
            "客户名称": "李四",
            "下单日期": "2024-01-16",
            "订单金额": 2000,
            "单价": 200,
            "数量": 10,
            "订单状态": "待支付",
            "是否加急": "是"
        }
    ],

    problematicOrderCSV: `订单编号,客户,日期,金额,单价,数量,状态,加急
ORD2024001,张三,2024-01-15,1500,300,5,已支付,否
ORD2024001,李四,2024-01-16,2000,200,10,待支付,是
,王五,2024-01-17,800,800,1,已完成,
ORD2024004,,01/15/2024,1.5万,500,7,已发货,true
ORD2024005,钱七,2024/01/19,1200,600,3,待处理,0
ORD2024006,孙八,2024-01-20,2500,1200,2,无效状态,是
ORD2024007,周九,2024-01-21,1000,abc,10,待支付,是
ORD2024008,吴十,15/01/2024,5000,1000,4,已完成,否`,

    problematicOrderJSON: [
        {
            "订单编号": "ORD2024001",
            "客户名称": "张三",
            "下单日期": "2024-01-15",
            "订单金额": 1500,
            "单价": 300,
            "数量": 5,
            "订单状态": "已支付",
            "是否加急": "否"
        },
        {
            "订单编号": "ORD2024001",
            "客户名称": "李四",
            "下单日期": "01/16/2024",
            "订单金额": "2.5万",
            "单价": 250,
            "数量": 10,
            "订单状态": "待支付",
            "是否加急": "是"
        },
        {
            "订单编号": "",
            "客户名称": "王五",
            "下单日期": "2024-01-17",
            "订单金额": null,
            "单价": 800,
            "数量": 1,
            "订单状态": "已完成",
            "是否加急": ""
        }
    ],

    validEmployeeCSV: `工号,姓名,部门,入职日期,薪资
E001,张三,技术部,2023-06-15,15000
E002,李四,产品部,2023-08-20,18000
E003,王五,运营部,2024-01-05,12000
E004,赵六,市场部,2024-02-10,16000`,

    problematicEmployeeCSV: `员工编号,姓名,部门,入职时间,月薪
E001,张三,技术部,2023-06-15,15000
E002,李四,产品部,2023/08/20,1.8万
E003,王五,未知部门,06-15-2023,12000
E004,,市场部,2024-02-10,16000
E001,孙八,财务部,2024-03-01,20000`,

    dateAmbiguousCSV: `订单编号,开始日期,结束日期
ORD001,03/04/2024,05/06/2024
ORD002,04/03/2024,06/05/2024
ORD003,10/11/2024,12/01/2025`,

    amountMixedCSV: `订单号,金额,单价,数量
ORD001,10000,100,100
ORD002,1万,200,50
ORD003,5000元,50,100
ORD004,0.5万,500,10
ORD005,2千,200,10`,

    crossFieldErrorCSV: `订单编号,开始时间,结束时间,总金额,单价,数量
ORD001,2024-01-15,2024-01-10,1500,300,5
ORD002,2024-02-01,2024-02-15,2000,200,12
ORD003,2024-03-01,2024-02-28,800,100,10`,

    enumErrorCSV: `订单编号,订单状态,是否加急
ORD001,已支付,是
ORD002,待处理,否
ORD003,已取消,是
ORD004,未知状态,否
ORD005,审核中,是`,

    getExamples() {
        return [
            {
                id: 'valid_order',
                name: '✅ 正常订单数据 (CSV)',
                description: '一份完全符合模板规范的订单数据，无任何错误',
                category: '正常数据',
                format: 'csv',
                content: this.validOrderCSV
            },
            {
                id: 'valid_order_json',
                name: '✅ 正常订单数据 (JSON)',
                description: 'JSON 格式的正常订单数据',
                category: '正常数据',
                format: 'json',
                content: JSON.stringify(this.validOrderJSON, null, 2)
            },
            {
                id: 'problematic_order',
                name: '❌ 问题订单数据',
                description: '包含重复订单号、缺必填字段、日期歧义、金额单位混乱、枚举越界、类型错误等多种问题',
                category: '问题数据',
                format: 'csv',
                content: this.problematicOrderCSV
            },
            {
                id: 'problematic_order_json',
                name: '❌ 问题订单数据 (JSON)',
                description: 'JSON 格式的问题数据，包含重复订单号、日期格式、金额单位等问题',
                category: '问题数据',
                format: 'json',
                content: JSON.stringify(this.problematicOrderJSON, null, 2)
            },
            {
                id: 'valid_employee',
                name: '✅ 正常员工数据',
                description: '符合员工信息模板的正常数据',
                category: '正常数据',
                format: 'csv',
                content: this.validEmployeeCSV
            },
            {
                id: 'problematic_employee',
                name: '❌ 问题员工数据',
                description: '包含重复工号、缺姓名、无效部门、日期格式、金额单位等问题',
                category: '问题数据',
                format: 'csv',
                content: this.problematicEmployeeCSV
            },
            {
                id: 'date_ambiguous',
                name: '📅 日期歧义示例',
                description: '日期格式 MM/DD/YYYY 和 DD/MM/YYYY 无法区分的情况',
                category: '问题数据',
                format: 'csv',
                content: this.dateAmbiguousCSV
            },
            {
                id: 'amount_mixed',
                name: '💰 金额单位混乱示例',
                description: '混合使用元、万元、千元等不同单位的金额数据',
                category: '问题数据',
                format: 'csv',
                content: this.amountMixedCSV
            },
            {
                id: 'cross_field_error',
                name: '⚡ 跨列规则冲突示例',
                description: '包含结束时间早于开始时间、金额与单价数量不符等跨列问题',
                category: '问题数据',
                format: 'csv',
                content: this.crossFieldErrorCSV
            },
            {
                id: 'enum_error',
                name: '🚫 枚举越界示例',
                description: '包含不在允许枚举值范围内的订单状态数据',
                category: '问题数据',
                format: 'csv',
                content: this.enumErrorCSV
            }
        ];
    },

    getByCategory() {
        const examples = this.getExamples();
        return Utils.groupBy(examples, e => e.category);
    }
};

export default SampleData;
