export const BOUNDARY_RULES = {
  reworkReason: {
    keywords: ['返工', '重录', '修改', '调整', '需复核', '待确认', '不对', '错误'],
    autoDetect: true,
    requireManualReview: true,
    preventAutoNormal: true
  },
  importDeduplication: {
    checkBatchIdentifier: true,
    checkTrackIdAndAliases: true,
    skipDuplicates: true,
    updateIfExists: false
  },
  statusTransition: {
    allowedPaths: {
      pending: ['reviewing', 'rework_required'],
      reviewing: ['approved', 'rejected', 'rework_required'],
      rework_required: ['reviewing', 'approved'],
      approved: ['normal'],
      rejected: ['reviewing'],
      normal: []
    },
    requireReviewBeforeNormal: true,
    allowRollbackFrom: ['reviewing', 'rework_required', 'approved']
  },
  workflow: {
    steps: ['alias_import', 'photo_review', 'rehearsal_update'],
    requirePhotoReview: true,
    requireRehearsalUpdate: true,
    skipReworkTracks: false
  },
  displayMode: {
    chart: {
      requireServiceReview: true,
      allowNavigationBack: true
    },
    three_d: {
      requireServiceReview: true,
      allowNavigationBack: true
    }
  }
} as const;

export type BoundaryRules = typeof BOUNDARY_RULES;
