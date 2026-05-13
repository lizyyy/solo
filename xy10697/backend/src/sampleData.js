const storage = require('./storage/memoryStorage');
const CylinderService = require('./services/CylinderService');
const { CylinderStatus } = require('./models/CylinderStatus');
const { subDays } = require('date-fns');

function initSampleData() {
  const sampleCylinders = [
    {
      cylinderNo: 'QP-2024-001',
      specification: '40L',
      material: '钢制无缝',
      manufactureDate: subDays(new Date(), 365).toISOString(),
      lastInspectionDate: subDays(new Date(), 30).toISOString(),
      nextInspectionDate: subDays(new Date(), -335).toISOString()
    },
    {
      cylinderNo: 'QP-2024-002',
      specification: '40L',
      material: '钢制无缝',
      manufactureDate: subDays(new Date(), 730).toISOString(),
      lastInspectionDate: subDays(new Date(), 365).toISOString(),
      nextInspectionDate: subDays(new Date(), -1).toISOString()
    },
    {
      cylinderNo: 'QP-2024-003',
      specification: '50L',
      material: '铝合金',
      manufactureDate: subDays(new Date(), 180).toISOString(),
      lastInspectionDate: subDays(new Date(), 180).toISOString(),
      nextInspectionDate: subDays(new Date(), 185).toISOString()
    },
    {
      cylinderNo: 'QP-2024-004',
      specification: '40L',
      material: '钢制无缝',
      manufactureDate: subDays(new Date(), 1000).toISOString(),
      lastInspectionDate: subDays(new Date(), 500).toISOString(),
      nextInspectionDate: subDays(new Date(), -200).toISOString()
    }
  ];

  sampleCylinders.forEach(data => {
    CylinderService.createCylinder(data, 'admin');
  });

  const cylinder1 = storage.getCylinderByNo('QP-2024-001');
  if (cylinder1) {
    CylinderService.transitionStatus(cylinder1.id, CylinderStatus.FILLING, {
      operator: '张三',
      reason: '开始充装',
      batchNo: 'BATCH-2024-001',
      remark: '氮气充装'
    });

    setTimeout(() => {
      CylinderService.transitionStatus(cylinder1.id, CylinderStatus.FILLED, {
        operator: '张三',
        reason: '充装完成',
        batchNo: 'BATCH-2024-001',
        remark: '压力15MPa'
      });
    }, 100);

    setTimeout(() => {
      CylinderService.transitionStatus(cylinder1.id, CylinderStatus.DELIVERED, {
        operator: '李四',
        reason: '配送完成',
        customer: '华南机械厂',
        remark: '配送至车间A区'
      });
    }, 200);

    setTimeout(() => {
      CylinderService.transitionStatus(cylinder1.id, CylinderStatus.IN_USE, {
        operator: '李四',
        reason: '客户签收使用',
        customer: '华南机械厂',
        remark: '客户正常使用中'
      });
    }, 300);
  }

  const cylinder2 = storage.getCylinderByNo('QP-2024-002');
  if (cylinder2) {
    CylinderService.transitionStatus(cylinder2.id, CylinderStatus.FILLING, {
      operator: '张三',
      reason: '开始充装',
      batchNo: 'BATCH-2024-002',
      remark: '氧气充装'
    });

    setTimeout(() => {
      CylinderService.transitionStatus(cylinder2.id, CylinderStatus.FILLED, {
        operator: '张三',
        reason: '充装完成',
        batchNo: 'BATCH-2024-002'
      });
    }, 100);

    setTimeout(() => {
      CylinderService.transitionStatus(cylinder2.id, CylinderStatus.DELIVERED, {
        operator: '王五',
        reason: '配送完成',
        customer: '东方化工'
      });
    }, 200);

    setTimeout(() => {
      CylinderService.transitionStatus(cylinder2.id, CylinderStatus.IN_USE, {
        operator: '王五',
        reason: '客户签收使用',
        customer: '东方化工'
      });
    }, 300);
  }

  const cylinder3 = storage.getCylinderByNo('QP-2024-003');
  if (cylinder3) {
    CylinderService.transitionStatus(cylinder3.id, CylinderStatus.FILLING, {
      operator: '张三',
      reason: '开始充装',
      batchNo: 'BATCH-2024-003'
    });

    setTimeout(() => {
      CylinderService.transitionStatus(cylinder3.id, CylinderStatus.FILLED, {
        operator: '张三',
        reason: '充装完成',
        batchNo: 'BATCH-2024-003'
      });
    }, 100);

    setTimeout(() => {
      CylinderService.transitionStatus(cylinder3.id, CylinderStatus.DELIVERED, {
        operator: '李四',
        reason: '配送完成',
        customer: '北方电子'
      });
    }, 200);

    setTimeout(() => {
      CylinderService.transitionStatus(cylinder3.id, CylinderStatus.IN_USE, {
        operator: '李四',
        reason: '客户签收使用',
        customer: '北方电子'
      });
    }, 300);

    setTimeout(() => {
      CylinderService.transitionStatus(cylinder3.id, CylinderStatus.COLLECTED, {
        operator: '赵六',
        reason: '回收气瓶',
        customer: '北方电子',
        remark: '客户用完回收'
      });
    }, 400);

    setTimeout(() => {
      CylinderService.transitionStatus(cylinder3.id, CylinderStatus.INSPECTING, {
      operator: '钱七',
      reason: '开始检验'
    });
    }, 500);

    setTimeout(() => {
      CylinderService.transitionStatus(cylinder3.id, CylinderStatus.INSPECTION_FAIL, {
        operator: '钱七',
        reason: '检验不合格',
        remark: '瓶壁有腐蚀痕迹'
      });
    }, 600);

    setTimeout(() => {
      CylinderService.transitionStatus(cylinder3.id, CylinderStatus.SCRAPPED, {
        operator: '管理员',
        reason: '检验不合格报废',
        remark: '腐蚀严重，强制报废'
      });
    }, 700);
  }

  const cylinder4 = storage.getCylinderByNo('QP-2024-004');
  if (cylinder4) {
    CylinderService.transitionStatus(cylinder4.id, CylinderStatus.OVERDUE, {
      operator: 'system',
      reason: '检验超期',
      remark: '系统自动标记超期'
    });
  }

  storage.addCustomer({
    customerNo: 'C001',
    name: '华南机械厂',
    contact: '张经理',
    phone: '13800138001',
    address: '广东省深圳市南山区'
  });

  storage.addCustomer({
    customerNo: 'C002',
    name: '东方化工',
    contact: '李总',
    phone: '13800138002',
    address: '广东省广州市天河区'
  });

  storage.addCustomer({
    customerNo: 'C003',
    name: '北方电子',
    contact: '王工',
    phone: '13800138003',
    address: '北京市海淀区'
  });
}

module.exports = { initSampleData };
