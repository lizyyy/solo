import React, { useState } from 'react';
import {
  Card,
  Typography,
  Tabs,
  Upload,
  Button,
  Space,
  Table,
  Tag,
  Alert,
  message,
} from 'antd';
import {
  ImportOutlined,
  UploadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { useDataStore } from '../../store/dataStore';

const { Title, Text } = Typography;

const ImportCenter: React.FC = () => {
  const importResults = useDataStore((state) => state.importResults);
  const [activeTab, setActiveTab] = useState('contracts');

  const uploadProps: UploadProps = {
    name: 'file',
    accept: '.xlsx,.xls,.csv',
    onChange(info) {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 文件上传成功`);
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 文件上传失败`);
      }
    },
    beforeUpload: (file) => {
      const isExcel =
        file.type ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel' ||
        file.name.endsWith('.csv');
      if (!isExcel) {
        message.error('只能上传 Excel 文件!');
        return false;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过 10MB!');
        return false;
      }
      return true;
    },
  };

  const dataTabs = [
    {
      key: 'contracts',
      label: '采购合同',
      icon: <FileTextOutlined />,
      description: '导入采购合同数据，包括供应商、数量、价格、交货日期等',
      columns: [
        { title: '合同编号', dataIndex: 'contractNo', key: 'contractNo' },
        { title: '供应商', dataIndex: 'supplier', key: 'supplier' },
        { title: '铜品种', dataIndex: 'copperGrade', key: 'copperGrade' },
        { title: '数量(吨)', dataIndex: 'quantity', key: 'quantity' },
        { title: '单价(元/吨)', dataIndex: 'price', key: 'price' },
        { title: '交货日期', dataIndex: 'deliveryDate', key: 'deliveryDate' },
        { title: '状态', dataIndex: 'status', key: 'status' },
      ],
    },
    {
      key: 'lots',
      label: '库存批次',
      icon: <FileTextOutlined />,
      description: '导入库存批次数据，用于现货敞口计算',
      columns: [
        { title: '批次号', dataIndex: 'lotNo', key: 'lotNo' },
        { title: '关联合同', dataIndex: 'contractId', key: 'contractId' },
        { title: '数量(吨)', dataIndex: 'quantity', key: 'quantity' },
        { title: '仓库', dataIndex: 'warehouse', key: 'warehouse' },
        { title: '入库日期', dataIndex: 'receiptDate', key: 'receiptDate' },
        { title: '匹配状态', dataIndex: 'matchStatus', key: 'matchStatus' },
      ],
    },
    {
      key: 'positions',
      label: '期货持仓',
      icon: <FileTextOutlined />,
      description: '导入期货持仓数据，包括合约月份、方向、手数、价格等',
      columns: [
        { title: '合约月份', dataIndex: 'contractMonth', key: 'contractMonth' },
        { title: '方向', dataIndex: 'direction', key: 'direction' },
        { title: '数量(吨)', dataIndex: 'quantity', key: 'quantity' },
        { title: '开仓价', dataIndex: 'openPrice', key: 'openPrice' },
        { title: '交割月', dataIndex: 'deliveryMonth', key: 'deliveryMonth' },
        { title: '状态', dataIndex: 'status', key: 'status' },
      ],
    },
    {
      key: 'basis',
      label: '基差数据',
      icon: <FileTextOutlined />,
      description: '导入基差记录，用于基差风险计算',
      columns: [
        { title: '日期', dataIndex: 'basisDate', key: 'basisDate' },
        { title: '现货价', dataIndex: 'spotPrice', key: 'spotPrice' },
        { title: '期货价', dataIndex: 'futuresPrice', key: 'futuresPrice' },
        { title: '基差', dataIndex: 'basisValue', key: 'basisValue' },
        { title: '是否锁定', dataIndex: 'isLocked', key: 'isLocked' },
      ],
    },
  ];

  const resultColumns = [
    {
      title: '数据类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          contracts: '采购合同',
          lots: '库存批次',
          positions: '期货持仓',
          basis: '基差数据',
        };
        return typeMap[type] || type;
      },
    },
    {
      title: '成功条数',
      dataIndex: 'success',
      key: 'success',
      render: (v: number) => <Text type="success">{v}</Text>,
    },
    {
      title: '失败条数',
      dataIndex: 'failed',
      key: 'failed',
      render: (v: number) => (v > 0 ? <Text type="danger">{v}</Text> : v),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: any) =>
        record.failed > 0 ? (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">
            有错误
          </Tag>
        ) : (
          <Tag icon={<CheckCircleOutlined />} color="success">
            成功
          </Tag>
        ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <ImportOutlined style={{ marginRight: 8 }} />
        数据导入中心
      </Title>

      <Alert
        message="数据导入说明"
        description={
          <div>
            <p style={{ margin: 0 }}>
              • 请按照标准模板导入数据，确保字段名称与模板一致
            </p>
            <p style={{ margin: 0 }}>
              • 导入后系统会自动校验数据完整性，异常数据将高亮显示供人工核对
            </p>
            <p style={{ margin: 0 }}>
              • 人工核对区可直接编辑修正数据，所有修改都会留下审计记录
            </p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={dataTabs.map((tab) => ({
          key: tab.key,
          label: (
            <span>
              {tab.icon} {tab.label}
            </span>
          ),
          children: (
            <div>
              <Card style={{ marginBottom: 16 }}>
                <p style={{ marginBottom: 16, color: '#666' }}>
                  {tab.description}
                </p>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Upload.Dragger {...uploadProps} multiple>
                    <p className="ant-upload-drag-icon">
                      <UploadOutlined />
                    </p>
                    <p className="ant-upload-text">
                      点击或拖拽文件到此区域上传
                    </p>
                    <p className="ant-upload-hint">
                      支持 .xlsx, .xls, .csv 格式
                    </p>
                  </Upload.Dragger>
                </Space>
              </Card>

              <Card
                title="人工核对区"
                extra={
                  <Space>
                    <Button size="small">下载模板</Button>
                    <Button type="primary" size="small">
                      保存修改
                    </Button>
                  </Space>
                }
              >
                  <Table
                    columns={tab.columns}
                    dataSource={[]}
                    pagination={{ pageSize: 10 }}
                    size="small"
                    locale={{ emptyText: '暂无数据，请先导入文件' }}
                  />
              </Card>
            </div>
          ),
        }))}
      />

      <Card title="导入历史" style={{ marginTop: 24 }}>
        <Table
          columns={resultColumns}
          dataSource={importResults}
          pagination={{ pageSize: 10 }}
          size="small"
          locale={{ emptyText: '暂无导入记录' }}
        />
      </Card>
    </div>
  );
};

export default ImportCenter;
