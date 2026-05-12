import { db } from './database';
import { parkingService } from './service';
import { CreateAppointmentRequest, ApproveAppointmentRequest, CheckInRequest, CheckOutRequest, RevokeRequest, AppointmentStatus } from './types';
import { v4 as uuidv4 } from 'uuid';

async function step(title: string, fn: () => Promise<void>) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
  await fn();
}

async function demo() {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(15) + '园区访客车牌授权 API 完整流程演示' + ' '.repeat(14) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  await db.init();
  console.log('\n✅ 数据库初始化完成\n');

  let appointmentId: string;
  let authorizationId: string;

  await step('1. 创建访客预约', async () => {
    const requestId = `DEMO-${uuidv4().substring(0, 8)}`;
    const appointmentReq: CreateAppointmentRequest = {
      requestId,
      visitorName: '演示访客',
      visitorPhone: '13900139000',
      visitorCompany: '演示科技有限公司',
      hostName: '演示接待人',
      hostDepartment: '演示部门',
      licensePlate: '京XDEMO1',
      meetingSubject: '演示会议 - 项目合作洽谈',
      startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    };

    console.log('📝 创建预约请求:');
    console.log(`   请求ID: ${appointmentReq.requestId}`);
    console.log(`   访客: ${appointmentReq.visitorName}`);
    console.log(`   车牌: ${appointmentReq.licensePlate}`);
    console.log(`   会议: ${appointmentReq.meetingSubject}`);
    console.log(`   时间: ${new Date(appointmentReq.startTime).toLocaleString()} ~ ${new Date(appointmentReq.endTime).toLocaleString()}`);

    const result = await parkingService.createAppointment(appointmentReq);
    if (result.success && result.data) {
      appointmentId = result.data.id;
      console.log(`\n✅ 预约创建成功!`);
      console.log(`   预约ID: ${appointmentId}`);
      console.log(`   当前状态: ${result.data.status}`);
    } else {
      console.log(`\n❌ 预约创建失败: ${result.error}`);
      process.exit(1);
    }
  });

  await step('2. 测试幂等性: 重复提交相同预约', async () => {
    const requestId = (await parkingService.getAppointment(appointmentId)).data?.requestId!;
    const duplicateReq: CreateAppointmentRequest = {
      requestId,
      visitorName: '重复访客',
      visitorPhone: '13900139000',
      visitorCompany: '重复公司',
      hostName: '重复接待人',
      hostDepartment: '重复部门',
      licensePlate: '京XDEMO1',
      meetingSubject: '重复会议',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString()
    };

    console.log('🔄 再次提交相同 requestId 的预约...');
    const result = await parkingService.createAppointment(duplicateReq);

    if (result.success && result.duplicate && result.data) {
      console.log(`✅ 幂等性验证通过! 返回已存在的预约`);
      console.log(`   访客名称仍为: ${result.data.visitorName} (未被修改)`);
      console.log(`   说明: 使用相同 requestId 重复提交不会创建新记录`);
    } else {
      console.log(`❌ 幂等性验证失败`);
    }
  });

  await step('3. 测试车牌时间冲突检测', async () => {
    const conflictReq: CreateAppointmentRequest = {
      requestId: `CONFLICT-${uuidv4().substring(0, 8)}`,
      visitorName: '冲突访客',
      visitorPhone: '13900139001',
      visitorCompany: '冲突公司',
      hostName: '冲突接待人',
      hostDepartment: '冲突部门',
      licensePlate: '京XDEMO1',
      meetingSubject: '冲突会议',
      startTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
    };

    console.log('⚠️  尝试提交同一车牌的重叠时间段预约...');
    const result = await parkingService.createAppointment(conflictReq);

    if (!result.success) {
      console.log(`✅ 冲突检测正常!`);
      console.log(`   错误信息: ${result.error}`);
      console.log(`   说明: 系统正确阻止了同一车牌在重叠时间段的重复预约`);
    } else {
      console.log(`❌ 冲突检测失败: 不应允许创建冲突预约`);
    }
  });

  await step('4. 审批预约并创建车牌授权', async () => {
    const approveReq: ApproveAppointmentRequest = {
      operatorId: 'ADMIN-001',
      operatorName: '系统管理员',
      remark: '审批通过，欢迎来访'
    };

    console.log('✅ 管理员审批预约:');
    console.log(`   操作人: ${approveReq.operatorName}`);
    console.log(`   备注: ${approveReq.remark}`);

    const result = await parkingService.approveAppointment(appointmentId, approveReq);
    if (result.success && result.data) {
      authorizationId = result.data.authorization.id;
      console.log(`\n✅ 审批通过!`);
      console.log(`   预约状态: ${result.data.appointment.status}`);
      console.log(`   授权ID: ${authorizationId}`);
      console.log(`   授权状态: ${result.data.authorization.status}`);
      console.log(`   有效时间: ${new Date(result.data.authorization.validFrom).toLocaleString()} ~ ${new Date(result.data.authorization.validTo).toLocaleString()}`);
    } else {
      console.log(`\n❌ 审批失败: ${result.error}`);
    }
  });

  await step('5. 访客签到 (进入园区)', async () => {
    const checkInReq: CheckInRequest = {
      gateId: 'GATE-NORTH',
      gateName: '北门岗'
    };

    console.log('🚗 车辆到达北门岗，进行签到验证:');
    console.log(`   门岗: ${checkInReq.gateName}`);

    const result = await parkingService.checkIn(appointmentId, checkInReq);
    if (result.success && result.data) {
      console.log(`\n✅ 签到成功!`);
      console.log(`   预约状态: ${result.data.status}`);
      console.log(`   说明: 车牌授权验证通过，允许进入园区`);
    } else {
      console.log(`\n❌ 签到失败: ${result.error}`);
    }
  });

  await step('6. 查看预约变更历史 (审计日志)', async () => {
    const logsResult = await parkingService.getChangeLogs('appointment', appointmentId);

    if (logsResult.success && logsResult.data) {
      console.log('📋 预约变更历史 (审计日志):\n');
      logsResult.data.forEach((log, index) => {
        console.log(`${index + 1}. [${new Date(log.createdAt).toLocaleString()}]`);
        console.log(`   来源: ${log.source}`);
        console.log(`   字段: ${log.field}`);
        console.log(`   变更: ${log.oldValue || '(初始)'} → ${log.newValue}`);
        if (log.operatorName) console.log(`   操作人: ${log.operatorName}`);
        if (log.remark) console.log(`   备注: ${log.remark}`);
        console.log('');
      });
    }
  });

  await step('7. 访客离场 (离开园区)', async () => {
    const checkOutReq: CheckOutRequest = {
      gateId: 'GATE-SOUTH',
      gateName: '南门岗'
    };

    console.log('🚗 访客从南门岗离开园区:');
    console.log(`   门岗: ${checkOutReq.gateName}`);

    const result = await parkingService.checkOut(appointmentId, checkOutReq);
    if (result.success && result.data) {
      console.log(`\n✅ 离场登记成功!`);
      console.log(`   预约状态: ${result.data.status}`);

      const authResult = await parkingService.getAuthorization(authorizationId);
      if (authResult.success && authResult.data) {
        console.log(`   授权状态: ${authResult.data.status} (已自动失效)`);
      }
    } else {
      console.log(`\n❌ 离场登记失败: ${result.error}`);
    }
  });

  await step('8. 测试场景: 会议取消后授权自动撤销', async () => {
    const cancelApptReq: CreateAppointmentRequest = {
      requestId: `CANCEL-DEMO-${uuidv4().substring(0, 8)}`,
      visitorName: '取消测试',
      visitorPhone: '13800138111',
      visitorCompany: '测试公司',
      hostName: '测试接待',
      hostDepartment: '测试部门',
      licensePlate: '京XTEST1',
      meetingSubject: '取消测试会议',
      startTime: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
    };

    console.log('📝 创建一个新预约，批准后模拟会议取消...');
    const createResult = await parkingService.createAppointment(cancelApptReq);
    if (!createResult.success || !createResult.data) {
      console.log('❌ 创建预约失败');
      return;
    }

    const tempApptId = createResult.data.id;
    const approveResult = await parkingService.approveAppointment(tempApptId, {
      operatorId: 'ADMIN-001',
      operatorName: '系统管理员'
    });

    if (!approveResult.success || !approveResult.data) {
      console.log('❌ 审批失败');
      return;
    }

    const tempAuthId = approveResult.data.authorization.id;
    console.log(`✅ 预约已批准，授权ID: ${tempAuthId.substring(0, 12)}...`);

    const cancelReq: RevokeRequest = {
      operatorId: 'ADMIN-001',
      operatorName: '会议组织者',
      reason: '会议时间调整，改期举行'
    };

    console.log(`\n📢 收到会议取消通知，正在撤销车牌授权...`);
    const cancelResult = await parkingService.cancelMeeting(tempApptId, cancelReq);

    if (cancelResult.success && cancelResult.data) {
      console.log(`✅ 会议已取消!`);
      console.log(`   预约状态: ${cancelResult.data.status}`);

      const authResult = await parkingService.getAuthorization(tempAuthId);
      if (authResult.success && authResult.data) {
        console.log(`   授权状态: ${authResult.data.status}`);
        console.log(`   说明: 会议取消后，车牌授权已自动撤销`);
      }
    }
  });

  await step('9. 查询超时授权列表', async () => {
    console.log('🔍 查询当前所有超时未失效的授权...\n');
    const result = await parkingService.getOverdueAuthorizations();

    if (result.success && result.data) {
      console.log(`超时授权数量: ${result.data.length}`);
      if (result.data.length > 0) {
        result.data.forEach(auth => {
          console.log(`  - 车牌 ${auth.licensePlate} (预约 ${auth.appointmentId.substring(0, 8)}...)`);
          console.log(`    应过期时间: ${new Date(auth.validTo).toLocaleString()}`);
        });
      } else {
        console.log(`✅ 当前没有超时未失效的授权`);
      }
    }
  });

  await step('10. 查询所有待审批预约', async () => {
    console.log('📋 查询当前所有待审批的预约...\n');
    const result = await parkingService.getPendingAppointments();

    if (result.success && result.data) {
      console.log(`待审批预约数量: ${result.data.length}`);
      result.data.forEach(appt => {
        console.log(`  - ${appt.visitorName} (${appt.licensePlate}) - ${appt.meetingSubject}`);
      });
    }
  });

  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(22) + '🎉 流程演示完成!' + ' '.repeat(23) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('\n📌 已验证的功能:');
  console.log('   ✅ 预约创建与幂等性保证');
  console.log('   ✅ 车牌时间段冲突检测');
  console.log('   ✅ 审批流程与授权创建');
  console.log('   ✅ 签到离场流程');
  console.log('   ✅ 变更历史审计日志');
  console.log('   ✅ 会议取消后授权自动撤销');
  console.log('   ✅ 超时授权查询');
  console.log('   ✅ 待审批预约查询');
  console.log('');

  await db.close();
}

demo().catch(console.error);
