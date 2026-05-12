const customerFields = [
  {
    key: 'customerNo',
    label: '客户编号',
    type: 'string',
    required: true,
    isUniqueKey: true,
    description: '客户唯一编号，用于去重判断',
  },
  {
    key: 'customerName',
    label: '客户名称',
    type: 'string',
    required: true,
    description: '客户姓名或公司名称',
  },
  {
    key: 'phone',
    label: '联系电话',
    type: 'string',
    required: false,
    description: '手机号或固定电话',
  },
  {
    key: 'email',
    label: '电子邮箱',
    type: 'string',
    required: false,
    format: 'email',
    description: '有效的邮箱地址',
  },
  {
    key: 'level',
    label: '客户等级',
    type: 'enum',
    required: false,
    enumValues: ['normal', 'silver', 'gold', 'platinum'],
    enumLabels: ['普通', '白银', '黄金', '铂金'],
    defaultValue: 'normal',
    description: '客户等级枚举值',
  },
  {
    key: 'source',
    label: '客户来源',
    type: 'enum',
    required: false,
    enumValues: ['online', 'offline', 'referral', 'advertisement'],
    enumLabels: ['线上', '线下', '转介绍', '广告'],
    description: '客户来源渠道',
  },
  {
    key: 'province',
    label: '省份',
    type: 'string',
    required: false,
    description: '省/直辖市',
  },
  {
    key: 'city',
    label: '城市',
    type: 'string',
    required: false,
    description: '城市',
  },
  {
    key: 'address',
    label: '详细地址',
    type: 'string',
    required: false,
    description: '详细地址信息',
  },
  {
    key: 'remark',
    label: '备注',
    type: 'string',
    required: false,
    description: '备注信息',
  },
];

const productFields = [
  {
    key: 'productCode',
    label: '商品编码',
    type: 'string',
    required: true,
    isUniqueKey: true,
    description: '商品唯一编码，用于去重判断',
  },
  {
    key: 'productName',
    label: '商品名称',
    type: 'string',
    required: true,
    description: '商品名称',
  },
  {
    key: 'category',
    label: '商品分类',
    type: 'enum',
    required: false,
    enumValues: ['electronics', 'clothing', 'food', 'home', 'beauty', 'other'],
    enumLabels: ['电子', '服装', '食品', '家居', '美妆', '其他'],
    description: '商品分类',
  },
  {
    key: 'price',
    label: '商品价格',
    type: 'number',
    required: false,
    min: 0,
    defaultValue: 0,
    description: '销售价格，非负',
  },
  {
    key: 'stock',
    label: '库存数量',
    type: 'integer',
    required: false,
    min: 0,
    defaultValue: 0,
    description: '库存数量，非负整数',
  },
  {
    key: 'unit',
    label: '计量单位',
    type: 'string',
    required: false,
    defaultValue: '件',
    description: '商品计量单位',
  },
  {
    key: 'brand',
    label: '品牌',
    type: 'string',
    required: false,
    description: '品牌名称',
  },
  {
    key: 'remark',
    label: '备注',
    type: 'string',
    required: false,
    description: '备注信息',
  },
];

const fieldDefinitions = {
  customer: customerFields,
  product: productFields,
};

function getUniqueKeyField(batchType) {
  const fields = fieldDefinitions[batchType] || [];
  return fields.find(f => f.isUniqueKey);
}

function getRequiredFields(batchType) {
  const fields = fieldDefinitions[batchType] || [];
  return fields.filter(f => f.required);
}

function getEnumField(batchType, fieldKey) {
  const fields = fieldDefinitions[batchType] || [];
  return fields.find(f => f.key === fieldKey && f.type === 'enum');
}

function getFieldByKey(batchType, fieldKey) {
  const fields = fieldDefinitions[batchType] || [];
  return fields.find(f => f.key === fieldKey);
}

function getAllFields(batchType) {
  return fieldDefinitions[batchType] || [];
}

module.exports = {
  customerFields,
  productFields,
  fieldDefinitions,
  getUniqueKeyField,
  getRequiredFields,
  getEnumField,
  getFieldByKey,
  getAllFields,
};
