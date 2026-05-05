import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Select,
  Input,
  Space,
  Divider,
  List,
  Typography,
  Empty,
  Badge,
} from 'antd';
import { SaveOutlined, EditOutlined } from '@ant-design/icons';
import {
  RiskLevelLabels,
  ActionTypeLabels,
  RiskLevelColors,
  ActionTypeColors,
  RiskLevel,
  ActionType,
} from '../types';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { TextArea } = Input;

const ComponentTypeLabels = {
  deck: '桥面',
  pier: '桥墩',
  girder: '主梁',
  abutment: '桥台',
  bearing: '支座',
};

export default function ComponentDetail({
  component,
  onUpdateAction,
  onUpdateNote,
  userOverrides,
  userNotes,
}) {
  const [isEditingAction, setIsEditingAction] = useState(false);
  const [selectedAction, setSelectedAction] = useState(
    userOverrides?.[component?.id] || component?.analysis?.actionType
  );
  const [note, setNote] = useState(userNotes?.[component?.id] || '');

  useEffect(() => {
    if (component) {
      setSelectedAction(userOverrides?.[component.id] || component.analysis?.actionType);
      setNote(userNotes?.[component.id] || '');
    }
  }, [component, userOverrides, userNotes]);

  if (!component) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Empty description="请在 3D 视图中点击构件查看详情" />
      </div>
    );
  }

  const analysis = component.analysis || {};
  const riskLevel = analysis.riskLevel || RiskLevel.LOW;
  const actionType = userOverrides?.[component.id] || analysis.actionType || ActionType.NORMAL;

  const handleSaveAction = () => {
    onUpdateAction(component.id, selectedAction);
    setIsEditingAction(false);
  };

  const handleSaveNote = () => {
    onUpdateNote(component.id, note);
  };

  const formatDate = (dateStr) => {
    return dateStr ? dayjs(dateStr).format('YYYY-MM-DD HH:mm') : '-';
  };

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Title level={5} style={{ margin: 0 }}>
            {component.name}
          </Title>
          <Text type="secondary">
            {ComponentTypeLabels[component.type] || component.type}
          </Text>

          <Descriptions size="small" column={1}>
            <Descriptions.Item label="构件ID">
              <Text code>{component.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="风险等级">
              <Tag color={RiskLevelColors[riskLevel]}>
                {RiskLevelLabels[riskLevel]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="处置建议">
              <Space>
                {isEditingAction ? (
                  <>
                    <Select
                      value={selectedAction}
                      onChange={setSelectedAction}
                      style={{ width: 120 }}
                      options={Object.entries(ActionTypeLabels).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                    />
                    <Button type="primary" size="small" onClick={handleSaveAction}>
                      确定
                    </Button>
                    <Button size="small" onClick={() => setIsEditingAction(false)}>
                      取消
                    </Button>
                  </>
                ) : (
                  <>
                    <Tag color={ActionTypeColors[actionType]}>
                      {ActionTypeLabels[actionType]}
                    </Tag>
                    {userOverrides?.[component.id] && (
                      <Tag color="gold">人工改判</Tag>
                    )}
                    <Button
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => setIsEditingAction(true)}
                    >
                      改判
                    </Button>
                  </>
                )}
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Card>

      <Card size="small" title="风险原因分析" style={{ marginBottom: 12 }}>
        <List
          size="small"
          dataSource={analysis.riskReasons || ['构件状态正常']}
          renderItem={(item) => (
            <List.Item>
              <Badge
                status={riskLevel === RiskLevel.LOW ? 'success' : 'warning'}
                text={item}
              />
            </List.Item>
          )}
        />
      </Card>

      {analysis.inspections?.length > 0 && (
        <Card size="small" title="巡检记录" style={{ marginBottom: 12 }}>
          <List
            size="small"
            dataSource={analysis.inspections}
            renderItem={(inspection) => (
              <List.Item>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <Tag color={inspection.type === 'crack' ? 'orange' : 'brown'}>
                      {inspection.type === 'crack' ? '裂缝' : '锈蚀'}
                    </Tag>
                    <Text strong>
                      {formatDate(inspection.date || inspection.inspectionDate)}
                    </Text>
                  </Space>
                  {inspection.type === 'crack' ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      宽度: {inspection.width}mm | 长度: {inspection.length}cm |
                      深度: {inspection.depth}cm
                      {inspection.location && ` | 位置: ${inspection.location}`}
                    </Text>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      锈蚀等级: {inspection.level} | 锈蚀面积: {inspection.area}%
                      {inspection.location && ` | 位置: ${inspection.location}`}
                    </Text>
                  )}
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}

      {analysis.alarms?.length > 0 && (
        <Card size="small" title="传感器告警" style={{ marginBottom: 12 }}>
          <List
            size="small"
            dataSource={analysis.alarms}
            renderItem={(alarm) => (
              <List.Item>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <Tag
                      color={
                        alarm.level === 'critical'
                          ? 'red'
                          : alarm.level === 'alarm'
                          ? 'orange'
                          : 'gold'
                      }
                    >
                      {alarm.level === 'critical'
                        ? '严重告警'
                        : alarm.level === 'alarm'
                        ? '告警'
                        : '预警'}
                    </Tag>
                    <Text strong>{formatDate(alarm.time || alarm.alarmTime)}</Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    振幅: {alarm.amplitude}mm | 频率: {alarm.frequency}Hz
                    {alarm.sensorId && ` | 传感器: ${alarm.sensorId}`}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}

      <Card
        size="small"
        title={
          <Space>
            <span>备注</span>
            {userNotes?.[component.id] && <Tag color="blue">已保存</Tag>}
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="输入备注信息..."
            rows={4}
          />
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveNote} block>
            保存备注
          </Button>
        </Space>
      </Card>
    </div>
  );
}
