const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../data');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function writeJson(filename, data) {
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

function generateSampleData() {
    ensureDataDir();

    const roles = [
        { id: uuidv4(), name: '管理员', description: '项目管理员权限', createdAt: new Date(Date.now() - 86400000 * 30).toISOString() },
        { id: uuidv4(), name: '开发者', description: '开发人员权限', createdAt: new Date(Date.now() - 86400000 * 30).toISOString() },
        { id: uuidv4(), name: '查看者', description: '只读权限', createdAt: new Date(Date.now() - 86400000 * 30).toISOString() }
    ];
    writeJson('roles.json', roles);

    const domains = [
        { id: uuidv4(), domain: 'company.com', enabled: true, createdAt: new Date(Date.now() - 86400000 * 20).toISOString() }
    ];
    writeJson('domains.json', domains);

    const invitations = [];
    const usages = [];
    const revocations = [];
    const approvals = [];

    invitations.push({
        id: uuidv4(),
        inviterEmail: 'admin@company.com',
        inviteeEmail: 'zhangsan@company.com',
        roleId: roles[1].id,
        roleName: roles[1].name,
        projectId: 'PROJECT-001',
        status: 'active',
        requiresApproval: false,
        token: uuidv4(),
        maxUses: 1,
        usedCount: 0,
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        expiresAt: new Date(Date.now() + 86400000 * 2).toISOString()
    });

    invitations.push({
        id: uuidv4(),
        inviterEmail: 'admin@company.com',
        inviteeEmail: 'lisi@company.com',
        roleId: roles[2].id,
        roleName: roles[2].name,
        projectId: 'PROJECT-001',
        status: 'used',
        requiresApproval: false,
        token: uuidv4(),
        maxUses: 1,
        usedCount: 1,
        createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
        expiresAt: new Date(Date.now() + 86400000 * (-3)).toISOString(),
        lastUsedAt: new Date(Date.now() - 86400000 * 8).toISOString()
    });

    usages.push({
        id: uuidv4(),
        invitationId: invitations[1].id,
        userEmail: 'lisi@company.com',
        usedAt: invitations[1].lastUsedAt,
        ipAddress: '192.168.1.100'
    });

    const pendingInv = {
        id: uuidv4(),
        inviterEmail: 'admin@company.com',
        inviteeEmail: 'wangwu@external.com',
        roleId: roles[1].id,
        roleName: roles[1].name,
        projectId: 'PROJECT-002',
        status: 'pending',
        requiresApproval: true,
        token: uuidv4(),
        maxUses: 1,
        usedCount: 0,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        expiresAt: new Date(Date.now() + 86400000 * 5).toISOString()
    };
    invitations.push(pendingInv);

    approvals.push({
        id: uuidv4(),
        invitationId: pendingInv.id,
        requesterEmail: 'admin@company.com',
        inviteeEmail: 'wangwu@external.com',
        reason: '邮箱域名不在白名单内，需要审批',
        status: 'pending',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    });

    const revokedInv = {
        id: uuidv4(),
        inviterEmail: 'admin@company.com',
        inviteeEmail: 'zhaoliu@external.com',
        roleId: roles[1].id,
        roleName: roles[1].name,
        projectId: 'PROJECT-001',
        status: 'revoked',
        requiresApproval: true,
        token: uuidv4(),
        maxUses: 1,
        usedCount: 0,
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        expiresAt: new Date(Date.now() + 86400000 * 0).toISOString()
    };
    invitations.push(revokedInv);

    revocations.push({
        id: uuidv4(),
        invitationId: revokedInv.id,
        reason: '安全风险评估，撤销外部人员邀请',
        revokedBy: 'security@company.com',
        revokedAt: new Date(Date.now() - 86400000 * 3).toISOString()
    });

    const expiredInv = {
        id: uuidv4(),
        inviterEmail: 'admin@company.com',
        inviteeEmail: 'qianqi@company.com',
        roleId: roles[2].id,
        roleName: roles[2].name,
        projectId: 'PROJECT-003',
        status: 'expired',
        requiresApproval: false,
        token: uuidv4(),
        maxUses: 1,
        usedCount: 0,
        createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
        expiresAt: new Date(Date.now() - 86400000 * 8).toISOString()
    };
    invitations.push(expiredInv);

    writeJson('invitations.json', invitations);
    writeJson('usages.json', usages);
    writeJson('revocations.json', revocations);
    writeJson('approvals.json', approvals);

    const audit = [
        {
            id: uuidv4(),
            action: 'create_invitation',
            operator: { user: 'admin', ip: '127.0.0.1' },
            input: { inviterEmail: 'admin@company.com', inviteeEmail: 'zhangsan@company.com', roleId: roles[1].id, projectId: 'PROJECT-001' },
            result: { success: true, data: invitations[0] },
            status: 'success',
            timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
            requestId: uuidv4()
        },
        {
            id: uuidv4(),
            action: 'create_invitation',
            operator: { user: 'admin', ip: '127.0.0.1' },
            input: { inviterEmail: 'admin@company.com', inviteeEmail: 'lisi@company.com', roleId: roles[2].id, projectId: 'PROJECT-001' },
            result: { success: true, data: invitations[1] },
            status: 'success',
            timestamp: new Date(Date.now() - 86400000 * 10).toISOString(),
            requestId: uuidv4()
        },
        {
            id: uuidv4(),
            action: 'create_invitation',
            operator: { user: 'admin', ip: '127.0.0.1' },
            input: { inviterEmail: 'admin@company.com', inviteeEmail: 'wangwu@external.com', roleId: roles[1].id, projectId: 'PROJECT-002' },
            result: { success: true, data: invitations[2] },
            status: 'success',
            timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
            requestId: uuidv4()
        },
        {
            id: uuidv4(),
            action: 'use_invitation',
            operator: { user: 'lisi@company.com', ip: '192.168.1.100' },
            input: { token: invitations[1].token, userEmail: 'lisi@company.com' },
            result: { success: true, data: { invitation: invitations[1], usage: usages[0] } },
            status: 'success',
            timestamp: invitations[1].lastUsedAt,
            requestId: uuidv4()
        },
        {
            id: uuidv4(),
            action: 'use_invitation',
            operator: { user: 'hacker@evil.com', ip: '10.0.0.1' },
            input: { token: invitations[0].token, userEmail: 'hacker@evil.com' },
            result: { success: false, error: 'EMAIL_MISMATCH', message: '只能由受邀邮箱使用' },
            status: 'error',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            requestId: uuidv4()
        },
        {
            id: uuidv4(),
            action: 'create_invitation',
            operator: { user: 'admin', ip: '127.0.0.1' },
            input: { inviterEmail: 'admin@company.com', inviteeEmail: 'zhangsan@company.com', roleId: roles[1].id, projectId: 'PROJECT-001' },
            result: { success: false, error: 'DUPLICATE_INVITATION', message: '该用户已有有效邀请', invitationId: invitations[0].id },
            status: 'error',
            timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
            requestId: uuidv4()
        },
        {
            id: uuidv4(),
            action: 'revoke_invitation',
            operator: { user: 'security@company.com', ip: '192.168.1.1' },
            input: { invitationId: revokedInv.id, reason: '安全风险评估，撤销外部人员邀请' },
            result: { success: true, data: { invitation: revokedInv, revocation: revocations[0] } },
            status: 'success',
            timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
            requestId: uuidv4()
        },
        {
            id: uuidv4(),
            action: 'add_domain',
            operator: { user: 'admin', ip: '127.0.0.1' },
            input: { domain: 'company.com' },
            result: { success: true, data: domains[0] },
            status: 'success',
            timestamp: new Date(Date.now() - 86400000 * 20).toISOString(),
            requestId: uuidv4()
        },
        {
            id: uuidv4(),
            action: 'create_invitation',
            operator: { user: 'admin', ip: '127.0.0.1' },
            input: { inviterEmail: 'admin@company.com', inviteeEmail: 'zhaoliu@external.com', roleId: roles[1].id, projectId: 'PROJECT-001' },
            result: { success: true, data: revokedInv },
            status: 'success',
            timestamp: new Date(Date.now() - 86400000 * 7).toISOString(),
            requestId: uuidv4()
        },
        {
            id: uuidv4(),
            action: 'create_invitation',
            operator: { user: 'admin', ip: '127.0.0.1' },
            input: { inviterEmail: 'admin@company.com', inviteeEmail: 'qianqi@company.com', roleId: roles[2].id, projectId: 'PROJECT-003' },
            result: { success: true, data: expiredInv },
            status: 'success',
            timestamp: new Date(Date.now() - 86400000 * 15).toISOString(),
            requestId: uuidv4()
        }
    ];

    writeJson('audit.json', audit);

    console.log('✅ 样例数据已生成完成！');
    console.log('');
    console.log('📊 数据统计：');
    console.log(`  - 角色: ${roles.length} 个`);
    console.log(`  - 域名白名单: ${domains.length} 个`);
    console.log(`  - 邀请记录: ${invitations.length} 个`);
    console.log(`  - 审批记录: ${approvals.length} 个`);
    console.log(`  - 使用记录: ${usages.length} 个`);
    console.log(`  - 撤销记录: ${revocations.length} 个`);
    console.log(`  - 审计日志: ${audit.length} 条`);
    console.log('');
    console.log('📝 包含的样例场景：');
    console.log('  1. ✅ 成功创建邀请（域名白名单内，无需审批）');
    console.log('  2. ✅ 成功使用邀请');
    console.log('  3. ❌ 失败场景 - 邮箱不匹配（邀请链接被转发）');
    console.log('  4. ❌ 失败场景 - 重复提交邀请');
    console.log('  5. ⏳ 待审批邀请（外部域名）');
    console.log('  6. 🚫 已撤销邀请（人工修正）');
    console.log('  7. ⏰ 已过期邀请');
    console.log('  8. 📋 完整的审计追踪');
}

generateSampleData();
