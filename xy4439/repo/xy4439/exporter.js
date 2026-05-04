class Exporter {
  constructor(db) {
    this.db = db;
  }

  async exportMarkdown(date, shiftType) {
    const shiftResult = this.db.db.exec(
      'SELECT id, date, shift_type FROM shifts WHERE date = ? AND shift_type = ?',
      [date, shiftType]
    );

    if (shiftResult.length === 0 || shiftResult[0].values.length === 0) {
      return `# ${date} ${shiftType} 交接单\n\n暂无数据`;
    }

    const shiftId = shiftResult[0].values[0][0];
    
    const risks = this.db.getRisksForShift(shiftId);
    const weldingRecords = this.db.getWeldingRecordsForShift(shiftId);
    const exhaustData = this.db.getExhaustDataForShift(shiftId);
    const schedule = this.db.getEmployeeScheduleForShift(shiftId);
    const inspections = this.db.getHelmetInspectionsForShift(shiftId);

    let markdown = `# ${date} ${shiftType} 交接单\n\n`;
    markdown += `> 生成时间：${new Date().toLocaleString('zh-CN')}\n\n`;

    markdown += `## 风险概览\n\n`;
    
    const redRisks = risks.filter(r => r.risk_level === '红色');
    const yellowRisks = risks.filter(r => r.risk_level === '黄色');
    const greenRisks = risks.filter(r => r.risk_level === '绿色');

    markdown += `| 风险等级 | 数量 |\n`;
    markdown += `|----------|------|\n`;
    markdown += `| 🔴 红色 | ${redRisks.length} |\n`;
    markdown += `| 🟡 黄色 | ${yellowRisks.length} |\n`;
    markdown += `| 🟢 绿色 | ${greenRisks.length} |\n\n`;

    if (redRisks.length > 0) {
      markdown += `## 🔴 红色风险（需立即处理）\n\n`;
      redRisks.forEach((risk, index) => {
        markdown += `### ${index + 1}. ${risk.risk_type}\n\n`;
        markdown += `- **工位/员工**: ${risk.station_id || risk.employee_name || '未知'}\n`;
        markdown += `- **时间**: ${risk.start_time ? new Date(risk.start_time).toLocaleString('zh-CN') : '未知'}\n`;
        if (risk.duration_seconds) {
          markdown += `- **持续时间**: ${Math.floor(risk.duration_seconds / 60)} 分钟\n`;
        }
        if (risk.smoke_level !== null) {
          markdown += `- **烟尘浓度**: ${risk.smoke_level.toFixed(1)} mg/m³\n`;
        }
        if (risk.exhaust_flow !== null) {
          markdown += `- **排风流量**: ${risk.exhaust_flow.toFixed(2)} m³/min\n`;
        }
        markdown += `- **描述**: ${risk.description}\n`;
        if (risk.latest_comment) {
          markdown += `- **复核状态**: ${risk.review_status || 'pending'}\n`;
          markdown += `- **复核备注**: ${risk.latest_comment}\n`;
        }
        markdown += `\n`;
      });
    }

    if (yellowRisks.length > 0) {
      markdown += `## 🟡 黄色风险（需关注）\n\n`;
      yellowRisks.forEach((risk, index) => {
        markdown += `### ${index + 1}. ${risk.risk_type}\n\n`;
        markdown += `- **工位/员工**: ${risk.station_id || risk.employee_name || '未知'}\n`;
        markdown += `- **时间**: ${risk.start_time ? new Date(risk.start_time).toLocaleString('zh-CN') : '未知'}\n`;
        if (risk.duration_seconds) {
          markdown += `- **持续时间**: ${Math.floor(risk.duration_seconds / 60)} 分钟\n`;
        }
        if (risk.smoke_level !== null) {
          markdown += `- **烟尘浓度**: ${risk.smoke_level.toFixed(1)} mg/m³\n`;
        }
        markdown += `- **描述**: ${risk.description}\n`;
        if (risk.latest_comment) {
          markdown += `- **复核状态**: ${risk.review_status || 'pending'}\n`;
          markdown += `- **复核备注**: ${risk.latest_comment}\n`;
        }
        markdown += `\n`;
      });
    }

    if (greenRisks.length > 0) {
      markdown += `## 🟢 绿色风险（需留意）\n\n`;
      greenRisks.forEach((risk, index) => {
        markdown += `### ${index + 1}. ${risk.risk_type}\n\n`;
        markdown += `- **工位/员工**: ${risk.station_id || risk.employee_name || '未知'}\n`;
        markdown += `- **时间**: ${risk.start_time ? new Date(risk.start_time).toLocaleString('zh-CN') : '未知'}\n`;
        if (risk.duration_seconds) {
          markdown += `- **持续时间**: ${Math.floor(risk.duration_seconds / 60)} 分钟\n`;
        }
        markdown += `- **描述**: ${risk.description}\n`;
        if (risk.latest_comment) {
          markdown += `- **复核状态**: ${risk.review_status || 'pending'}\n`;
          markdown += `- **复核备注**: ${risk.latest_comment}\n`;
        }
        markdown += `\n`;
      });
    }

    markdown += `## 数据统计\n\n`;
    markdown += `- **焊机记录数**: ${weldingRecords.length}\n`;
    markdown += `- **排风传感器数据点**: ${exhaustData.length}\n`;
    markdown += `- **员工排班记录**: ${schedule.length}\n`;
    markdown += `- **防护面罩点检**: ${inspections.length}\n\n`;

    if (schedule.length > 0) {
      markdown += `## 员工排班\n\n`;
      markdown += `| 员工姓名 | 工位 | 开始时间 | 结束时间 |\n`;
      markdown += `|----------|------|----------|----------|\n`;
      schedule.forEach(item => {
        const startTime = item.start_time ? new Date(item.start_time).toLocaleTimeString('zh-CN') : '未知';
        const endTime = item.end_time ? new Date(item.end_time).toLocaleTimeString('zh-CN') : '未知';
        markdown += `| ${item.employee_name} | ${item.station_id} | ${startTime} | ${endTime} |\n`;
      });
      markdown += `\n`;
    }

    if (inspections.length > 0) {
      markdown += `## 防护面罩点检\n\n`;
      markdown += `| 员工姓名 | 点检时间 | 面罩配备 | 滤片有效 | 结果 |\n`;
      markdown += `|----------|----------|----------|----------|------|\n`;
      inspections.forEach(item => {
        const time = item.inspection_time ? new Date(item.inspection_time).toLocaleString('zh-CN') : '未知';
        const helmet = item.is_helmet_provided ? '✅ 是' : '❌ 否';
        const filter = item.is_filter_valid ? '✅ 有效' : '❌ 失效';
        const result = item.inspection_result || '-';
        markdown += `| ${item.employee_name} | ${time} | ${helmet} | ${filter} | ${result} |\n`;
      });
      markdown += `\n`;
    }

    markdown += `---\n\n`;
    markdown += `*本交接单由焊接车间复盘工具自动生成*\n`;

    return markdown;
  }

  async exportJSON(date, shiftType) {
    const shiftResult = this.db.db.exec(
      'SELECT id, date, shift_type FROM shifts WHERE date = ? AND shift_type = ?',
      [date, shiftType]
    );

    if (shiftResult.length === 0 || shiftResult[0].values.length === 0) {
      return {
        metadata: {
          export_time: new Date().toISOString(),
          date: date,
          shift_type: shiftType,
          status: 'no_data'
        }
      };
    }

    const shiftId = shiftResult[0].values[0][0];
    
    const risks = this.db.getRisksForShift(shiftId);
    const weldingRecords = this.db.getWeldingRecordsForShift(shiftId);
    const exhaustData = this.db.getExhaustDataForShift(shiftId);
    const schedule = this.db.getEmployeeScheduleForShift(shiftId);
    const inspections = this.db.getHelmetInspectionsForShift(shiftId);

    const riskReviews = {};
    risks.forEach(risk => {
      const reviews = this.db.getRiskReviews(risk.id);
      if (reviews.length > 0) {
        riskReviews[risk.id] = reviews;
      }
    });

    const redRisks = risks.filter(r => r.risk_level === '红色');
    const yellowRisks = risks.filter(r => r.risk_level === '黄色');
    const greenRisks = risks.filter(r => r.risk_level === '绿色');

    return {
      metadata: {
        export_time: new Date().toISOString(),
        export_version: '1.0',
        date: date,
        shift_type: shiftType,
        shift_id: shiftId
      },
      risk_summary: {
        total: risks.length,
        red: redRisks.length,
        yellow: yellowRisks.length,
        green: greenRisks.length
      },
      risks: risks.map(risk => ({
        id: risk.id,
        risk_type: risk.risk_type,
        risk_level: risk.risk_level,
        station_id: risk.station_id,
        employee_name: risk.employee_name,
        start_time: risk.start_time,
        end_time: risk.end_time,
        duration_seconds: risk.duration_seconds,
        smoke_level: risk.smoke_level,
        exhaust_flow: risk.exhaust_flow,
        description: risk.description,
        latest_comment: risk.latest_comment,
        review_status: risk.review_status,
        reviews: riskReviews[risk.id] || []
      })),
      source_data: {
        welding_records: weldingRecords,
        exhaust_sensor_data: exhaustData,
        employee_schedule: schedule,
        helmet_inspections: inspections
      },
      audit_trail: {
        data_import_time: new Date().toISOString(),
        risk_detection_time: new Date().toISOString()
      }
    };
  }
}

module.exports = { Exporter };
