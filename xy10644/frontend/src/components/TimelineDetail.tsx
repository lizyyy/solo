import React, { useState, useEffect } from 'react';
import { Card, Select, Timeline, Tag, Typography, Descriptions, Space, Divider, Alert } from 'antd';
import { FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { boxApi, logApi } from '../services/api';
import moment from 'moment';

const { Title, Text } = Typography;
const { Option } = Select;

interface Box {
  id: string;
  boxCode: string;
  medicineName: string;
  minTemp: number;
  maxTemp: number;
  currentTemp: number;
  status: string;
  createdAt: string;
}

interface LogEntry {
  id: string;
  operationType: string;
  entityType: string;
  operateTime: string;
  operatorName: string;
  remarks?: string;
  afterValue?: any;
}

const TimelineDetail: React.FC = () => {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string>('');
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    loadBoxes();
  }, []);

  useEffect(() => {
    if (selectedBoxId) {
      loadBoxLogs();
      const box = boxes.find(b => b.id === selectedBoxId);
      setSelectedBox(box || null);
    }
  }, [selectedBoxId]);

  const loadBoxes = async () => {
    try {
      const res = await boxApi.getAll();
      setBoxes(res.data);
      if (res.data.length > 0) {
        setSelectedBoxId(res.data[0].id);
      }
    } catch (error) {
      console.error('加载温度箱失败', error);
    }
  };

  const loadBoxLogs = async () => {
    try {
      const res = await logApi.getByBox(selectedBoxId);
      setLogs(res.data);
    } catch (error) {
      console.error('加载日志失败', error);
    }
  };

  const getTimelineIcon = (operationType: string) => {
    switch (operationType) {
      case 'create':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'signoff':
        return <CheckCircleOutlined style={{ color: '#1890ff' }} />;
      case 'confirm':
        return <CheckCircleOutlined style={{ color: '#722ed1' }} />;
      case 'update':
        return <ClockCircleOutlined style={{ color: '#fa8c16' }} />;
      case 'assess':
        return <WarningOutlined style={{ color: '#eb2f96' }} />;
      default:
        return <ClockCircleOutlined />;
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      created: 'default',
      in_transit: 'blue',
      delivered: 'green',
      exchanged: 'orange'
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      created: '已创建',
      in_transit: '配送中',
      delivered: '已签收',
      exchanged: '已换箱'
    };
    return labels[status] || status;
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Title level={4}>
          <FileTextOutlined /> 时间线详情
        </Title>
        <Select
          style={{ width: 300, marginBottom: 16 }}
          value={selectedBoxId}
          onChange={setSelectedBoxId}
          placeholder="选择温度箱"
        >
          {boxes.map(box => (
            <Option key={box.id} value={box.id}>
              {box.boxCode} - {box.medicineName}
            </Option>
          ))}
        </Select>

        {selectedBox && (
          <>
            <Descriptions title="温度箱信息" bordered column={2}>
              <Descriptions.Item label="箱号">{selectedBox.boxCode}</Descriptions.Item>
              <Descriptions.Item label="药品名称">{selectedBox.medicineName}</Descriptions.Item>
              <Descriptions.Item label="温度范围">
                {selectedBox.minTemp}°C ~ {selectedBox.maxTemp}°C
              </Descriptions.Item>
              <Descriptions.Item label="当前温度">
                <Text type={selectedBox.currentTemp < selectedBox.minTemp || selectedBox.currentTemp > selectedBox.maxTemp ? 'danger' : 'success'}>
                  {selectedBox.currentTemp}°C
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStatusColor(selectedBox.status)}>
                  {getStatusLabel(selectedBox.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {moment(selectedBox.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Alert
              message="说明"
              description="时间线展示了该温度箱从创建到签收的完整流程，包括骑手交接、GPS温度上报、风险评估、延误换箱、签收等所有操作记录。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Title level={5}>事件时间线</Title>
            <Timeline mode="left">
              {logs.map((log, index) => (
                <Timeline.Item
                  key={log.id}
                  dot={getTimelineIcon(log.operationType)}
                  label={moment(log.operateTime).format('YYYY-MM-DD HH:mm:ss')}
                >
                  <Card size="small" style={{ marginBottom: 8 }}>
                    <Space direction="vertical" size="small">
                      <div>
                        <Text strong>{log.remarks || '操作记录'}</Text>
                        <Tag style={{ marginLeft: 8 }}>操作人: {log.operatorName}</Tag>
                      </div>
                      {log.afterValue && typeof log.afterValue === 'object' && (
                        <Descriptions column={2} size="small">
                          {Object.entries(log.afterValue).slice(0, 4).map(([key, value]) => (
                            <Descriptions.Item key={key} label={key}>
                              {String(value)}
                            </Descriptions.Item>
                          ))}
                        </Descriptions>
                      )}
                    </Space>
                  </Card>
                </Timeline.Item>
              ))}
              {logs.length === 0 && (
                <Timeline.Item>
                  <Text type="secondary">暂无操作记录</Text>
                </Timeline.Item>
              )}
            </Timeline>
          </>
        )}
      </Card>
    </Space>
  );
};

export default TimelineDetail;
