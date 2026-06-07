import React from 'react';
import type { SelfCheckResult } from '../types';
import { getSelfCheckClass, getSelfCheckText, getSelfCheckTypeName } from '../utils/format';

interface SelfCheckPanelProps {
  results: SelfCheckResult[];
}

const SelfCheckPanel: React.FC<SelfCheckPanelProps> = ({ results }) => {
  return (
    <div className="card">
      <h2>自检结果</h2>
      <div>
        {results.map((result, index) => (
          <div key={index} className="check-item">
            <div className={`check-icon ${getSelfCheckClass(result.status)}`}>
              {getSelfCheckText(result.status)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>
                {getSelfCheckTypeName(result.type)}
              </div>
              <div style={{ fontSize: 13, color: '#666' }}>
                {result.message}
              </div>
              {result.details && (
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  {Object.entries(result.details).map(([key, value]) => (
                    <span key={key} style={{ marginRight: 12 }}>
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SelfCheckPanel;
