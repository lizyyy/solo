module.exports = {
  BACKGROUND_CHECK_TIMEOUT_HOURS: parseInt(process.env.BACKGROUND_CHECK_TIMEOUT_HOURS || '72'),
  MAX_RETRY_TIMES: parseInt(process.env.MAX_RETRY_TIMES || '3'),
  
  CANDIDATE_STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
  },
  
  TASK_STATUS: {
    DRAFT: 'draft',
    PENDING_MATERIALS: 'pending_materials',
    MATERIALS_SUBMITTED: 'materials_submitted',
    SENT_TO_THIRD_PARTY: 'sent_to_third_party',
    THIRD_PARTY_RECEIVED: 'third_party_received',
    PENDING_REVIEW: 'pending_review',
    COMPLETED: 'completed',
    CONFLICT: 'conflict',
    CANCELLED: 'cancelled',
    TIMEOUT: 'timeout',
  },
  
  RISK_LEVEL: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },
  
  MATERIAL_TYPE: {
    ID_CARD: 'id_card',
    EDUCATION: 'education',
    EMPLOYMENT: 'employment',
    REFERENCE: 'reference',
    CRIMINAL: 'criminal',
    OTHER: 'other',
  },
};
