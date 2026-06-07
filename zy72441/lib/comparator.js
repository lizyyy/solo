const fs = require('fs');
const path = require('path');

class SynthPresetComparator {
  constructor(dataPath) {
    this.dataPath = dataPath || path.join(__dirname, '..', 'data', 'demo-batches.json');
    this.batches = this.loadBatches();
  }

  loadBatches() {
    if (fs.existsSync(this.dataPath)) {
      const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
      return data.batches || [];
    }
    return [];
  }

  saveBatches() {
    fs.writeFileSync(this.dataPath, JSON.stringify({ batches: this.batches }, null, 2), 'utf8');
  }

  importAuthorization(authData, batchName) {
    const batchId = `BATCH-${new Date().getFullYear()}-${String(this.batches.length + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const batch = {
      id: batchId,
      name: batchName || `导入批次 ${batchId}`,
      importedAt: now,
      status: 'imported',
      authorization: {
        licensee: authData.licensee || '未指定',
        validFrom: authData.validFrom,
        validTo: authData.validTo,
        ticketType: authData.ticketType || 'paid',
        ticketCount: authData.ticketCount || 0,
        authorizedPresets: authData.authorizedPresets || []
      },
      engineerNotes: '',
      history: [
        {
          action: 'import',
          timestamp: now,
          operator: '老周',
          note: '授权期限页第一次导入'
        }
      ],
      reminder: ''
    };

    this.analyzeBatch(batch);
    this.batches.push(batch);
    this.saveBatches();
    return batch;
  }

  analyzeBatch(batch) {
    const auth = batch.authorization;

    if (auth.ticketType === 'mixed' || this.detectMixedTickets(auth)) {
      batch.status = 'pending_review';
      batch.flags = batch.flags || [];
      if (!batch.flags.includes('mixed_tickets')) {
        batch.flags.push('mixed_tickets');
      }
      if (!batch.flags.includes('needs_engineer_review')) {
        batch.flags.push('needs_engineer_review');
      }
      batch.reminder = '⚠️ 赠票售票混批，待录音师确认后再更新授权提醒';
      batch.history.push({
        action: 'flag_mixed',
        timestamp: new Date().toISOString(),
        operator: '系统',
        note: '⚠️ 赠票和售票混在一个批次，按规则不归正常，留给录音师复核'
      });
    } else {
      batch.status = 'verified';
      batch.reminder = `授权将于 ${auth.validTo} 到期，提前两周续约`;
      batch.history.push({
        action: 'auto_verify',
        timestamp: new Date().toISOString(),
        operator: '系统',
        note: '纯售票批次，自动校验通过'
      });
    }
  }

  detectMixedTickets(auth) {
    if (auth.ticketType === 'mixed') return true;
    if (auth.ticketBreakdown) {
      const types = Object.keys(auth.ticketBreakdown);
      return types.length > 1;
    }
    return false;
  }

  addEngineerNotes(batchId, notes) {
    const batch = this.getBatch(batchId);
    if (!batch) throw new Error(`批次 ${batchId} 不存在`);

    batch.engineerNotes = notes;
    batch.history.push({
      action: 'add_notes',
      timestamp: new Date().toISOString(),
      operator: '老周',
      note: '补录调音师留言'
    });

    this.updateReminderFromNotes(batch);
    this.saveBatches();
    return batch;
  }

  updateReminderFromNotes(batch) {
    const notes = batch.engineerNotes;

    if (notes.includes('旧口径') || notes.includes('内部招待') || notes.includes('不计入')) {
      batch.status = 'completed_amended';
      batch.reminder = '补录旧口径完成，授权余量重新核算，实际余量充足';
      batch.history.push({
        action: 'amend_complete',
        timestamp: new Date().toISOString(),
        operator: '系统',
        note: '根据调音师留言补录旧口径，授权提醒已更新'
      });
      if (batch.flags) {
        batch.flags = batch.flags.filter(f => !['mixed_tickets', 'needs_engineer_review'].includes(f));
      }
    }
  }

  manualCorrect(batchId, correction, operator = '老周') {
    const batch = this.getBatch(batchId);
    if (!batch) throw new Error(`批次 ${batchId} 不存在`);

    batch.history.push({
      action: 'manual_correction',
      timestamp: new Date().toISOString(),
      operator: operator,
      note: correction
    });

    this.saveBatches();
    return batch;
  }

  rerunComparison(batchId, operator = '老周') {
    const batch = this.getBatch(batchId);
    if (!batch) throw new Error(`批次 ${batchId} 不存在`);

    batch.history.push({
      action: 'rerun',
      timestamp: new Date().toISOString(),
      operator: operator,
      note: '重跑比较逻辑，重新计算授权有效期'
    });

    this.analyzeBatch(batch);
    this.saveBatches();
    return batch;
  }

  getBatch(batchId) {
    return this.batches.find(b => b.id === batchId);
  }

  getAllBatches() {
    return this.batches;
  }

  getBatchesNeedingReview() {
    return this.batches.filter(b => b.status === 'pending_review');
  }

  formatBatchSummary(batch) {
    const statusMap = {
      'imported': '📥 已导入',
      'verified': '✅ 已校验',
      'completed': '✅ 已完成',
      'pending_review': '⚠️ 待复核',
      'completed_amended': '📝 已补录修正'
    };

    const lines = [];
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`批次: ${batch.id} - ${batch.name}`);
    lines.push(`状态: ${statusMap[batch.status] || batch.status}`);
    lines.push(`被授权方: ${batch.authorization.licensee}`);
    lines.push(`授权期限: ${batch.authorization.validFrom} 至 ${batch.authorization.validTo}`);
    lines.push(`票种: ${this.formatTicketType(batch.authorization.ticketType)} (${batch.authorization.ticketCount}张)`);
    lines.push(`预设清单: ${batch.authorization.authorizedPresets.join(', ')}`);

    if (batch.engineerNotes) {
      lines.push(`调音师留言: ${batch.engineerNotes}`);
    }

    if (batch.reminder) {
      lines.push(`授权提醒: ${batch.reminder}`);
    }

    if (batch.flags && batch.flags.length > 0) {
      lines.push(`标记: ${batch.flags.join(', ')}`);
    }

    return lines.join('\n');
  }

  formatTicketType(type) {
    const map = {
      'paid': '纯售票',
      'complimentary': '纯赠票',
      'mixed': '赠票+售票混批'
    };
    return map[type] || type;
  }

  formatHistory(batch) {
    const lines = ['操作记录:'];
    batch.history.forEach((h, i) => {
      lines.push(`  ${i + 1}. [${h.timestamp.split('T')[0]} ${h.timestamp.split('T')[1].split('.')[0]}] ${h.operator}: ${h.note}`);
    });
    return lines.join('\n');
  }
}

module.exports = SynthPresetComparator;
