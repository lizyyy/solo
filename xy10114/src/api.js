const isElectron = window.electronAPI !== undefined

export const api = {
  async importFile() {
    if (isElectron) {
      return window.electronAPI.importFile()
    }
    return { success: false, error: '请在 Electron 环境中运行' }
  },

  async importFiles() {
    if (isElectron) {
      return window.electronAPI.importFiles()
    }
    return { success: false, error: '请在 Electron 环境中运行' }
  },

  async getContracts() {
    if (isElectron) {
      return window.electronAPI.getContracts()
    }
    return getMockContracts()
  },

  async getContract(id) {
    if (isElectron) {
      return window.electronAPI.getContract(id)
    }
    return getMockContracts().find(c => c.id === id)
  },

  async updateContractStatus(id, status) {
    if (isElectron) {
      return window.electronAPI.updateContractStatus(id, status)
    }
    return { success: true }
  },

  async deleteContract(id) {
    if (isElectron) {
      return window.electronAPI.deleteContract(id)
    }
    return { success: true }
  },

  async getComments(contractId) {
    if (isElectron) {
      return window.electronAPI.getComments(contractId)
    }
    return getMockComments(contractId)
  },

  async saveComment(comment) {
    if (isElectron) {
      return window.electronAPI.saveComment(comment)
    }
    return { id: Date.now(), success: true }
  },

  async updateComment(comment) {
    if (isElectron) {
      return window.electronAPI.updateComment(comment)
    }
    return { success: true }
  },

  async deleteComment(id) {
    if (isElectron) {
      return window.electronAPI.deleteComment(id)
    }
    return { success: true }
  },

  async getHistory(contractId) {
    if (isElectron) {
      return window.electronAPI.getHistory(contractId)
    }
    return getMockHistory(contractId)
  },

  async exportExcel(contractId) {
    if (isElectron) {
      return window.electronAPI.exportExcel(contractId)
    }
    return { success: false, error: '请在 Electron 环境中运行' }
  },

  async exportAllExcel() {
    if (isElectron) {
      return window.electronAPI.exportAllExcel()
    }
    return { success: false, error: '请在 Electron 环境中运行' }
  }
}

function getMockContracts() {
  return [
    {
      id: 1,
      file_name: '软件开发合同_v3.docx',
      file_path: '/path/to/contract1.docx',
      status: 'reviewing',
      version: 3,
      created_at: '2026-05-01T10:00:00Z',
      updated_at: '2026-05-08T14:30:00Z',
      comment_count: 5,
      accepted_count: 2,
      rejected_count: 1,
      pending_count: 2
    },
    {
      id: 2,
      file_name: '采购框架协议.docx',
      file_path: '/path/to/contract2.docx',
      status: 'pending',
      version: 1,
      created_at: '2026-05-05T09:00:00Z',
      updated_at: '2026-05-05T09:00:00Z',
      comment_count: 0,
      accepted_count: 0,
      rejected_count: 0,
      pending_count: 0
    }
  ]
}

function getMockComments(contractId) {
  if (contractId === 1) {
    return [
      {
        id: 1,
        contract_id: 1,
        clause_text: '乙方应在收到甲方付款后30日内交付产品',
        clause_type: 'payment',
        risk_level: 'high',
        comment_text: '付款期限过长，建议改为15日或验收后付款',
        reviewer: '张律师',
        review_date: '2026-05-06T10:00:00Z',
        adoption_status: 'accepted',
        version: 2
      },
      {
        id: 2,
        contract_id: 1,
        clause_text: '乙方承担的违约责任上限为合同总额的5%',
        clause_type: 'liability',
        risk_level: 'medium',
        comment_text: '责任限额过低，建议提高至10-15%',
        reviewer: '李法务',
        review_date: '2026-05-07T11:00:00Z',
        adoption_status: 'pending',
        version: 1
      }
    ]
  }
  return []
}

function getMockHistory(contractId) {
  if (contractId === 1) {
    return [
      {
        id: 1,
        comment_id: 1,
        contract_id: 1,
        clause_text: '乙方应在收到甲方付款后30日内交付产品',
        clause_type: 'payment',
        risk_level: 'high',
        comment_text: '付款期限过长，建议改为15日',
        reviewer: '张律师',
        adoption_status: 'pending',
        version: 1,
        change_type: 'INSERT',
        changed_at: '2026-05-06T10:00:00Z'
      },
      {
        id: 2,
        comment_id: 1,
        contract_id: 1,
        clause_text: '乙方应在收到甲方付款后30日内交付产品',
        clause_type: 'payment',
        risk_level: 'high',
        comment_text: '付款期限过长，建议改为15日或验收后付款',
        reviewer: '张律师',
        adoption_status: 'accepted',
        version: 2,
        change_type: 'UPDATE',
        changed_at: '2026-05-07T15:00:00Z'
      }
    ]
  }
  return []
}
