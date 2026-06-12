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

    const previousStatus = batch.status;
    batch.engineerNotes = notes;
    batch.history.push({
      action: 'add_notes',
      timestamp: new Date().toISOString(),
      operator: '老周',
      note: `补看调音师留言：${notes}`
    });

    this.updateReminderFromNotes(batch, previousStatus);
    this.saveBatches();
    return batch;
  }

  updateReminderFromNotes(batch, previousStatus) {
    const notes = batch.engineerNotes;
    const now = new Date().toISOString();

    const needsReview = batch.flags && batch.flags.includes('needs_engineer_review');
    const isMixed = batch.flags && batch.flags.includes('mixed_tickets');

    const hasOldCaliber = notes.includes('旧口径') || notes.includes('内部招待') || notes.includes('不计入');
    const hasEngineerConfirm = notes.includes('确认') || notes.includes('复核') || notes.includes('同意') || notes.includes('已核');

    if (needsReview && isMixed && (hasOldCaliber || hasEngineerConfirm)) {
      batch.status = 'engineer_reviewed';
      batch.history.push({
        action: 'engineer_review_complete',
        timestamp: now,
        operator: '系统',
        note: '录音师已复核，混批问题已确认'
      });
    }

    if (hasOldCaliber) {
      batch.status = 'completed_amended';
      batch.reminder = '补录旧口径完成，授权余量重新核算，实际余量充足';
      batch.report = {
        generatedAt: now,
        conclusion: '根据调音师留言补录旧口径修正',
        originalCount: batch.authorization.ticketCount,
        amendedCount: this.extractAmendedCount(notes, batch.authorization.ticketCount),
        oldCaliberNotes: notes,
        authorizationValid: true,
        nextStep: '无需特殊处理，按修正后数量监控授权到期'
      };
      batch.history.push({
        action: 'amend_complete',
        timestamp: now,
        operator: '系统',
        note: '根据调音师留言补录旧口径，授权提醒、复核状态、报告说明已全部更新'
      });
      if (batch.flags) {
        batch.flags = batch.flags.filter(f => !['mixed_tickets', 'needs_engineer_review'].includes(f));
      }
      batch.flags = batch.flags || [];
      batch.flags.push('engineer_confirmed');
    } else if (hasEngineerConfirm && isMixed) {
      const paidCount = this.extractPaidCount(notes, batch.authorization.ticketCount);
      batch.status = 'verified';
      batch.reminder = `录音师已确认，按 ${paidCount} 张售票核算，授权将于 ${batch.authorization.validTo} 到期`;
      batch.report = {
        generatedAt: now,
        conclusion: '录音师复核确认，赠票不计入授权计数',
        originalCount: batch.authorization.ticketCount,
        amendedCount: paidCount,
        engineerConfirmNotes: notes,
        authorizationValid: true,
        nextStep: '按售票数量监控授权到期，提前两周续约'
      };
      batch.history.push({
        action: 'verify_after_review',
        timestamp: now,
        operator: '系统',
        note: '录音师复核完成，授权提醒、复核状态、报告说明已全部更新'
      });
      if (batch.flags) {
        batch.flags = batch.flags.filter(f => !['mixed_tickets', 'needs_engineer_review'].includes(f));
      }
      batch.flags = batch.flags || [];
      batch.flags.push('engineer_confirmed');
    } else if (!needsReview && previousStatus === 'pending_review') {
      batch.status = 'completed';
      batch.reminder = `复核完成，授权将于 ${batch.authorization.validTo} 到期，提前两周续约`;
    }
  }

  extractAmendedCount(notes, fallback) {
    const paidMatch = notes.match(/(\d+)\s*张售票|售票\s*(\d+)\s*张|按\s*(\d+)\s*张/);
    if (paidMatch) {
      return parseInt(paidMatch[1] || paidMatch[2] || paidMatch[3]);
    }
    const anyMatch = notes.match(/(\d+)\s*张/);
    return anyMatch ? parseInt(anyMatch[1]) : fallback;
  }

  extractPaidCount(notes, fallback) {
    const match = notes.match(/(\d+)\s*张售票|售票\s*(\d+)\s*张|按\s*(\d+)\s*张/);
    if (match) {
      return parseInt(match[1] || match[2] || match[3]);
    }
    return fallback;
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
      'engineer_reviewed': '🔍 录音师已复核',
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

    if (batch.report) {
      lines.push(``);
      lines.push(`📄 报告说明:`);
      lines.push(`   结论: ${batch.report.conclusion}`);
      lines.push(`   原计数: ${batch.report.originalCount}张`);
      lines.push(`   修正后: ${batch.report.amendedCount}张`);
      lines.push(`   后续步骤: ${batch.report.nextStep}`);
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
