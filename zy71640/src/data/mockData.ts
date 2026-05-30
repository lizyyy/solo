import type { Wall, Artwork, Light, VisitorPath, SafetyZone, Source, Conflict, PathPoint } from '@/types'

function gid(): string {
  return Math.random().toString(36).substring(2, 10)
}

function ts(): string {
  return new Date().toISOString()
}

export const DEMO_EXHIBITION_ID = 'demo-exhibition-001'

export const demoSources: Source[] = [
  { id: 'src-1', type: 'email', label: '张策展人邮件', detail: '2024-03-15 邮件附件', importedAt: ts() },
  { id: 'src-2', type: 'chat', label: '布展微信群', detail: '2024-03-12 群消息', importedAt: ts() },
  { id: 'src-3', type: 'spreadsheet', label: '作品清单.xlsx', detail: '从旧表格导入', importedAt: ts() },
  { id: 'src-4', type: 'report', label: '春季展布展报告', detail: '2023年旧报告', importedAt: ts() },
  { id: 'src-5', type: 'manual', label: '手动录入', detail: '现场补充', importedAt: ts() },
]

export const demoWalls: Wall[] = [
  { id: 'wall-n', exhibitionId: DEMO_EXHIBITION_ID, startX: -6, startY: 0, startZ: -5, endX: 6, endY: 0, endZ: -5, height: 4, sourceId: 'src-1' },
  { id: 'wall-s', exhibitionId: DEMO_EXHIBITION_ID, startX: -6, startY: 0, startZ: 5, endX: 6, endY: 0, endZ: 5, height: 4, sourceId: 'src-1' },
  { id: 'wall-w', exhibitionId: DEMO_EXHIBITION_ID, startX: -6, startY: 0, startZ: -5, endX: -6, endY: 0, endZ: 5, height: 4, sourceId: 'src-1' },
  { id: 'wall-e', exhibitionId: DEMO_EXHIBITION_ID, startX: 6, startY: 0, startZ: -5, endX: 6, endY: 0, endZ: 5, height: 4, sourceId: 'src-1' },
]

export const demoArtworks: Artwork[] = [
  { id: 'art-1', exhibitionId: DEMO_EXHIBITION_ID, title: '山间晨雾', width: 1.2, height: 0.8, depth: 0.05, posX: -3, posY: 1.8, posZ: -4.95, rotY: 0, wallId: 'wall-n', sourceId: 'src-3', validationStatus: 'normal', processingOrder: 1 },
  { id: 'art-2', exhibitionId: DEMO_EXHIBITION_ID, title: '都市夜色', width: 1.5, height: 1.0, depth: 0.05, posX: 0, posY: 1.6, posZ: -4.95, rotY: 0, wallId: 'wall-n', sourceId: 'src-3', validationStatus: 'normal', processingOrder: 2 },
  { id: 'art-3', exhibitionId: DEMO_EXHIBITION_ID, title: '静物', width: 0.6, height: 0.6, depth: 0.05, posX: 3, posY: 2.0, posZ: -4.95, rotY: 0, wallId: 'wall-n', sourceId: 'src-3', validationStatus: 'normal', processingOrder: 3 },
  { id: 'art-4', exhibitionId: DEMO_EXHIBITION_ID, title: '流光', width: 2.0, height: 1.2, depth: 0.05, posX: -2.5, posY: 1.5, posZ: 4.95, rotY: Math.PI, wallId: 'wall-s', sourceId: 'src-2', validationStatus: 'normal', processingOrder: 4 },
  { id: 'art-5', exhibitionId: DEMO_EXHIBITION_ID, title: '抽象之三', width: 1.0, height: 1.0, depth: 0.05, posX: 1.5, posY: 1.7, posZ: 4.95, rotY: Math.PI, wallId: 'wall-s', sourceId: 'src-2', validationStatus: 'normal', processingOrder: 5 },
  { id: 'art-6', exhibitionId: DEMO_EXHIBITION_ID, title: '水墨长卷', width: 3.0, height: 0.8, depth: 0.05, posX: -5.95, posY: 1.6, posZ: -2, rotY: Math.PI / 2, wallId: 'wall-w', sourceId: 'src-5', validationStatus: 'normal', processingOrder: 6 },
  { id: 'art-7', exhibitionId: DEMO_EXHIBITION_ID, title: '装置A', width: 0.5, height: 0.5, depth: 0.5, posX: -5.95, posY: 1.0, posZ: 2, rotY: Math.PI / 2, wallId: 'wall-w', sourceId: 'src-5', validationStatus: 'normal', processingOrder: 7 },
  { id: 'art-8', exhibitionId: DEMO_EXHIBITION_ID, title: '东墙大作', width: 4.0, height: 2.5, depth: 0.05, posX: 5.95, posY: 1.5, posZ: 0, rotY: -Math.PI / 2, wallId: 'wall-e', sourceId: 'src-4', validationStatus: 'invalid', processingOrder: 8 },
  { id: 'art-overlap-1', exhibitionId: DEMO_EXHIBITION_ID, title: '重叠测试A', width: 1.5, height: 1.0, depth: 0.05, posX: -2, posY: 1.8, posZ: -4.93, rotY: 0, wallId: 'wall-n', sourceId: 'src-5', validationStatus: 'normal', processingOrder: 9 },
  { id: 'art-missing', exhibitionId: DEMO_EXHIBITION_ID, title: '未确认作品', width: 0, height: 0, depth: 0, posX: 0, posY: 0, posZ: 0, rotY: 0, wallId: '', sourceId: 'src-2', validationStatus: 'missing', processingOrder: 10 },
]

