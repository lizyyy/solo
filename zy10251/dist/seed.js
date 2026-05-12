"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database");
const types_1 = require("./types");
const seedAppointments = [
    {
        requestId: 'REQ-2024-001',
        visitorName: '张三',
        visitorPhone: '13800138001',
        visitorCompany: '华为技术有限公司',
        hostName: '李四',
        hostDepartment: '研发部',
        licensePlate: '京A12345',
        meetingSubject: '项目合作洽谈',
        startTime: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
    },
    {
        requestId: 'REQ-2024-002',
        visitorName: '王五',
        visitorPhone: '13800138002',
        visitorCompany: '阿里巴巴集团',
        hostName: '赵六',
        hostDepartment: '市场部',
        licensePlate: '沪B67890',
        meetingSubject: '商务谈判',
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
    },
    {
        requestId: 'REQ-2024-003',
        visitorName: '陈七',
        visitorPhone: '13800138003',
        visitorCompany: '腾讯科技',
        hostName: '周八',
        hostDepartment: '产品部',
        licensePlate: '粤C11111',
        meetingSubject: '产品交流会',
        startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    }
];
async function seed() {
    console.log('开始初始化数据库...');
    await database_1.db.init();
    console.log('数据库初始化完成');
    console.log('\n开始插入种子数据...\n');
    for (const apptReq of seedAppointments) {
        console.log(`创建预约: ${apptReq.visitorName} - ${apptReq.meetingSubject}`);
        const existing = await database_1.db.getAppointmentByRequestId(apptReq.requestId);
        if (existing) {
            console.log(`  跳过: 预约 ${apptReq.requestId} 已存在`);
            continue;
        }
        const appointment = await database_1.db.createAppointment(apptReq);
        console.log(`  成功: 预约 ID ${appointment.id.substring(0, 8)}...`);
        if (apptReq.requestId === 'REQ-2024-001') {
            console.log(`  自动批准预约并创建授权...`);
            await database_1.db.updateAppointmentStatus(appointment.id, types_1.AppointmentStatus.APPROVED, types_1.ChangeSource.ADMIN_APPROVE, 'ADMIN-001', '系统管理员', '自动审批通过');
            await database_1.db.createAuthorization(appointment.id, appointment.licensePlate, appointment.startTime, appointment.endTime, types_1.ChangeSource.ADMIN_APPROVE, 'ADMIN-001', '系统管理员');
            console.log(`  授权已创建`);
        }
        if (apptReq.requestId === 'REQ-2024-003') {
            console.log(`  模拟过期预约...`);
            await database_1.db.updateAppointmentStatus(appointment.id, types_1.AppointmentStatus.APPROVED, types_1.ChangeSource.ADMIN_APPROVE, 'ADMIN-001', '系统管理员', '自动审批通过');
            const auth = await database_1.db.createAuthorization(appointment.id, appointment.licensePlate, appointment.startTime, appointment.endTime, types_1.ChangeSource.ADMIN_APPROVE, 'ADMIN-001', '系统管理员');
            await database_1.db.updateAuthorizationStatus(auth.id, types_1.AuthorizationStatus.EXPIRED, types_1.ChangeSource.SYSTEM_EXPIRE, null, null, '系统自动过期');
            await database_1.db.updateAppointmentStatus(appointment.id, types_1.AppointmentStatus.EXPIRED, types_1.ChangeSource.SYSTEM_EXPIRE, null, null, '预约已过期');
            console.log(`  已标记为过期`);
        }
    }
    console.log('\n种子数据插入完成!\n');
    const allAppointments = await database_1.db.getAllAppointments();
    console.log(`预约总数: ${allAppointments.length}`);
    allAppointments.forEach(a => {
        console.log(`  - ${a.visitorName} (${a.licensePlate}) - ${a.status}`);
    });
    const allAuthorizations = await database_1.db.getAllAuthorizations();
    console.log(`\n授权总数: ${allAuthorizations.length}`);
    allAuthorizations.forEach(a => {
        console.log(`  - ${a.licensePlate} - ${a.status}`);
    });
    const overdueAuths = await database_1.db.getOverdueAuthorizations();
    console.log(`\n当前超时授权数: ${overdueAuths.length}`);
    await database_1.db.close();
    console.log('\n种子数据初始化完成!');
}
seed().catch(console.error);
