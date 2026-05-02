import React from 'react';
import { X, Download, FileText, FileJson } from 'lucide-react';
import type { StageProject, ProjectAdjustment } from '@/types';
import { exportProjectToFile, exportAdjustmentsToFile } from '@/persistence';
import { exportRiskReportToMarkdown } from '@/export';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: StageProject;
  adjustments: ProjectAdjustment[];
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  project,
  adjustments,
}) => {
  if (!isOpen) return null;

  const handleExportProject = () => {
    exportProjectToFile(project);
  };

  const handleExportAdjustments = () => {
    exportAdjustmentsToFile(adjustments, project.name || 'project');
  };

  const handleExportReport = () => {
    exportRiskReportToMarkdown(project, adjustments);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#16213e',
          borderRadius: '16px',
          width: '480px',
          maxWidth: '90vw',
          border: '1px solid #2a3a5a',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #2a3a5a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Download size={20} color="#e94560" />
            <span style={{ fontWeight: '600', color: '#e94560', fontSize: '16px' }}>
              导出数据
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#8888aa',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          <button
            onClick={handleExportProject}
            style={{
              width: '100%',
              padding: '16px 20px',
              marginBottom: '12px',
              backgroundColor: '#1a1a2e',
              border: '1px solid #2a3a5a',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              textAlign: 'left' as const,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(233, 69, 96, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1a2e';
              e.currentTarget.style.borderColor = '#2a3a5a';
            }}
          >
            <div
              style={{
                padding: '10px',
                backgroundColor: 'rgba(233, 69, 96, 0.15)',
                borderRadius: '8px',
              }}
            >
              <FileJson size={24} color="#e94560" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#ddddee' }}>
                完整项目 (JSON)
              </div>
              <div style={{ fontSize: '12px', color: '#666688', marginTop: '2px' }}>
                导出舞台配置、灯具、吊杆、时间轴等所有数据
              </div>
            </div>
          </button>

          <button
            onClick={handleExportAdjustments}
            style={{
              width: '100%',
              padding: '16px 20px',
              marginBottom: '12px',
              backgroundColor: '#1a1a2e',
              border: '1px solid #2a3a5a',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              textAlign: 'left' as const,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(233, 69, 96, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1a2e';
              e.currentTarget.style.borderColor = '#2a3a5a';
            }}
          >
            <div
              style={{
                padding: '10px',
                backgroundColor: 'rgba(255, 170, 0, 0.15)',
                borderRadius: '8px',
              }}
            >
              <FileJson size={24} color="#ffaa00" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#ddddee' }}>
                调整记录 (JSON)
              </div>
              <div style={{ fontSize: '12px', color: '#666688', marginTop: '2px' }}>
                导出本次会话中所有灯具角度、吊杆高度等调整记录
              </div>
              {adjustments.length > 0 && (
                <div
                  style={{
                    fontSize: '11px',
                    color: '#ffaa00',
                    marginTop: '4px',
                    fontWeight: '600',
                  }}
                >
                  共 {adjustments.length} 项调整
                </div>
              )}
            </div>
          </button>

          <button
            onClick={handleExportReport}
            style={{
              width: '100%',
              padding: '16px 20px',
              backgroundColor: '#e94560',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              textAlign: 'left' as const,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#c73e54';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#e94560';
            }}
          >
            <div
              style={{
                padding: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
              }}
            >
              <FileText size={24} color="white" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>
                风险评估报告 (Markdown)
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px' }}>
                生成完整的风险分析报告，包含统计、详细风险列表和建议
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
