import React from 'react';
import { Project } from '../types';
import { formatRelativeDate } from '../utils/format';

interface ProjectListProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ 
  projects, 
  selectedProject, 
  onSelectProject 
}) => {
  const getStatusBadge = (status: Project['status']) => {
    const statusMap: Record<string, { label: string; class: string }> = {
      pending: { label: '待处理', class: 'status-pending' },
      scanning: { label: '扫描中', class: 'status-scanning' },
      analyzing: { label: '分析中', class: 'status-analyzing' },
      processing: { label: '处理中', class: 'status-scanning' },
      exporting: { label: '导出中', class: 'status-scanning' },
      completed: { label: '已完成', class: 'status-completed' },
    };
    return statusMap[status] || { label: status, class: 'status-pending' };
  };

  return (
    <div className="project-list">
      {projects.map(project => {
        const statusInfo = getStatusBadge(project.status);
        const isSelected = selectedProject?.id === project.id;
        
        return (
          <div
            key={project.id}
            className={`project-item ${isSelected ? 'active' : ''}`}
            onClick={() => onSelectProject(project)}
          >
            <div className="project-name">{project.name}</div>
            <div className="project-path">{project.folderPath}</div>
            <div className="project-meta">
              <span className={`project-status ${statusInfo.class}`}>
                {statusInfo.label}
              </span>
              <span style={{ fontSize: '11px', color: '#999' }}>
                {formatRelativeDate(project.updatedAt)}
              </span>
            </div>
          </div>
        );
      })}
      
      {projects.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <div className="empty-title">暂无项目</div>
          <div className="empty-desc">拖入文件夹开始创建项目</div>
        </div>
      )}
    </div>
  );
};

export default ProjectList;
