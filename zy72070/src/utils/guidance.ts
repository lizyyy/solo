import { Device, CadPoint, Params, DeviceStatus, Conflict } from '@/types';

export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

export function evaluateDevice(
  device: Device,
  cadPoints: CadPoint[],
  params: Params
): {
  status: DeviceStatus;
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 100;

  if (device.matchedCadId) {
    const cadPoint = cadPoints.find(c => c.id === device.matchedCadId);
    if (cadPoint) {
      if (device.coordSystem === cadPoint.coordSystem) {
        const offset = calculateDistance(device.x, device.y, cadPoint.x, cadPoint.y);
        if (offset > params.coordTolerance) {
          score -= 40;
          reasons.push(`坐标偏移 ${offset.toFixed(2)}m，超过容差 ${params.coordTolerance}m`);
        } else {
          reasons.push(`坐标偏移 ${offset.toFixed(2)}m，在容差范围内`);
        }
      } else {
        reasons.push(`坐标系不一致（设备:${device.coordSystem} / CAD:${cadPoint.coordSystem}），已单独标记`);
      }

      if (device.floor !== cadPoint.floor) {
        score -= 30;
        reasons.push(`楼层标记不符（设备:${device.floor} / CAD:${cadPoint.floor}）`);
      }
    }
  }

  if (!device.hasPhoto) {
    score -= 20;
    reasons.push('缺少现场照片佐证');
  }

  if (device.coordSystem !== 'A') {
    reasons.push(`使用坐标系 ${device.coordSystem}（非标准A系）`);
  }

  let status: DeviceStatus;
  if (score >= 80) status = 'normal';
  else if (score >= 50) status = 'warning';
  else status = 'error';

  return { status, score, reasons };
}

export function detectConflicts(
  devices: Device[],
  cadPoints: CadPoint[],
  params: Params
): Conflict[] {
  const conflicts: Conflict[] = [];
  const conflictId = (type: string, idx: number) => `conflict-${type}-${idx}`;

  let idx = 1;

  devices.forEach(device => {
    if (!device.hasPhoto) {
      conflicts.push({
        id: conflictId('photo', idx++),
        type: 'missing_photo',
        severity: 'low',
        deviceIds: [device.id],
        cadPointIds: [],
        evidence: [
          { source: 'device', field: 'hasPhoto', value: false },
        ],
        suggestion: '建议补充现场照片，确保设备位置可追溯',
        resolved: false,
      });
    }
  });

  const nameMap = new Map<string, string[]>();
  devices.forEach(device => {
    const names = [device.name, device.alias].filter(Boolean) as string[];
    names.forEach(name => {
      const existing = nameMap.get(name) || [];
      nameMap.set(name, [...existing, device.id]);
    });
  });

  nameMap.forEach((deviceIds, name) => {
    if (deviceIds.length > 1) {
      conflicts.push({
        id: conflictId('name', idx++),
        type: 'name_duplicate',
        severity: 'high',
        deviceIds,
        cadPointIds: [],
        evidence: deviceIds.map(() => ({
          source: 'device' as const,
          field: 'name',
          value: name,
        })),
        suggestion: `发现 ${deviceIds.length} 个设备使用相同/相似名称，建议合并或明确区分`,
        resolved: false,
      });
    }
  });

  devices.forEach(device => {
    if (device.matchedCadId) {
      const cadPoint = cadPoints.find(c => c.id === device.matchedCadId);
      if (cadPoint && device.coordSystem === cadPoint.coordSystem) {
        const offset = calculateDistance(device.x, device.y, cadPoint.x, cadPoint.y);
        if (offset > params.coordTolerance) {
          conflicts.push({
            id: conflictId('coord', idx++),
            type: 'coord_offset',
            severity: 'medium',
            deviceIds: [device.id],
            cadPointIds: [cadPoint.id],
            evidence: [
              { source: 'device', field: '坐标', value: `(${device.x}, ${device.y})` },
              { source: 'cad', field: '坐标', value: `(${cadPoint.x}, ${cadPoint.y})` },
              { source: 'device', field: '偏移量', value: `${offset.toFixed(2)}m` },
            ],
            suggestion: `坐标偏移 ${offset.toFixed(2)}m，建议现场复核或调整容差阈值`,
            resolved: false,
          });
        }
      }
      if (cadPoint && device.floor !== cadPoint.floor) {
        conflicts.push({
          id: conflictId('floor', idx++),
          type: 'cross_floor',
          severity: 'high',
          deviceIds: [device.id],
          cadPointIds: [cadPoint.id],
          evidence: [
            { source: 'device', field: 'floor', value: device.floor },
            { source: 'cad', field: 'floor', value: cadPoint.floor },
          ],
          suggestion: '楼层标记不一致，建议确认设备实际所在楼层',
          resolved: false,
        });
      }
    }
  });

  cadPoints.forEach(cad => {
    if (cad.oldName && cad.newName) {
      conflicts.push({
        id: conflictId('cad-field', idx++),
        type: 'cad_field_mismatch',
        severity: 'low',
        deviceIds: [],
        cadPointIds: [cad.id],
        evidence: [
          { source: 'cad', field: '旧口径', value: cad.oldName },
          { source: 'cad', field: '新口径', value: cad.newName },
        ],
        suggestion: 'CAD导出使用旧口径字段名，已自动映射到新口径，建议确认',
        resolved: false,
      });
    }
  });

  const coordSystems = new Set([
    ...devices.map(d => d.coordSystem),
    ...cadPoints.map(c => c.coordSystem),
  ]);

  if (coordSystems.size > 1 && params.coordSystemHandling === 'separate') {
    conflicts.push({
      id: conflictId('coord-sys', idx++),
      type: 'coord_system_mismatch',
      severity: 'medium',
      deviceIds: devices.filter(d => d.coordSystem !== 'A').map(d => d.id),
      cadPointIds: cadPoints.filter(c => c.coordSystem !== 'A').map(c => c.id),
      evidence: [
        { source: 'device', field: '坐标系', value: Array.from(coordSystems).join(', ') },
      ],
      suggestion: `检测到 ${coordSystems.size} 套坐标系数据，已分别渲染，不强行合并`,
      resolved: false,
    });
  }

  return conflicts;
}

