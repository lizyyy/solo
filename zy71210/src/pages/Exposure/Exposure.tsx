import React, { useMemo, useState } from 'react';
import {
  Card,
  Form,
  Select,
  DatePicker,
  Switch,
  InputNumber,
  Button,
  Typography,
  Space,
  Table,
  Tag,
  Row,
  Col,
  Statistic,
  Alert,
} from 'antd';
import { CalculatorOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDataStore } from '../../store/dataStore';
import { ExposureCalculator, formatQuantity } from '../../utils/calculator';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const Exposure: React.FC = () => {
  const {
    lots,
    positions,
    basisRecords,
    rollovers,
    exposureConfig,
    setExposureConfig,
  } = useDataStore();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(false);

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

  const handleSave = (values: any) => {
    setExposureConfig({
      ...exposureConfig,
      ...values,
      dateRange: {
        start: values.dateRange[0].format('YYYY-MM-DD'),
        end: values.dateRange[1].format('YYYY-MM-DD'),
      },
    });
    setEditing(false);
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <CalculatorOutlined style={{ marginRight: 8 }} />
        敞口重算
      </Title>

      <Alert
        message="统一计算口径说明"
        description="此处的计算口径、筛选条件将同步应用于所有页面和报告导出，确保数据一致性。修改配置后，敞口结果会自动重新计算。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card
            title="计算配置"
            extra={
              <Button
                type="link"
                onClick={() => setEditing(!editing)}
              >
                {editing ? '取消' : '修改配置'}
              </Button>
            }
          >
            {editing ? (
              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  ...exposureConfig,
                  dateRange: [
                    dayjs(exposureConfig.dateRange.start),
                    dayjs(exposureConfig.dateRange.end),
                  ],
                }}
                onFinish={handleSave}
              >
                <Form.Item
                  label="计算方法"
                  name="calculationMethod"
                >
                  <Select>
                    <Select.Option value="gross">总额法</Select.Option>
                    <Select.Option value="net">净额法</Select.Option>
                    <Select.Option value="weighted">加权法</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="包含未匹配批次"
                  name="includeUnmatched"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item label="日期范围" name="dateRange">
                  <RangePicker />
                </Form.Item>

                <Form.Item label="套保比例" name="hedgingRatio">
                  <InputNumber
                    min={0}
                    max={2}
                    step={0.1}
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                <Form.Item label="交割月份" name="deliveryMonths">
                  <Select mode="multiple">
                    <Select.Option value="2024-05">2024-05</Select.Option>
                    <Select.Option value="2024-06">2024-06</Select.Option>
                    <Select.Option value="2024-07">2024-07</Select.Option>
                    <Select.Option value="2024-08">2024-08</Select.Option>
                    <Select.Option value="2024-09">2024-09</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">
                      保存配置
                    </Button>
                    <Button onClick={() => setEditing(false)}>取消</Button>
                  </Space>
                </Form.Item>
              </Form>
            ) : (
              <div>
                <p style={{ marginBottom: 12 }}>
                  <Text strong>计算方法：</Text>
                  {exposureConfig.calculationMethod === 'gross'
                    ? '总额法'
                    : exposureConfig.calculationMethod === 'net'
                    ? '净额法'
                    : '加权法'}
                </p>
                <p style={{ marginBottom: 12 }}>
                  <Text strong>包含未匹配批次：</Text>
                  <Tag color={exposureConfig.includeUnmatched ? 'green' : 'default'}>
                    {exposureConfig.includeUnmatched ? '是' : '否'}
                  </Tag>
                </p>
                <p style={{ marginBottom: 12 }}>
                  <Text strong>日期范围：</Text>
                  {exposureConfig.dateRange.start} 至 {exposureConfig.dateRange.end}
                </p>
                <p style={{ marginBottom: 12 }}>
                  <Text strong>套保比例：</Text>
                  {(exposureConfig.hedgingRatio * 100).toFixed(0)}%
                </p>
                <p style={{ marginBottom: 0 }}>
                  <Text strong>交割月份：</Text>
                  {exposureConfig.deliveryMonths.join('、')}
                </p>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  title="现货总敞口"
                  value={result.totalSpotExposure}
                  suffix="吨"
                  valueStyle={{ color: '#d32f2f' }}
                />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  title="期货套保量"
                  value={result.totalFuturesHedge}
                  suffix="吨"
                  valueStyle={{ color: '#388e3c' }}
                />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  title="净敞口"
                  value={result.netExposure}
                  suffix="吨"
                  valueStyle={{
                    color: result.netExposure > 0 ? '#f57c00' : '#388e3c',
                  }}
                />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  title="未匹配批次"
                  value={result.unmatchedLots.length}
                  suffix="个"
                  valueStyle={{ color: '#f57c00' }}
                />
              </Card>
            </Col>
          </Row>

          <Card
            title="按交割月明细"
            extra={
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={() => {
                  const calculator = new ExposureCalculator(
                    exposureConfig,
                    basisRecords,
                    rollovers
                  );
                  calculator.calculate(lots, positions);
                }}
              >
                重新计算
              </Button>
            }
          >
            <Table
              columns={columns}
              dataSource={monthlyData}
              pagination={false}
              summary={(pageData) => {
                const totalSpot = pageData.reduce((sum, d) => sum + d.spot, 0);
                const totalFutures = pageData.reduce((sum, d) => sum + d.futures, 0);
                const totalNet = pageData.reduce((sum, d) => sum + d.net, 0);
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <Text strong>合计</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <Text strong>{formatQuantity(totalSpot)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>
                      <Text strong>{formatQuantity(totalFutures)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>
                      <Text
                        strong
                        style={{
                          color: totalNet > 0 ? '#d32f2f' : totalNet < 0 ? '#388e3c' : 'inherit',
                        }}
                      >
                        {formatQuantity(totalNet)}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Exposure;
