import React, { useState, useEffect } from 'react';
import { Layout, Menu, Card, Row, Col, Button, Space, message, Modal, Form, Input, Select, DatePicker, Typography, Divider
} from 'antd';
import { 
  DashboardOutlined, 
  PlusOutlined,
  FileTextOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { annotationApi, metricsApi, exportApi, statusMap, eventTypeMap
} from './services/api';
import StatisticCards from './components/StatisticCards';
import ApprovalTimeline from './components/ApprovalTimeline';
import VersionList from './components/VersionList';
import AnnotationDetail from './components/AnnotationDetail';
import ApprovalWorkflow from './components/ApprovalWorkflow';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

function App() {
  const [annotations, setAnnotations] = useState([]);
  const [statistics, setStatistics] = useState([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [versions, setVersions] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    Promise.all([
      annotationApi.list(),
      metricsApi.getStatistics()
    ]).then(([annotationsRes, statsRes]) => {
      setAnnotations(annotationsRes.data);
      setStatistics(statsRes.data);
    }).catch(err => {
      message.error('加载数据失败');
    });
  };

  const handleSelectAnnotation = async (annotation) => {
    setSelectedAnnotation(annotation);
    try {
      const [detailRes, versionsRes, timelineRes] = await Promise.all([
        annotationApi.get(annotation.id),
        annotationApi.getVersions(annotation.id),
        annotationApi.getTimeline(annotation.id)
      ]);
      setSelectedAnnotation(detailRes.data);
      setVersions(versionsRes.data);
      setTimeline(timelineRes.data);
    } catch (err) {
      message.error('加载详情失败');
    }
  };

  const handleCreateAnnotation = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const data = {
        ...values,
        event_date: values.event_date.format('YYYY-MM-DD'),
        created_by: values.created_by || 'current_user',
        scopes: values.scopes?.map(s => ({
          scope_type: s.type,
          scope_value: s.value
        })) || []
      };

      await annotationApi.create(data);
      message.success('创建注释成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadData();
    } catch (err) {
      message.error(err.response?.data?.error || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExportInsights = async () => {
    if (!selectedAnnotation) return;
    try {
      const res = await exportApi.getInsights(selectedAnnotation.id);
      setExportData(res.data);
      setExportModalVisible(true);
    } catch (err) {
      message.error('导出失败');
    }
  };

  const handleExportExcel = () => {
    if (!selectedAnnotation) return;
    exportApi.downloadExcel(selectedAnnotation.id);
  };

  const handleStatusChange = () => {
    loadData();
    if (selectedAnnotation) {
      handleSelectAnnotation(selectedAnnotation);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={3} style={{ margin: 0 }}>
            <DashboardOutlined style={{ marginRight: 12 }} />
            数据看板注释系统
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建注释
          </Button>
        </div>
      </Header>

      <Layout>
        <Sider width={300} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: 16 }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              <FileTextOutlined style={{ marginRight: 8 }} />
              注释列表
            </Title>
            <Menu
              mode="inline"
              selectedKeys={selectedAnnotation ? [selectedAnnotation.id] : []}
              style={{ border: 'none' }}
            >
              {annotations.map(annotation => (
                <Menu.Item
                  key={annotation.id}
                  onClick={() => handleSelectAnnotation(annotation)}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{annotation.title}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      <span style={{ marginRight: 8 }}>
                        {eventTypeMap[annotation.event_type]?.label}
                      </span>
                      <span className={`ant-tag ant-tag-${statusMap[annotation.status]?.color}`} style={{ fontSize: 11 }}>
                        {statusMap[annotation.status]?.label}
                      </span>
                    </div>
                  </div>
                </Menu.Item>
              ))}
              {annotations.length === 0 && (
                <Menu.Item disabled>
                  <span style={{ color: '#999' }}>暂无注释</span>
                </Menu.Item>
              )}
            </Menu>
          </div>
        </Sider>

        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <StatisticCards statistics={statistics} annotations={annotations} />

            {selectedAnnotation && (
              <>
                <AnnotationDetail
                  annotation={selectedAnnotation}
                  onExport={handleExportInsights}
                  onExportExcel={handleExportExcel}
                />

                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                  <ApprovalTimeline
                    timeline={timeline}
                    annotation={selectedAnnotation}
                  />
                </Col>
                  <Col xs={24} md={12}>
                    <VersionList
                      versions={versions}
                      annotationId={selectedAnnotation.id}
                    />
                </Col>
              </Row>

                <ApprovalWorkflow
                  annotation={selectedAnnotation}
                  onStatusChange={handleStatusChange}
                />
              </>
            )}

            {!selectedAnnotation && (
              <Card style={{ textAlign: 'center', padding: 48 }}>
                <BarChartOutlined style={{ fontSize: 48, color: '#ccc' }} />
                <p style={{ color: '#999', marginTop: 16 }}>
                  请从左侧列表选择一个注释查看详情
                </p>
              </Card>
            )}
          </Space>
        </Content>
      </Layout>

      <Modal
        title="创建注释"
        open={createModalVisible}
        onOk={handleCreateAnnotation}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={loading}
        width={600}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入注释标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="详细描述"
            rules={[{ required: true, message: '请输入详细描述' }]}
          >
            <TextArea rows={4} placeholder="请输入详细描述..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="event_type"
                label="事件类型"
                rules={[{ required: true, message: '请选择事件类型' }]}
              >
                <Select placeholder="请选择">
                  <Option value="bug">系统异常</Option>
                  <Option value="feature">新功能上线</Option>
                  <Option value="marketing">营销活动</Option>
                  <Option value="operation">运营调整</Option>
                  <Option value="incident">重大事件</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="impact_level"
                label="影响程度"
                initialValue="medium"
              >
                <Select placeholder="请选择">
                  <Option value="low">低影响</Option>
                  <Option value="medium">中等影响</Option>
                  <Option value="high">高影响</Option>
                  <Option value="critical">严重影响</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="event_date"
                label="事件日期"
                rules={[{ required: true, message: '请选择事件日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="created_by"
                label="创建人"
                initialValue="current_user"
              >
                <Input placeholder="请输入创建人姓名" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">生效范围（可选）</Divider>
          <Form.List name="scopes">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'type']}
                      rules={[{ required: true, message: '请选择范围类型' }]}
                      style={{ marginBottom: 0, width: 150 }}
                    >
                      <Select placeholder="范围类型">
                        <Option value="chart">指定图表</Option>
                        <Option value="metric">指定指标</Option>
                        <Option value="dimension">指定维度</Option>
                        <Option value="date_range">日期范围</Option>
                        <Option value="global">全局生效</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'value']}
                      rules={[{ required: true, message: '请输入范围值' }]}
                      style={{ marginBottom: 0, flex: 1 }}
                    >
                      <Input placeholder="范围值" />
                    </Form.Item>
                    <Button onClick={() => remove(name)} danger>删除</Button>
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加生效范围
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title="洞察导出"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        footer={[
          <Button onClick={() => setExportModalVisible(false)}>关闭</Button>
        ]}
        width={800}
      >
        {exportData && (
          <div>
            {Object.entries(exportData).map(([sheetName, data]) => (
              <div key={sheetName} style={{ marginBottom: 24 }}>
                <Title level={5}>{sheetName}</Title>
                <Card type="inner" size="small">
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </Card>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </Layout>
  );
}

export default App;
