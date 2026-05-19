import db from '../config/database';
import { PersonInChargeModel } from '../models/person-in-charge.model';
import { PumpRoomModel } from '../models/pump-room.model';
import { InspectionModel } from '../models/inspection.model';
import { RepairService } from '../services/repair.service';

function seedData() {
  console.log('开始初始化示例数据...');

  try {
    const person1 = PersonInChargeModel.create({ name: '张工程师', phone: '13800138001', role: '巡检员' } as any);
    const person2 = PersonInChargeModel.create({ name: '李主管', phone: '13800138002', role: '工程主管' } as any);
    const person3 = PersonInChargeModel.create({ name: '王维修', phone: '13800138003', role: '维修工' } as any);
    console.log(`创建负责人: ${person1}, ${person2}, ${person3}`);

    const pump1 = PumpRoomModel.create({ name: '1号楼地下泵房', location: '1号楼地下一层', building: '1号楼', equipment_count: 3, status: '正常' } as any);
    const pump2 = PumpRoomModel.create({ name: '2号楼地下泵房', location: '2号楼地下一层', building: '2号楼', equipment_count: 2, status: '正常' } as any);
    const pump3 = PumpRoomModel.create({ name: '3号楼地下泵房', location: '3号楼地下二层', building: '3号楼', equipment_count: 4, status: '正常' } as any);
    console.log(`创建泵房: ${pump1}, ${pump2}, ${pump3}`);

    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();

    const insp1 = InspectionModel.create({
      pump_room_id: pump1,
      inspector_id: person1,
      inspection_date: yesterday,
      status: '已报修',
      water_pressure: 0.3,
      water_equipment_status: '异常',
      has_leakage: true,
      noise_level: '大',
      remarks: '发现管道有漏水现象',
      exception_type: '漏水',
      is_needs_repair: true
    } as any);
    console.log(`创建巡检记录: ${insp1}`);

    const repair1 = RepairService.createRepair({
      inspection_id: insp1,
      pump_room_id: pump1,
      reporter_id: person1,
      problem_description: '1号楼泵房进水管道漏水',
      status: '处理中',
      priority: '紧急',
      due_date: today,
      handler_id: person3
    } as any, person1);
    console.log(`创建报修记录: ${repair1.id}`);

    const insp2 = InspectionModel.create({
      pump_room_id: pump2,
      inspector_id: person1,
      inspection_date: yesterday,
      status: '待处理',
      water_pressure: 0.45,
      water_equipment_status: '正常',
      has_leakage: false,
      noise_level: '正常',
      remarks: '巡检正常',
      is_needs_repair: false
    } as any);
    console.log(`创建巡检记录: ${insp2}`);

    const insp3 = InspectionModel.create({
      pump_room_id: pump3,
      inspector_id: person1,
      inspection_date: today,
      status: '已完成',
      water_pressure: 0.42,
      water_equipment_status: '正常',
      has_leakage: false,
      noise_level: '正常',
      remarks: '设备运行正常',
      is_needs_repair: false
    } as any);
    console.log(`创建巡检记录: ${insp3}`);

    console.log('示例数据初始化完成！');
    console.log('');
    console.log('示例账号:');
    console.log('  张工程师 (巡检员) - ID: 1');
    console.log('  李主管 (工程主管) - ID: 2');
    console.log('  王维修 (维修工) - ID: 3');
    console.log('');
    console.log('泵房数据:');
    console.log('  1号楼地下泵房 - ID: 1');
    console.log('  2号楼地下泵房 - ID: 2');
    console.log('  3号楼地下泵房 - ID: 3');

  } catch (error) {
    console.error('初始化数据失败:', error);
    throw error;
  }
}

export { seedData };
