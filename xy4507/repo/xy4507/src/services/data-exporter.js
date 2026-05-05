const fs = require('fs');
const path = require('path');
const moment = require('moment');

class DataExporter {
  constructor(db) {
    this.db = db;
  }

  exportMarkdown(orderId, outputPath) {
    const order = this.db.getOrderById(orderId);
    if (!order) {
      throw new Error(`订单不存在: ${orderId}`);
    }

    const risks = this.db.getOrderRisks(orderId);
    const notes = this.db.getNotes(orderId);

    const markdown = this.generateMarkdown(order, risks, notes);
    fs.writeFileSync(outputPath, markdown, 'utf-8');
    
    return outputPath;
  }

  generateMarkdown(order, risks, notes) {
    const riskTypeNames = {
      axis_error: '轴位抄错风险',
      lens_diameter: '镜片直径风险',
      eye_swap: '左右眼装反风险',
      pickup_time: '取镜时间风险'
    };

    const riskLevelNames = {
      high: '高风险',
      medium: '中风险',
      low: '低风险'
    };

    const riskStatusNames = {
      pending: '待处理',
      confirmed: '已确认',
      dismissed: '已驳回',
      resolved: '已解决'
    };

    let md = `# 眼镜订单交接单

## 订单基本信息

| 项目 | 内容 |
|------|------|
| **订单号** | ${order.order_number} |
| **患者姓名** | ${order.patient_name} |
| **联系电话** | ${order.phone || '未填写'} |
| **下单日期** | ${order.order_date} |
| **预计取镜** | ${order.pickup_date} |
| **订单状态** | ${order.status === 'pending' ? '处理中' : order.status} |

---

## 处方信息

`;

    if (order.prescriptions && order.prescriptions.length > 0) {
      md += `| 眼别 | 球镜(S) | 柱镜(C) | 轴位(A) | 下加光(ADD) | 瞳距(PD) | 瞳高(PH) |
|------|---------|---------|---------|-------------|----------|----------|
`;
      
      for (const presc of order.prescriptions) {
        const eyeName = presc.eye_type === 'left' ? '左眼' : '右眼';
        md += `| ${eyeName} | ${this.formatDiopter(presc.sphere)} | ${this.formatDiopter(presc.cylinder)} | ${this.formatAxis(presc.axis)} | ${this.formatDiopter(presc.add_power)} | ${this.formatNumber(presc.pd)}mm | ${this.formatNumber(presc.ph)}mm |
`;
      }
    } else {
      md += `*暂无处方信息*\n`;
    }

    md += `\n---\n\n## 镜架信息\n\n`;

    if (order.frames) {
      const f = order.frames;
      md += `| 项目 | 内容 |
|------|------|
| **品牌** | ${f.frame_brand || '未填写'} |
| **型号** | ${f.frame_model || '未填写'} |
| **镜框宽度** | ${this.formatNumber(f.frame_width)}mm |
| **鼻梁宽度** | ${this.formatNumber(f.bridge_width)}mm |
| **镜腿长度** | ${this.formatNumber(f.temple_length)}mm |
| **镜片宽度** | ${this.formatNumber(f.lens_width)}mm |

`;
    } else {
      md += `*暂无镜架信息*\n`;
    }

    md += `\n---\n\n## 镜片信息\n\n`;

    if (order.lenses && order.lenses.length > 0) {
      md += `| 眼别 | 品牌 | 类型 | 直径 | 基弧 | 中心厚度 |
|------|------|------|------|------|----------|
`;
      for (const lens of order.lenses) {
        const eyeName = lens.eye_type === 'left' ? '左眼' : '右眼';
        md += `| ${eyeName} | ${lens.lens_brand || '-'} | ${lens.lens_type || '-'} | ${this.formatNumber(lens.lens_diameter)}mm | ${this.formatNumber(lens.base_curve)} | ${this.formatNumber(lens.center_thickness)}mm |
`;
      }
    } else {
      md += `*暂无镜片信息*\n`;
    }

    md += `\n---\n\n## 磨边加工日志\n\n`;

    if (order.grinding_logs && order.grinding_logs.length > 0) {
      for (let i = 0; i < order.grinding_logs.length; i++) {
        const log = order.grinding_logs[i];
        md += `### 加工记录 ${i + 1}\n\n`;
        md += `| 项目 | 内容 |
|------|------|
| **加工日期** | ${log.grinding_date || '-'} |
| **磨边机** | ${log.grinding_machine || '-'} |
| **操作员** | ${log.operator || '-'} |
| **成品尺寸** | ${this.formatNumber(log.lens_size_w)} × ${this.formatNumber(log.lens_size_h)} mm |
| **磨边类型** | ${log.bevel_type || '-'} |
| **边缘厚度** | ${this.formatNumber(log.edge_thickness)}mm |
| **加工质量** | ${log.quality_check || '-'} |
| **备注** | ${log.remarks || '-'} |

`;
      }
    } else {
      md += `*暂无磨边加工记录*\n`;
    }

    md += `\n---\n\n## 质检记录\n\n`;

    if (order.quality_checks && order.quality_checks.length > 0) {
      for (let i = 0; i < order.quality_checks.length; i++) {
        const qc = order.quality_checks[i];
        md += `### 质检记录 ${i + 1}\n\n`;
        md += `| 项目 | 内容 |
|------|------|
| **质检日期** | ${qc.check_date || '-'} |
| **质检人** | ${qc.checker || '-'} |
| **左眼视力** | ${qc.visual_acuity_left || '-'} |
| **右眼视力** | ${qc.visual_acuity_right || '-'} |
| **棱镜检查** | ${qc.prism_check || '-'} |
| **轴位验证** | ${qc.axis_verification || '-'} |
| **表面质量** | ${qc.surface_quality || '-'} |
| **配戴检查** | ${qc.fitting_check || '-'} |
| **总体结果** | ${qc.overall_result || '-'} |
| **备注** | ${qc.remarks || '-'} |

`;
      }
    } else {
      md += `*暂无质检记录*\n`;
    }

    md += `\n---\n\n## 风险检测结果\n\n`;

    if (risks && risks.length > 0) {
      md += `共检测到 **${risks.length}** 个风险项\n\n`;
      md += `| 风险类型 | 风险等级 | 状态 | 描述 |
|----------|----------|------|------|
`;
      
      for (const risk of risks) {
        const typeName = riskTypeNames[risk.risk_type] || risk.risk_type;
        const levelName = riskLevelNames[risk.risk_level] || risk.risk_level;
        const statusName = riskStatusNames[risk.status] || risk.status;
        
        let levelMark = '';
        if (risk.risk_level === 'high') levelMark = '🔴';
        else if (risk.risk_level === 'medium') levelMark = '🟡';
        else levelMark = '🟢';
        
        md += `| ${typeName} | ${levelMark} ${levelName} | ${statusName} | ${risk.description} |
`;
        
        if (risk.evidence) {
          try {
            const evidence = JSON.parse(risk.evidence);
            if (evidence.hint) {
              md += `\n> 💡 提示: ${evidence.hint}\n\n`;
            }
          } catch (e) {}
        }
        
        if (risk.reviewer_remark) {
          md += `\n> 📝 复核备注: ${risk.reviewer_remark}\n\n`;
        }
      }
    } else {
      md += `✅ 未检测到风险\n`;
    }

    md += `\n---\n\n## 备注记录\n\n`;

    if (notes && notes.length > 0) {
      for (const note of notes) {
        const noteTime = moment(note.created_at).format('YYYY-MM-DD HH:mm');
        md += `### ${noteTime}\n\n`;
        md += `${note.content}\n\n`;
      }
    } else {
      md += `*暂无备注*\n`;
    }

    md += `\n---\n\n*此交接单由 Opticare Audit 系统于 ${moment().format('YYYY-MM-DD HH:mm:ss')} 生成*\n`;

    return md;
  }

  formatDiopter(value) {
    if (value === null || value === undefined) return '-';
    const num = Number(value);
    if (isNaN(num)) return '-';
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}D`;
  }

  formatAxis(value) {
    if (value === null || value === undefined) return '-';
    const num = Number(value);
    if (isNaN(num)) return '-';
    return `${num}°`;
  }

  formatNumber(value) {
    if (value === null || value === undefined) return '-';
    const num = Number(value);
    if (isNaN(num)) return '-';
    return num.toString();
  }

  exportJSON(outputPath) {
    const allData = this.db.getAllDataForExport();
    
    const exportData = {
      export_time: new Date().toISOString(),
      version: '1.0.0',
      total_orders: allData.length,
      orders: allData
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
    
    return outputPath;
  }
}

module.exports = DataExporter;
