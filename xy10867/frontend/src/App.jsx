import React, { useState, useEffect } from 'react';
import { Layout, Table, Button, Tag, Space, Modal, Form, Input, Select, message, Card, Statistic, Row, Col, Timeline, Dropdown, Checkbox, Alert } from 'antd';
import { PlusOutlined, ExportOutlined, HistoryOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, SafetyCertificateOutlined, ToolOutlined, EyeOutlined, MergeOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { vulnerabilityApi } from './services/api';

const { Header, Content } = Layout;
const { Option } = Select;
const { TextArea } = Input;

const STATUS_MAP = {
  PENDING: { label: '待处理', color: 'default' },
  ANALYZING: { label: '分析中', color: 'processing' },
  EXEMPTED: { label: '已豁免', color: 'success' },
  FIXING: { label: '修复中', color: 'warning' },
  VERIFIED: { label: '已验证', color: 'purple' },
  CLOSED: { label: '已关闭', color: 'default' }
};

const SEVERITY_MAP = {
  CRITICAL: { label: '严重', class: 'severity-critical' },
  HIGH: { label: '高危', class: 'severity-high' },
  MEDIUM: { label: '中危', class: 'severity-medium' },
  LOW: { label: '低危', class: 'severity-low' }
};

function App() {
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [selectedVulnerability, setSelectedVulnerability] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [form] = Form.useForm();
  const [actionForm] = Form.useForm();
  const [mergeForm] = Form.useForm();
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [operator] = useState('current-user');
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  useEffect(() => {
    loadVulnerabilities();
  }, []);

  const loadVulnerabilities = async () => {
    setLoading(true);
    try {
      const res = await vulnerabilityApi.getAll({}, operator);
      if (res.data.success) {
        setVulnerabilities(res.data.data);
      }
    } catch (error) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  const loadDetail = async (id) => {
    try {
      const [vulnRes, logsRes, verifRes] = await Promise.all([
        vulnerabilityApi.getById(id, operator),
        vulnerabilityApi.getAuditLogs(id),
        vulnerabilityApi.getVerifications(id)
      ]);
      setSelectedVulnerability(vulnRes.data.data);
      setAuditLogs(logsRes.data.data || []);
      setVerifications(verifRes.data.data || []);
      setDetailModalVisible(true);
    } catch (error) {
      message.error('加载详情失败');
    }
  };

  const handleCreate = async (values) => {
    try {
      const res = await vulnerabilityApi.create({
        ...values,
        affectedServices: values.affectedServices ? values.affectedServices.split(',').map(s => s.trim()) : [],
        operator
      });
      
      if (res.data.data.duplicatesFound && res.data.data.duplicatesFound > 0) {
        setDuplicateWarning({
          packageName: values.packageName,
          count: res.data.data.duplicatesFound,
          existingDuplicates: res.data.data.existingDuplicates
        });
      }
      
      message.success(res.data.data.merged ? '检测到重复漏洞，已自动归并' : '创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadVulnerabilities();
    } catch (error) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const handleMerge = async (values) => {
    try {
      const sourceIds = selectedRowKeys.filter(id => id !== values.targetId);
      await vulnerabilityApi.merge(values.targetId, sourceIds, operator);
      message.success('合并成功');
      setMergeModalVisible(false);
      setSelectedRowKeys([]);
      mergeForm.resetFields();
      loadVulnerabilities();
    } catch (error) {
      message.error(error.response?.data?.error || '合并失败');
    }
  };

  const handleExport = async (format, includeDetails) => {
    try {
      const res = await vulnerabilityApi.export(format, {}, operator, includeDetails);
      if (res.data.success) {
        window.open(`/api/vulnerabilities/exports/${res.data.data.filename}`);
        message.success(`导出成功，共 ${res.data.data.count} 条记录${includeDetails ? '（含完整审计轨迹）' : ''}`);
      }
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleAction = (action, record) => {
    setCurrentAction({ action, record });
    actionForm.resetFields();
    setActionModalVisible(true);
  };

  const executeAction = async (values) => {
    const { action, record } = currentAction;
    try {
      switch (action) {
        case 'analyze':
          await vulnerabilityApi.analyze(record.id, operator);
          break;
        case 'exempt':
          await vulnerabilityApi.exempt(record.id, values.reason, operator);
          break;
        case 'fix':
          await vulnerabilityApi.startFix(record.id, values.fixBatch, operator);
          break;
        case 'verify':
          await vulnerabilityApi.verify(record.id, operator, values.result, values.comment);
          break;
        case 'close':
          await vulnerabilityApi.close(record.id, operator);
          break;
      }
      message.success('操作成功');
      setActionModalVisible(false);
      loadVulnerabilities();
      if (selectedVulnerability?.id === record.id) {
        loadDetail(record.id);
      }
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const getAvailableActions = (record) => {
    const actions = [];
    switch (record.status) {
      case 'PENDING':
        actions.push({ key: 'analyze', label: '开始分析', icon: <SearchOutlined /> });
        actions.push({ key: 'exempt', label: '申请豁免', icon: <SafetyCertificateOutlined /> });
        break;
      case 'ANALYZING':
        actions.push({ key: 'exempt', label: '申请豁免', icon: <SafetyCertificateOutlined /> });
        actions.push({ key: 'fix', label: '开始修复', icon: <ToolOutlined /> });
        actions.push({ key: 'close', label: '关闭', icon: <CloseCircleOutlined /> });
        break;
      case 'FIXING':
        actions.push({ key: 'verify', label: '验证修复', icon: <CheckCircleOutlined /> });
        actions.push({ key: 'close', label: '关闭', icon: <CloseCircleOutlined /> });
        break;
      case 'VERIFIED':
      case 'EXEMPTED':
        actions.push({ key: 'close', label: '关闭', icon: <CloseCircleOutlined /> });
        break;
    }
    return actions;
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys) => {
      setSelectedRowKeys(newSelectedRowKeys);
    }
  };

  const columns = [
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity) => (
        <span className={SEVERITY_MAP[severity]?.class}>
          {SEVERITY_MAP[severity]?.label}
        </span>
      ),
      filters: Object.keys(SEVERITY_MAP).map(k => ({ text: SEVERITY_MAP[k].label, value: k }))
    },
    {
      title: 'CVE ID',
      dataIndex: 'cve_id',
      key: 'cve_id',
      width: 150
    },
    {
      title: '包名',
      dataIndex: 'package_name',
      key: 'package_name',
      width: 150
    },
    {
      title: '版本',
      dataIndex: 'package_version',
      key: 'package_version',
      width: 100
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '受影响服务',
      dataIndex: 'affected_services',
      key: 'affected_services',
      width: 200,
      render: (services) => (
        <Space wrap>
          {services?.map(s => <Tag key={s} size="small">{s}</Tag>)}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={STATUS_MAP[status]?.color}>
          {STATUS_MAP[status]?.label}
        </Tag>
      ),
      filters: Object.keys(STATUS_MAP).map(k => ({ text: STATUS_MAP[k].label, value: k }))
    },
    {
      title: '操作',
      key: 'actions',
      width: 250,
      render: (_, record) => (
        <Space size="small">
          <Button icon={<EyeOutlined />} size="small" onClick={() => loadDetail(record.id)}>
            详情
          </Button>
          {getAvailableActions(record).map(action => (
            <Button
              key={action.key}
              icon={action.icon}
              size="small"
              type="primary"
              onClick={() => handleAction(action.key, record)}
            >
              {action.label}
            </Button>
          ))}
        </Space>
      )
    }
  ];

  const stats = {
    total: vulnerabilities.length,
    pending: vulnerabilities.filter(v => v.status === 'PENDING').length,
    analyzing: vulnerabilities.filter(v => v.status === 'ANALYZING').length,
    critical: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
    high: vulnerabilities.filter(v => v.severity === 'HIGH').length
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ color: 'white', margin: 0, fontSize: '20px' }}>
          🛡️ 漏洞包分诊台
        </h1>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateModalVisible(true)}>
            录入漏洞
          </Button>
          <Dropdown
            menu={{
              items: [
                { key: 'csv-basic', label: '基础 CSV', icon: <ExportOutlined />, onClick: () => handleExport('csv', false) },
                { key: 'json-basic', label: '基础 JSON', icon: <ExportOutlined />, onClick: () => handleExport('json', false) },
                { type: 'divider' },
                { key: 'csv-full', label: '完整报告 CSV (含审计/验证)', icon: <FileTextOutlined />, onClick: () => handleExport('csv', true) },
                { key: 'json-full', label: '完整报告 JSON (含审计/验证)', icon: <FileTextOutlined />, onClick: () => handleExport('json', true) }
              ]
            }}
          >
            <Button icon={<ExportOutlined />}>
              导出
            </Button>
          </Dropdown>
        </Space>
      </Header>
      <Content style={{ padding: '24px' }}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card>
              <Statistic title="漏洞总数" value={stats.total} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="待处理" value={stats.pending} valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="分析中" value={stats.analyzing} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="严重漏洞" value={stats.critical} valueStyle={{ color: '#ff4d4f' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="高危漏洞" value={stats.high} valueStyle={{ color: '#fa8c16' }} />
            </Card>
          </Col>
        </Row>

        <Card 
          title="异常队列" 
          extra={
            <Space>
              <span>共 {vulnerabilities.length} 条记录</span>
              {selectedRowKeys.length > 1 && (
                <Button 
                  type="primary" 
                  icon={<MergeOutlined />} 
                  onClick={() => {
                    setMergeModalVisible(true);
                    mergeForm.setFieldsValue({ targetId: selectedRowKeys[0] });
                  }}
                >
                  合并选中 ({selectedRowKeys.length})
                </Button>
              )}
            </Space>
          }
        >
          {duplicateWarning && (
            <Alert
              message={`检测到 ${duplicateWarning.packageName} 有 ${duplicateWarning.count} 条重复漏洞记录`}
              type="warning"
              showIcon
              closable
              onClose={() => setDuplicateWarning(null)}
              style={{ marginBottom: 16 }}
            />
          )}
          <Table
            columns={columns}
            dataSource={vulnerabilities}
            rowKey="id"
            loading={loading}
            rowClassName={(record) => `status-${record.status.toLowerCase()}`}
            pagination={{ pageSize: 10 }}
            rowSelection={rowSelection}
          />
        </Card>
      </Content>

      <Modal
        title="录入新漏洞"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="cveId" label="CVE ID">
            <Input placeholder="例如: CVE-2021-23337" />
          </Form.Item>
          <Form.Item name="packageName" label="包名" rules={[{ required: true }]}>
            <Input placeholder="例如: lodash" />
          </Form.Item>
          <Form.Item name="packageVersion" label="版本" rules={[{ required: true }]}>
            <Input placeholder="例如: 4.17.20" />
          </Form.Item>
          <Form.Item name="ecosystem" label="生态" rules={[{ required: true }]}>
            <Select placeholder="选择包管理生态">
              <Option value="npm">NPM</Option>
              <Option value="pypi">PyPI</Option>
              <Option value="maven">Maven</Option>
              <Option value="gem">RubyGems</Option>
            </Select>
          </Form.Item>
          <Form.Item name="severity" label="严重程度" rules={[{ required: true }]}>
            <Select placeholder="选择严重程度">
              <Option value="CRITICAL">严重</Option>
              <Option value="HIGH">高危</Option>
              <Option value="MEDIUM">中危</Option>
              <Option value="LOW">低危</Option>
            </Select>
          </Form.Item>
          <Form.Item name="cvssScore" label="CVSS 分数">
            <Input type="number" placeholder="0-10" />
          </Form.Item>
          <Form.Item name="description" label="漏洞描述">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="affectedServices" label="受影响服务">
            <Input placeholder="多个服务用逗号分隔，例如: user-service, order-service" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={currentAction?.action === 'exempt' ? '申请豁免' :
               currentAction?.action === 'fix' ? '开始修复' :
               currentAction?.action === 'verify' ? '验证修复' :
               currentAction?.action === 'close' ? '确认关闭' : '确认操作'}
        open={actionModalVisible}
        onCancel={() => setActionModalVisible(false)}
        onOk={() => actionForm.submit()}
      >
        <Form form={actionForm} layout="vertical" onFinish={executeAction}>
          {currentAction?.action === 'exempt' && (
            <Form.Item name="reason" label="豁免理由" rules={[{ required: true }]}>
              <TextArea rows={4} placeholder="请说明豁免的理由和风险评估" />
            </Form.Item>
          )}
          {currentAction?.action === 'fix' && (
            <Form.Item name="fixBatch" label="修复批次" rules={[{ required: true }]}>
              <Input placeholder="例如: BATCH-2024-01" />
            </Form.Item>
          )}
          {currentAction?.action === 'verify' && (
            <>
              <Form.Item name="result" label="验证结果" rules={[{ required: true }]}>
                <Select placeholder="请选择验证结果">
                  <Option value="PASS">通过</Option>
                  <Option value="FAIL">失败</Option>
                </Select>
              </Form.Item>
              <Form.Item name="comment" label="验证备注">
                <TextArea rows={3} />
              </Form.Item>
            </>
          )}
          {currentAction?.action === 'close' && (
            <p>确定要关闭此漏洞记录吗？关闭后将无法再进行状态变更。</p>
          )}
        </Form>
      </Modal>

      <Modal
        title="漏洞详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={900}
        footer={null}
      >
        {selectedVulnerability && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <p><strong>CVE ID:</strong> {selectedVulnerability.cve_id || '-'}</p>
                <p><strong>包名:</strong> {selectedVulnerability.package_name}</p>
                <p><strong>版本:</strong> {selectedVulnerability.package_version}</p>
                <p><strong>生态:</strong> {selectedVulnerability.ecosystem}</p>
              </Col>
              <Col span={12}>
                <p><strong>严重程度:</strong> <span className={SEVERITY_MAP[selectedVulnerability.severity]?.class}>{SEVERITY_MAP[selectedVulnerability.severity]?.label}</span></p>
                <p><strong>CVSS 分数:</strong> {selectedVulnerability.cvss_score || '-'}</p>
                <p><strong>当前状态:</strong> <Tag color={STATUS_MAP[selectedVulnerability.status]?.color}>{STATUS_MAP[selectedVulnerability.status]?.label}</Tag></p>
                <p><strong>修复批次:</strong> {selectedVulnerability.fix_batch || '-'}</p>
              </Col>
            </Row>
            <p><strong>漏洞描述:</strong> {selectedVulnerability.description || '-'}</p>
            <p><strong>受影响服务:</strong> {selectedVulnerability.affected_services?.join(', ') || '-'}</p>
            {selectedVulnerability.exempt_reason && (
              <p><strong>豁免理由:</strong> {selectedVulnerability.exempt_reason}</p>
            )}

            <div style={{ marginTop: 24 }}>
              <h4><HistoryOutlined /> 操作轨迹</h4>
              <Timeline>
                {auditLogs.map(log => (
                  <Timeline.Item key={log.id}>
                    <p>
                      <strong>{log.action}</strong> - 
                      操作人: {log.operator} - 
                      {dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </p>
                    {log.previous_status && log.new_status && (
                      <p style={{ margin: 0 }}>
                        状态变更: {STATUS_MAP[log.previous_status]?.label} → {STATUS_MAP[log.new_status]?.label}
                      </p>
                    )}
                  </Timeline.Item>
                ))}
              </Timeline>
            </div>

            {verifications.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4><CheckCircleOutlined /> 验证记录</h4>
                {verifications.map(v => (
                  <Card key={v.id} size="small" style={{ marginBottom: 8 }}>
                    <p><strong>验证人:</strong> {v.verifier}</p>
                    <p><strong>结果:</strong> <Tag color={v.result === 'PASS' ? 'success' : 'error'}>{v.result === 'PASS' ? '通过' : '失败'}</Tag></p>
                    <p><strong>时间:</strong> {dayjs(v.verified_at).format('YYYY-MM-DD HH:mm:ss')}</p>
                    {v.comment && <p><strong>备注:</strong> {v.comment}</p>}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="合并漏洞"
        open={mergeModalVisible}
        onCancel={() => setMergeModalVisible(false)}
        onOk={() => mergeForm.submit()}
        width={600}
      >
        <Alert
          message="合并说明"
          description="合并后，源漏洞的所有操作记录将被合并到目标漏洞中，源漏洞会被标记为已关闭。此操作不可逆。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={mergeForm} layout="vertical" onFinish={handleMerge}>
          <Form.Item name="targetId" label="目标漏洞（保留）" rules={[{ required: true, message: '请选择目标漏洞' }]}>
            <Select placeholder="选择要保留的目标漏洞">
              {selectedRowKeys.map(id => {
                const vuln = vulnerabilities.find(v => v.id === id);
                return vuln ? (
                  <Option key={id} value={id}>
                    {vuln.package_name}@{vuln.package_version} - {vuln.cve_id} ({vuln.status})
                  </Option>
                ) : null;
              })}
            </Select>
          </Form.Item>
          <div>
            <p><strong>将被合并的漏洞（共 {selectedRowKeys.length - 1} 个）:</strong></p>
            <ul>
              {selectedRowKeys.filter(id => id !== mergeForm.getFieldValue('targetId')).map(id => {
                const vuln = vulnerabilities.find(v => v.id === id);
                return vuln ? (
                  <li key={id}>
                    {vuln.package_name}@{vuln.package_version} - {vuln.cve_id}
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        </Form>
      </Modal>
    </Layout>
  );
}

export default App;
