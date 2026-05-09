export const sampleFields = [
  {
    id: 'field_name',
    name: '姓名',
    label: '姓名',
    type: 'text',
    options: [],
    value: ''
  },
  {
    id: 'field_age',
    name: '年龄',
    label: '年龄',
    type: 'number',
    options: [],
    value: ''
  },
  {
    id: 'field_is_student',
    name: '是否学生',
    label: '是否学生',
    type: 'checkbox',
    options: [
      { label: '是', value: true }
    ],
    value: []
  },
  {
    id: 'field_school',
    name: '学校名称',
    label: '学校名称',
    type: 'text',
    options: [],
    value: ''
  },
  {
    id: 'field_occupation',
    name: '职业',
    label: '职业',
    type: 'select',
    options: [
      { label: '请选择', value: '' },
      { label: '学生', value: 'student' },
      { label: '员工', value: 'employee' },
      { label: '自由职业', value: 'freelancer' },
      { label: '其他', value: 'other' }
    ],
    value: ''
  },
  {
    id: 'field_company',
    name: '公司名称',
    label: '公司名称',
    type: 'text',
    options: [],
    value: ''
  },
  {
    id: 'field_income',
    name: '月收入',
    label: '月收入',
    type: 'number',
    options: [],
    value: ''
  },
  {
    id: 'field_income_proof',
    name: '收入证明',
    label: '收入证明',
    type: 'file',
    options: [],
    value: ''
  },
  {
    id: 'field_has_emergency',
    name: '是否有紧急联系人',
    label: '是否有紧急联系人',
    type: 'radio',
    options: [
      { label: '是', value: 'yes' },
      { label: '否', value: 'no' }
    ],
    value: ''
  },
  {
    id: 'field_emergency_name',
    name: '紧急联系人姓名',
    label: '紧急联系人姓名',
    type: 'text',
    options: [],
    value: ''
  },
  {
    id: 'field_emergency_phone',
    name: '紧急联系人电话',
    label: '紧急联系人电话',
    type: 'text',
    options: [],
    value: ''
  }
]

export const sampleRules = [
  {
    id: 'rule_1',
    type: 'visibility',
    targetField: 'field_school',
    conditions: [
      {
        id: 'cond_1_1',
        fieldId: 'field_is_student',
        operator: 'isTrue',
        value: null
      }
    ],
    logicOperator: 'and',
    action: { visible: true },
    enabled: true,
    priority: 0
  },
  {
    id: 'rule_2',
    type: 'visibility',
    targetField: 'field_company',
    conditions: [
      {
        id: 'cond_2_1',
        fieldId: 'field_occupation',
        operator: 'equals',
        value: 'employee'
      }
    ],
    logicOperator: 'and',
    action: { visible: true },
    enabled: true,
    priority: 0
  },
  {
    id: 'rule_3',
    type: 'visibility',
    targetField: 'field_income',
    conditions: [
      {
        id: 'cond_3_1',
        fieldId: 'field_occupation',
        operator: 'notEquals',
        value: 'student'
      }
    ],
    logicOperator: 'and',
    action: { visible: true },
    enabled: true,
    priority: 0
  },
  {
    id: 'rule_4',
    type: 'visibility',
    targetField: 'field_income_proof',
    conditions: [
      {
        id: 'cond_4_1',
        fieldId: 'field_income',
        operator: 'greaterThan',
        value: 10000
      }
    ],
    logicOperator: 'and',
    action: { visible: true },
    enabled: true,
    priority: 0
  },
  {
    id: 'rule_5',
    type: 'required',
    targetField: 'field_school',
    conditions: [
      {
        id: 'cond_5_1',
        fieldId: 'field_is_student',
        operator: 'isTrue',
        value: null
      }
    ],
    logicOperator: 'and',
    action: { required: true },
    enabled: true,
    priority: 0
  },
  {
    id: 'rule_6',
    type: 'required',
    targetField: 'field_company',
    conditions: [
      {
        id: 'cond_6_1',
        fieldId: 'field_occupation',
        operator: 'equals',
        value: 'employee'
      }
    ],
    logicOperator: 'and',
    action: { required: true },
    enabled: true,
    priority: 0
  },
  {
    id: 'rule_7',
    type: 'visibility',
    targetField: 'field_emergency_name',
    conditions: [
      {
        id: 'cond_7_1',
        fieldId: 'field_has_emergency',
        operator: 'equals',
        value: 'yes'
      }
    ],
    logicOperator: 'and',
    action: { visible: true },
    enabled: true,
    priority: 0
  },
  {
    id: 'rule_8',
    type: 'visibility',
    targetField: 'field_emergency_phone',
    conditions: [
      {
        id: 'cond_8_1',
        fieldId: 'field_has_emergency',
        operator: 'equals',
        value: 'yes'
      }
    ],
    logicOperator: 'and',
    action: { visible: true },
    enabled: true,
    priority: 0
  },
  {
    id: 'rule_9',
    type: 'required',
    targetField: 'field_emergency_name',
    conditions: [
      {
        id: 'cond_9_1',
        fieldId: 'field_has_emergency',
        operator: 'equals',
        value: 'yes'
      }
    ],
    logicOperator: 'and',
    action: { required: true },
    enabled: true,
    priority: 0
  },
  {
    id: 'rule_10',
    type: 'required',
    targetField: 'field_emergency_phone',
    conditions: [
      {
        id: 'cond_10_1',
        fieldId: 'field_has_emergency',
        operator: 'equals',
        value: 'yes'
      }
    ],
    logicOperator: 'and',
    action: { required: true },
    enabled: true,
    priority: 0
  },
  {
    id: 'rule_11',
    type: 'validation',
    targetField: 'field_age',
    conditions: [
      {
        id: 'cond_11_1',
        fieldId: 'field_age',
        operator: 'lessThan',
        value: 18
      }
    ],
    logicOperator: 'and',
    action: { message: '年龄必须大于等于 18 岁' },
    enabled: true,
    priority: 0
  }
]

export const problematicRules = [
  ...sampleRules,
  {
    id: 'rule_cycle_1',
    type: 'visibility',
    targetField: 'field_name',
    conditions: [
      {
        id: 'cond_cycle_1',
        fieldId: 'field_school',
        operator: 'isNotEmpty',
        value: null
      }
    ],
    logicOperator: 'and',
    action: { visible: true },
    enabled: true,
    priority: 0
  },
  {
    id: 'rule_cycle_2',
    type: 'visibility',
    targetField: 'field_school',
    conditions: [
      {
        id: 'cond_cycle_2',
        fieldId: 'field_name',
        operator: 'isNotEmpty',
        value: null
      }
    ],
    logicOperator: 'and',
    action: { visible: true },
    enabled: true,
    priority: 0
  }
]

export const conflictingRules = [
  ...sampleRules,
  {
    id: 'rule_conflict_1',
    type: 'visibility',
    targetField: 'field_school',
    conditions: [
      {
        id: 'cond_conflict_1',
        fieldId: 'field_age',
        operator: 'greaterThan',
        value: 25
      }
    ],
    logicOperator: 'and',
    action: { visible: false },
    enabled: true,
    priority: 0
  }
]

export const sampleFormConfig = {
  title: '个人信息登记表',
  description: '请填写以下信息完成注册',
  fields: sampleFields,
  rules: sampleRules
}