export function generateReport(
  devices: Device[],
  conflicts: Conflict[],
  decisions: any[],
  params: Params
): string {
  const normalCount = devices.filter(d => d.status === 'normal').length;
  const warningCount = devices.filter(d => d.status === 'warning').length;
  const errorCount = devices.filter(d => d.status === 'error').length;
  const pendingCount = devices.filter(d => d.status === 'pending').length;
  const unresolvedConflicts = conflicts.filter(c => !c.resolved).length;

  const report = `
# 地下停车诱导模型 - 分析报告

**生成时间**: ${new Date().toLocaleString('zh-CN')}
**操作人员**: 阿乔

---

## 一、数据概览

| 指标 | 数量 | 说明 |
|------|------|------|
| 设备总数 | ${devices.length} | 现场采集设备 |
| CAD点位 | ${conflicts.filter(c => c.cadPointIds.length > 0).length} | CAD导出点位 |
| 正常通过 | ${normalCount} | 数据完整、坐标一致 |
| 待确认 | ${warningCount} | 需人工复核 |
| 异常 | ${errorCount} | 存在明显问题 |
| 未处理 | ${pendingCount} | 尚未匹配 |
| 待解决冲突 | ${unresolvedConflicts} | 项 |

---

## 二、当前参数设置

| 参数 | 值 |
|------|-----|
| 诱导距离阈值 | ${params.distanceThreshold}m |
| 坐标容差 | ${params.coordTolerance}m |
| 坐标系处理 | ${params.coordSystemHandling === 'separate' ? '分别渲染' : params.coordSystemHandling} |

---

## 三、主要问题清单

${conflicts.filter(c => !c.resolved).map((c, i) => `
### ${i + 1}. ${getConflictLabel(c.type)}（${getSeverityLabel(c.severity)}）

**问题描述**: ${c.suggestion}

**证据**:
${c.evidence.map(e => `- ${e.source === 'device' ? '现场数据' : 'CAD数据'} - ${e.field}: ${e.value}`).join('\n')}
`).join('\n')}

---

## 四、判定记录

${decisions.length > 0 
  ? decisions.map((d, i) => `${i + 1}. [${d.timestamp}] ${d.operator} - ${getDecisionLabel(d.type)}: ${d.reason}`).join('\n')
  : '暂无人工判定记录'
}

---

## 五、建议下一步

1. 先处理"高"优先级的冲突
2. 补充缺少照片的设备佐证材料
3. 对坐标偏移较大的设备进行现场复核
4. 统一设备命名规范

---

*此报告由地下停车诱导模型工具自动生成*
`;

  return report;
}

function getConflictLabel(type: string): string {
  const labels: Record<string, string> = {
    coord_offset: '坐标偏移',
    name_duplicate: '设备重名',
    missing_photo: '缺少照片',
    cross_floor: '跨楼层异常',
    coord_system_mismatch: '坐标系不一致',
    cad_field_mismatch: 'CAD字段口径不一致',
  };
  return labels[type] || type;
}

function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
  };
  return labels[severity] || severity;
}

function getDecisionLabel(type: string): string {
  const labels: Record<string, string> = {
    accept: '通过',
    reject: '驳回',
    manual_check: '人工确认',
    merge: '合并',
  };
  return labels[type] || type;
}
