import React, { useState } from 'react';
import {
  Card,
  Tabs,
  List,
  Tag,
  Timeline,
  Avatar,
  Button,
  Space,
  Select,
  Row,
  Col,
  Divider,
  Tooltip,
  Modal,
} from 'antd';
import {
  Clock,
  User,
  Image,
  FileText,
  MessageSquare,
  ScanLine,
  GitCompare,
  Eye,
  ArrowLeftRight,
  Edit3,
  Plus,
  Trash2,
  Link2,
} from 'lucide-react';
import { useAppStore } from '../store';
import { tagColors, tagLabels } from '../data/mockData';
import { diff_match_patch } from 'diff-match-patch';

const { TabPane } = Tabs;
const { Option } = Select;

const dmp = new diff_match_patch();

export const VersionHistory: React.FC = () => {
  const { photos, operationLogs, scanReports } = useAppStore();
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [compareVersions, setCompareVersions] = useState<[number, number] | null>(null);
  const [isCompareModalVisible, setIsCompareModalVisible] = useState(false);

  const selectedPhoto = photos.find((p) => p.id === selectedPhotoId);

  const actionIcons: Record<string, React.ReactNode> = {
    '上传照片': <Plus size={14} />,
    '添加批改意见': <MessageSquare size={14} />,
    '更新批改意见': <Edit3 size={14} />,
    '生成扫描报告': <ScanLine size={14} />,
    '关联证据': <Link2 size={14} />,
    '删除': <Trash2 size={14} />,
  };

  const actionColors: Record<string, string> = {
    '上传照片': '#00B42A',
    '添加批改意见': '#165DFF',
    '更新批改意见': '#FF7D00',
    '生成扫描报告': '#722ED1',
    '关联证据': '#165DFF',
    '删除': '#F53F3F',
  };

  const renderDiff = (text1: string, text2: string) => {
    const diffs = dmp.diff_main(text1, text2);
    dmp.diff_cleanupSemantic(diffs);

    return diffs.map((diff, index) => {
      const [operation, text] = diff;
      let className = '';
      if (operation === 1) className = 'bg-green-100 text-green-800';
      if (operation === -1) className = 'bg-red-100 text-red-800 line-through';
      
      return (
        <span key={index} className={className}>
          {text}
        </span>
      );
    });
  };

  const handleCompare = (v1: number, v2: number) => {
    setCompareVersions([v1, v2]);
    setIsCompareModalVisible(true);
  };

  const getVersionContent = (version: number) => {
    return selectedPhoto?.corrections.find((c) => c.version === version)?.content || '';
  };

  return (
    <div className="space-y-6">
      <Tabs defaultActiveKey="logs">
        <TabPane
          tab={
            <span className="flex items-center">
              <Clock size={16} className="mr-2" />
              操作日志
            </span>
          }
          key="logs"
        >
          <Card>
            <Timeline
              mode="left"
              items={operationLogs.map((log) => ({
                color: actionColors[log.action] || '#165DFF',
                dot: actionIcons[log.action] || <Clock size={14} />,
                children: (
                  <div className="py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{log.action}</span>
                      <Tag className="text-xs" color="blue">
                        {log.entityType}
                      </Tag>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{log.details}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center">
                        <User size={12} className="mr-1" />
                        {log.operator}
                      </span>
                      <span className="flex items-center">
                        <Clock size={12} className="mr-1" />
                        {log.timestamp}
                      </span>
                    </div>
                  </div>
                ),
              }))}
            />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span className="flex items-center">
              <MessageSquare size={16} className="mr-2" />
              批改意见版本
            </span>
          }
          key="corrections"
        >
          <Row gutter={16}>
            <Col span={8}>
              <Card
                title="选择照片"
                className="sticky top-0"
                styles={{ body: { padding: 0 } }}
              >
                <List
                  dataSource={photos.filter((p) => p.corrections.length > 0)}
                  renderItem={(photo) => (
                    <List.Item
                      className={`cursor-pointer px-4 ${selectedPhotoId === photo.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      onClick={() => setSelectedPhotoId(photo.id)}
                    >
                      <List.Item.Meta
                        avatar={
                          <img
                            src={photo.url}
                            alt={photo.name}
                            className="w-12 h-12 rounded object-cover"
                          />
                        }
                        title={
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate max-w-[150px]">
                              {photo.name}
                            </span>
                            <Tag className="text-xs" color="blue">
                              v{photo.corrections.length}
                            </Tag>
                          </div>
                        }
                        description={
                          <div className="flex flex-wrap gap-1">
                            {photo.tags.slice(0, 2).map((tag) => (
                              <Tag
                                key={tag}
                                color={tagColors[tag]}
                                style={{ fontSize: '10px', padding: '0 4px' }}
                              >
                                {tagLabels[tag]}
                              </Tag>
                            ))}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>

            <Col span={16}>
              <Card
                title={
                  selectedPhoto ? (
                    <div className="flex items-center justify-between">
                      <span>{selectedPhoto.name} - 批改意见历史</span>
                      {selectedPhoto.corrections.length >= 2 && (
                        <Tooltip title="版本对比">
                          <Button
                            size="small"
                            icon={<GitCompare size={14} />}
                            onClick={() =>
                              handleCompare(
                                selectedPhoto.corrections.length - 1,
                                selectedPhoto.corrections.length
                              )
                            }
                          >
                            对比版本
                          </Button>
                        </Tooltip>
                      )}
                    </div>
                  ) : (
                    '请选择照片查看版本历史'
                  )
                }
              >
                {selectedPhoto ? (
                  <List
                    dataSource={[...selectedPhoto.corrections].reverse()}
                    renderItem={(correction) => (
                      <List.Item className="py-4 border-b last:border-b-0">
                        <List.Item.Meta
                          avatar={
                            <Avatar
                              size="large"
                              style={{
                                backgroundColor: correction.isLatest
                                  ? '#165DFF'
                                  : '#86909C',
                              }}
                            >
                              {correction.author[0]}
                            </Avatar>
                          }
                          title={
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {correction.author}
                              </span>
                              <Tag
                                color={correction.isLatest ? 'blue' : 'default'}
                              >
                                v{correction.version}
                                {correction.isLatest && ' (最新)'}
                              </Tag>
                            </div>
                          }
                          description={
                            <div>
                              <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-3 rounded">
                                {correction.content}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-400">
                                  {correction.timestamp}
                                </span>
                                {!correction.isLatest && (
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<Eye size={12} />}
                                    onClick={() =>
                                      handleCompare(
                                        correction.version,
                                        correction.version + 1
                                      )
                                    }
                                  >
                                    与下一版本对比
                                  </Button>
                                )}
                              </div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <FileText size={48} className="mx-auto mb-4 opacity-50" />
                    <p>请从左侧选择照片查看批改意见历史</p>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane
          tab={
            <span className="flex items-center">
              <ScanLine size={16} className="mr-2" />
              扫描报告版本
            </span>
          }
          key="reports"
        >
          <Row gutter={16}>
            {scanReports.map((report) => (
              <Col span={12} key={report.id}>
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <ScanLine size={16} className="text-blue-500" />
                      {report.name}
                    </div>
                  }
                  extra={
                    <Tag color="blue">v{report.version}</Tag>
                  }
                >
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">创建时间</span>
                      <span>{report.createdAt}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">创建者</span>
                      <span>{report.author}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">数据点数</span>
                      <span>{report.points.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">异常点</span>
                      <span className="text-red-500">
                        {report.points.filter((p) => p.status === 'anomaly').length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">已关联证据</span>
                      <span className="text-blue-500">
                        {report.points.filter((p) => p.linkedPhotoId).length}
                      </span>
                    </div>
                    {report.notes && (
                      <>
                        <Divider style={{ margin: '12px 0' }} />
                        <div>
                          <span className="text-sm text-gray-500 block mb-1">
                            备注
                          </span>
                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {report.notes}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </TabPane>
      </Tabs>

      <Modal
        title="版本对比"
        open={isCompareModalVisible}
        onCancel={() => setIsCompareModalVisible(false)}
        footer={
          <Button onClick={() => setIsCompareModalVisible(false)}>
            关闭
          </Button>
        }
        width={800}
      >
        {selectedPhoto && compareVersions && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <Tag color="default">v{compareVersions[0]}</Tag>
              <ArrowLeftRight size={16} className="text-gray-400" />
              <Tag color="blue">v{compareVersions[1]}</Tag>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm leading-relaxed">
              {renderDiff(
                getVersionContent(compareVersions[0]),
                getVersionContent(compareVersions[1])
              )}
            </div>
            <div className="flex justify-center gap-8 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-red-100 border border-red-300 rounded"></span>
                删除内容
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-green-100 border border-green-300 rounded"></span>
                新增内容
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
