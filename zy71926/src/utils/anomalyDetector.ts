import type { Registration, Anomaly, AnomalyType } from '@/types';

const generateId = () => Math.random().toString(36).substring(2, 10);

export function detectAnomalies(
  registrations: Registration[],
  existingAnomalies: Anomaly[] = []
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const existingRegistrationIds = new Set(existingAnomalies.map(a => a.registrationId));

  const duplicateGroups = new Map<string, Registration[]>();
  registrations.forEach((reg) => {
    const key = `${reg.artworkName.trim().toLowerCase()}|${reg.artist.trim().toLowerCase()}`;
    if (!duplicateGroups.has(key)) {
      duplicateGroups.set(key, []);
    }
    duplicateGroups.get(key)!.push(reg);
  });

  const contactGroups = new Map<string, Registration[]>();
  registrations.forEach((reg) => {
    if (reg.contact) {
      if (!contactGroups.has(reg.contact)) {
        contactGroups.set(reg.contact, []);
      }
      contactGroups.get(reg.contact)!.push(reg);
    }
  });

  duplicateGroups.forEach((group, key) => {
    if (group.length > 1) {
      group.forEach((reg) => {
        anomalies.push({
          id: generateId(),
          registrationId: reg.id,
          type: 'duplicate',
          severity: 'high',
          description: `检测到${group.length}条重复记录，匹配规则：${key}`,
          rule: '作品名 + 艺术家完全匹配，或联系电话重复',
          suggestion: `核实${group.length}条记录的真实性，合并或删除重复项`,
          detectedAt: new Date().toISOString(),
        });
      });
    }
  });

  contactGroups.forEach((group, contact) => {
    if (group.length > 1) {
      const hasAnomaly = anomalies.some(a => a.registrationId === group[0].id && a.type === 'duplicate');
      if (!hasAnomaly) {
        group.forEach((reg) => {
          anomalies.push({
            id: generateId(),
            registrationId: reg.id,
            type: 'duplicate',
            severity: 'high',
            description: `检测到${group.length}条记录使用相同联系电话：${contact}`,
            rule: '作品名 + 艺术家完全匹配，或联系电话重复',
            suggestion: `核实${group.length}条记录是否为同一人重复报名`,
            detectedAt: new Date().toISOString(),
          });
        });
      }
    }
  });

  const now = new Date();
  registrations.forEach((reg) => {
    if (reg.status === 'confirmed' && reg.attachmentReceivedAt) {
      const confirmedAt = reg.updatedAt;
      const attachmentAt = reg.attachmentReceivedAt;
      const diffHours =
        (new Date(attachmentAt).getTime() - new Date(confirmedAt).getTime()) /
        (1000 * 60 * 60);

      if (diffHours > 24) {
        anomalies.push({
          id: generateId(),
          registrationId: reg.id,
          type: 'late_attachment',
          severity: 'medium',
          description: `附件晚到${Math.round(diffHours)}小时，报名已于${confirmedAt.slice(0, 10)}确认`,
          rule: '报名确认后附件上传时间超过24小时',
          suggestion: '核实附件内容是否有效，联系报名人确认延迟原因',
          detectedAt: new Date().toISOString(),
        });
      }
    }
  });

  registrations.forEach((reg) => {
    const missing: string[] = [];
    if (!reg.artworkName.trim()) missing.push('作品名');
    if (!reg.artist.trim()) missing.push('艺术家');
    if (!reg.registrant.trim()) missing.push('报名人');
    if (!reg.contact.trim()) missing.push('联系方式');

    if (missing.length > 0) {
      anomalies.push({
        id: generateId(),
        registrationId: reg.id,
        type: 'missing_info',
        severity: 'high',
        description: `必填字段缺失：${missing.join('、')}`,
        rule: '作品名、艺术家、报名人、联系方式均为必填项，不能为空',
        suggestion: '联系报名人补充缺失信息，否则无法确认报名',
        detectedAt: new Date().toISOString(),
      });
    }
  });

  const locationGroups = new Map<string, Registration[]>();
  registrations.forEach((reg) => {
    if (reg.location && reg.status !== 'cancelled') {
      if (!locationGroups.has(reg.location)) {
        locationGroups.set(reg.location, []);
      }
      locationGroups.get(reg.location)!.push(reg);
    }
  });

  locationGroups.forEach((group, location) => {
    if (group.length > 1) {
      group.forEach((reg) => {
        anomalies.push({
          id: generateId(),
          registrationId: reg.id,
          type: 'conflict',
          severity: 'high',
          description: `展位 ${location} 被${group.length}个作品同时分配，存在冲突`,
          rule: '同一展位不能同时分配给多个作品',
          suggestion: '立即协调调整展位，避免布展现场混乱',
          detectedAt: new Date().toISOString(),
        });
      });
    }
  });

  return anomalies.filter(
    (a) => !existingRegistrationIds.has(a.registrationId) || a.type === 'swap_record'
  );
}

export function createSwapAnomaly(
  registrationId: string,
  swapFrom: string,
  swapTo: string
): Anomaly {
  return {
    id: generateId(),
    registrationId,
    type: 'swap_record',
    severity: 'medium',
    description: `作品已调换：${swapFrom} → ${swapTo}`,
    rule: '所有经历过状态变更为「已调换」的记录永久标记',
    suggestion: '布展和保险需特别注意，该作品与原报名信息不符',
    detectedAt: new Date().toISOString(),
  };
}

export function getAnomalyTagClass(type: AnomalyType): string {
  const classMap: Record<AnomalyType, string> = {
    duplicate: 'tag-danger',
    late_attachment: 'tag-warning',
    missing_info: 'tag-danger',
    conflict: 'tag-danger',
    swap_record: 'tag-info',
  };
  return classMap[type];
}
