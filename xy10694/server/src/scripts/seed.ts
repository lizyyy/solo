import sequelize from '../config/database';
import ProblemType from '../models/ProblemType';
import GridWorker from '../models/GridWorker';
import ResponsibleUnit from '../models/ResponsibleUnit';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  try {
    await sequelize.sync({ force: true });
    console.log('数据库已重置');

    const unit1 = await ResponsibleUnit.create({
      id: uuidv4(),
      name: '物业管理处',
      code: 'WY-001',
      contactPerson: '张经理',
      contactPhone: '13800138001',
      level: 1,
      isActive: true,
      canHandleTypes: JSON.stringify([])
    });

    const unit2 = await ResponsibleUnit.create({
      id: uuidv4(),
      name: '市政维修科',
      code: 'SZ-001',
      contactPerson: '李科长',
      contactPhone: '13800138002',
      level: 1,
      isActive: true,
      canHandleTypes: JSON.stringify([])
    });

    const unit3 = await ResponsibleUnit.create({
      id: uuidv4(),
      name: '社区服务中心',
      code: 'SQ-001',
      contactPerson: '王主任',
      contactPhone: '13800138003',
      level: 1,
      isActive: true,
      canHandleTypes: JSON.stringify([])
    });

    console.log('责任单位已创建');

    const type1 = await ProblemType.create({
      id: uuidv4(),
      name: '设备维修',
      code: 'WX-001',
      level: 1,
      isActive: true,
      defaultUnitId: unit1.id,
      priority: 2
    });

    const type2 = await ProblemType.create({
      id: uuidv4(),
      name: '环境卫生',
      code: 'HJ-001',
      level: 1,
      isActive: true,
      defaultUnitId: unit2.id,
      priority: 1
    });

    const type3 = await ProblemType.create({
      id: uuidv4(),
      name: '邻里纠纷',
      code: 'JF-001',
      level: 1,
      isActive: true,
      defaultUnitId: unit3.id,
      priority: 3
    });

    const type4 = await ProblemType.create({
      id: uuidv4(),
      name: '政策咨询',
      code: 'ZX-001',
      level: 1,
      isActive: true,
      defaultUnitId: null,
      priority: 1
    });

    console.log('问题类型已创建');

    await GridWorker.create({
      id: uuidv4(),
      name: '网格员小王',
      phone: '13900139001',
      employeeId: 'GW-001',
      gridCodes: JSON.stringify(['GRID-001', 'GRID-002']),
      isActive: true
    });

    await GridWorker.create({
      id: uuidv4(),
      name: '网格员小李',
      phone: '13900139002',
      employeeId: 'GW-002',
      gridCodes: JSON.stringify(['GRID-003', 'GRID-004']),
      isActive: true
    });

    console.log('网格员已创建');
    console.log('初始化数据完成！');
    console.log('测试场景说明：');
    console.log('1. 正常流程：选择"设备维修"问题类型 + GRID-001网格 - 会自动分派');
    console.log('2. 规则拦截：选择"政策咨询"问题类型 - 无默认责任单位，会被拦截');
    console.log('3. 人工复核：描述包含"投诉"、"安全"等关键词或勾选紧急 - 进入复核');
    console.log('4. 重复提交：24小时内相同地址+相同问题类型+相似描述 - 判定重复');
    
    process.exit(0);
  } catch (error) {
    console.error('初始化数据失败:', error);
    process.exit(1);
  }
}

seed();