export const demoLights: Light[] = [
  { id: 'light-1', exhibitionId: DEMO_EXHIBITION_ID, type: 'point', posX: -3, posY: 3.8, posZ: -3, intensity: 1.2, range: 6, color: '#fff5e6', sourceId: 'src-1', validationStatus: 'normal', processingOrder: 1 },
  { id: 'light-2', exhibitionId: DEMO_EXHIBITION_ID, type: 'point', posX: 3, posY: 3.8, posZ: -3, intensity: 1.0, range: 6, color: '#fff5e6', sourceId: 'src-1', validationStatus: 'normal', processingOrder: 2 },
  { id: 'light-3', exhibitionId: DEMO_EXHIBITION_ID, type: 'spot', posX: 0, posY: 3.9, posZ: 3, intensity: 1.5, range: 8, color: '#ffffff', sourceId: 'src-4', validationStatus: 'normal', processingOrder: 3 },
  { id: 'light-4', exhibitionId: DEMO_EXHIBITION_ID, type: 'point', posX: -3, posY: 3.8, posZ: 0, intensity: 0.8, range: 4, color: '#ffeedd', sourceId: 'src-5', validationStatus: 'normal', processingOrder: 4 },
  { id: 'light-obscured', exhibitionId: DEMO_EXHIBITION_ID, type: 'point', posX: -5.8, posY: 1.2, posZ: -2, intensity: 0.6, range: 3, color: '#ffccaa', sourceId: 'src-2', validationStatus: 'normal', processingOrder: 5 },
  { id: 'light-invalid', exhibitionId: DEMO_EXHIBITION_ID, type: 'point', posX: 0, posY: -1, posZ: 0, intensity: 5, range: 100, color: '#ff0000', sourceId: 'src-5', validationStatus: 'invalid', processingOrder: 6 },
]

export const demoPaths: VisitorPath[] = [
  {
    id: 'path-1',
    exhibitionId: DEMO_EXHIBITION_ID,
    name: '主参观路线',
    points: [
      { x: 0, y: 0, z: 4.5, time: 0 },
      { x: -3, y: 0, z: 4, time: 5 },
      { x: -3, y: 0, z: 2, time: 10 },
      { x: -3, y: 0, z: -2, time: 20 },
      { x: -3, y: 0, z: -4, time: 25 },
      { x: 0, y: 0, z: -4, time: 35 },
      { x: 3, y: 0, z: -4, time: 40 },
      { x: 3, y: 0, z: 0, time: 50 },
      { x: 3, y: 0, z: 3, time: 55 },
      { x: 0, y: 0, z: 3, time: 60 },
      { x: -2, y: 0, z: 3, time: 65 },
      { x: -2, y: 0, z: 0, time: 70 },
      { x: 0, y: 0, z: 0, time: 75 },
    ],
    sourceId: 'src-4',
    validationStatus: 'normal',
    processingOrder: 1,
  },
]

export const demoSafetyZones: SafetyZone[] = [
  { id: 'sz-1', exhibitionId: DEMO_EXHIBITION_ID, artworkId: 'art-1', distance: 0.8, sourceId: 'src-3' },
  { id: 'sz-2', exhibitionId: DEMO_EXHIBITION_ID, artworkId: 'art-2', distance: 0.8, sourceId: 'src-3' },
  { id: 'sz-3', exhibitionId: DEMO_EXHIBITION_ID, artworkId: 'art-3', distance: 0.8, sourceId: 'src-3' },
  { id: 'sz-4', exhibitionId: DEMO_EXHIBITION_ID, artworkId: 'art-4', distance: 1.0, sourceId: 'src-2' },
  { id: 'sz-5', exhibitionId: DEMO_EXHIBITION_ID, artworkId: 'art-5', distance: 0.8, sourceId: 'src-2' },
  { id: 'sz-6', exhibitionId: DEMO_EXHIBITION_ID, artworkId: 'art-6', distance: 0.8, sourceId: 'src-5' },
  { id: 'sz-7', exhibitionId: DEMO_EXHIBITION_ID, artworkId: 'art-7', distance: 0.6, sourceId: 'src-5' },
  { id: 'sz-8', exhibitionId: DEMO_EXHIBITION_ID, artworkId: 'art-8', distance: 1.2, sourceId: 'src-4' },
  { id: 'sz-9', exhibitionId: DEMO_EXHIBITION_ID, artworkId: 'art-overlap-1', distance: 0.8, sourceId: 'src-5' },
]

