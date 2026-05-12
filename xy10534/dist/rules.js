"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDependencies = checkDependencies;
exports.checkMigrations = checkMigrations;
exports.checkSwitches = checkSwitches;
exports.checkContacts = checkContacts;
exports.checkWaivers = checkWaivers;
exports.calculateRecommendedOrder = calculateRecommendedOrder;
exports.applyWaivers = applyWaivers;
exports.runAllChecks = runAllChecks;
const uuid_1 = require("uuid");
function parseDate(dateStr) {
    return new Date(dateStr);
}
function getServiceName(services, serviceId) {
    const service = services.find(s => s.id === serviceId);
    return service ? service.name : serviceId;
}
function checkDependencies(data) {
    const results = [];
    const { services, dependencies } = data;
    for (const dep of dependencies) {
        if (!dep.windowAlignmentRequired) {
            continue;
        }
        const caller = services.find(s => s.id === dep.callerServiceId);
        const callee = services.find(s => s.id === dep.calleeServiceId);
        if (!caller || !callee) {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'dependency-reference',
                serviceId: dep.callerServiceId,
                status: 'warning',
                message: `依赖关系引用的服务不存在`,
                detail: `调用方服务 ${dep.callerServiceId} 或被调用方服务 ${dep.calleeServiceId} 未在发布计划中找到`,
                action: '确认依赖服务是否需要纳入本次发布或调整依赖关系'
            });
            continue;
        }
        const callerWindowStart = parseDate(caller.windowStart);
        const calleeWindowEnd = parseDate(callee.windowEnd);
        const depType = dep.dependencyType === 'hard' ? '强依赖' : '弱依赖';
        if (dep.dependencyType === 'hard' && calleeWindowEnd > callerWindowStart) {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'dependency-window-alignment',
                serviceId: dep.callerServiceId,
                status: 'blocking',
                message: `依赖服务窗口未对齐：${getServiceName(services, dep.callerServiceId)} 依赖 ${getServiceName(services, dep.calleeServiceId)} (${depType})`,
                detail: `${caller.name}(${caller.version}) 计划窗口: ${caller.windowStart} ~ ${caller.windowEnd}\n${callee.name}(${callee.version}) 计划窗口: ${callee.windowStart} ~ ${callee.windowEnd}\n${callee.name} 结束时间晚于 ${caller.name} 开始时间`,
                action: `建议将 ${callee.name} 提前发布，或延后 ${caller.name} 的发布时间`
            });
        }
        else if (dep.dependencyType === 'soft' && calleeWindowEnd > callerWindowStart) {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'dependency-window-alignment',
                serviceId: dep.callerServiceId,
                status: 'warning',
                message: `弱依赖服务窗口未对齐：${getServiceName(services, dep.callerServiceId)} 依赖 ${getServiceName(services, dep.calleeServiceId)} (${depType})`,
                detail: `${caller.name}(${caller.version}) 计划窗口: ${caller.windowStart} ~ ${caller.windowEnd}\n${callee.name}(${callee.version}) 计划窗口: ${callee.windowStart} ~ ${callee.windowEnd}`,
                action: `建议确认 ${callee.name} 是否可以提前发布，或延后 ${caller.name} 的发布时间`
            });
        }
        else {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'dependency-window-alignment',
                serviceId: dep.callerServiceId,
                status: 'passed',
                message: `依赖窗口对齐：${getServiceName(services, dep.callerServiceId)} → ${getServiceName(services, dep.calleeServiceId)} (${depType})`,
                detail: `${caller.name} 计划窗口晚于 ${callee.name} 结束时间`
            });
        }
    }
    return results;
}
function checkMigrations(data) {
    const results = [];
    const { services, migrations } = data;
    for (const migration of migrations) {
        const service = services.find(s => s.id === migration.serviceId);
        const serviceName = service ? service.name : migration.serviceId;
        if (!migration.hasRollback) {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'migration-rollback',
                serviceId: migration.serviceId,
                status: 'blocking',
                message: `${serviceName} 数据库迁移脚本缺少回滚脚本`,
                detail: `脚本: ${migration.scriptName} (版本: ${migration.version})\n类型: ${migration.migrationType}\n状态: 未提供回滚脚本`,
                action: '必须提供回滚脚本后才能继续发布'
            });
        }
        else {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'migration-rollback',
                serviceId: migration.serviceId,
                status: 'passed',
                message: `${serviceName} 数据库迁移脚本回滚检查通过`,
                detail: `脚本: ${migration.scriptName} (版本: ${migration.version})\n回滚脚本: ${migration.rollbackScript || '已配置'}`
            });
        }
        if (migration.preDeploy && !migration.executed) {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'migration-execution',
                serviceId: migration.serviceId,
                status: 'blocking',
                message: `${serviceName} 前置数据库迁移脚本未执行`,
                detail: `脚本: ${migration.scriptName}\n类型: 前置迁移\n状态: 未执行`,
                action: '请先执行前置数据库迁移脚本'
            });
        }
        if (migration.postDeploy && migration.executed) {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'migration-execution',
                serviceId: migration.serviceId,
                status: 'warning',
                message: `${serviceName} 后置数据库迁移脚本已提前执行`,
                detail: `脚本: ${migration.scriptName}\n类型: 后置迁移\n状态: 已执行（执行时间: ${migration.executedAt}）`,
                action: '建议确认提前执行后置迁移是否符合预期'
            });
        }
    }
    const serviceIdsWithMigrations = new Set(migrations.map(m => m.serviceId));
    for (const service of services) {
        if (!serviceIdsWithMigrations.has(service.id)) {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'migration-presence',
                serviceId: service.id,
                status: 'passed',
                message: `${service.name} 无数据库迁移`,
                detail: '该服务本次发布不涉及数据库变更'
            });
        }
    }
    return results;
}
function checkSwitches(data) {
    const results = [];
    const { services, switches } = data;
    for (const sw of switches) {
        const service = services.find(s => s.id === sw.serviceId);
        const serviceName = service ? service.name : sw.serviceId;
        if (!sw.preConfigured) {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'switch-preconfigured',
                serviceId: sw.serviceId,
                status: 'blocking',
                message: `${serviceName} 配置开关未预置`,
                detail: `开关: ${sw.key}\n目标值: ${sw.targetValue}\n当前值: ${sw.currentValue || '未设置'}\n预置状态: 否`,
                action: '请先在配置中心预置目标配置值'
            });
        }
        else {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'switch-preconfigured',
                serviceId: sw.serviceId,
                status: 'passed',
                message: `${serviceName} 配置开关已预置`,
                detail: `开关: ${sw.key}\n目标值: ${sw.targetValue}\n当前值: ${sw.currentValue || '已预置'}`
            });
        }
    }
    return results;
}
function checkContacts(data) {
    const results = [];
    const { services, contacts } = data;
    for (const service of services) {
        const serviceContacts = contacts.filter(c => c.serviceId === service.id);
        const primaryContacts = serviceContacts.filter(c => c.isPrimary);
        if (serviceContacts.length === 0) {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'contact-presence',
                serviceId: service.id,
                status: 'blocking',
                message: `${service.name} 缺少回滚联系人`,
                detail: '该服务未配置任何回滚联系人',
                action: '必须配置至少一名回滚联系人'
            });
        }
        else if (primaryContacts.length === 0) {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'contact-primary',
                serviceId: service.id,
                status: 'warning',
                message: `${service.name} 未指定主要回滚联系人`,
                detail: `已配置 ${serviceContacts.length} 名联系人，但未指定首要联系人`,
                action: '建议指定一名主要回滚联系人'
            });
        }
        else {
            const availablePrimary = primaryContacts.filter(c => c.available);
            if (availablePrimary.length === 0) {
                results.push({
                    id: (0, uuid_1.v4)(),
                    checkType: 'contact-availability',
                    serviceId: service.id,
                    status: 'blocking',
                    message: `${service.name} 主要回滚联系人不可用`,
                    detail: `主要联系人: ${primaryContacts.map(c => c.name).join(', ')}\n状态: 全部不可用`,
                    action: '请联系主要联系人确认可用性，或调整主要联系人'
                });
            }
            else {
                results.push({
                    id: (0, uuid_1.v4)(),
                    checkType: 'contact-availability',
                    serviceId: service.id,
                    status: 'passed',
                    message: `${service.name} 回滚联系人检查通过`,
                    detail: `主要联系人: ${availablePrimary[0].name} (${availablePrimary[0].phone})\n总联系人: ${serviceContacts.length} 人`
                });
            }
        }
    }
    return results;
}
function checkWaivers(data, currentTime = new Date()) {
    const results = [];
    const { waivers } = data;
    for (const waiver of waivers) {
        if (!waiver.isActive) {
            continue;
        }
        const expiresAt = parseDate(waiver.expiresAt);
        if (currentTime > expiresAt) {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'waiver-expiration',
                serviceId: waiver.serviceId,
                status: 'blocking',
                message: '豁免已过期',
                detail: `豁免原因: ${waiver.reason}\n审批人: ${waiver.approvedBy}\n到期时间: ${waiver.expiresAt}`,
                action: '豁免已过期，需要重新申请'
            });
        }
        else {
            results.push({
                id: (0, uuid_1.v4)(),
                checkType: 'waiver-expiration',
                serviceId: waiver.serviceId,
                status: 'passed',
                message: '豁免有效',
                detail: `豁免原因: ${waiver.reason}\n审批人: ${waiver.approvedBy}\n到期时间: ${waiver.expiresAt}`
            });
        }
    }
    return results;
}
function calculateRecommendedOrder(data) {
    const { services, dependencies } = data;
    const inDegree = new Map();
    const graph = new Map();
    for (const service of services) {
        inDegree.set(service.id, 0);
        graph.set(service.id, []);
    }
    for (const dep of dependencies) {
        const outgoing = graph.get(dep.calleeServiceId);
        if (outgoing) {
            outgoing.push(dep.callerServiceId);
        }
        inDegree.set(dep.callerServiceId, (inDegree.get(dep.callerServiceId) || 0) + 1);
    }
    const queue = [];
    for (const [serviceId, degree] of inDegree) {
        if (degree === 0) {
            queue.push(serviceId);
        }
    }
    const result = [];
    while (queue.length > 0) {
        queue.sort((a, b) => {
            const sa = services.find(s => s.id === a);
            const sb = services.find(s => s.id === b);
            if (!sa || !sb)
                return 0;
            return parseDate(sa.plannedTime).getTime() - parseDate(sb.plannedTime).getTime();
        });
        const current = queue.shift();
        result.push(current);
        const neighbors = graph.get(current) || [];
        for (const neighbor of neighbors) {
            const newDegree = (inDegree.get(neighbor) || 0) - 1;
            inDegree.set(neighbor, newDegree);
            if (newDegree === 0) {
                queue.push(neighbor);
            }
        }
    }
    return result;
}
function applyWaivers(results, data) {
    const { waivers } = data;
    return results.map(result => {
        const applicableWaiver = waivers.find(w => w.isActive &&
            w.relatedCheckId === result.checkType &&
            (!w.serviceId || w.serviceId === result.serviceId));
        if (applicableWaiver && (result.status === 'blocking' || result.status === 'warning')) {
            return {
                ...result,
                status: 'waived',
                waiverId: applicableWaiver.id,
                detail: `${result.detail}\n\n豁免信息:\n  原因: ${applicableWaiver.reason}\n  审批人: ${applicableWaiver.approvedBy}\n  到期: ${applicableWaiver.expiresAt}`
            };
        }
        return result;
    });
}
function runAllChecks(data) {
    let allResults = [];
    allResults = allResults.concat(checkDependencies(data));
    allResults = allResults.concat(checkMigrations(data));
    allResults = allResults.concat(checkSwitches(data));
    allResults = allResults.concat(checkContacts(data));
    const waiverResults = checkWaivers(data);
    allResults = applyWaivers(allResults, data);
    allResults = allResults.concat(waiverResults);
    const total = allResults.length;
    const blocking = allResults.filter(r => r.status === 'blocking').length;
    const warning = allResults.filter(r => r.status === 'warning').length;
    const passed = allResults.filter(r => r.status === 'passed').length;
    const waived = allResults.filter(r => r.status === 'waived').length;
    const canRelease = blocking === 0;
    const recommendedOrderIds = calculateRecommendedOrder(data);
    const recommendedOrder = recommendedOrderIds.map(id => getServiceName(data.services, id));
    const summary = {
        total,
        blocking,
        warning,
        passed,
        waived,
        canRelease,
        recommendedOrder
    };
    return { results: allResults, summary };
}
//# sourceMappingURL=rules.js.map