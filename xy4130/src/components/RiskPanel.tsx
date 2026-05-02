import React from 'react';
import type { Risk } from '@/types';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

interface RiskPanelProps {
  risks: Risk[];
  isOpen: boolean;
  onToggle: () => void;
  onJumpToTime?: (time: number) => void;
}

const getRiskIcon = (level: Risk['level']) => {
  switch (level) {
    case 'critical':
      return <AlertCircle size={18} color="#ff4444" fill="#ff4444" />;
    case 'warning':
      return <AlertTriangle size={18} color="#ffaa00" fill="#ffaa00" />;
    case 'info':
      return <Info size={18} color="#4488ff" fill="#4488ff" />;
  }
};

const getRiskTypeLabel = (type: Risk['type']) => {
  switch (type) {
    case 'collision':
      return '碰撞风险';
    case 'occlusion':
      return '遮挡风险';
    case 'illumination':
      return '照度不足';
    case 'height':
      return '超高风险';
  }
};

const getRiskLevelColor = (level: Risk['level']) => {
  switch (level) {
    case 'critical':
      return 'rgba(255, 68, 68, 0.1)';
    case 'warning':
      return 'rgba(255, 170, 0, 0.1)';
    case 'info':
      return 'rgba(68, 136, 255, 0.1)';
  }
};

const getRiskLevelBorder = (level: Risk['level']) => {
  switch (level) {
    case 'critical':
      return '#ff4444';
    case 'warning':
      return '#ffaa00';
    case 'info':
      return '#4488ff';
  }
};

export const RiskPanel: React.FC<RiskPanelProps> = ({
  risks,
  isOpen,
  onToggle,
  onJumpToTime,
}) => {
  const criticalCount = risks.filter((r) => r.level === 'critical').length;
  const warningCount = risks.filter((r) => r.level === 'warning').length;
  const infoCount = risks.filter((r) => r.level === 'info').length;

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          right: '16px',
          top: '80px',
          backgroundColor: '#16213e',
          border: '1px solid #2a3a5a',
          color: '#e94560',
          padding: '12px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 100,
        }}
      >
        <AlertTriangle size={18} />
        <span>风险 ({risks.length})</span>
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: '16px',
        top: '80px',
        width: '360px',
        maxHeight: '60vh',
        backgroundColor: '#16213e',
        border: '1px solid #2a3a5a',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #2a3a5a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={20} color="#e94560" />
          <span style={{ fontWeight: '600', color: '#e94560', fontSize: '15px' }}>
            当前风险
          </span>
        </div>
        <button
          onClick={onToggle}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#8888aa',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '16px',
          padding: '12px 16px',
          borderBottom: '1px solid #2a3a5a',
          backgroundColor: '#1a1a2e',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#ff4444', fontWeight: '700', fontSize: '18px' }}>
            {criticalCount}
          </div>
          <div style={{ color: '#8888aa', fontSize: '11px' }}>严重</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#ffaa00', fontWeight: '700', fontSize: '18px' }}>
            {warningCount}
          </div>
          <div style={{ color: '#8888aa', fontSize: '11px' }}>警告</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#4488ff', fontWeight: '700', fontSize: '18px' }}>
            {infoCount}
          </div>
          <div style={{ color: '#8888aa', fontSize: '11px' }}>信息</div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '400px',
          padding: '8px',
        }}
      >
        {risks.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: '#44aa44',
              fontSize: '14px',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
            当前时刻未检测到风险
          </div>
        ) : (
          risks.map((risk, index) => (
            <div
              key={risk.id}
              onClick={() => onJumpToTime?.(risk.time)}
              style={{
                padding: '12px',
                marginBottom: '8px',
                borderRadius: '8px',
                backgroundColor: getRiskLevelColor(risk.level),
                borderLeft: `3px solid ${getRiskLevelBorder(risk.level)}`,
                cursor: onJumpToTime ? 'pointer' : 'default',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (onJumpToTime) {
                  e.currentTarget.style.backgroundColor = getRiskLevelColor(risk.level).replace('0.1', '0.2');
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = getRiskLevelColor(risk.level);
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '6px',
                }}
              >
                {getRiskIcon(risk.level)}
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#aaaacc',
                  }}
                >
                  {getRiskTypeLabel(risk.type)}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#ddddee',
                  lineHeight: '1.4',
                }}
              >
                {risk.description}
              </p>
              {risk.suggestedFix && (
                <p
                  style={{
                    margin: '6px 0 0 0',
                    fontSize: '12px',
                    color: '#88cc88',
                    fontStyle: 'italic',
                  }}
                >
                  💡 {risk.suggestedFix}
                </p>
              )}
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '11px',
                  color: '#666688',
                  fontFamily: '"SF Mono", Monaco, monospace',
                }}
              >
                涉及: {risk.involvedObjects.join(', ')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