export function computeDemoConflicts(
  artworks: Artwork[],
  lights: Light[],
  paths: VisitorPath[],
  safetyZones: SafetyZone[]
): Conflict[] {
  const conflicts: Conflict[] = []

  const a1 = artworks.find(a => a.id === 'art-1')!
  const aOverlap = artworks.find(a => a.id === 'art-overlap-1')!
  if (a1 && aOverlap) {
    const dx = Math.abs(a1.posX - aOverlap.posX)
    const overlapW = (a1.width + aOverlap.width) / 2 - dx
    if (overlapW > 0) {
      conflicts.push({
        id: gid(),
        type: 'overlap',
        severity: 'critical',
        affectedIds: ['art-1', 'art-overlap-1'],
        description: `「${a1.title}」与「${aOverlap.title}」水平重叠 ${overlapW.toFixed(2)}m`,
        resolvedAt: null,
      })
    }
  }

  const a8 = artworks.find(a => a.id === 'art-8')!
  if (a8 && a8.height > a8.posY + a8.height / 2) {
    conflicts.push({
      id: gid(),
      type: 'overlap',
      severity: 'critical',
      affectedIds: ['art-8'],
      description: `「${a8.title}」尺寸 ${a8.width}×${a8.height}m 超出展墙高度 4m`,
      resolvedAt: null,
    })
  }

  const lightObscured = lights.find(l => l.id === 'light-obscured')!
  const a6 = artworks.find(a => a.id === 'art-6')!
  if (lightObscured && a6) {
    const dist = Math.sqrt(
      (lightObscured.posX - a6.posX) ** 2 +
      (lightObscured.posY - a6.posY) ** 2 +
      (lightObscured.posZ - a6.posZ) ** 2
    )
    if (dist < 1.5) {
      conflicts.push({
        id: gid(),
        type: 'light_obstruction',
        severity: 'warning',
        affectedIds: ['light-obscured', 'art-6'],
        description: `灯光「light-obscured」距作品「${a6.title}」仅 ${dist.toFixed(2)}m，可能被遮挡`,
        resolvedAt: null,
      })
    }
  }

  const lightInvalid = lights.find(l => l.id === 'light-invalid')!
  if (lightInvalid && lightInvalid.posY < 0) {
    conflicts.push({
      id: gid(),
      type: 'light_obstruction',
      severity: 'critical',
      affectedIds: ['light-invalid'],
      description: `灯光「light-invalid」位于地面以下 (Y=${lightInvalid.posY})，参数不合理`,
      resolvedAt: null,
    })
  }

  const path1 = paths.find(p => p.id === 'path-1')
  if (path1 && path1.points.length > 4) {
    const pts = path1.points
    for (let i = 0; i < pts.length - 1; i++) {
      for (let j = i + 2; j < pts.length - 1; j++) {
        const segA = { dx: pts[i + 1].x - pts[i].x, dz: pts[i + 1].z - pts[i].z }
        const segB = { dx: pts[j + 1].x - pts[j].x, dz: pts[j + 1].z - pts[j].z }
        const cross = segA.dx * segB.dz - segA.dz * segB.dx
        const dot = segA.dx * segB.dx + segA.dz * segB.dz
        const angle = Math.abs(Math.atan2(cross, dot)) * 180 / Math.PI
        if (angle > 150 && pts[j].time - pts[i].time < 30) {
          conflicts.push({
            id: gid(),
            type: 'path_backflow',
            severity: 'warning',
            affectedIds: ['path-1'],
            description: `路线「${path1.name}」在 ${pts[i].time}s-${pts[j].time}s 之间出现回流（转向 ${angle.toFixed(0)}°）`,
            resolvedAt: null,
          })
          break
        }
      }
      if (conflicts.some(c => c.type === 'path_backflow')) break
    }
  }

  const missingArt = artworks.find(a => a.id === 'art-missing')
  if (missingArt) {
    conflicts.push({
      id: gid(),
      type: 'safety_violation',
      severity: 'info',
      affectedIds: ['art-missing'],
      description: `「${missingArt.title}」缺少尺寸和位置信息，无法计算安全距离`,
      resolvedAt: null,
    })
  }

  return conflicts
}
