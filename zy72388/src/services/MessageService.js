const userFriendlyMessages = {
  duplicate_import: {
    title: '发现重复导入',
    message: '这条记录已经导入过了，同一时间、同一地点、同一频率的数据不能重复导入。',
    suggestion: '请检查导入的数据是否正确，或者跳过这条记录继续导入其他数据。',
    severity: 'warning'
  },
  missing_sample_time: {
    title: '采样时间缺失',
    message: '发现有半小时左右的采样记录没有上传，这会影响数据的连续性分析。',
    suggestion: '请维修师傅老岑确认是否保留这个间隔，或者补充上传缺失的采样数据。',
    severity: 'error'
  },
  threshold_violation: {
    title: '混响时间超出安全范围',
    message: '检测到混响时间值不在安全阈值范围内，可能存在声学问题。',
    suggestion: '请现场核实测量设备和环境条件，确认数据准确性。',
    severity: 'warning'
  },
  note_threshold_conflict: {
    title: '巡检备注与阈值冲突',
    message: '手写巡检备注写着"正常"，但安全阈值表显示混响时间超出范围，两边不一致。',
    suggestion: '请维修师傅老岑仔细核对，选择"确认冲突"或"驳回冲突"，不要自动处理。',
    severity: 'error'
  },
  supplement_added: {
    title: '补录记录已添加',
    message: '补录记录已成功添加，系统已自动重新计算相关数据。',
    suggestion: '请检查实验复盘图，确认补录后的数据趋势是否合理。',
    severity: 'info'
  },
  export_consistent: {
    title: '导出数据一致',
    message: '导出的数据经过校验，多次导出结果完全一致。',
    suggestion: '可以放心使用导出的数据进行报告和存档。',
    severity: 'success'
  },
  self_check_complete: {
    title: '自检完成',
    message: '系统已完成基本自检，包括重复导入检查、采样时间检查、补录重算检查和导出一致性检查。',
    suggestion: '请查看自检报告，处理发现的问题。',
    severity: 'info'
  },
  record_valid: {
    title: '记录验证通过',
    message: '这条混响时间记录格式正确，数据完整。',
    suggestion: '可以继续导入下一条记录。',
    severity: 'success'
  },
  record_invalid: {
    title: '记录验证失败',
    message: '这条记录缺少必要的信息或者数据格式有问题。',
    suggestion: '请检查采样时间、混响时间值和测量地点是否都填写正确。',
    severity: 'error'
  },
  missing_review_pending: {
    title: '待复核的时间缺失',
    message: '有采样时间缺失的记录还没有经过质检员复核，暂时不能标记为正常。',
    suggestion: '请先让质检员检查这些缺失记录，确认是否需要保留。',
    severity: 'warning'
  },
  keep_reason_recorded: {
    title: '保留理由已记录',
    message: '维修师傅老岑保留该时间缺失的理由已记录在案，可以在实验复盘图中查看。',
    suggestion: '点击复盘图中的缺失标记可查看详细原因。',
    severity: 'info'
  },
  workflow_step1_complete: {
    title: '第一步完成：手写巡检备注导入',
    message: '手写巡检备注已成功导入系统，与对应记录关联。',
    suggestion: '请进入第二步：维修师傅老岑查看安全阈值表。',
    severity: 'success'
  },
  workflow_step2_complete: {
    title: '第二步完成：老岑核对阈值',
    message: '维修师傅老岑已完成安全阈值表核对，发现的冲突已列出。',
    suggestion: '请处理冲突后进入第三步：实验复盘图更新。',
    severity: 'info'
  },
  workflow_step3_complete: {
    title: '第三步完成：实验复盘图更新',
    message: '实验复盘图已根据最新数据更新，包含所有记录、补录和缺失标记。',
    suggestion: '点击缺失标记可以查看维修师傅老岑当时保留它的理由。',
    severity: 'success'
  }
}

export class MessageService {
  constructor() {
    this.messages = []
    this.listeners = []
  }

  getMessage(key, customData = {}) {
    const template = userFriendlyMessages[key] || {
      title: '系统消息',
      message: key,
      suggestion: '请联系系统管理员。',
      severity: 'info'
    }

    return {
      id: 'MSG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      ...template,
      ...customData,
      timestamp: new Date().toISOString()
    }
  }

  addMessage(key, customData = {}) {
    const message = this.getMessage(key, customData)
    this.messages.push(message)
    this.notifyListeners(message)
    return message
  }

  addCustomMessage(customMessage) {
    const message = {
      id: 'MSG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      ...customMessage,
      timestamp: new Date().toISOString()
    }
    this.messages.push(message)
    this.notifyListeners(message)
    return message
  }

  getRecentMessages(limit = 10) {
    return this.messages.slice(-limit).reverse()
  }

  clearMessages() {
    this.messages = []
  }

  subscribe(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  notifyListeners(message) {
    for (const listener of this.listeners) {
      try {
        listener(message)
      } catch (e) {
        console.error('消息监听器出错:', e)
      }
    }
  }

  formatImportResults(results) {
    const formatted = []

    if (results.success.length > 0) {
      formatted.push(this.getMessage('record_valid', {
        message: `成功导入 ${results.success.length} 条记录。`,
        detail: results.success.map(r => 
          `时间: ${r.sampleTime}, 地点: ${r.location}, T60: ${r.reverberationTime}秒`
        ).join('\n')
      }))
    }

    if (results.duplicates.length > 0) {
      formatted.push(this.getMessage('duplicate_import', {
        message: `发现 ${results.duplicates.length} 条重复记录已跳过。`,
        detail: results.duplicates.map(d => d.reason).join('\n')
      }))
    }

    if (results.errors.length > 0) {
      formatted.push(this.getMessage('record_invalid', {
        message: `${results.errors.length} 条记录验证失败。`,
        detail: results.errors.map(e => e.errors.join('; ')).join('\n')
      }))
    }

    if (results.warnings.length > 0) {
      formatted.push(this.getMessage('threshold_violation', {
        message: `${results.warnings.length} 条记录有警告。`,
        detail: results.warnings.map(w => w.warnings.map(x => x.message).join('; ')).join('\n')
      }))
    }

    return formatted
  }

  formatConflict(conflict) {
    return {
      ...this.getMessage('note_threshold_conflict'),
      conflictId: conflict.id,
      evidence: conflict.evidence,
      status: conflict.status
    }
  }

  formatMissingRecord(missing) {
    const statusText = {
      'pending_review': '待质检员复核',
      'kept': '已保留',
      'resolved': '已补录解决'
    }

    return {
      ...this.getMessage('missing_sample_time'),
      missingId: missing.id,
      gapDuration: Math.round(missing.gapDuration) + ' 分钟',
      previousTime: missing.previousRecord.sampleTime,
      nextTime: missing.nextRecord.sampleTime,
      status: statusText[missing.status] || missing.status,
      keepReason: missing.keepReason,
      reviewedBy: missing.reviewedBy
    }
  }
}
