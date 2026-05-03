import React from 'react';

const CaseSidebar = ({ caseData, isActive, onClick }) => {
  const errorCount = caseData.errorCount || 0;
  const warningCount = caseData.warningCount || 0;
  const infoCount = caseData.infoCount || 0;

  return (
    <div 
      className={`case-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <h3>
        {caseData.patientName || caseData.patient || '未知动物'}
      </h3>
      <p>
        {caseData.id || caseData.caseId || ''} · 
        {caseData.species || caseData.animalType || '未知类型'} · 
        {caseData.procedure || caseData.surgeryType || '未知手术'}
      </p>
      <div className="case-issues">
        {errorCount > 0 && (
          <span className="issue-badge badge-error">
            🔴 {errorCount}
          </span>
        )}
        {warningCount > 0 && (
          <span className="issue-badge badge-warning">
            🟡 {warningCount}
          </span>
        )}
        {infoCount > 0 && (
          <span className="issue-badge badge-info">
            🔵 {infoCount}
          </span>
        )}
        {errorCount === 0 && warningCount === 0 && infoCount === 0 && (
          <span className="issue-badge badge-info">
            ✅ 无风险
          </span>
        )}
      </div>
    </div>
  );
};

export default CaseSidebar;
