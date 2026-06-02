// ========== 结算报告生成 ==========
(function() {
  const { formatCurrency, formatDate, getStatusLabel, getAnomalyLabel, STATUS } = window.DataModels;

const ReportGenerator = {
  // 生成完整结算报告
  generateFullReport(records, failedItems = [], operator = '小李') {
    const settledRecords = records.filter(r => r.status === STATUS.SETTLED || r.status === STATUS.CONFIRMED);
    const pendingRecords = records.filter(r => r.status === STATUS.PENDING || r.status === STATUS.NEEDS_REVIEW);
    
    let totalDeposit = 0;
    let totalRefund = 0;
    let totalDeduction = 0;
    let oldStandardCount = 0;
    
    records.forEach(r => {
      totalDeposit += r.depositAmount || 0;
      if (r.settlement) {
        totalRefund += r.settlement.refundAmount || 0;
        totalDeduction += (r.settlement.originalDeposit || 0) - (r.settlement.refundAmount || 0);
      }
      if (r.source === 'group_screenshot') {
        oldStandardCount++;
      }
    });

    const reportDate = new Date().toLocaleDateString('zh-CN');
    const reportTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    // 生成HTML报告
    let html = `
      <div class="report-content">
        <div class="report-header">
          <div class="report-title">🎹 琴房预约押金结算报告</div>
          <div class="report-meta">
            报告日期：${reportDate} ${reportTime} · 处理人：${operator}
          </div>
        </div>

        <div class="report-section">
          <h3>📊 总体情况</h3>
          <div class="report-summary">
            <div class="report-summary-item">
              <div class="report-summary-label">处理记录总数</div>
              <div class="report-summary-value">${records.length} 条</div>
            </div>
            <div class="report-summary-item">
              <div class="report-summary-label">已完成结算</div>
              <div class="report-summary-value">${settledRecords.length} 条</div>
            </div>
            <div class="report-summary-item">
              <div class="report-summary-label">待人工处理</div>
              <div class="report-summary-value">${pendingRecords.length} 条</div>
            </div>
            <div class="report-summary-item">
              <div class="report-summary-label">导入失败</div>
              <div class="report-summary-value">${failedItems.length} 条</div>
            </div>
          </div>
          <div class="report-summary">
            <div class="report-summary-item">
              <div class="report-summary-label">押金总额</div>
              <div class="report-summary-value">${formatCurrency(totalDeposit)}</div>
            </div>
            <div class="report-summary-item">
              <div class="report-summary-label">应退总额</div>
              <div class="report-summary-value" style="color: #10b981;">${formatCurrency(totalRefund)}</div>
            </div>
            <div class="report-summary-item">
              <div class="report-summary-label">扣款总额</div>
              <div class="report-summary-value" style="color: #ef4444;">${formatCurrency(totalDeduction)}</div>
            </div>
            <div class="report-summary-item">
              <div class="report-summary-label">旧口径记录</div>
              <div class="report-summary-value" style="color: #f59e0b;">${oldStandardCount} 条</div>
            </div>
          </div>
        </div>

        <div class="report-section">
          <h3>📋 明细列表</h3>
          <table class="report-table">
            <thead>
              <tr>
                <th>曲目</th>
                <th>学生</th>
                <th>状态</th>
                <th>押金</th>
                <th>应退</th>
                <th>扣款原因</th>
              </tr>
            </thead>
            <tbody>
    `;

    records.forEach((record, idx) => {
      const deductionReasons = record.settlement && record.settlement.deductions 
        ? record.settlement.deductions.map(d => d.reason).join('、')
        : '';
      const refund = record.settlement ? formatCurrency(record.settlement.refundAmount) : '-';
      
      html += `
        <tr>
          <td>${record.trackName || '(未填写)'}</td>
          <td>${record.artist || '-'}</td>
          <td>${getStatusLabel(record.status)}</td>
          <td>${formatCurrency(record.depositAmount || 0)}</td>
          <td>${refund}</td>
          <td style="color: #ef4444;">${deductionReasons || '-'}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
    `;

    // 需要注意的事项
    const importantNotes = this.generateImportantNotes(records, failedItems);
    if (importantNotes.length > 0) {
      html += `
        <div class="report-section">
          <h3>⚠️ 需要注意的事</h3>
          <div class="report-remarks">
            <ul style="padding-left: 20px; margin: 0;">
      `;
      importantNotes.forEach(note => {
        html += `<li style="margin-bottom: 6px;">${note}</li>`;
      });
      html += `
            </ul>
          </div>
        </div>
      `;
    }

    // 待处理事项
    const pendingItems = this.generatePendingItems(pendingRecords);
    if (pendingItems.length > 0) {
      html += `
        <div class="report-section">
          <h3>⏳ 待人工处理</h3>
          <div class="report-remarks">
            <ul style="padding-left: 20px; margin: 0;">
      `;
      pendingItems.forEach(item => {
        html += `<li style="margin-bottom: 6px;">${item}</li>`;
      });
      html += `
            </ul>
          </div>
        </div>
      `;
    }

    html += `
        <div class="report-footer">
          本报告由「琴房预约押金结算系统」自动生成 · 如有疑问请找林老师核对
        </div>
      </div>
    `;

    // 纯文本版本（用于复制
    const textReport = this.generateTextReport(records, failedItems, operator);

    return { html, text: textReport };
  },

  // 生成口语化的注意事项
  generateImportantNotes(records, failedItems) {
    const notes = [];

    // 检查旧口径记录
    const oldStandardRecords = records.filter(r => r.source === 'group_screenshot');
    if (oldStandardRecords.length > 0) {
      notes.push(`有 ${oldStandardRecords.length} 条是从排练群截图补的旧口径数据，押金按老规矩算的，下次记得走系统`);
    }

    // 检查人工改名记录
    const renamedRecords = records.filter(r => r.isRenamed);
    if (renamedRecords.length > 0) {
      notes.push(`有 ${renamedRecords.length} 条文件名是人工改过的，我都备注了原始文件名，核对时留心一下`);
    }

    // 检查导入失败
    if (failedItems.length > 0) {
      notes.push(`有 ${failedItems.length} 个文件读不出来（可能损坏了），单独列在下面了，没影响其他的`);
      failedItems.forEach(item => {
        notes.push(`&nbsp;&nbsp;· ${item.fileName}：${item.error}`);
      });
    }

    // 检查重复曲目
    const hasDuplicates = records.some(r => 
      r.anomalies.some(a => a.type === 'duplicate' && !a.resolved)
    );
    if (hasDuplicates) {
      notes.push('发现有重复申报的记录，已经标记出来了，确认下是不是真的报重了');
    }

    // 检查空值
    const hasEmptyFields = records.some(r => 
      r.anomalies.some(a => a.type === 'empty_field' && !a.resolved)
    );
    if (hasEmptyFields) {
      notes.push('有些记录字段没填全，得补一下信息才能结算');
    }

    return notes;
  },

  // 生成待处理事项
  generatePendingItems(pendingRecords) {
    const items = [];
    
    pendingRecords.forEach(record => {
      const unresolvedAnomalies = record.anomalies.filter(a => !a.resolved);
      if (unresolvedAnomalies.length > 0) {
        unresolvedAnomalies.forEach(anomaly => {
          const trackName = record.trackName || '(未命名)';
          const artist = record.artist || '(未知)';
          items.push(`<strong>${trackName}</strong>（${artist}）：${anomaly.reason}`);
        });
      } else {
        const trackName = record.trackName || '(未命名)';
        const artist = record.artist || '(未知)';
        items.push(`<strong>${trackName}</strong>（${artist}）：状态是"${getStatusLabel(record.status)}"，需要人工确认下`);
      }
    });

    return items;
  },

  // 生成纯文本版本（同事间发消息用
  generateTextReport(records, failedItems, operator) {
    const now = new Date().toLocaleString('zh-CN');
    const settledRecords = records.filter(r => r.status === STATUS.SETTLED || r.status === STATUS.CONFIRMED);
    const pendingRecords = records.filter(r => r.status === STATUS.PENDING || r.status === STATUS.NEEDS_REVIEW);
    
    let totalDeposit = 0;
    let totalRefund = 0;
    let totalDeduction = 0;
    
    records.forEach(r => {
      totalDeposit += r.depositAmount || 0;
      if (r.settlement) {
        totalRefund += r.settlement.refundAmount || 0;
        totalDeduction += (r.settlement.originalDeposit || 0) - (r.settlement.refundAmount || 0);
      }
    });

    let text = `
🎹 琴房预约押金结算 - ${now}
处理人：${operator}

━━━━━━━━━━━━━━━━━━━━
📊 总体情况
━━━━━━━━━━━━━━━━━━━━
处理总数：${records.length} 条
已完成：${settledRecords.length} 条
待处理：${pendingRecords.length} 条
导入失败：${failedItems.length} 条

押金总额：${formatCurrency(totalDeposit)}
应退总额：${formatCurrency(totalRefund)}
扣款总额：${formatCurrency(totalDeduction)}

━━━━━━━━━━━━━━━━━━━━
📋 明细
━━━━━━━━━━━━━━━━━━━━
`;

    records.forEach((record, idx) => {
      const status = getStatusLabel(record.status);
      const refund = record.settlement ? formatCurrency(record.settlement.refundAmount) : '-';
      const deductions = record.settlement && record.settlement.deductions 
        ? record.settlement.deductions.map(d => `${d.reason}(${formatCurrency(d.amount)})`).join('，')
        : '无';
      
      text += `${idx + 1}. ${record.trackName || '(未填写)'} - ${record.artist || '-'}
   状态：${status} | 押金：${formatCurrency(record.depositAmount || 0)} | 应退：${refund}
   扣款：${deductions}
`;
      if (record.anomalies.length > 0) {
        const unresolved = record.anomalies.filter(a => !a.resolved);
        if (unresolved.length > 0) {
          text += `   ⚠️ ${unresolved.map(a => getAnomalyLabel(a.type) + ': ' + a.reason).join('；')}\n`;
        }
      }
      text += '\n';
    });

    // 待处理
    if (pendingRecords.length > 0) {
      text += `━━━━━━━━━━━━━━━━━━━━
⏳ 待人工处理
━━━━━━━━━━━━━━━━━━━━
`;
      pendingRecords.forEach(record => {
        const trackName = record.trackName || '(未命名)';
        const artist = record.artist || '(未知)';
        const issues = record.anomalies.filter(a => !a.resolved).map(a => a.reason).join('；');
        text += `• ${trackName}（${artist}）：${issues || '需要人工确认'}\n`;
      });
      text += '\n';
    }

    // 失败记录
    if (failedItems.length > 0) {
      text += `━━━━━━━━━━━━━━━━━━━━
❌ 导入失败（不影响其他）
━━━━━━━━━━━━━━━━━━━━
`;
      failedItems.forEach(item => {
        text += `• ${item.fileName}：${item.error}\n`;
      });
      text += '\n';
    }

    text += `━━━━━━━━━━━━━━━━━━━━
💬 备注
━━━━━━━━━━━━━━━━━━━━
本报告由系统自动生成，如有疑问找林老师核对。
`;

    return text;
  },

  // 生成单条记录的处理说明（用于历史记录
  generateProcessNote(record, action, operator) {
    const date = new Date().toLocaleString('zh-CN');
    return {
      author: operator,
      content: `${action}：${record.trackName || '(未命名)'}（${record.artist || '未知'}）`,
      time: date
    };
  }
};

  // ========== 导出 ==========
  window.ReportGenerator = ReportGenerator;
})();
