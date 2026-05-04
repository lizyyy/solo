const authorizationModel = require('../models/authorizationModel');
const materialModel = require('../models/materialModel');
const riskModel = require('../models/riskModel');
const programModel = require('../models/programModel');

const riskDetector = {
  checkExpiredAuthorizations: () => {
    const expired = authorizationModel.checkExpired();
    const risks = [];
    
    expired.forEach(auth => {
      const existingRisk = riskModel.getAll().find(r => 
        r.authorization_id === auth.id && 
        r.risk_type === 'expired_music' && 
        r.status !== 'resolved'
      );
      
      if (!existingRisk) {
        const risk = riskModel.create({
          program_id: auth.program_id,
          material_id: auth.material_id,
          authorization_id: auth.id,
          risk_type: 'expired_music',
          description: `音乐授权已过期：${auth.holder_name} - 有效期至 ${auth.valid_until}`,
          severity: 'high'
        });
        risks.push(risk);
      }
    });
    
    return risks;
  },

  checkExpiringAuthorizations: () => {
    const expiring = authorizationModel.checkExpiring();
    const risks = [];
    
    expiring.forEach(auth => {
      const existingRisk = riskModel.getAll().find(r => 
        r.authorization_id === auth.id && 
        r.risk_type === 'expiring_soon' && 
        r.status !== 'resolved'
      );
      
      if (!existingRisk) {
        const risk = riskModel.create({
          program_id: auth.program_id,
          material_id: auth.material_id,
          authorization_id: auth.id,
          risk_type: 'expiring_soon',
          description: `音乐授权即将过期：${auth.holder_name} - 有效期至 ${auth.valid_until}`,
          severity: 'medium'
        });
        risks.push(risk);
      }
    });
    
    return risks;
  },

  checkUnauthorizedMaterials: () => {
    const materials = materialModel.getAll();
    const authorizations = authorizationModel.getAll();
    const risks = [];
    
    materials.forEach(material => {
      if (material.type === 'music' || material.type === 'clip') {
        const hasAuth = authorizations.some(auth => 
          auth.material_id === material.id || 
          (auth.material_id === null && auth.program_id === material.program_id)
        );
        
        if (!hasAuth) {
          const existingRisk = riskModel.getAll().find(r => 
            r.material_id === material.id && 
            r.risk_type === 'no_authorization' && 
            r.status !== 'resolved'
          );
          
          if (!existingRisk) {
            const risk = riskModel.create({
              program_id: material.program_id,
              material_id: material.id,
              risk_type: 'no_authorization',
              description: `素材缺少授权：${material.name} (${material.type})`,
              severity: 'high'
            });
            risks.push(risk);
          }
        }
      }
    });
    
    return risks;
  },

  checkAdDuration: () => {
    const materials = materialModel.getAll();
    const risks = [];
    
    materials.forEach(material => {
      if (material.type === 'ad' && material.duration) {
        const maxDuration = 30;
        if (material.duration > maxDuration) {
          const existingRisk = riskModel.getAll().find(r => 
            r.material_id === material.id && 
            r.risk_type === 'ad_too_long' && 
            r.status !== 'resolved'
          );
          
          if (!existingRisk) {
            const risk = riskModel.create({
              program_id: material.program_id,
              material_id: material.id,
              risk_type: 'ad_too_long',
              description: `广告时长超标：${material.name} - ${material.duration}秒 (最大允许${maxDuration}秒)`,
              severity: 'medium'
            });
            risks.push(risk);
          }
        }
      }
    });
    
    return risks;
  },

  checkDuplicateMaterials: () => {
    const duplicates = materialModel.findDuplicates();
    const risks = [];
    
    duplicates.forEach(material => {
      const existingRisk = riskModel.getAll().find(r => 
        r.material_id === material.id && 
        r.risk_type === 'duplicate_claim' && 
        r.status !== 'resolved'
      );
      
      if (!existingRisk) {
        const programs = material.program_ids.split(',').map(pid => {
          const p = programModel.getById(pid);
          return p ? p.name : pid;
        }).join(', ');
        
        const risk = riskModel.create({
          program_id: material.program_id,
          material_id: material.id,
          risk_type: 'duplicate_claim',
          description: `素材被${material.program_count}个节目重复声明：${material.name} - 涉及节目: ${programs}`,
          severity: 'high'
        });
        risks.push(risk);
      }
    });
    
    return risks;
  },

  runAllChecks: () => {
    const results = {
      expired: this.checkExpiredAuthorizations(),
      expiring: this.checkExpiringAuthorizations(),
      unauthorized: this.checkUnauthorizedMaterials(),
      adDuration: this.checkAdDuration(),
      duplicates: this.checkDuplicateMaterials()
    };
    
    return results;
  }
};

module.exports = riskDetector;
