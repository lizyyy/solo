export const certificateStatusMap = {
  active: { label: '有效', type: 'success', color: '#67c23a' },
  expiring_soon: { label: '即将过期', type: 'warning', color: '#e6a23c' },
  expired: { label: '已过期', type: 'danger', color: '#f56c6c' },
  cancelled: { label: '已注销', type: 'info', color: '#909399' },
  replaced: { label: '已换人', type: 'info', color: '#909399' }
}

export const replacementStatusMap = {
  pending: { label: '待审批', type: 'warning', color: '#e6a23c' },
  approved: { label: '已通过', type: 'success', color: '#67c23a' },
  rejected: { label: '已驳回', type: 'danger', color: '#f56c6c' }
}

export const operationTypeMap = {
  PATIENT_REGISTER: { label: '患者登记', type: 'primary' },
  PATIENT_UPDATE: { label: '患者更新', type: 'info' },
  CERTIFICATE_ISSUE: { label: '证件办理', type: 'success' },
  CERTIFICATE_RENEW: { label: '证件续期', type: 'primary' },
  CERTIFICATE_CANCEL: { label: '证件注销', type: 'danger' },
  REPLACEMENT_REQUEST: { label: '换人申请', type: 'warning' },
  REPLACEMENT_APPROVE: { label: '换人通过', type: 'success' },
  REPLACEMENT_REJECT: { label: '换人驳回', type: 'danger' }
}

export const resultTypeMap = {
  success: { label: '成功', type: 'success' },
  failed: { label: '失败', type: 'danger' }
}
