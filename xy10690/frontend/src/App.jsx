import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Button, Space, Card, Table, DatePicker, Select, Upload, message, Tag, Modal, Input, Row, Col, Statistic } from 'antd';
import { ExportOutlined, ImportOutlined, DownloadOutlined, ReloadOutlined, CheckCircleOutlined, StopOutlined, UserOutlined, SafetyCertificateOutlined, RepeatOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import * as XLSX from 'xlsx';

const { Header, Content } = Layout;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;

const api = axios.create({ baseURL: '/api' });

function App() {
  const [sessions, setSessions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [demoModalVisible, setDemoModalVisible] = useState(false);
  const [demoResult, setDemoResult] = useState(null);

  useEffect(() => {
    loadSessions();
    loadLogs();
  }, [filters]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sessions', { params: filters });
      setSessions(res.data.data);
    } catch (err) {
      message.error('加载失败');
    }
    setLoading(false);
  };

  const loadLogs = async () => {
    try {
      const res = await api.get('/logs');
      setLogs(res.data.data);
    } catch (err) {
      message.error('加载失败');
    }
  };

  const exportSessions = async () => {
    try {
      const res = await api.get('/export/sessions', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', '试妆项目.xlsx');
      document.body.appendChild(link);
      link.click();
      message.success('导出成功');
    } catch (err) {
      message.error('导出失败');
    }
  };

  const exportLogs = async () => {
    try {
      const res = await api.get('/export/logs', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', '操作日志.xlsx');
      document.body.appendChild(link);
      link.click();
      message.success('导出成功');
    } catch (err) {
      message.error('导出失败');
    }
  };

  const handleImport = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const workbook = XLSX.read(e.target.result, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const res = await api.post('/import/sessions', formData);
        message.success(`成功导入 ${res.data.imported} 条记录`);
        loadSessions();
        loadLogs();
      } catch (err) {
        message.error('导入失败');
      }
    };
    reader.readAsBinaryString(file);
    return false;
  };

  const runDemo = async (type) => {
    setDemoResult(null);
    try {
      const res = await api.post(`/demo/${type}`);
      setDemoResult(res.data);
      message.success('演示完成');
      loadSessions();
      loadLogs();
    } catch (err) {
      message.error('演示失败');
    }
  };

  const sessionColumns = [
    { title: '客户', dataIndex: 'customer_name', key: 'customer_name' },
    { title: '顾问', dataIndex: 'consultant_name', key: 'consultant_name' },
    { title: '产品', dataIndex: 'product_name', key: 'product_name' },
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status) => {
      const colorMap = { approved: 'green', blocked: 'red', manual_approved: 'orange', pending: 'blue' };
      const textMap = { approved: '已通过', blocked: '已拦截', manual_approved: '人工通过', pending: '待处理' };
      return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
    }},
    { title: '风险等级', dataIndex: 'risk_level', key: 'risk_level' },
    { title: '备注', dataIndex: 'notes', key: 'notes' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (t) => moment(t).format('YYYY-MM-DD HH:mm:ss') }
  ];

  const logColumns = [
    { title: '操作类型', dataIndex: 'operation_type', key: 'operation_type' },
    { title: '实体类型', dataIndex: 'entity_type', key: 'entity_type' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status) => {
      const colorMap = { success: 'green', failed: 'red', blocked: 'red', duplicate: 'orange', manual: 'orange' };
      const textMap = { success: '成功', failed: '失败', blocked: '拦截', duplicate: '重复', manual: '人工' };
      return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
    }},
    { title: '失败原因', dataIndex: 'failure_reason', key: 'failure_reason' },
    { title: '操作人', dataIndex: 'operator', key: 'operator' },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (t) => moment(t).format('YYYY-MM-DD HH:mm:ss') }
  ];

  const stats = {
    total: sessions.length,
    approved: sessions.filter(s => s.status === 'approved').length,
    blocked: sessions.filter(s => s.status === 'blocked').length,
    manual: sessions.filter(s => s.status === 'manual_approved').length
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>门店试妆过敏禁忌管理系统</h1>
        <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={() => setDemoModalVisible(true)}>
          演示功能
        </Button>
      </Header>
      <Content style={{ padding: '24px' }}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="总项目数" value={stats.total} prefix={<DownloadOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="已通过" value={stats.approved} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="已拦截" value={stats.blocked} valueStyle={{ color: '#cf1322' }} prefix={<StopOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="人工通过" value={stats.manual} valueStyle={{ color: '#fa8c16' }} prefix={<UserOutlined />} />
            </Card>
          </Col>
        </Row>

        <Tabs defaultActiveKey="1" items={[
          {
            key: '1',
            label: '试妆项目',
            children: (
              <>
                <Card style={{ marginBottom: 16 }}>
                  <Space wrap>
                    <Select
                      style={{ width: 150 }}
                      placeholder="状态筛选"
                      allowClear
                      onChange={(v) => setFilters({ ...filters, status: v })}
                    >
                      <Option value="approved">已通过</Option>
                      <Option value="blocked">已拦截</Option>
                      <Option value="manual_approved">人工通过</Option>
                      <Option value="pending">待处理</Option>
                    </Select>
                    <RangePicker
                      onChange={(dates) => setFilters({
                        ...filters,
                        dateFrom: dates?.[0]?.format('YYYY-MM-DD'),
                        dateTo: dates?.[1]?.format('YYYY-MM-DD')
                      })}
                    />
                    <Button icon={<ReloadOutlined />} onClick={loadSessions}>刷新</Button>
                    <Upload beforeUpload={handleImport} showUploadList={false}>
                      <Button icon={<ImportOutlined />}>批量导入</Button>
                    </Upload>
                    <Button type="primary" icon={<ExportOutlined />} onClick={exportSessions}>导出Excel</Button>
                  </Space>
                </Card>
                <Table
                  columns={sessionColumns}
                  dataSource={sessions}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </>
            )
          },
          {
            key: '2',
            label: '操作日志',
            children: (
              <>
                <Card style={{ marginBottom: 16 }}>
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={loadLogs}>刷新</Button>
                    <Button type="primary" icon={<ExportOutlined />} onClick={exportLogs}>导出Excel</Button>
                  </Space>
                </Card>
                <Table
                  columns={logColumns}
                  dataSource={logs}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                />
              </>
            )
          }
        ]} />
      </Content>

      <Modal
        title="演示四条业务路径"
        open={demoModalVisible}
        onCancel={() => setDemoModalVisible(false)}
        footer={null}
        width={700}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <strong><CheckCircleOutlined style={{ color: 'green' }} /> 成功路径</strong>
                <p style={{ margin: '8px 0', color: '#666' }}>陈小姐 + 张美容(值班) + 水润粉底液(无过敏)</p>
                <Button type="primary" onClick={() => runDemo('success')}>运行演示</Button>
              </div>
            </Space>
          </Card>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <strong><StopOutlined style={{ color: 'red' }} /> 拦截路径</strong>
                <p style={{ margin: '8px 0', color: '#666' }}>周女士(酒精过敏) + 张美容(值班) + 持妆口红(含酒精)</p>
                <Button danger onClick={() => runDemo('blocked')}>运行演示</Button>
              </div>
            </Space>
          </Card>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <strong><UserOutlined style={{ color: 'orange' }} /> 人工修正路径</strong>
                <p style={{ margin: '8px 0', color: '#666' }}>先触发拦截，然后经理人工通过(签署知情同意书)</p>
                <Button style={{ background: '#fa8c16', borderColor: '#fa8c16' }} type="primary" onClick={() => runDemo('manual')}>运行演示</Button>
              </div>
            </Space>
          </Card>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <strong><RepeatOutlined style={{ color: '#1890ff' }} /> 重复提交路径</strong>
                <p style={{ margin: '8px 0', color: '#666' }}>相同requestId重复提交，触发幂等性，返回已有数据</p>
                <Button style={{ background: '#1890ff', borderColor: '#1890ff' }} type="primary" onClick={() => runDemo('duplicate')}>运行演示</Button>
              </div>
            </Space>
          </Card>

          {demoResult && (
            <Card title="演示结果">
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, maxHeight: 300, overflow: 'auto' }}>
                {JSON.stringify(demoResult, null, 2)}
              </pre>
            </Card>
          )}
        </Space>
      </Modal>
    </Layout>
  );
}

export default App;
