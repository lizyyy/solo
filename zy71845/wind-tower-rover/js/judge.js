import { getAllPoints, getAllModels, getAllInspections, getInspectionsByPoint, putPoint, putWorkflow } from './store.js';

function computeBoundary(points) {
  if (!points.length) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, boundaryMargin: 0 };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;
  const boundaryMargin = Math.min(rangeX, rangeZ) * 0.15;
  return { minX, maxX, minZ, maxZ, boundaryMargin };
}

function isBoundaryPoint(point, boundary) {
  const { minX, maxX, minZ, maxZ, boundaryMargin } = boundary;
  return (
    point.x <= minX + boundaryMargin ||
    point.x >= maxX - boundaryMargin ||
    point.z <= minZ + boundaryMargin ||
    point.z >= maxZ - boundaryMargin
  );
}

function findOverlaps(points) {
  const overlaps = new Map();
  const seen = new Map();
  for (const p of points) {
    const key = `${p.x.toFixed(1)}_${p.z.toFixed(1)}`;
    if (seen.has(key)) {
      const existing = seen.get(key);
      if (!overlaps.has(key)) {
        overlaps.set(key, [existing]);
      }
      overlaps.get(key).push(p);
    } else {
      seen.set(key, p);
    }
  }
  return overlaps;
}

export async function runAutoJudge() {
  const points = await getAllPoints();
  const models = await getAllModels();
  const inspections = await getAllInspections();

  const modelIds = new Set(models.map(m => m.id));
  const inspectionByPoint = new Map();
  for (const insp of inspections) {
    if (!inspectionByPoint.has(insp.pointId)) {
      inspectionByPoint.set(insp.pointId, []);
    }
    inspectionByPoint.get(insp.pointId).push(insp);
  }

  const photoNameMap = new Map();
  for (const insp of inspections) {
    const photoNames = insp.photoFiles || [];
    for (const photoName of photoNames) {
      if (!photoNameMap.has(photoName)) {
        photoNameMap.set(photoName, []);
      }
      photoNameMap.get(photoName).push({ inspectionId: insp.id, pointId: insp.pointId, photoName });
    }
  }

  const boundary = computeBoundary(points);
  const overlaps = findOverlaps(points);

  const results = [];

  for (const point of points) {
    const flags = [];
    const reasons = [];
    const nextSteps = [];

    if (!point.linkedModelId) {
      flags.push('no-model');
      reasons.push('该点位未关联任何塔筒模型，无法确认塔筒规格是否匹配');
      nextSteps.push('请从模型清单中为该点位分配对应型号');
    } else if (!modelIds.has(point.linkedModelId)) {
      flags.push('no-model');
      reasons.push(`该点位关联的模型 "${point.linkedModelId}" 在模型清单中不存在，可能已被删除或ID不匹配`);
      nextSteps.push('请核实模型ID，重新关联正确的模型');
    }

    const pointInspections = inspectionByPoint.get(point.id) || [];
    if (pointInspections.length === 0) {
      flags.push('no-inspection');
      reasons.push('该点位尚无任何巡检记录，现场状况未知');
      nextSteps.push('请安排现场巡检并上传巡检照片');
    }

    for (const insp of pointInspections) {
      const photoNames = insp.photoFiles || [];
      for (const photoName of photoNames) {
        const entries = photoNameMap.get(photoName) || [];
        const duplicates = entries.filter(e => e.inspectionId !== insp.id);
        for (const dup of duplicates) {
          flags.push('duplicate-photo');
          reasons.push(`照片 "${photoName}" 在巡检 ${insp.id} 和巡检 ${dup.inspectionId}(点位 ${dup.pointId}) 中重复出现`);
          nextSteps.push('请确认是否为重复上传；如非重复请备注说明拍摄时间与位置差异');
        }
      }

      const samePointPhotos = [];
      for (const otherInsp of pointInspections) {
        if (otherInsp.id === insp.id) continue;
        const otherPhotos = otherInsp.photoFiles || [];
        for (const pName of insp.photoFiles || []) {
          if (otherPhotos.includes(pName)) {
            samePointPhotos.push(pName);
          }
        }
      }
      for (const dupName of samePointPhotos) {
        if (!flags.includes('duplicate-photo')) {
          flags.push('duplicate-photo');
          reasons.push(`照片 "${dupName}" 在同一点位的多条巡检记录中重复出现`);
          nextSteps.push('请核实是否为同一次巡检的重复上传');
        }
      }
    }

    if (isBoundaryPoint(point, boundary)) {
      flags.push('boundary');
      reasons.push('该点位位于风场边界区域，可能面临特殊地形或风况条件');
      nextSteps.push('边界点位需额外确认地形数据和风况评估报告');
    }

    const overlapKey = `${point.x.toFixed(1)}_${point.z.toFixed(1)}`;
    if (overlaps.has(overlapKey)) {
      const overlapping = overlaps.get(overlapKey);
      if (overlapping.length > 1 && overlapping.some(p => p.id === point.id)) {
        flags.push('overlap');
        const otherNames = overlapping.filter(p => p.id !== point.id).map(p => p.name || p.id).join(', ');
        reasons.push(`该点位与 [${otherNames}] 坐标完全重叠(${point.x}, ${point.z})`);
        nextSteps.push('请核实是否为数据录入错误，如为不同高度点位请补充高程区分');
      }
    }

    if (flags.length === 0) {
      flags.push('ok');
    }

    const updatedPoint = {
      ...point,
      flags,
      judgeReasons: reasons,
      judgeNextSteps: nextSteps,
      judgeTime: new Date().toISOString()
    };

    await putPoint(updatedPoint);

    results.push({
      pointId: point.id,
      pointName: point.name || point.id,
      flags,
      reasons,
      nextSteps
    });
  }

  await putWorkflow({
    id: `WF_JUDGE_${Date.now()}`,
    pointId: 'ALL',
    action: 'auto_judge',
    timestamp: new Date().toISOString(),
    operator: 'system',
    reason: `自动判断完成，共检查 ${points.length} 个点位`,
    nextStep: results.filter(r => !r.flags.includes('ok')).length > 0
      ? `${results.filter(r => !r.flags.includes('ok')).length} 个点位存在标记，请在复核页查看`
      : '所有点位均无异常标记',
    details: { totalPoints: points.length, flaggedPoints: results.filter(r => !r.flags.includes('ok')).length }
  });

  return results;
}

export function formatJudgeResult(results) {
  const lines = [];
  const flagged = results.filter(r => !r.flags.includes('ok'));
  const ok = results.filter(r => r.flags.includes('ok') && r.flags.length === 1);

  lines.push(`【判断总览】共 ${results.length} 个点位，${ok.length} 个正常，${flagged.length} 个有标记\n`);

  for (const r of flagged) {
    lines.push(`◆ 点位 ${r.pointName} (${r.pointId})`);
    for (let i = 0; i < r.reasons.length; i++) {
      lines.push(`  判断理由: ${r.reasons[i]}`);
      lines.push(`  下一步: ${r.nextSteps[i]}`);
    }
    lines.push('');
  }

  if (ok.length > 0) {
    lines.push(`✓ 正常点位: ${ok.map(r => r.pointName).join(', ')}`);
  }

  return lines.join('\n');
}
