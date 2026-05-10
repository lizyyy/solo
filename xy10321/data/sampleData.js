const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const formatDateTime = (date) => {
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

module.exports = {
  petTypes: [
    { id: 1, name: '小型犬', baseTime: 60, priceMultiplier: 1.0 },
    { id: 2, name: '中型犬', baseTime: 90, priceMultiplier: 1.5 },
    { id: 3, name: '大型犬', baseTime: 120, priceMultiplier: 2.0 },
    { id: 4, name: '猫', baseTime: 60, priceMultiplier: 1.2 }
  ],

  services: [
    { id: 1, name: '基础洗护', basePrice: 80, duration: 60, description: '洗澡、吹干、梳理' },
    { id: 2, name: '精剪造型', basePrice: 150, duration: 90, description: '造型修剪、洗澡' },
    { id: 3, name: 'SPA护理', basePrice: 120, duration: 45, description: '深层护理、按摩' },
    { id: 4, name: '指甲修剪', basePrice: 30, duration: 15, description: '指甲修剪、打磨' },
    { id: 5, name: '耳道清洁', basePrice: 40, duration: 20, description: '耳道检查、清洁' }
  ],

  addOns: [
    { id: 1, name: '开结处理', price: 50, duration: 30 },
    { id: 2, name: '驱虫服务', price: 80, duration: 15 },
    { id: 3, name: '牙齿清洁', price: 60, duration: 20 },
    { id: 4, name: '染色服务', price: 100, duration: 45 }
  ],

  beauticians: [
    { id: 1, name: '李师傅', phone: '138****1234', status: 'active', specialty: ['小型犬', '造型'] },
    { id: 2, name: '王师傅', phone: '139****5678', status: 'active', specialty: ['大型犬', 'SPA'] },
    { id: 3, name: '张师傅', phone: '137****9012', status: 'active', specialty: ['猫', '精剪'] }
  ],

  supplies: [
    { id: 1, name: '沐浴露', unit: 'ml', currentStock: 5000, minStock: 1000, pricePerUnit: 0.05 },
    { id: 2, name: '护毛素', unit: 'ml', currentStock: 3000, minStock: 1000, pricePerUnit: 0.08 },
    { id: 3, name: '一次性毛巾', unit: '条', currentStock: 15, minStock: 20, pricePerUnit: 2.00 },
    { id: 4, name: '耳朵清洁液', unit: 'ml', currentStock: 500, minStock: 200, pricePerUnit: 0.10 },
    { id: 5, name: '指甲剪耗材', unit: '个', currentStock: 20, minStock: 10, pricePerUnit: 5.00 }
  ],

  pets: [
    {
      id: 'pet-001',
      ownerName: '陈先生',
      ownerPhone: '138****8888',
      petName: '旺财',
      typeId: 1,
      breed: '泰迪',
      age: 3,
      gender: '公',
      weight: 5.5,
      notes: '性格温顺，怕吹风机'
    },
    {
      id: 'pet-002',
      ownerName: '刘女士',
      ownerPhone: '139****6666',
      petName: '豆豆',
      typeId: 3,
      breed: '金毛',
      age: 5,
      gender: '公',
      weight: 35,
      notes: '毛发打结严重，需要开结'
    },
    {
      id: 'pet-003',
      ownerName: '赵小姐',
      ownerPhone: '136****3333',
      petName: '咪咪',
      typeId: 4,
      breed: '英短',
      age: 2,
      gender: '母',
      weight: 4.0,
      notes: '胆小，需要安抚'
    }
  ],

  appointments: [
    {
      id: 'apt-001',
      petId: 'pet-001',
      beauticianId: 1,
      serviceId: 1,
      date: formatDate(today),
      startTime: '09:00',
      endTime: '10:00',
      status: 'confirmed',
      basePrice: 80,
      totalPrice: 80,
      addOns: [],
      supplyUsage: [
        { supplyId: 1, quantity: 100 },
        { supplyId: 2, quantity: 80 },
        { supplyId: 3, quantity: 1 }
      ],
      notes: '小型犬正常预约，已完成',
      createdAt: formatDateTime(new Date(today.getTime() - 3600000 * 24)),
      updatedAt: formatDateTime(new Date())
    },
    {
      id: 'apt-002',
      petId: 'pet-002',
      beauticianId: 2,
      serviceId: 2,
      date: formatDate(today),
      startTime: '10:30',
      endTime: '12:30',
      status: 'pending',
      basePrice: 300,
      totalPrice: 300,
      addOns: [],
      supplyUsage: [],
      pendingAddOn: {
        addOnId: 1,
        price: 50,
        duration: 30,
        newEndTime: '13:00',
        reason: '毛发打结严重，需要额外开结处理，预计超时30分钟'
      },
      notes: '大型犬，预约精剪造型，申请加项开结处理',
      createdAt: formatDateTime(new Date(today.getTime() - 3600000 * 2)),
      updatedAt: formatDateTime(new Date())
    },
    {
      id: 'apt-003',
      petId: 'pet-003',
      beauticianId: 3,
      serviceId: 1,
      date: formatDate(tomorrow),
      startTime: '14:00',
      endTime: '15:15',
      status: 'pending',
      basePrice: 96,
      totalPrice: 96,
      addOns: [],
      supplyUsage: [],
      supplyWarning: {
        supplyId: 3,
        supplyName: '一次性毛巾',
        required: 2,
        available: 15,
        message: '一次性毛巾库存即将不足，请及时补货'
      },
      notes: '猫咪基础洗护，需要2条毛巾',
      createdAt: formatDateTime(new Date(today.getTime() - 3600000)),
      updatedAt: formatDateTime(new Date())
    }
  ],

  histories: [
    {
      id: 'hist-001',
      appointmentId: 'apt-001',
      action: 'create',
      field: 'status',
      oldValue: null,
      newValue: 'pending',
      operator: '系统',
      timestamp: formatDateTime(new Date(today.getTime() - 3600000 * 24))
    },
    {
      id: 'hist-002',
      appointmentId: 'apt-001',
      action: 'update',
      field: 'status',
      oldValue: 'pending',
      newValue: 'confirmed',
      operator: '前台',
      timestamp: formatDateTime(new Date(today.getTime() - 3600000 * 20))
    },
    {
      id: 'hist-003',
      appointmentId: 'apt-001',
      action: 'complete',
      field: 'status',
      oldValue: 'confirmed',
      newValue: 'closed',
      operator: '李师傅',
      timestamp: formatDateTime(new Date())
    },
    {
      id: 'hist-004',
      appointmentId: 'apt-002',
      action: 'create',
      field: 'status',
      oldValue: null,
      newValue: 'pending',
      operator: '系统',
      timestamp: formatDateTime(new Date(today.getTime() - 3600000 * 2))
    },
    {
      id: 'hist-005',
      appointmentId: 'apt-002',
      action: 'request_addon',
      field: 'addOns',
      oldValue: '[]',
      newValue: '申请开结处理',
      operator: '王师傅',
      timestamp: formatDateTime(new Date(today.getTime() - 1800000))
    },
    {
      id: 'hist-006',
      appointmentId: 'apt-003',
      action: 'create',
      field: 'status',
      oldValue: null,
      newValue: 'pending',
      operator: '系统',
      timestamp: formatDateTime(new Date(today.getTime() - 3600000))
    },
    {
      id: 'hist-007',
      appointmentId: 'apt-003',
      action: 'supply_warning',
      field: 'supplies',
      oldValue: null,
      newValue: '一次性毛巾库存预警',
      operator: '系统',
      timestamp: formatDateTime(new Date())
    }
  ]
};
