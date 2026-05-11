const departments = [
  {
    id: 'dept_001',
    name: '超声科',
    description: '负责超声检查项目',
    daily_capacity: 50,
    current_usage: 0
  },
  {
    id: 'dept_002',
    name: '检验科',
    description: '负责血液、尿液等检验项目',
    daily_capacity: 100,
    current_usage: 0
  },
  {
    id: 'dept_003',
    name: '放射科',
    description: '负责X光、CT等放射检查项目',
    daily_capacity: 30,
    current_usage: 0
  },
  {
    id: 'dept_004',
    name: '内科',
    description: '负责内科检查项目',
    daily_capacity: 80,
    current_usage: 0
  },
  {
    id: 'dept_005',
    name: '外科',
    description: '负责外科检查项目',
    daily_capacity: 80,
    current_usage: 0
  },
  {
    id: 'dept_006',
    name: '眼科',
    description: '负责眼科检查项目',
    daily_capacity: 60,
    current_usage: 0
  },
  {
    id: 'dept_007',
    name: '耳鼻喉科',
    description: '负责耳鼻喉检查项目',
    daily_capacity: 60,
    current_usage: 0
  },
  {
    id: 'dept_008',
    name: '口腔科',
    description: '负责口腔检查项目',
    daily_capacity: 40,
    current_usage: 0
  }
];

const items = [
  {
    id: 'item_001',
    name: '甲状腺彩超',
    description: '甲状腺超声检查',
    price: 180,
    department_id: 'dept_001',
    is_addable: 1
  },
  {
    id: 'item_002',
    name: '腹部彩超',
    description: '腹部超声检查',
    price: 150,
    department_id: 'dept_001',
    is_addable: 1
  },
  {
    id: 'item_003',
    name: '心脏彩超',
    description: '心脏超声检查',
    price: 220,
    department_id: 'dept_001',
    is_addable: 1
  },
  {
    id: 'item_004',
    name: '血常规',
    description: '血液常规检查',
    price: 50,
    department_id: 'dept_002',
    is_addable: 1
  },
  {
    id: 'item_005',
    name: '尿常规',
    description: '尿液常规检查',
    price: 30,
    department_id: 'dept_002',
    is_addable: 1
  },
  {
    id: 'item_006',
    name: '肝功能',
    description: '肝功能检查',
    price: 120,
    department_id: 'dept_002',
    is_addable: 1
  },
  {
    id: 'item_007',
    name: '肾功能',
    description: '肾功能检查',
    price: 100,
    department_id: 'dept_002',
    is_addable: 1
  },
  {
    id: 'item_008',
    name: '胃幽门螺杆菌检测',
    description: 'C14呼气试验',
    price: 150,
    department_id: 'dept_002',
    is_addable: 1
  },
  {
    id: 'item_009',
    name: '胸部X光',
    description: '胸部正位片',
    price: 80,
    department_id: 'dept_003',
    is_addable: 1
  },
  {
    id: 'item_010',
    name: '肺部CT',
    description: '肺部CT检查',
    price: 350,
    department_id: 'dept_003',
    is_addable: 1
  },
  {
    id: 'item_011',
    name: '内科常规',
    description: '内科常规检查',
    price: 40,
    department_id: 'dept_004',
    is_addable: 0
  },
  {
    id: 'item_012',
    name: '血压测量',
    description: '血压测量',
    price: 10,
    department_id: 'dept_004',
    is_addable: 0
  },
  {
    id: 'item_013',
    name: '外科常规',
    description: '外科常规检查',
    price: 40,
    department_id: 'dept_005',
    is_addable: 0
  },
  {
    id: 'item_014',
    name: '眼科常规',
    description: '眼科常规检查',
    price: 30,
    department_id: 'dept_006',
    is_addable: 1
  },
  {
    id: 'item_015',
    name: '耳鼻喉常规',
    description: '耳鼻喉常规检查',
    price: 30,
    department_id: 'dept_007',
    is_addable: 1
  },
  {
    id: 'item_016',
    name: '口腔检查',
    description: '口腔常规检查',
    price: 40,
    department_id: 'dept_008',
    is_addable: 1
  }
];

const packages = [
  {
    id: 'pkg_001',
    name: '个人基础体检套餐',
    description: '适合个人常规体检',
    base_price: 500,
    type: 'personal'
  },
  {
    id: 'pkg_002',
    name: '个人精英体检套餐',
    description: '适合个人深度体检',
    base_price: 1200,
    type: 'personal'
  },
  {
    id: 'pkg_003',
    name: '企业员工基础体检套餐',
    description: '适合企业员工团体体检',
    base_price: 450,
    type: 'enterprise'
  },
  {
    id: 'pkg_004',
    name: '企业高管体检套餐',
    description: '适合企业高管深度体检',
    base_price: 1500,
    type: 'enterprise'
  }
];

const packageItems = [
  { package_id: 'pkg_001', item_ids: ['item_002', 'item_004', 'item_005', 'item_006', 'item_009', 'item_011', 'item_012', 'item_013'] },
  { package_id: 'pkg_002', item_ids: ['item_002', 'item_003', 'item_004', 'item_005', 'item_006', 'item_007', 'item_008', 'item_009', 'item_010', 'item_011', 'item_012', 'item_013', 'item_014', 'item_015', 'item_016'] },
  { package_id: 'pkg_003', item_ids: ['item_004', 'item_005', 'item_006', 'item_009', 'item_011', 'item_012', 'item_013'] },
  { package_id: 'pkg_004', item_ids: ['item_001', 'item_002', 'item_003', 'item_004', 'item_005', 'item_006', 'item_007', 'item_008', 'item_009', 'item_010', 'item_011', 'item_012', 'item_013', 'item_014', 'item_015', 'item_016'] }
];

const customers = [
  {
    id: 'cust_001',
    name: '张三',
    phone: '13800138001',
    id_card: '110101199001011234',
    type: 'personal',
    company_name: null
  },
  {
    id: 'cust_002',
    name: '李四',
    phone: '13800138002',
    id_card: '110101199202022345',
    type: 'personal',
    company_name: null
  },
  {
    id: 'cust_003',
    name: '王五',
    phone: '13800138003',
    id_card: '110101198803033456',
    type: 'enterprise',
    company_name: '科技创新有限公司'
  },
  {
    id: 'cust_004',
    name: '赵六',
    phone: '13800138004',
    id_card: '110101198504044567',
    type: 'enterprise',
    company_name: '科技创新有限公司'
  },
  {
    id: 'cust_005',
    name: '孙七',
    phone: '13800138005',
    id_card: '110101199005055678',
    type: 'enterprise',
    company_name: '金融投资集团'
  }
];

const staff = [
  {
    id: 'staff_001',
    name: '前台王小姐',
    role: 'receptionist'
  },
  {
    id: 'staff_002',
    name: '前台李先生',
    role: 'receptionist'
  },
  {
    id: 'staff_003',
    name: '收费张女士',
    role: 'cashier'
  }
];

module.exports = {
  departments,
  items,
  packages,
  packageItems,
  customers,
  staff
};
