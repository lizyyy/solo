import React, { useState } from 'react';
import {
  Card,
  Radio,
  Tag,
  Button,
  Modal,
  Input,
  Select,
  Space,
  Typography,
  Empty,
  message,
  Checkbox,
} from 'antd';
import {
  EditOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useApp } from '../store/AppContext';
import { RiskItem } from '../../shared/types';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { confirm } = Modal;

type FilterType = 'all' | 'high' | 'medium' | 'low';
type FilterStatus = 'all' | 'active' | 'resolved';

const RiskList: React.FC = () => {
  const { risks, updateRisk } = useApp();

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [editingRisk, setEditingRisk] = useState<RiskItem | null>(null);
  const [notes, setNotes] = useState('');
  const [userOverride, setUserOverride] = useState<
    'ignore' | 'pending' | 'resolved' | undefined
  >(undefined);

  const getRiskTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      missing_item: '缺件',
      wash_conflict: '清洗冲突',
      size_unconfirmed: '尺码未确认',
      photo_mismatch: '照片不匹配',
      alteration_delay: '改衣延迟',
    };
    return labels[type] || type;
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      missing_item: <StopOutlined />,
      wash_conflict: <ClockCircleOutlined />,
      size_unconfirmed: <ExclamationCircleOutlined />,
      photo_mismatch: <ExclamationCircleOutlined />,
      alteration_delay: <ClockCircleOutlined />,
    };
    return icons[type] || <WarningOutlined />;
  };

  const filteredRisks = risks.filter((risk) => {
    if (filterType !== 'all' && risk.severity !== filterType) {
      return false;
    }
    if (filterStatus === 'active' && risk.isResolved) {
      return false;
    }
    if (filterStatus === 'resolved' && !risk.isResolved) {
      return false;
    }
    return true;
  });

  const handleEdit = (risk: RiskItem) => {
    setEditingRisk(risk);
    setNotes(risk.userNotes || '');
    setUserOverride(risk.userOverride);
  };

  const handleSaveNotes = async () => {
    if (!editingRisk) return;

    try {
      await updateRisk(editingRisk.id, {
        userNotes: notes || undefined,
        userOverride: userOverride,
        isResolved: userOverride === 'resolved' ? true : editingRisk.isResolved,
      });
      setEditingRisk(null);
      message.success('保存成功');
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleMarkResolved = (risk: RiskItem) => {
    confirm({
      title: '标记为已解决？',
      content: '此风险将被标记为已解决状态。',
      onOk: async () => {
        try {
          await updateRisk(risk.id, {
            isResolved: true,
            resolvedAt: new Date().toISOString(),
          });
          message.success('已标记为解决');
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  const handleMarkUnresolved = (risk: RiskItem) => {
    confirm({
      title: '重新标记为未解决？',
      content: '此风险将被重新标记为未解决状态。',
      onOk: async () => {
        try {
          await updateRisk(risk.id, {
            isResolved: false,
            userOverride: undefined,
          });
          message.success('已标记为未解决');
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  const getSeverityClass = (risk: RiskItem) => {
    if (risk.isResolved) return 'risk-item-resolved';
    return `risk-item-${risk.severity}`;
  };

  return (
    <div>
      <Card
        className="panel-card"
        title={
          <Space>
            <ExclamationCircleOutlined />
            <span>风险预警列表</span>
            <Tag color="blue">{filteredRisks.length} 项</Tag>
          </Space>
        }
        extra={
          <Space>
            <Radio.Group
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              size="small"
            >
              <Radio.Button value="all">全部</Radio.Button>
              <Radio.Button value="active">未解决</Radio.Button>
              <Radio.Button value="resolved">已解决</Radio.Button>
            </Radio.Group>
            <Radio.Group
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              size="small"
            >
              <Radio.Button value="all">全部级别</Radio.Button>
              <Radio.Button value="high">高</Radio.Button>
              <Radio.Button value="medium">中</Radio.Button>
              <Radio.Button value="low">低</Radio.Button>
            </Radio.Group>
          </Space>
        }
      >
        {filteredRisks.length === 0 ? (
          <Empty description="暂无风险记录" style={{ padding: 48 }} />
        ) : (
          <div>
            {filteredRisks.map((risk) => (
              <div key={risk.id} className={`risk-item ${getSeverityClass(risk)}`}>
                <div className="risk-item-header">
                  <div className="risk-item-title">
                    <Space>
                      {getTypeIcon(risk.type)}
                      <span>{risk.title}</span>
                    </Space>
                  </div>
                  <Space>
                    <Tag className={`risk-item-severity risk-item-severity-${risk.severity}`}>
                      {risk.severity === 'high'
                        ? '高'
                        : risk.severity === 'medium'
                        ? '中'
                        : '低'}
                    </Tag>
                    <Tag>{getRiskTypeLabel(risk.type)}</Tag>
                    {risk.isResolved && <Tag color="success">已解决</Tag>}
                    {risk.userOverride === 'ignore' && <Tag color="default">已忽略</Tag>}
                  </Space>
                </div>

                <div className="risk-item-description">{risk.description}</div>

                <div className="risk-item-meta">
                  {risk.sceneNumber && (
                    <span>场次: {risk.sceneNumber}</span>
                  )}
                  {risk.character && <span>角色: {risk.character}</span>}
                  {risk.barcode && <span>条码: {risk.barcode}</span>}
                  {risk.affectedDate && <span>影响日期: {risk.affectedDate}</span>}
                </div>

                {risk.userNotes && (
                  <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.03)', borderRadius: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <strong>备注:</strong> {risk.userNotes}
                    </Text>
                  </div>
                )}

                <div className="risk-item-actions">
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(risk)}
                  >
                    添加备注/改判
                  </Button>
                  {!risk.isResolved ? (
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleMarkResolved(risk)}
                    >
                      标记已解决
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      icon={<StopOutlined />}
                      onClick={() => handleMarkUnresolved(risk)}
                    >
                      重新标记
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        title="编辑风险项"
        open={!!editingRisk}
        onOk={handleSaveNotes}
        onCancel={() => setEditingRisk(null)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        {editingRisk && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Title level={5}>风险信息</Title>
              <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
                <div>
                  <Text strong>{editingRisk.title}</Text>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">{editingRisk.description}</Text>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Title level={5}>添加备注</Title>
              <TextArea
                className="notes-textarea"
                placeholder="请输入备注信息..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div>
              <Title level={5}>改判状态</Title>
              <Select
                style={{ width: '100%' }}
                value={userOverride || undefined}
                onChange={setUserOverride}
                allowClear
                placeholder="选择改判状态（可选）"
              >
                <Option value="ignore">忽略此风险</Option>
                <Option value="pending">标记为待处理</Option>
                <Option value="resolved">标记为已解决</Option>
              </Select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RiskList;
