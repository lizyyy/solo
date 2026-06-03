export const BOUNDARY_RULES = [
  {
    category: 'detection' as const,
    rule_name: 'MIXED_COORDINATE_DETECTION',
    rule_description: '当同一记录中同时出现经纬度标识（E/W/N/S、东经/西经/北纬/南纬、度数符号°）和米制坐标标识（m/米、大数值无度符号）时，判定为混合坐标类型',
    code_reference: 'api/services/coordinateDetector.ts::detectCoordinateType',
  },
  {
    category: 'detection' as const,
    rule_name: 'DEFAULT_COORDINATE_TYPE',
    rule_description: '无法识别坐标类型时默认为米制坐标，但保留原描述供人工复核',
    code_reference: 'api/services/coordinateDetector.ts::detectCoordinateType',
  },
  {
    category: 'correction' as const,
    rule_name: 'MIXED_RETAIN_REQUIRE_REASON',
    rule_description: '混合坐标记录不可自动归为正常，必须由教官填写保留理由后才可推进状态',
    code_reference: 'api/routes/review.ts::postReview',
  },
  {
    category: 'correction' as const,
    rule_name: 'CORRECTION_MUST_LOG',
    rule_description: '任何坐标类型修正操作必须在审计日志中记录修正前后的值',
    code_reference: 'api/services/auditService.ts::createAuditLog',
  },
  {
    category: 'rollback' as const,
    rule_name: 'ROLLBACK_RESTORE_SNAPSHOT',
    rule_description: '回滚操作将记录恢复到目标审计日志的快照状态，回滚本身也记入审计日志',
    code_reference: 'api/services/auditService.ts::rollbackToSnapshot',
  },
  {
    category: 'rollback' as const,
    rule_name: 'ROLLBACK_INSPECTOR_ONLY',
    rule_description: '只有巡检组(inspector)角色可以执行回滚操作',
    code_reference: 'api/routes/audit.ts::postRollback',
  },
]
