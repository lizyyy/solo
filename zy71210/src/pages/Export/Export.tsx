import React, { useMemo, useState } from 'react';
import {
  Card,
  Typography,
  Form,
  Checkbox,
  Select,
  Button,
  Space,
  Alert,
  DatePicker,
  Table,
  Tag,
} from 'antd';
import {
  FileTextOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDataStore } from '../../store/dataStore';
import { ExposureCalculator, formatQuantity } from '../../utils/calculator';
import { exportToFile, ExportOptions } from '../../utils/excel';
import { message } from 'antd';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const Export: React.FC = () => {
  const {
    lots,
    positions,
    basisRecords,
    rollovers,
    exposureConfig,
    auditLogs,
  } = useDataStore();
  const [form] = Form.useForm();
  const [exporting, setExporting] = useState(false);

  const result = useMemo(() => {
    const calculator = new ExposureCalculator(
      exposureConfig,
      basisRecords,
      rollovers
    );
    return calculator.calculate(lots, positions);
  }, [lots, positions, basisRecords, rollovers, exposureConfig]);

  const monthlyData = useMemo(() => {
    return Object.entries(result.byDeliveryMonth).map(([month, data]) => ({
      key: month,
      month,
      spot: data.spot,
      futures: data.futures,
      net: data.net,
    }));
  }, [result]);

  const columns = [
    {
      title: '交割月',
      dataIndex: 'month',
      key: 'month',
    },
    {
      title: '现货敞口(吨)',
      dataIndex: 'spot',
      key: 'spot',
      render: (v: number) => formatQuantity(v),
    },
    {
      title: '期货套保(吨)',
      dataIndex: 'futures',
      key: 'futures',
      render: (v: number) => formatQuantity(v),
    },
    {
      title: '净敞口(吨)',
      dataIndex: 'net',
      key: 'net',
      render: (v: number) => (
        <Text style={{ color: v > 0 ? '#d32f2f' : v < 0 ? '#388e3c' : 'inherit' }}>
          {formatQuantity(v)}
        </Text>
      ),
    },
  ];

  const handleExport = (values: any) => {
    setExporting(true);
    
    try {
      const includeMap: Record<string, boolean> = {};
      (values.include as string[]).forEach((key) => {
        includeMap[key] = true;
      });

      const options: ExportOptions = {
        format: values.format === 'pdf' ? 'xlsx' : values.format,
        include: includeMap,
      };

      if (values.format === 'pdf') {
        message.info('PDF格式暂不支持，已自动转换为Excel格式导出');
      }

      exportToFile(
        result,
        exposureConfig,
        lots,
        positions,
        basisRecords,
        rollovers,
        auditLogs,
        options
      );

      const formatName = values.format === 'xlsx' || values.format === 'pdf' ? 'Excel' : 'CSV';
      message.success(`报告已成功导出为${formatName}文件`);
    } catch (error) {
      message.error(`导出失败: ${(error as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <FileTextOutlined style={{ marginRight: 8 }} />
        报告导出
      </Title>

      <Alert
        message="统一计算口径说明"
        description="导出报告使用的计算口径与敞口重算页面完全一致，确保页面展示和导出数据的一致性。导出文件将包含您选择的所有内容。"
        type="success"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 24 }}>
        <Card title="导出配置">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              format: 'xlsx',
              dateRange: [dayjs().subtract(3, 'month'), dayjs()],
              include: ['summary', 'monthly', 'warnings'],
            }}
            onFinish={handleExport}
          >
            <Form.Item label="导出格式" name="format">
              <Select>
                <Select.Option value="xlsx">
                  <FileExcelOutlined /> Excel (.xlsx)
                </Select.Option>
                <Select.Option value="csv">
                  <FileTextOutlined /> CSV (.csv)
                </Select.Option>
                <Select.Option value="pdf">
                  <FilePdfOutlined /> PDF (.pdf)
                </Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="报告期间" name="dateRange">
              <RangePicker />
            </Form.Item>

            <Form.Item label="包含内容" name="include">
              <Checkbox.Group style={{ width: '100%' }}>
                <Space direction="vertical">
                  <Checkbox value="summary">敞口汇总表</Checkbox>
                  <Checkbox value="monthly">按月明细</Checkbox>
                  <Checkbox value="lots">现货批次明细</Checkbox>
                  <Checkbox value="positions">期货持仓明细</Checkbox>
                  <Checkbox value="warnings">风险预警记录</Checkbox>
                  <Checkbox value="audit">人工修改记录</Checkbox>
                  <Checkbox value="basis">基差记录</Checkbox>
                  <Checkbox value="rollovers">移仓记录</Checkbox>
                </Space>
              </Checkbox.Group>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                icon={<DownloadOutlined />}
                loading={exporting}
                block
              >
                导出报告
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <div>
          <Card title="报告预览" style={{ marginBottom: 16 }}>
            <Alert
              message="预览说明"
              description="以下为导出报告的核心内容预览，实际导出文件将包含完整的详细数据。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <div style={{ marginBottom: 16 }}>
              <Text strong>一、敞口汇总</Text>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 12,
                  marginTop: 12,
                }}
              >
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    现货总敞口
                  </Text>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#d32f2f' }}>
                    {formatQuantity(result.totalSpotExposure)} 吨
                  </div>
                </Card>
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    期货套保量
                  </Text>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#388e3c' }}>
                    {formatQuantity(result.totalFuturesHedge)} 吨
                  </div>
                </Card>
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    净敞口
                  </Text>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: result.netExposure > 0 ? '#f57c00' : '#388e3c',
                    }}
                  >
                    {formatQuantity(result.netExposure)} 吨
                  </div>
                </Card>
                <Card size="small">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    风险预警
                  </Text>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>
                    <Tag color={result.warnings.length > 0 ? 'error' : 'success'}>
                      {result.warnings.length} 项
                    </Tag>
                  </div>
                </Card>
              </div>
            </div>

            <div>
              <Text strong>二、按月明细</Text>
              <Table
                columns={columns}
                dataSource={monthlyData}
                pagination={false}
                size="small"
                style={{ marginTop: 12 }}
              />
            </div>

            {result.warnings.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text strong>三、风险预警</Text>
                <div style={{ marginTop: 12 }}>
                  {result.warnings.slice(0, 3).map((w) => (
                    <Alert
                      key={w.id}
                      message={w.title}
                      description={w.description}
                      type={w.severity === 'high' ? 'error' : w.severity === 'medium' ? 'warning' : 'info'}
                      showIcon
                      style={{ marginBottom: 8 }}
                    />
                  ))}
                </div>
              </div>
            )}

            {auditLogs.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text strong>四、人工修改记录 ({auditLogs.length}条)</Text>
                <p style={{ fontSize: 13, color: '#666', marginTop: 8 }}>
                  导出文件将包含完整的修改记录，包括旧值、新值、修改人和修改理由
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Export;
