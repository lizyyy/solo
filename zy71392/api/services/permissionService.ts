import scriptRepository from '../repositories/scriptRepository.js';
import activityRepository from '../repositories/activityRepository.js';
import type { Permission, PermissionDiff } from '../types/index.js';

class PermissionService {
  derivePermissions(scriptId: number): PermissionDiff {
    const script = scriptRepository.getById(scriptId);
    if (!script) throw new Error('Script not found');

    const apiCalls = scriptRepository.getApiCalls(scriptId);

    let existingPermissions: Permission[] = [];
    try {
      const existing = JSON.parse(script.existing_policy_json || '[]') as Array<{ service: string; action: string }>;
      existingPermissions = existing.map((p, idx) => ({
        id: idx + 1,
        script_id: scriptId,
        service: p.service,
        action: p.action,
        type: 'existing',
        status: 'kept',
      }));
    } catch {
      existingPermissions = [];
    }

    const derivedPermissions: Permission[] = apiCalls.map((call, idx) => ({
      id: idx + 1000,
      script_id: scriptId,
      service: call.service,
      action: call.action,
      type: 'derived',
      status: 'kept',
    }));

    const existingKeys = new Set(existingPermissions.map(p => `${p.service}:${p.action}`));
    const derivedKeys = new Set(derivedPermissions.map(p => `${p.service}:${p.action}`));

    const removed: Permission[] = existingPermissions
      .filter(p => !derivedKeys.has(`${p.service}:${p.action}`))
      .map(p => ({ ...p, status: 'removed', reason: '无匹配API调用，建议移除' }));

    const added: Permission[] = derivedPermissions
      .filter(p => !existingKeys.has(`${p.service}:${p.action}`))
      .map(p => ({ ...p, status: 'added', reason: 'API调用需要，建议添加' }));

    const kept: Permission[] = derivedPermissions
      .filter(p => existingKeys.has(`${p.service}:${p.action}`))
      .map(p => ({ ...p, status: 'kept', reason: '匹配API调用，保留' }));

    scriptRepository.clearPermissions(scriptId);
    [...removed, ...added, ...kept].forEach(p => {
      scriptRepository.addPermission({
        script_id: scriptId,
        service: p.service,
        action: p.action,
        type: p.type,
        status: p.status,
        reason: p.reason,
      });
    });

    activityRepository.create('derive_permissions', `推导脚本 ${script.name} 权限：移除${removed.length}，新增${added.length}，保留${kept.length}`, {
      scriptId, removed: removed.length, added: added.length, kept: kept.length,
    });

    return {
      existing_permissions: existingPermissions,
      derived_permissions: derivedPermissions,
      removed,
      added,
      kept,
    };
  }

  detectWildcardOver(scriptId: number): Array<{ permission: string; reason: string; impact: string; nextAction: string }> {
    const script = scriptRepository.getById(scriptId);
    if (!script) throw new Error('Script not found');

    const wildcards: Array<{ permission: string; reason: string; impact: string; nextAction: string }> = [];

    try {
      const existing = JSON.parse(script.existing_policy_json || '[]') as Array<{ service: string; action: string }>;
      existing.forEach(p => {
        const actionWild = p.action.includes('*');
        const serviceWild = p.service === '*' || p.service.includes('*');

        if (actionWild || serviceWild) {
          const reason = [];
          if (serviceWild) reason.push('服务名使用通配符');
          if (actionWild) reason.push('操作名使用通配符');

          wildcards.push({
            permission: `${p.service}:${p.action}`,
            reason: reason.join('，'),
            impact: '通配权限授予了超出脚本实际需要的访问范围，存在权限滥用风险',
            nextAction: '根据识别的API调用，将通配符替换为具体的服务和操作列表',
          });
        }
      });
    } catch {
      //
    }

    return wildcards;
  }

  getPermissionDiff(scriptId: number): PermissionDiff {
    const script = scriptRepository.getById(scriptId);
    if (!script) throw new Error('Script not found');

    const perms = scriptRepository.getPermissions(scriptId);

    if (perms.length === 0) {
      return this.derivePermissions(scriptId);
    }

    return {
      existing_permissions: perms.filter(p => p.type === 'existing' || p.status !== 'added'),
      derived_permissions: perms.filter(p => p.type === 'derived' || p.status !== 'removed'),
      removed: perms.filter(p => p.status === 'removed'),
      added: perms.filter(p => p.status === 'added'),
      kept: perms.filter(p => p.status === 'kept'),
    };
  }

  applyMinimalPolicy(scriptId: number): void {
    const diff = this.getPermissionDiff(scriptId);
    const minimal = [...diff.kept, ...diff.added];
    const policyJson = JSON.stringify(minimal.map(p => ({ service: p.service, action: p.action })));
    scriptRepository.update(scriptId, { existing_policy_json: policyJson });

    const script = scriptRepository.getById(scriptId);
    activityRepository.create('apply_policy', `应用脚本 ${script?.name} 的最小权限策略`, { scriptId });
  }
}

export default new PermissionService();
