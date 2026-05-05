import React from 'react';
import { Upload, Button, Space, Typography, Card, Tag, message } from 'antd';
import {
  UploadOutlined,
  AppstoreOutlined,
  AlertOutlined,
  NotificationOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import Papa from 'papaparse';

const { Text } = Typography;

const ImportTypes = {
  COMPONENTS: 'components',
  INSPECTIONS: 'inspections',
  ALARMS: 'alarms',
  CLOSURES: 'closures',
};

const ImportTypeConfig = {
  [ImportTypes.COMPONENTS]: {
    label: '桥跨结构简表',
    icon: <AppstoreOutlined />,
    color: 'blue',
    description: '导入桥梁构件信息（桥面、桥墩、主梁等）',
    requiredFields: ['id', 'name', 'type'],
  },
  [ImportTypes.INSPECTIONS]: {
    label: '裂缝/锈蚀巡检记录',
    icon: <AlertOutlined />,
    color: 'orange',
    description: '导入裂缝宽度、长度、锈蚀等级等巡检数据',
    requiredFields: ['id', 'componentId', 'type'],
  },
  [ImportTypes.ALARMS]: {
    label: '传感器振动告警',
    icon: <NotificationOutlined />,
    color: 'red',
    description: '导入振动传感器的告警记录',
    requiredFields: ['id', 'componentId', 'level'],
  },
  [ImportTypes.CLOSURES]: {
    label: '临时封道窗口',
    icon: <ClockCircleOutlined />,
    color: 'purple',
    description: '导入临时封道时间窗口信息',
    requiredFields: ['id', 'componentId', 'startTime'],
  },
};

function ImportCard({ type, config, onImport, importedCount }) {
  const handleUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvData = Papa.parse(e.target.result, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
        });

        if (csvData.errors.length > 0) {
          message.error(`文件解析错误: ${csvData.errors[0].message}`);
          return false;
        }

        const missingFields = config.requiredFields.filter(
          (field) => !csvData.meta.fields.includes(field)
        );

        if (missingFields.length > 0) {
          message.error(`缺少必要字段: ${missingFields.join(', ')}`);
          return false;
        }

        onImport(type, csvData.data);
        message.success(`成功导入 ${csvData.data.length} 条 ${config.label} 数据`);
      } catch (error) {
        message.error(`导入失败: ${error.message}`);
      }
      return false;
    };
    reader.readAsText(file);
    return false;
  };

  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <span style={{ fontSize: 18 }}>{config.icon}</span>
          <Text strong>{config.label}</Text>
          {importedCount > 0 && <Tag color={config.color}>{importedCount} 条</Tag>}
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {config.description}
        </Text>
        <Upload
          beforeUpload={handleUpload}
          fileList={[]}
          accept=".csv,.txt"
        >
          <Button icon={<UploadOutlined />} size="small">
            导入 CSV 文件
          </Button>
        </Upload>
      </Space>
    </Card>
  );
}

export default function DataImport({ onDataChange, importStats }) {
  const handleImport = (type, data) => {
    onDataChange(type, data);
  };

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text strong style={{ fontSize: 14 }}>
          数据导入
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          依次导入以下四类数据，支持 CSV 格式
        </Text>
        {Object.entries(ImportTypeConfig).map(([type, config]) => (
          <ImportCard
            key={type}
            type={type}
            config={config}
            onImport={handleImport}
            importedCount={importStats[type] || 0}
          />
        ))}
      </Space>
    </div>
  );
}

export { ImportTypes };
