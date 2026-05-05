import React, { useEffect } from 'react';
import { Card, List, Button, Empty, Typography, Space } from 'antd';
import {
  FolderOpenOutlined,
  PlusOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { Project } from '../../shared/types';
import { useApp } from '../store/AppContext';

const { Title, Text } = Typography;

interface ProjectSelectorProps {
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  onSelectProject,
  onCreateProject,
}) => {
  const { projects, loadProjects } = useApp();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="project-selector">
      <Card className="project-selector-card">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            🎬 服装连续性管理工具
          </Title>
          <Text type="secondary">
            管理剧组服装连续性，避免拍摄当天的意外状况
          </Text>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Title level={4} style={{ margin: 0 }}>
              项目列表
            </Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onCreateProject}
            >
              新建项目
            </Button>
          </Space>
        </div>

        {projects.length === 0 ? (
          <Empty
            description={
              <Text type="secondary">
                暂无项目，点击"新建项目"开始
              </Text>
            }
            style={{ padding: 48 }}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onCreateProject}
            >
              创建第一个项目
            </Button>
          </Empty>
        ) : (
          <List
            dataSource={projects}
            renderItem={(project) => (
              <div
                className="project-list-item"
                onClick={() => onSelectProject(project)}
              >
                <div className="project-list-item-name">
                  <Space>
                    <FolderOpenOutlined style={{ color: '#1890ff' }} />
                    <span>{project.name}</span>
                  </Space>
                </div>
                <div className="project-list-item-meta">
                  <Space>
                    <ClockCircleOutlined />
                    <span>更新于: {formatDate(project.updatedAt)}</span>
                    {project.lastScannedAt && (
                      <span>
                        上次检测: {formatDate(project.lastScannedAt)}
                      </span>
                    )}
                  </Space>
                </div>
              </div>
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default ProjectSelector;
