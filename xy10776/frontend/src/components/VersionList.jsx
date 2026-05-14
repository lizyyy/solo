import React, { useState } from 'react';
import { List, Card, Button, Tag, Typography, Modal, Descriptions, message } from 'antd';
import { HistoryOutlined, EyeOutlined, RollbackOutlined } from '@ant-design/icons';
import moment from 'moment';
import { annotationApi } from '../services/api';

const { Text, Paragraph } = Typography;

const VersionList = ({ versions, annotationId }) => {
  const [previewVersion, setPreviewVersion] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const handleReplay = async (versionNumber) => {
    try {
      const result = await annotationApi.replayVersion(annotationId, versionNumber, {
        replayed_by: 'current_user'
      });
      message.success(`版本 v${versionNumber} 回放成功`);
      setPreviewVersion(result.data);
      setPreviewVisible(true);
    } catch (err) {
      message.error(err.response?.data?.error || '回放失败');
    }
  };

  const renderSnapshot = (snapshot) => {
    if (!snapshot) return null;
    try {
      const data = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
      return (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="标题">{data.title}</Descriptions.Item>
          <Descriptions.Item label="描述">{data.description}</Descriptions.Item>
          <Descriptions.Item label="状态">{data.status}</Descriptions.Item>
          <Descriptions.Item label="版本号">v{data.version}</Descriptions.Item>
          <Descriptions.Item label="事件日期">{data.event_date}</Descriptions.Item>
          <Descriptions.Item label="创建人">{data.created_by}</Descriptions.Item>
        </Descriptions>
      );
    } catch (e) {
      return <Text type="secondary">快照数据解析失败</Text>;
    }
  };

  return (
    <>
      <Card 
        title={
          <span>
            <HistoryOutlined style={{ marginRight: 8 }} />
            版本历史
          </span>
        }
        extra={<Tag color="blue">{versions.length} 个版本</Tag>}
      >
        <List
          dataSource={versions}
          renderItem={(version) => (
            <List.Item
              actions={[
                <Button 
                  icon={<EyeOutlined />} 
                  size="small"
                  onClick={() => {
                    setPreviewVersion(version);
                    setPreviewVisible(true);
                  }}
                >
                  查看
                </Button>,
                <Button 
                  icon={<RollbackOutlined />} 
                  size="small"
                  type="primary"
                  ghost
                  onClick={() => handleReplay(version.version_number)}
                >
                  回放
                </Button>
              ]}
            >
              <List.Item.Meta
                title={
                  <span>
                    <Tag color="purple">v{version.version_number}</Tag>
                    <Text strong>{version.created_by}</Text>
                  </span>
                }
                description={moment(version.created_at).format('YYYY-MM-DD HH:mm:ss')}
              />
            </List.Item>
          )}
        />
        {versions.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Text type="secondary">暂无版本记录</Text>
          </div>
        )}
      </Card>

      <Modal
        title="版本详情"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button onClick={() => setPreviewVisible(false)}>关闭</Button>
        ]}
        width={600}
      >
        {previewVersion && (
          <>
            <Descriptions column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="版本号">
                <Tag color="purple">v{previewVersion.version_number || previewVersion.version}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                {previewVersion.created_by || previewVersion.replayed_by}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {moment(previewVersion.created_at || previewVersion.replayed_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {previewVersion.can_restore !== undefined && (
                <Descriptions.Item label="可恢复" span={2}>
                  <Tag color={previewVersion.can_restore ? 'green' : 'red'}>
                    {previewVersion.can_restore ? '是' : '否'}
                  </Tag>
                </Descriptions.Item>
              )}
            </Descriptions>
            <Card type="inner" title="快照数据" size="small">
              {renderSnapshot(previewVersion.snapshot_data || previewVersion.snapshot)}
            </Card>
          </>
        )}
      </Modal>
    </>
  );
};

export default VersionList;
