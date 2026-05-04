const programModel = require('../models/programModel');
const materialModel = require('../models/materialModel');
const authorizationModel = require('../models/authorizationModel');
const riskModel = require('../models/riskModel');
const reviewModel = require('../models/reviewModel');

const exporter = {
  exportAuthorizationList: (programId) => {
    let programs;
    if (programId) {
      const p = programModel.getById(programId);
      programs = p ? [p] : [];
    } else {
      programs = programModel.getAll();
    }
    
    let markdown = '# 播客授权清单\n\n';
    markdown += `生成时间: ${new Date().toISOString()}\n\n`;
    markdown += '---\n\n';
    
    programs.forEach(program => {
      markdown += `## ${program.name}${program.title ? ' - ' + program.title : ''}\n\n`;
      
      const materials = materialModel.getByProgramId(program.id);
      const authorizations = authorizationModel.getByProgramId(program.id);
      
      if (authorizations.length > 0) {
        markdown += '### 授权记录\n\n';
        markdown += '| 类型 | 授权方 | 权限类型 | 有效期 | 状态 |\n';
        markdown += '|------|--------|----------|--------|------|\n';
        
        authorizations.forEach(auth => {
          const material = materials.find(m => m.id === auth.material_id);
          const type = auth.type + (material ? ` (${material.name})` : '');
          const validFrom = auth.valid_from || '-';
          const validUntil = auth.valid_until || '永久';
          const statusEmoji = auth.status === 'active' ? '✅' : 
                              auth.status === 'expired' ? '❌' : 
                              auth.status === 'pending' ? '⏳' : '❓';
          
          markdown += `| ${type} | ${auth.holder_name} | ${auth.permission_type} | ${validFrom} - ${validUntil} | ${statusEmoji} ${auth.status} |\n`;
        });
        
        markdown += '\n';
      }
      
      if (materials.length > 0) {
        markdown += '### 素材清单\n\n';
        markdown += '| 类型 | 名称 | 来源 | 时长 |\n';
        markdown += '|------|------|------|------|\n';
        
        materials.forEach(material => {
          const duration = material.duration ? `${material.duration}秒` : '-';
          markdown += `| ${material.type} | ${material.name} | ${material.source || '-'} | ${duration} |\n`;
        });
        
        markdown += '\n';
      }
      
      markdown += '---\n\n';
    });
    
    return markdown;
  },

  exportRiskTable: () => {
    const risks = riskModel.getAll();
    const programs = programModel.getAll();
    
    let csv = 'risk_id,program_name,risk_type,description,severity,status,detected_at\n';
    
    risks.forEach(risk => {
      const program = programs.find(p => p.id === risk.program_id);
      const programName = program ? program.name : 'Unknown';
      
      csv += `"${risk.id}","${programName}","${risk.risk_type}","${risk.description.replace(/"/g, '""')}","${risk.severity}","${risk.status}","${risk.detected_at}"\n`;
    });
    
    return csv;
  },

  exportAuditPackage: () => {
    const programs = programModel.getAll();
    const materials = materialModel.getAll();
    const authorizations = authorizationModel.getAll();
    const risks = riskModel.getAll();
    const reviews = reviewModel.getAll();
    
    const programsWithDetails = programs.map(p => {
      return {
        ...p,
        materials: materials.filter(m => m.program_id === p.id),
        authorizations: authorizations.filter(a => a.program_id === p.id),
        risks: risks.filter(r => r.program_id === p.id).map(r => ({
          ...r,
          reviews: reviews.filter(rv => rv.risk_id === r.id)
        }))
      };
    });
    
    const auditPackage = {
      generated_at: new Date().toISOString(),
      version: '1.0',
      summary: {
        program_count: programs.length,
        material_count: materials.length,
        authorization_count: authorizations.length,
        risk_summary: riskModel.getStats()
      },
      programs: programsWithDetails,
      raw_data: {
        programs,
        materials,
        authorizations,
        risks,
        reviews
      }
    };
    
    return JSON.stringify(auditPackage, null, 2);
  }
};

module.exports = exporter;
