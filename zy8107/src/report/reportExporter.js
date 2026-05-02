export class ReportExporter {
  constructor(dataLoader, dataValidator, riskEngine) {
    this.dataLoader = dataLoader;
    this.dataValidator = dataValidator;
    this.riskEngine = riskEngine;
  }

  exportToMarkdown() {
    const risks = this.riskEngine.risks;
    const validationIssues = this.dataValidator ? this.dataValidator.validateAll() : [];
    const siteLayout = this.dataLoader.siteLayout;
    const craneSpecs = this.dataLoader.craneSpecs;
    const liftPlan = this.dataLoader.liftPlan;
    
    const now = new Date();
    const timestamp = now.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    
    let md = '# 3D吊装路径碰撞预演风险报告\n\n';
    md += `**生成时间**: ${timestamp}\n\n`;
    md += '---\n\n';
    
    md += '## 1. 项目概览\n\n';
    
    if (siteLayout) {
      md += `### 1.1 场地信息\n\n`;
      md += `- **场地名称**: ${siteLayout.site_name || '未命名'}\n`;
      md += `- **障碍物数量**: ${siteLayout.obstacles?.length || 0}\n`;
      md += `- **支腿区数量**: ${siteLayout.outrigger_zones?.length || 0}\n`;
      md += `- **禁飞区数量**: ${siteLayout.no_fly_zones?.length || 0}\n\n`;
    }
    
    if (craneSpecs?.cranes) {
      md += `### 1.2 吊机配置\n\n`;
      md += '| 吊机ID | 名称 | 类型 | 最大起重能力 | 吊臂长度范围 |\n';
      md += '|--------|------|------|-------------|-------------|\n';
      craneSpecs.cranes.forEach(crane => {
        md += `| ${crane.crane_id} | ${crane.name} | ${crane.type === 'crawler' ? '履带吊' : '汽车吊'} | ${crane.max_capacity} ${crane.capacity_unit} | ${crane.boom?.min_length || '-'}m - ${crane.boom?.max_length || '-'}m |\n`;
      });
      md += '\n';
    }
    
    if (liftPlan) {
      md += `### 1.3 吊装计划\n\n`;
      md += `共 ${liftPlan.length} 个吊装任务\n\n`;
      md += '| 任务ID | 任务名称 | 设备名称 | 重量 | 吊机 | 开始时间 | 结束时间 |\n';
      md += '|--------|----------|----------|------|------|----------|----------|\n';
      liftPlan.forEach(lift => {
        const startTime = lift.start_time ? this.formatDateTime(lift.start_time) : '-';
        const endTime = lift.end_time ? this.formatDateTime(lift.end_time) : '-';
        md += `| ${lift.lift_id} | ${lift.lift_name} | ${lift.component_name} | ${lift.weight} ${lift.weight_unit} | ${lift.crane_id} | ${startTime} | ${endTime} |\n`;
      });
      md += '\n';
    }
    
    md += '---\n\n';
    
    if (validationIssues && validationIssues.length > 0) {
      md += '## 2. 数据验证问题\n\n';
      
      const crossDayIssues = validationIssues.filter(i => i.type === 'cross_day' || i.type === 'night_work');
      if (crossDayIssues.length > 0) {
        md += `### 2.1 施工时间问题 (${crossDayIssues.length}项)\n\n`;
        crossDayIssues.forEach(issue => {
          md += `#### ${issue.title}\n\n`;
          md += `- **类别**: ${issue.category}\n`;
          md += `- **严重程度**: ${this.getSeverityLabel(issue.severity)}\n`;
          md += `- **涉及任务**: ${issue.lift_name || issue.lift_id || 'N/A'}\n`;
          md += `- **详情**: ${issue.message}\n`;
          md += `- **建议**: ${issue.suggestion}\n\n`;
        });
      }
      
      const missingParamIssues = validationIssues.filter(i => i.type === 'missing_param');
      if (missingParamIssues.length > 0) {
        md += `### 2.2 缺失参数问题 (${missingParamIssues.length}项)\n\n`;
        missingParamIssues.forEach(issue => {
          md += `#### ${issue.title}\n\n`;
          md += `- **类别**: ${issue.category}\n`;
          md += `- **严重程度**: ${this.getSeverityLabel(issue.severity)}\n`;
          if (issue.lift_name) md += `- **涉及任务**: ${issue.lift_name}\n`;
          if (issue.crane_name) md += `- **涉及吊机**: ${issue.crane_name}\n`;
          md += `- **详情**: ${issue.message}\n`;
          md += `- **建议**: ${issue.suggestion}\n\n`;
        });
      }
      
      const otherIssues = validationIssues.filter(i => 
        i.type !== 'cross_day' && i.type !== 'night_work' && i.type !== 'missing_param'
      );
      if (otherIssues.length > 0) {
        md += `### 2.3 其他验证问题 (${otherIssues.length}项)\n\n`;
        otherIssues.forEach(issue => {
          md += `#### ${issue.title}\n\n`;
          md += `- **类别**: ${issue.category}\n`;
          md += `- **严重程度**: ${this.getSeverityLabel(issue.severity)}\n`;
          md += `- **详情**: ${issue.message}\n`;
          md += `- **建议**: ${issue.suggestion}\n\n`;
        });
      }
      
      md += '---\n\n';
    }
    
    md += '## 3. 风险评估\n\n';
    
    if (risks.length === 0) {
      md += '### ✅ 无风险\n\n';
      md += '经过综合评估，未检测到碰撞、超半径、超重等风险。\n\n';
    } else {
      const dangerRisks = risks.filter(r => r.severity === 'danger');
      const warningRisks = risks.filter(r => r.severity === 'warning');
      
      md += `### 3.1 风险概览\n\n`;
      md += `- **严重风险**: ${dangerRisks.length} 项\n`;
      md += `- **警告风险**: ${warningRisks.length} 项\n`;
      md += `- **总计**: ${risks.length} 项\n\n`;
      
      if (dangerRisks.length > 0) {
        md += `### 3.2 严重风险 (${dangerRisks.length}项) ⚠️\n\n`;
        dangerRisks.forEach((risk, index) => {
          md += `#### 风险 ${index + 1}: ${risk.title}\n\n`;
          md += `- **类型**: ${risk.type}\n`;
          md += `- **类别**: ${risk.category}\n`;
          if (risk.lift_name) md += `- **吊装任务**: ${risk.lift_name} (${risk.lift_id})\n`;
          if (risk.obstacle_name) md += `- **相关障碍物**: ${risk.obstacle_name} (${risk.obstacle_id})\n`;
          if (risk.zone_name) md += `- **相关区域**: ${risk.zone_name}\n`;
          md += `- **问题描述**: ${risk.message}\n\n`;
          
          if (risk.details) {
            md += `**详细信息**:\n\n`;
            md += '```\n';
            md += JSON.stringify(risk.details, null, 2);
            md += '\n```\n\n';
          }
          
          md += `**建议措施**: ${risk.suggestion}\n\n`;
          md += '---\n\n';
        });
      }
      
      if (warningRisks.length > 0) {
        md += `### 3.3 警告风险 (${warningRisks.length}项)\n\n`;
        warningRisks.forEach((risk, index) => {
          md += `#### 风险 ${index + 1}: ${risk.title}\n\n`;
          md += `- **类型**: ${risk.type}\n`;
          md += `- **类别**: ${risk.category}\n`;
          if (risk.lift_name) md += `- **吊装任务**: ${risk.lift_name} (${risk.lift_id})\n`;
          if (risk.obstacle_name) md += `- **相关障碍物**: ${risk.obstacle_name} (${risk.obstacle_id})\n`;
          if (risk.zone_name) md += `- **相关区域**: ${risk.zone_name}\n`;
          md += `- **问题描述**: ${risk.message}\n\n`;
          md += `**建议措施**: ${risk.suggestion}\n\n`;
          md += '---\n\n';
        });
      }
    }
    
    md += '## 4. 总结与建议\n\n';
    
    if (risks.length === 0 && (validationIssues.length === 0)) {
      md += '### ✅ 方案评估通过\n\n';
      md += '本吊装方案经过全面预演，未检测到碰撞、超半径、超重等风险。数据完整，可以按计划实施。\n\n';
    } else {
      md += '### ⚠️ 需要关注的问题\n\n';
      
      const dangerCount = risks.filter(r => r.severity === 'danger').length;
      if (dangerCount > 0) {
        md += `1. **${dangerCount} 项严重风险** - 必须立即处理，无法继续按原方案实施。建议：\n`;
        md += `   - 调整吊机站位位置\n`;
        md += `   - 修改吊装路径\n`;
        md += `   - 考虑使用更大吨位的吊机\n`;
        md += `   - 重新评估吊装方案\n\n`;
      }
      
      const warningCount = risks.filter(r => r.severity === 'warning').length;
      if (warningCount > 0) {
        md += `2. **${warningCount} 项警告风险** - 需要关注，建议采取预防措施：\n`;
        md += `   - 增加现场监护人员\n`;
        md += `   - 准备应急方案\n`;
        md += `   - 作业前再次确认现场条件\n\n`;
      }
      
      const crossDayCount = validationIssues?.filter(i => i.type === 'cross_day' || i.type === 'night_work').length || 0;
      if (crossDayCount > 0) {
        md += `3. **${crossDayCount} 项跨天/夜间作业** - 需要特殊安排：\n`;
        md += `   - 申请夜间施工许可\n`;
        md += `   - 增加照明设备\n`;
        md += `   - 安排轮班人员\n`;
        md += `   - 做好安全交底\n\n`;
      }
      
      const missingCount = validationIssues?.filter(i => i.type === 'missing_param').length || 0;
      if (missingCount > 0) {
        md += `4. **${missingCount} 项参数缺失** - 需要补充确认：\n`;
        md += `   - 复核相关数据\n`;
        md += `   - 现场测量确认\n`;
        md += `   - 更新数据文件后重新预演\n\n`;
      }
    }
    
    md += '---\n\n';
    md += '*本报告由3D吊装路径碰撞预演工具自动生成，仅供参考。实际作业前请由专业工程师复核确认。*\n';
    
    return md;
  }

  exportToJSON() {
    const risks = this.riskEngine.risks;
    const validationIssues = this.dataValidator ? this.dataValidator.validateAll() : [];
    
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        tool: 'Lift Path Simulator'
      },
      summary: {
        totalRisks: risks.length,
        dangerRisks: risks.filter(r => r.severity === 'danger').length,
        warningRisks: risks.filter(r => r.severity === 'warning').length,
        validationIssues: validationIssues.length
      },
      siteInfo: {
        site_name: this.dataLoader.siteLayout?.site_name,
        obstacles_count: this.dataLoader.siteLayout?.obstacles?.length || 0,
        outrigger_zones_count: this.dataLoader.siteLayout?.outrigger_zones?.length || 0,
        no_fly_zones_count: this.dataLoader.siteLayout?.no_fly_zones?.length || 0
      },
      cranes: this.dataLoader.craneSpecs?.cranes?.map(crane => ({
        crane_id: crane.crane_id,
        name: crane.name,
        type: crane.type,
        max_capacity: crane.max_capacity,
        capacity_unit: crane.capacity_unit
      })) || [],
      liftPlan: this.dataLoader.liftPlan?.map(lift => ({
        lift_id: lift.lift_id,
        lift_name: lift.lift_name,
        component_name: lift.component_name,
        component_id: lift.component_id,
        weight: lift.weight,
        weight_unit: lift.weight_unit,
        crane_id: lift.crane_id,
        boom_length: lift.boom_length,
        start_time: lift.start_time?.toISOString(),
        end_time: lift.end_time?.toISOString()
      })) || [],
      validationIssues: validationIssues.map(issue => ({
        ...issue,
        time_range: issue.time_range ? {
          start: issue.time_range.start?.toISOString(),
          end: issue.time_range.end?.toISOString()
        } : null
      })),
      risks: risks.map(risk => ({
        ...risk,
        time_range: risk.time_range ? {
          start: risk.time_range.start?.toISOString(),
          end: risk.time_range.end?.toISOString()
        } : null
      }))
    };
    
    return JSON.stringify(report, null, 2);
  }

  downloadMarkdown() {
    const content = this.exportToMarkdown();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lift_risk_report_${this.getDateString()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  downloadJSON() {
    const content = this.exportToJSON();
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lift_risk_report_${this.getDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}`;
  }

  formatDateTime(date) {
    if (!date) return '-';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  getSeverityLabel(severity) {
    const labels = {
      'danger': '严重 ⚠️',
      'warning': '警告',
      'info': '信息',
      'success': '通过'
    };
    return labels[severity] || severity;
  }
}
