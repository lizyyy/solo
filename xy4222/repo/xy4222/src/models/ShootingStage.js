const ShootingStage = {
  BEFORE: 'before',
  DURING: 'during',
  AFTER: 'after',
  COMPARISON: 'comparison'
}

export const ShootingStageLabels = {
  [ShootingStage.BEFORE]: '修复前',
  [ShootingStage.DURING]: '修复中',
  [ShootingStage.AFTER]: '修复后',
  [ShootingStage.COMPARISON]: '对比图'
}

export default ShootingStage
