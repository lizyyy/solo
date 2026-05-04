import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout,
  Menu,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Progress,
  Button,
  Upload,
  message,
  Tabs,
  Form,
  Input,
  Select,
  Space,
  Divider,
  List,
  Modal,
  InputNumber,
} from 'antd';
import {
  DashboardOutlined,
  ImportOutlined,
  AreaChartOutlined,
  FileTextOutlined,
  SettingOutlined,
  UploadOutlined,
  EyeOutlined,
  EditOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  AlertOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getStatistics,
  getAreas,
  getAreaDetail,
  updateArea,
  importResurfacing,
  importTemperature,
  importAlarms,
  importSchedule,
  getSettings,
  updateSettings,
  exportMarkdown,
  exportRiskCSV,
  exportAuditJSON,
} from './api';

const { Header, Content } = Layout;
const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

// 数据概览页面
const DashboardPage = () => {
  const [statistics, setStatistics] = useState(null);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [stats, areasData] = await Promise.all([
        getStatistics(),
        getAreas(),
      ]);
      setStatistics(stats);
      setAreas(areasData);
    } catch (error) {
      message.error('获取数据失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getRiskBadge = (riskLevel) => {
    switch (riskLevel) {
      case 'high':
        return <Tag color="error">高风险</Tag>;
      case 'medium':
        return <Tag color="warning">中风险</Tag>;
      case 'low':
        return <Tag color="success">低风险</Tag>;
      default:
        return <Tag color="success">正常</Tag>;
    }
  };

  const columns = [
    {
      title: '区域',
      dataIndex: 'area',
      key: 'area',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (level) => getRiskBadge(level),
    },
    {
      title: '最高温度',
      dataIndex: 'maxTemperature',
      key: 'maxTemperature',
      render: (temp) => (temp !== null ? `${temp.toFixed(1)}°C` : '-'),
    },
    {
      title: '浇冰次数',
      dataIndex: 'resurfacingCount',
      key: 'resurfacingCount',
    },
    {
      title: '判定结果',
      dataIndex: 'verdict',
      key: 'verdict',
      render: (text) => text || '未复核',
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>📊 数据概览</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: '8px' }}>
            <Statistic
              title="总区域数"
              value={statistics?.totalAreas || 0}
              prefix={<AreaChartOutlined />}
              valueStyle={{ color: '#667eea' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: '8px' }}>
            <Statistic
              title="高风险区域"
              value={statistics?.highRiskCount || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: '8px' }}>
            <Statistic
              title="未处理告警"
              value={statistics?.unresolvedAlarms || 0}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: '8px' }}>
            <Statistic
              title="明日早场活动"
              value={statistics?.tomorrowMorningActivities || 0}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} md={12}>
          <Card title="风险分布" bordered={false} style={{ borderRadius: '8px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>高风险区域</span>
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  {statistics?.highRiskCount || 0}
                </span>
              </div>
              <Progress
                percent={
                  statistics?.totalAreas
                    ? ((statistics.highRiskCount / statistics.totalAreas) * 100).toFixed(1)
                    : 0
                }
                strokeColor="#ff4d4f"
                showInfo={false}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>中风险区域</span>
                <span style={{ color: '#faad14', fontWeight: 'bold' }}>
                  {statistics?.mediumRiskCount || 0}
                </span>
              </div>
              <Progress
                percent={
                  statistics?.totalAreas
                    ? ((statistics.mediumRiskCount / statistics.totalAreas) * 100).toFixed(1)
                    : 0
                }
                strokeColor="#faad14"
                showInfo={false}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>低风险区域</span>
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                  {statistics?.lowRiskCount || 0}
                </span>
              </div>
              <Progress
                percent={
                  statistics?.totalAreas
                    ? ((statistics.lowRiskCount / statistics.totalAreas) * 100).toFixed(1)
                    : 0
                }
                strokeColor="#52c41a"
                showInfo={false}
              />
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="复核状态" bordered={false} style={{ borderRadius: '8px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>
                  <ClockCircleOutlined style={{ marginRight: '8px', color: '#faad14' }} />
                  待复核
                </span>
                <span style={{ color: '#faad14', fontWeight: 'bold' }}>
                  {statistics?.pendingReview || 0}
                </span>
              </div>
              <Progress
                percent={
                  statistics?.totalAreas
                    ? ((statistics.pendingReview / statistics.totalAreas) * 100).toFixed(1)
                    : 0
                }
                strokeColor="#faad14"
                showInfo={false}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>
                  <CheckCircleOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                  已复核
                </span>
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                  {statistics?.reviewed || 0}
                </span>
              </div>
              <Progress
                percent={
                  statistics?.totalAreas
                    ? ((statistics.reviewed / statistics.totalAreas) * 100).toFixed(1)
                    : 0
                }
                strokeColor="#52c41a"
                showInfo={false}
              />
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="各区域状态" bordered={false} style={{ borderRadius: '8px' }}>
        <Table
          columns={columns}
          dataSource={areas}
          rowKey="id"
          loading={loading}
          rowClassName={(record) => {
            if (record.riskLevel === 'high') return 'table-row-highlight';
            if (record.riskLevel === 'medium') return 'table-row-warning';
            return '';
          }}
          pagination={false}
        />
      </Card>
    </div>
  );
};

// 数据导入页面
const ImportPage = () => {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (file, importFunc, type) => {
    setUploading(true);
    try {
      const text = await file.text();
      const result = await importFunc(text);
      if (result.success) {
        message.success(result.message);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('导入失败: ' + error.message);
    } finally {
      setUploading(false);
    }
    return false;
  };

  const uploadProps = (importFunc, type) => ({
    beforeUpload: (file) => handleFileUpload(file, importFunc, type),
    showUploadList: false,
    accept: '.csv',
    disabled: uploading,
  });

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>📥 数据导入</h2>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            title="浇冰车作业记录"
            bordered={false}
            style={{ borderRadius: '8px', height: '100%' }}
          >
            <p style={{ color: '#666', marginBottom: '16px' }}>
              支持导入包含区域、开始时间、结束时间、操作员、水温、冰厚等字段的 CSV 文件。
            </p>
            <Upload {...uploadProps(importResurfacing, 'resurfacing')}>
              <Button icon={<UploadOutlined />} loading={uploading} type="primary">
                选择 CSV 文件
              </Button>
            </Upload>
            <Divider>支持的列名</Divider>
            <List size="small" dataSource={['Area/区域', 'StartTime/开始时间', 'EndTime/结束时间', 'Operator/操作员', 'WaterTemp/水温', 'IceThickness/冰厚']} renderItem={(item) => <List.Item>{item}</List.Item>} />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title="冰面温度传感器数据"
            bordered={false}
            style={{ borderRadius: '8px', height: '100%' }}
          >
            <p style={{ color: '#666', marginBottom: '16px' }}>
              支持导入包含区域、传感器编号、时间戳、温度等字段的 CSV 文件。
            </p>
            <Upload {...uploadProps(importTemperature, 'temperature')}>
              <Button icon={<UploadOutlined />} loading={uploading} type="primary">
                选择 CSV 文件
              </Button>
            </Upload>
            <Divider>支持的列名</Divider>
            <List size="small" dataSource={['Area/区域', 'SensorID/传感器编号', 'Timestamp/时间戳', 'Temperature/温度']} renderItem={(item) => <List.Item>{item}</List.Item>} />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title="压缩机告警记录"
            bordered={false}
            style={{ borderRadius: '8px', height: '100%' }}
          >
            <p style={{ color: '#666', marginBottom: '16px' }}>
              支持导入包含设备、告警代码、告警类型、严重程度、开始时间等字段的 CSV 文件。
            </p>
            <Upload {...uploadProps(importAlarms, 'alarms')}>
              <Button icon={<UploadOutlined />} loading={uploading} type="primary">
                选择 CSV 文件
              </Button>
            </Upload>
            <Divider>支持的列名</Divider>
            <List size="small" dataSource={['Equipment/设备', 'AlarmCode/告警代码', 'AlarmType/告警类型', 'Severity/严重程度', 'StartTime/开始时间']} renderItem={(item) => <List.Item>{item}</List.Item>} />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title="次日活动排期"
            bordered={false}
            style={{ borderRadius: '8px', height: '100%' }}
          >
            <p style={{ color: '#666', marginBottom: '16px' }}>
              支持导入包含区域、日期、开始时间、结束时间、活动类型、组织者等字段的 CSV 文件。
            </p>
            <Upload {...uploadProps(importSchedule, 'schedule')}>
              <Button icon={<UploadOutlined />} loading={uploading} type="primary">
                选择 CSV 文件
              </Button>
            </Upload>
            <Divider>支持的列名</Divider>
            <List size="small" dataSource={['Area/区域', 'Date/日期', 'StartTime/开始时间', 'EndTime/结束时间', 'ActivityType/活动类型', 'Organizer/组织者']} renderItem={(item) => <List.Item>{item}</List.Item>} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// 冰场区域页面
const AreasPage = ({ onViewDetail }) => {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAreas();
      setAreas(data);
    } catch (error) {
      message.error('获取数据失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getRiskBadge = (riskLevel) => {
    switch (riskLevel) {
      case 'high':
        return <Tag color="error">高风险</Tag>;
      case 'medium':
        return <Tag color="warning">中风险</Tag>;
      case 'low':
        return <Tag color="success">低风险</Tag>;
      default:
        return <Tag color="success">正常</Tag>;
    }
  };

  const columns = [
    {
      title: '区域',
      dataIndex: 'area',
      key: 'area',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (level) => getRiskBadge(level),
    },
    {
      title: '平均温度',
      dataIndex: 'avgTemperature',
      key: 'avgTemperature',
      render: (temp) => (temp !== null ? `${temp.toFixed(1)}°C` : '-'),
    },
    {
      title: '最高温度',
      dataIndex: 'maxTemperature',
      key: 'maxTemperature',
      render: (temp) => (temp !== null ? `${temp.toFixed(1)}°C` : '-'),
    },
    {
      title: '浇冰次数',
      dataIndex: 'resurfacingCount',
      key: 'resurfacingCount',
    },
    {
      title: '温度记录数',
      dataIndex: 'temperatureCount',
      key: 'temperatureCount',
    },
    {
      title: '判定结果',
      dataIndex: 'verdict',
      key: 'verdict',
      render: (text) => text || '未复核',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => onViewDetail(record.id)}
          >
            查看详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>🏟️ 冰场区域</h2>
        <Button icon={<AreaChartOutlined />} onClick={fetchData}>
          刷新数据
        </Button>
      </div>

      <Card bordered={false} style={{ borderRadius: '8px' }}>
        <Table
          columns={columns}
          dataSource={areas}
          rowKey="id"
          loading={loading}
          rowClassName={(record) => {
            if (record.riskLevel === 'high') return 'table-row-highlight';
            if (record.riskLevel === 'medium') return 'table-row-warning';
            return '';
          }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

// 区域详情页面
const AreaDetailPage = ({ areaId, onBack }) => {
  const [areaDetail, setAreaDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAreaDetail(areaId);
      setAreaDetail(data);
    } catch (error) {
      message.error('获取数据失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [areaId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEdit = () => {
    form.setFieldsValue({
      notes: areaDetail?.notes || '',
      verdict: areaDetail?.verdict || '未复核',
      status: areaDetail?.status || 'pending',
    });
    setEditModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      const result = await updateArea(areaId, values);
      if (result.success) {
        message.success('保存成功');
        setEditModalVisible(false);
        fetchData();
      } else {
        message.error('保存失败');
      }
    } catch (error) {
      message.error('保存失败: ' + error.message);
    }
  };

  const getRiskBadge = (risk) => {
    return (
      <Tag color={risk.severity === 'high' ? 'error' : 'warning'}>
        {risk.severity === 'high' ? '高' : '中'}风险
      </Tag>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <p>加载中...</p>
      </div>
    );
  }

  if (!areaDetail) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <p>未找到该区域数据</p>
        <Button onClick={onBack}>返回</Button>
      </div>
    );
  }

  const riskColumns = [
    {
      title: '风险等级',
      key: 'severity',
      render: (_, record) => getRiskBadge(record),
    },
    {
      title: '风险描述',
      dataIndex: 'message',
      key: 'message',
    },
  ];

  const temperatureColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
    },
    {
      title: '传感器',
      dataIndex: 'sensorId',
      key: 'sensorId',
    },
    {
      title: '温度',
      dataIndex: 'temperature',
      key: 'temperature',
      render: (temp) => `${temp.toFixed(1)}°C`,
    },
  ];

  const resurfacingColumns = [
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      key: 'endTime',
    },
    {
      title: '操作员',
      dataIndex: 'operator',
      key: 'operator',
    },
    {
      title: '水温',
      dataIndex: 'waterTemp',
      key: 'waterTemp',
      render: (temp) => (temp > 0 ? `${temp}°C` : '-'),
    },
    {
      title: '冰厚',
      dataIndex: 'iceThickness',
      key: 'iceThickness',
      render: (thickness) => (thickness > 0 ? `${thickness}mm` : '-'),
    },
  ];

  const alarmColumns = [
    {
      title: '设备',
      dataIndex: 'equipment',
      key: 'equipment',
    },
    {
      title: '告警代码',
      dataIndex: 'alarmCode',
      key: 'alarmCode',
    },
    {
      title: '类型',
      dataIndex: 'alarmType',
      key: 'alarmType',
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity) => (
        <Tag color={severity === 'high' || severity === 'critical' ? 'error' : 'warning'}>
          {severity}
        </Tag>
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
  ];

  const scheduleColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      key: 'endTime',
    },
    {
      title: '活动类型',
      dataIndex: 'activityType',
      key: 'activityType',
    },
    {
      title: '组织者',
      dataIndex: 'organizer',
      key: 'organizer',
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button style={{ marginRight: '16px' }} onClick={onBack}>
            ← 返回
          </Button>
          <h2 style={{ margin: 0 }}>📍 {areaDetail.area} - 区域详情</h2>
        </div>
        <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
          复核编辑
        </Button>
      </div>

      {/* 基本信息 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: '8px' }}>
            <Statistic
              title="判定结果"
              value={areaDetail.verdict || '未复核'}
              valueStyle={{ color: areaDetail.verdict === '合格' ? '#52c41a' : areaDetail.verdict === '不合格' ? '#ff4d4f' : '#666' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: '8px' }}>
            <Statistic
              title="状态"
              value={areaDetail.status === 'reviewed' ? '已复核' : '待复核'}
              valueStyle={{ color: areaDetail.status === 'reviewed' ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: '8px' }}>
            <Statistic
              title="风险数量"
              value={areaDetail.risks?.length || 0}
              valueStyle={{ color: areaDetail.risks?.some(r => r.severity === 'high') ? '#ff4d4f' : '#666' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 备注 */}
      {areaDetail.notes && (
        <Card title="复核备注" bordered={false} style={{ borderRadius: '8px', marginBottom: '24px' }}>
          <p>{areaDetail.notes}</p>
        </Card>
      )}

      <Tabs defaultActiveKey="risks">
        <TabPane tab={`风险分析 (${areaDetail.risks?.length || 0})`} key="risks">
          <Card bordered={false} style={{ borderRadius: '8px' }}>
            {areaDetail.risks?.length > 0 ? (
              <Table
                columns={riskColumns}
                dataSource={areaDetail.risks}
                rowKey="type"
                pagination={false}
              />
            ) : (
              <p style={{ textAlign: 'center', color: '#52c41a' }}>
                <CheckCircleOutlined style={{ marginRight: '8px' }} />
                该区域暂无风险
              </p>
            )}
          </Card>
        </TabPane>

        <TabPane tab={`温度数据 (${areaDetail.temperature?.length || 0})`} key="temperature">
          <Card bordered={false} style={{ borderRadius: '8px' }}>
            <Table
              columns={temperatureColumns}
              dataSource={areaDetail.temperature}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        <TabPane tab={`浇冰记录 (${areaDetail.resurfacing?.length || 0})`} key="resurfacing">
          <Card bordered={false} style={{ borderRadius: '8px' }}>
            <Table
              columns={resurfacingColumns}
              dataSource={areaDetail.resurfacing}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        <TabPane tab={`未处理告警 (${areaDetail.alarms?.length || 0})`} key="alarms">
          <Card bordered={false} style={{ borderRadius: '8px' }}>
            {areaDetail.alarms?.length > 0 ? (
              <Table
                columns={alarmColumns}
                dataSource={areaDetail.alarms}
                rowKey="id"
                pagination={false}
              />
            ) : (
              <p style={{ textAlign: 'center', color: '#52c41a' }}>
                <CheckCircleOutlined style={{ marginRight: '8px' }} />
                该区域关联的设备暂无未处理告警
              </p>
            )}
          </Card>
        </TabPane>

        <TabPane tab={`活动排期 (${areaDetail.schedule?.length || 0})`} key="schedule">
          <Card bordered={false} style={{ borderRadius: '8px' }}>
            {areaDetail.schedule?.length > 0 ? (
              <Table
                columns={scheduleColumns}
                dataSource={areaDetail.schedule}
                rowKey="id"
                pagination={false}
              />
            ) : (
              <p style={{ textAlign: 'center', color: '#999' }}>
                该区域暂无排期数据
              </p>
            )}
          </Card>
        </TabPane>
      </Tabs>

      {/* 编辑模态框 */}
      <Modal
        title="复核编辑"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="verdict"
            label="判定结果"
            rules={[{ required: true, message: '请选择判定结果' }]}
          >
            <Select>
              <Option value="未复核">未复核</Option>
              <Option value="合格">合格</Option>
              <Option value="不合格">不合格</Option>
              <Option value="需关注">需关注</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Option value="pending">待复核</Option>
              <Option value="reviewed">已复核</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="notes"
            label="复核备注"
          >
            <TextArea rows={4} placeholder="请输入复核备注..." />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setEditModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// 数据导出页面
const ExportPage = () => {
  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>📤 数据导出</h2>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card
            title="Markdown 交班单"
            bordered={false}
            style={{ borderRadius: '8px', height: '100%' }}
          >
            <p style={{ color: '#666', marginBottom: '16px' }}>
              导出完整的冰场运维交班单，包含所有区域信息、风险分析、告警记录和次日活动排期。
            </p>
            <Button
              icon={<DownloadOutlined />}
              type="primary"
              onClick={exportMarkdown}
              block
            >
              下载 Markdown 交班单
            </Button>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card
            title="CSV 风险清单"
            bordered={false}
            style={{ borderRadius: '8px', height: '100%' }}
          >
            <p style={{ color: '#666', marginBottom: '16px' }}>
              导出所有区域的风险清单，包含区域、风险类型、严重程度、风险描述等信息。
            </p>
            <Button
              icon={<DownloadOutlined />}
              type="primary"
              onClick={exportRiskCSV}
              block
            >
              下载 CSV 风险清单
            </Button>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card
            title="JSON 审计包"
            bordered={false}
            style={{ borderRadius: '8px', height: '100%' }}
          >
            <p style={{ color: '#666', marginBottom: '16px' }}>
              导出完整的审计数据包，包含所有区域、浇冰记录、温度数据、告警、排期等原始数据。
            </p>
            <Button
              icon={<DownloadOutlined />}
              type="primary"
              onClick={exportAuditJSON}
              block
            >
              下载 JSON 审计包
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// 系统设置页面
const SettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSettings();
      setSettings(data);
      form.setFieldsValue(data);
    } catch (error) {
      message.error('获取设置失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (values) => {
    try {
      const result = await updateSettings(values);
      message.success('设置保存成功');
      setSettings(result);
    } catch (error) {
      message.error('保存失败: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>⚙️ 系统设置</h2>

      <Card bordered={false} style={{ borderRadius: '8px', maxWidth: '600px' }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={settings}
          onFinish={handleSave}
        >
          <Divider>冰面温度设置</Divider>
          
          <Form.Item
            name="idealIceTemperature"
            label="理想冰面温度 (°C)"
            rules={[{ required: true, message: '请输入理想冰面温度' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="例如: -5.5"
              step={0.1}
            />
          </Form.Item>

          <Form.Item
            name="softIceThreshold"
            label="软冰阈值 (°C)"
            rules={[{ required: true, message: '请输入软冰阈值' }]}
            extra="超过此温度认为冰面可能偏软"
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="例如: -3.0"
              step={0.1}
            />
          </Form.Item>

          <Form.Item
            name="temperatureWarningDelta"
            label="温度警告偏移量 (°C)"
            rules={[{ required: true, message: '请输入温度警告偏移量' }]}
            extra="偏离理想温度超过此值时发出警告"
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="例如: 1.5"
              step={0.1}
            />
          </Form.Item>

          <Divider>浇冰间隔设置</Divider>

          <Form.Item
            name="maxResurfacingInterval"
            label="最大浇冰间隔 (分钟)"
            rules={[{ required: true, message: '请输入最大浇冰间隔' }]}
            extra="超过此间隔认为浇冰不及时"
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="例如: 120"
              min={0}
            />
          </Form.Item>

          <Form.Item
            name="minResurfacingInterval"
            label="最小浇冰间隔 (分钟)"
            rules={[{ required: true, message: '请输入最小浇冰间隔' }]}
            extra="短于此间隔认为浇冰过于频繁"
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="例如: 45"
              min={0}
            />
          </Form.Item>

          <Divider>活动排期设置</Divider>

          <Form.Item
            name="morningActivityStartHour"
            label="早场活动开始时间 (小时)"
            rules={[{ required: true, message: '请输入早场活动开始时间' }]}
            extra="此时间之后的活动视为早场，需要特别关注"
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="例如: 6"
              min={0}
              max={24}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={fetchData}>
                重置
              </Button>
              <Button type="primary" htmlType="submit">
                保存设置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

// 主应用组件
const App = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedAreaId, setSelectedAreaId] = useState(null);

  const handleViewAreaDetail = (areaId) => {
    setSelectedAreaId(areaId);
    setCurrentPage('areaDetail');
  };

  const handleBackToAreas = () => {
    setCurrentPage('areas');
    setSelectedAreaId(null);
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: '数据概览',
      onClick: () => setCurrentPage('dashboard'),
    },
    {
      key: 'import',
      icon: <ImportOutlined />,
      label: '数据导入',
      onClick: () => setCurrentPage('import'),
    },
    {
      key: 'areas',
      icon: <AreaChartOutlined />,
      label: '冰场区域',
      onClick: () => setCurrentPage('areas'),
    },
    {
      key: 'export',
      icon: <FileTextOutlined />,
      label: '数据导出',
      onClick: () => setCurrentPage('export'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => setCurrentPage('settings'),
    },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'import':
        return <ImportPage />;
      case 'areas':
        return <AreasPage onViewDetail={handleViewAreaDetail} />;
      case 'areaDetail':
        return <AreaDetailPage areaId={selectedAreaId} onBack={handleBackToAreas} />;
      case 'export':
        return <ExportPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: '20px',
            fontWeight: 'bold',
            marginRight: '24px',
          }}
        >
          🏒 冰场运维复盘工具
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[currentPage]}
          items={menuItems}
          style={{
            flex: 1,
            borderBottom: 'none',
            background: 'transparent',
          }}
        />
      </Header>

      <Layout>
        <Content
          style={{
            padding: '24px',
            background: '#f5f5f5',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '24px',
              borderRadius: '8px',
              minHeight: 'calc(100vh - 112px)',
            }}
          >
            {renderPage()}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
