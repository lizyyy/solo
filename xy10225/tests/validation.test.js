const { validateHousehold } = require('../src/services/householdService');
const { validateVolunteer } = require('../src/services/volunteerService');
const { validateDonation } = require('../src/services/donationService');

describe('户主数据验证测试', () => {
  test('有效户主数据应无验证错误', () => {
    const validHousehold = {
      name: '张三',
      address: '北京市朝阳区和平街12号楼',
      phone: '13800138001',
      familyMembers: 3
    };
    
    const errors = validateHousehold(validHousehold);
    expect(errors.length).toBe(0);
  });

  test('空姓名应返回验证错误', () => {
    const invalidHousehold = {
      name: '',
      address: '北京市朝阳区和平街12号楼',
      phone: '13800138001',
      familyMembers: 3
    };
    
    const errors = validateHousehold(invalidHousehold);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('户主姓名不能为空');
  });

  test('空地址应返回验证错误', () => {
    const invalidHousehold = {
      name: '张三',
      address: '',
      phone: '13800138001',
      familyMembers: 3
    };
    
    const errors = validateHousehold(invalidHousehold);
    expect(errors).toContain('住址不能为空');
  });

  test('空电话应返回验证错误', () => {
    const invalidHousehold = {
      name: '张三',
      address: '北京市朝阳区和平街12号楼',
      phone: '',
      familyMembers: 3
    };
    
    const errors = validateHousehold(invalidHousehold);
    expect(errors).toContain('联系电话不能为空');
  });

  test('家庭人数为0应返回验证错误', () => {
    const invalidHousehold = {
      name: '张三',
      address: '北京市朝阳区和平街12号楼',
      phone: '13800138001',
      familyMembers: 0
    };
    
    const errors = validateHousehold(invalidHousehold);
    expect(errors).toContain('家庭人数必须大于等于1');
  });
});

describe('志愿者数据验证测试', () => {
  test('有效志愿者数据应无验证错误', () => {
    const validVolunteer = {
      name: '李志愿者',
      phone: '13900139001'
    };
    
    const errors = validateVolunteer(validVolunteer);
    expect(errors.length).toBe(0);
  });

  test('空姓名应返回验证错误', () => {
    const invalidVolunteer = {
      name: '',
      phone: '13900139001'
    };
    
    const errors = validateVolunteer(invalidVolunteer);
    expect(errors).toContain('志愿者姓名不能为空');
  });

  test('空电话应返回验证错误', () => {
    const invalidVolunteer = {
      name: '李志愿者',
      phone: ''
    };
    
    const errors = validateVolunteer(invalidVolunteer);
    expect(errors).toContain('联系电话不能为空');
  });
});

describe('物资捐赠数据验证测试', () => {
  test('有效捐赠数据应无验证错误', () => {
    const validDonation = {
      itemName: '大米',
      quantity: 50,
      unit: '袋',
      donor: '爱心基金会'
    };
    
    const errors = validateDonation(validDonation);
    expect(errors.length).toBe(0);
  });

  test('空物资名称应返回验证错误', () => {
    const invalidDonation = {
      itemName: '',
      quantity: 50,
      unit: '袋',
      donor: '爱心基金会'
    };
    
    const errors = validateDonation(invalidDonation);
    expect(errors).toContain('物资名称不能为空');
  });

  test('数量为0应返回验证错误', () => {
    const invalidDonation = {
      itemName: '大米',
      quantity: 0,
      unit: '袋',
      donor: '爱心基金会'
    };
    
    const errors = validateDonation(invalidDonation);
    expect(errors).toContain('物资数量必须大于0');
  });

  test('空单位应返回验证错误', () => {
    const invalidDonation = {
      itemName: '大米',
      quantity: 50,
      unit: '',
      donor: '爱心基金会'
    };
    
    const errors = validateDonation(invalidDonation);
    expect(errors).toContain('物资单位不能为空');
  });

  test('空捐赠来源应返回验证错误', () => {
    const invalidDonation = {
      itemName: '大米',
      quantity: 50,
      unit: '袋',
      donor: ''
    };
    
    const errors = validateDonation(invalidDonation);
    expect(errors).toContain('捐赠来源不能为空');
  });
});
