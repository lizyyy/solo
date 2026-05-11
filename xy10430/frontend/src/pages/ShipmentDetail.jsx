import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Descriptions, 
  Table, 
  Tag, 
  Timeline, 
  Row, 
  Col, 
  Statistic,
  Button,
  Space,
  Alert,
  Tabs,
  Upload,
  message,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber
} from 'antd';
import { 
  ArrowLeftOutlined, 
  FileAddOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  UploadOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import moment from 'moment';
import { 
  shipmentApi, 
  temperatureApi, 
  nodeApi, 
  signoffApi,
  cargoTypeApi 
} from '../services/api';

const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

function ShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [cargoTypes, setCargoTypes] = useState([]);
  const [signoffModalVisible, setSignoffModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
    loadCargoTypes();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analysisRes, nodesRes] = await Promise.all([
        shipmentApi.getAnalysis(id),
        nodeApi.list(id)
      ]);

      if (analysisRes.success) {
        setAnalysisData(analysisRes.data);
      }
      if (nodesRes.success) {
        setNodes(nodesRes.data);
      }
    } catch (error) {
      console.error('加载运单详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCargoTypes = async () => {
    try {
      const res = await cargoTypeApi.list();
      if (res.success) {
        setCargoTypes(res.data);
      }
    } catch (error) {
      console.error('加载货物类型失败:', error);
    }
  };

  const getTemperatureChartOption = () => {
    if (!analysisData) return {};
    
    const { temperatureRecords, shipment, analysis } = analysisData;
    const cargoType = shipment?.cargoType;
    
    const times = temperatureRecords?.map(r => 
      moment(r.recordTime).format('MM-DD HH:mm')
    ) || [];
    const temps = temperatureRecords?.map(r => parseFloat(r.temperature)) || [];

    return {
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: ['温度', '上限', '下限']
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: times
      },
      yAxis: {
        type: 'value',
        name: '温度(℃)'
      },
      series: [
        {
          name: '温度',
          type: 'line',
          data: temps,
          smooth: true,
          itemStyle: {
            color: analysis?.isSerious ? '#ff4d4f' : '#1890ff'
          },
          areaStyle: {
            color: analysis?.isSerious ? 'rgba(255, 77, 79, 0.2)' : 'rgba(24, 144, 255, 0.2)'
          }
        },
        {
          name: '上限',
          type: 'line',
          data: times.map(() => parseFloat(cargoType?.maxTemp || 8)),
          lineStyle: {
            type: 'dashed',
            color: '#faad14'
          },
          symbol: 'none'
        },
        {
          name: '下限',
          type: 'line',
          data: times.map(() => parseFloat(cargoType?.minTemp || 2)),
          lineStyle: {
            type: 'dashed',
            color: '#faad14'
          },
          symbol: 'none'
        }
      ]
    };
  };

  const handleUpload = async (file) => {
    try {
      const res = await temperatureApi.import(id, file);
      if (res.success) {
        message.success(res.message);
        loadData();
      }
    } catch (error) {
      message.error('导入失败');
    }
    return false;
  };

  const handleSignoff = async (values) => {
    try {
      const data = {
        ...values,
        shipmentId: id,
        signOffTime: values.signOffTime?.toDate() || new Date()
      };
      const res = await signoffApi.create(data);
      if (res.success) {
        message.success('签收记录已保存');
        setSignoffModalVisible(false);
        loadData();
      }
    } catch (error) {
      message.error('保存签收记录失败');
    }
  };

  const { shipment, analysis, signOff, temperatureRecords } = analysisData || {};

  const temperatureColumns = [
    {
      title: '记录时间',
      dataIndex: 'recordTime',
      key: 'recordTime',
      render: (val) => moment(val).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '温度(℃)',
      dataIndex: 'temperature',
      key: 'temperature',
      render: (val) => (
        <span style={{ color: val > 8 || val < 2 ? '#ff4d4f' : '#52c41a' }}>
          {val}℃
        </span>
      )
    },
    {
      title: '湿度(%)',
      dataIndex: 'humidity',
      key: 'humidity'
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location'
    },
    {
      title: '状态',
      dataIndex: 'isOvertemp',
      key: 'isOvertemp',
      render: (val) => val ? 
        <Tag color="red">超温</Tag> : 
        <Tag color="green">正常</Tag>
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/shipments')}
        >
          返回列表
        </Button>
        <Button 
          type="primary" 
          icon={<FileAddOutlined />}
          onClick={() => navigate(`/claims/new?shipmentId=${id}`)}
        >
          发起索赔
        </Button>
      </Space>

      {shipment && (
        <Row gutter={16}>
          <Col span={24}>
            <Card title="运单基本信息" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={3}>
                <Descriptions.Item label="运单号">{shipment.shipmentNo}</Descriptions.Item>
                <Descriptions.Item label="客户名称">{shipment.customerName}</Descriptions.Item>
                <Descriptions.Item label="货物类型">
                  {shipment.cargoType?.name}
                  <Tag color="blue">
                    {shipment.cargoType?.minTemp}℃ ~ {shipment.cargoType?.maxTemp}℃
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="起始地">{shipment.origin}</Descriptions.Item>
                <Descriptions.Item label="目的地">{shipment.destination}</Descriptions.Item>
                <Descriptions.Item label="货值">¥{shipment.cargoValue?.toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="发运时间">
                  {moment(shipment.departureTime).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label="预计到达">
                  {shipment.estimatedArrivalTime ? 
                    moment(shipment.estimatedArrivalTime).format('YYYY-MM-DD HH:mm') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="实际到达">
                  {shipment.actualArrivalTime ? 
                    moment(shipment.actualArrivalTime).format('YYYY-MM-DD HH:mm') : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          {analysis && (
            <Col span={6}>
              <Card>
                <Statistic
                  title="超温次数"
                  value={analysis.overtempIntervals?.length || 0}
                  prefix={<ThunderboltOutlined />}
                  valueStyle={{ color: analysis.overtempIntervals?.length > 0 ? '#ff4d4f' : '#52c41a' }}
                />
              </Card>
            </Col>
          )}
          {analysis && (
            <Col span={6}>
              <Card>
                <Statistic
                  title="累计超温时长"
                  value={analysis.totalOvertempMinutes || 0}
                  suffix="分钟"
                  valueStyle={{ color: analysis.isSerious ? '#ff4d4f' : '#faad14' }}
                />
              </Card>
            </Col>
          )}
          {analysis && (
            <Col span={6}>
              <Card>
                <Statistic
                  title="最大温度偏差"
                  value={analysis.maxTempDeviation?.toFixed(1) || 0}
                  suffix="℃"
                  valueStyle={{ color: analysis.maxTempDeviation > 5 ? '#ff4d4f' : '#faad14' }}
                />
              </Card>
            </Col>
          )}
          {analysis && (
            <Col span={6}>
              <Card>
                <Statistic
                  title="风险等级"
                  value={analysis.isSerious ? '严重' : analysis.overtempIntervals?.length > 0 ? '警告' : '正常'}
                  prefix={analysis.isSerious ? 
                    <WarningOutlined style={{ color: '#ff4d4f' }} /> : 
                    analysis.overtempIntervals?.length > 0 ? 
                      <WarningOutlined style={{ color: '#faad14' }} /> :
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  }
                  valueStyle={{ 
                    color: analysis.isSerious ? '#ff4d4f' : 
                           analysis.overtempIntervals?.length > 0 ? '#faad14' : '#52c41a' 
                  }}
                />
              </Card>
            </Col>
          )}

          <Col span={24} style={{ marginTop: 16 }}>
            <Card 
              title="温度分析"
              extra={
                <Upload
                  beforeUpload={handleUpload}
                  showUploadList={false}
                  accept=".xlsx,.xls"
                >
                  <Button icon={<UploadOutlined />}>导入温度数据</Button>
                </Upload>
              }
            >
              {analysis?.overtempSummary && (
                <Alert
                  message="温度分析结果"
                  description={analysis.overtempSummary}
                  type={analysis.isSerious ? 'error' : analysis.overtempIntervals?.length > 0 ? 'warning' : 'success'}
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}
              <ReactECharts option={getTemperatureChartOption()} style={{ height: 300 }} />
            </Card>
          </Col>

          <Col span={24}>
            <Tabs defaultActiveKey="1" style={{ marginTop: 16 }}>
              <TabPane tab="运输节点" key="1">
                <Card>
                  {nodes.length > 0 ? (
                    <Timeline mode="alternate">
                      {nodes.map((node, index) => (
                        <Timeline.Item 
                          key={node.id}
                          color={index === 0 ? 'green' : index === nodes.length - 1 ? 'red' : 'blue'}
                        >
                          <Card size="small" style={{ width: '80%', margin: '0 auto' }}>
                            <p><strong>{node.nodeName}</strong> ({node.nodeType === 'warehouse' ? '仓库' : node.nodeType === 'transit' ? '运输' : '配送'})</p>
                            <p>位置：{node.location}</p>
                            <p>责任方：{node.responsibleParty}</p>
                            <p>到达：{moment(node.arrivalTime).format('YYYY-MM-DD HH:mm')}</p>
                            {node.departureTime && (
                              <p>离开：{moment(node.departureTime).format('YYYY-MM-DD HH:mm')}</p>
                            )}
                          </Card>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  ) : (
                    <p style={{ textAlign: 'center', color: '#999' }}>暂无运输节点数据</p>
                  )}
                </Card>
              </TabPane>
              
              <TabPane tab="温度记录" key="2">
                <Card>
                  <Table
                    columns={temperatureColumns}
                    dataSource={temperatureRecords}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                </Card>
              </TabPane>

              <TabPane tab="签收记录" key="3">
                <Card 
                  extra={
                    !signOff && (
                      <Button 
                        type="primary" 
                        onClick={() => setSignoffModalVisible(true)}
                      >
                        录入签收
                      </Button>
                    )
                  }
                >
                  {signOff ? (
                    <Descriptions bordered column={2}>
                      <Descriptions.Item label="签收时间">
                        {moment(signOff.signOffTime).format('YYYY-MM-DD HH:mm')}
                      </Descriptions.Item>
                      <Descriptions.Item label="签收结果">
                        {signOff.signOffResult === 'normal' ? <Tag color="green">正常</Tag> :
                         signOff.signOffResult === 'overtemp_warning' ? <Tag color="orange">超温警告</Tag> :
                         signOff.signOffResult === 'overtemp_serious' ? <Tag color="red">严重超温</Tag> :
                         <Tag color="red">货损</Tag>}
                      </Descriptions.Item>
                      <Descriptions.Item label="签收人">{signOff.receiverName}</Descriptions.Item>
                      <Descriptions.Item label="联系电话">{signOff.receiverPhone}</Descriptions.Item>
                      <Descriptions.Item label="包装状态">
                        {signOff.packageCondition === 'good' ? '完好' :
                         signOff.packageCondition === 'partial_damaged' ? '部分损坏' : '损坏'}
                      </Descriptions.Item>
                      <Descriptions.Item label="签收时温度">
                        {signOff.temperatureAtSignoff}℃
                      </Descriptions.Item>
                      <Descriptions.Item label="是否免责">
                        {signOff.isExempt ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>}
                        {signOff.isExempt && ` (原因：${signOff.exemptReason})`}
                      </Descriptions.Item>
                      <Descriptions.Item label="签收备注" span={2}>
                        {signOff.signOffRemarks}
                      </Descriptions.Item>
                    </Descriptions>
                  ) : (
                    <p style={{ textAlign: 'center', color: '#999' }}>暂无签收记录</p>
                  )}
                </Card>
              </TabPane>
            </Tabs>
          </Col>
        </Row>
      )}

      <Modal
        title="录入签收"
        open={signoffModalVisible}
        onCancel={() => setSignoffModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSignoff}
        >
          <Form.Item
            name="signOffTime"
            label="签收时间"
            initialValue={moment()}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="signOffResult"
            label="签收结果"
            rules={[{ required: true, message: '请选择签收结果' }]}
          >
            <Select>
              <Option value="normal">正常签收</Option>
              <Option value="overtemp_warning">超温警告</Option>
              <Option value="overtemp_serious">严重超温</Option>
              <Option value="damaged">货物损坏</Option>
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="receiverName"
                label="签收人"
                rules={[{ required: true, message: '请输入签收人' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="receiverPhone"
                label="联系电话"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="packageCondition"
                label="包装状态"
                initialValue="good"
              >
                <Select>
                  <Option value="good">完好</Option>
                  <Option value="partial_damaged">部分损坏</Option>
                  <Option value="damaged">损坏</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="temperatureAtSignoff"
                label="签收时温度(℃)"
              >
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="isExempt"
            label="是否免责"
            valuePropName="checked"
          >
            <Select>
              <Option value={false}>否</Option>
              <Option value={true}>是</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="exemptReason"
            label="免责原因"
          >
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="signOffRemarks"
            label="签收备注"
          >
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              保存签收记录
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ShipmentDetail;
