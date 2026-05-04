import React, { useState } from 'react';
import { Table, Card, Button, Tag, Space, Statistic, Row, Col, Select, message, Modal, Form, Input } from 'antd';
import { 
  WarningOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  FileSearchOutlined
} from '@ant-design/icons';
import { usePhotoScan, RISK_STATUS, RISK_STATUS_LABELS, RISK_TYPE, RISK_TYPE_LABELS } from '../context/PhotoScanContext';
import RiskService from '../services/RiskService';
import DataService from '../services/DataService';

const { Option } = Select;
const { TextArea } = Input;

function RiskPage() {
  const { state, setRisks, updateRisk, updateRecord } = usePhotoScan();
  const [filterRiskType, setFilterRiskType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isHandleModalOpen, setIsHandleModalOpen] = useState(false);
  const [handlingRisk, setHandlingRisk] = useState(null);
  const [form] = Form.useForm();

  const runRiskCheck = () => {
    if (state.records.length === 0) {
      message.warning('没有记录可检查，请先导入数据');
      return;
    }

    const risks = RiskService.checkAll(state.records, state.settings);
    setRisks(risks.map(risk => ({
      ...risk,
      id: risk.id || Date.now().toString(),
      createdTime: risk.createdTime || new Date().toLocaleString(),
      status: risk.status || RISK_STATUS.PENDING
    })));
    message.success(`风险检查完成，发现 ${risks.length} 个风险点`);
  };

  const filteredRisks = state.risks.filter(risk => {
    const matchType = !filterRiskType || risk.riskType === filterRiskType;
    const matchStatus = !filterStatus || risk.status === filterStatus;
    return matchType && matchStatus;
  });

  const getRecordInfo = (recordId) => {
    const record = state.records.find(r => r.id === recordId);
    if (record) {
      return {
        uniqueId: DataService.generateUniqueId(record.boxId, record.frameNumber),
        boxId: record.boxId,
        frameNumber: record.frameNumber,
        scanFile: record.scanFile,
        ...record
      };
    }
    return { uniqueId: '未知', boxId: '-', frameNumber: '-', scanFile: '-' };
  };

  const getRiskTypeTag = (riskType) => {
    const colorMap = {
      [RISK_TYPE.MISSING_FILE]: 'error',
      [RISK_TYPE.DUPLICATE_ID]: 'warning',
      [RISK_TYPE.LOW_RESOLUTION]: 'orange',
      [RISK_TYPE.REPAIRED_NO_DELIVERY]: 'magenta'
    };
    return (
      <Tag color={colorMap[riskType] || 'default'}>
        {RISK_TYPE_LABELS[riskType] || riskType}
      </Tag>
    );
  };

  const getStatusTag = (status) => {
    const colorMap = {
      [RISK_STATUS.PENDING]: 'warning',
      [RISK_STATUS.CONFIRMED]: 'processing',
      [RISK_STATUS.RESOLVED]: 'success',
      [RISK_STATUS.IGNORED]: 'default'
    };
    return (
      <Tag color={colorMap[status] || 'default'}>
        {RISK_STATUS_LABELS[status] || status}
      </Tag>
    );
  };

  const handleRisk = (risk) => {
    setHandlingRisk(risk);
    form.resetFields();
    setIsHandleModalOpen(true);
  };

  const saveHandle = () => {
    form.validateFields().then(values => {
      updateRisk({
        ...handlingRisk,
        status: values.status,
        handler: values.handler,
        handleNotes: values.handleNotes,
        handledTime: new Date().toLocaleString()
      });

      if (values.status === RISK_STATUS.RESOLVED) {
        const record = state.records.find(r => r.id === handlingRisk.recordId);
        if (record) {
          if (handlingRisk.riskType === RISK_TYPE.LOW_RESOLUTION && values.newResolution) {
            updateRecord({
              ...record,
              scanResolution: parseInt(values.newResolution)
            });
          }
          if (handlingRisk.riskType === RISK_TYPE.MISSING_FILE && values.scanFile) {
            updateRecord({
              ...record,
              scanFile: values.scanFile
            });
          }
          if (handlingRisk.riskType === RISK_TYPE.REPAIRED_NO_DELIVERY && values.deliveryFile) {
            updateRecord({
              ...record,
              deliveryFile: values.deliveryFile
            });
          }
        }
      }

      message.success('风险处理已保存');
      setIsHandleModalOpen(false);
    });
  };

  const columns = [
    {
      title: '风险类型',
      dataIndex: 'riskType',
      key: 'riskType',
      width: 120,
      render: (text) => getRiskTypeTag(text)
    },
    {
      title: '记录编号',
      dataIndex: 'recordId',
      key: 'recordId',
      width: 120,
      render: (recordId) => {
        const info = getRecordInfo(recordId);
        return <strong>{info.uniqueId}</strong>;
      }
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (text) => getStatusTag(text)
    },
    {
      title: '处理人',
      dataIndex: 'handler',
      key: 'handler',
      width: 100,
      render: (text) => text || '-'
    },
    {
      title: '发现时间',
      dataIndex: 'createdTime',
      key: 'createdTime',
      width: 160
    },
    {
      title: '处理时间',
      dataIndex: 'handledTime',
      key: 'handledTime',
      width: 160,
      render: (text) => text || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button 
          type="link" 
          size="small"
          onClick={() => handleRisk(record)}
        >
          处理
        </Button>
      )
    }
  ];

  const stats = {
    total: state.risks.length,
    pending: state.risks.filter(r => r.status === RISK_STATUS.PENDING).length,
    resolved: state.risks.filter(r => r.status === RISK_STATUS.RESOLVED).length,
    ignored: state.risks.filter(r => r.status === RISK_STATUS.IGNORED).length
  };

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={4}>
            <Statistic 
              title="总风险数" 
              value={stats.total} 
              valueStyle={{ color: stats.total > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="待处理" 
              value={stats.pending} 
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="已解决" 
              value={stats.resolved} 
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="已忽略" 
              value={stats.ignored} 
            />
          </Col>
          <Col span={8} style={{ textAlign: 'right' }}>
            <Space>
              <Button 
                icon={<PlayCircleOutlined />} 
                onClick={runRiskCheck}
                type="primary"
              >
                执行风险检查
              </Button>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={() => {
                  setFilterRiskType('');
                  setFilterStatus('');
                }}
              >
                重置筛选
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card 
        size="small"
        title={
          <Space>
            <WarningOutlined style={{ color: '#faad14' }} />
            <span>风险列表</span>
            <Tag color="blue">{filteredRisks.length} 条</Tag>
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="风险类型"
              allowClear
              style={{ width: 140 }}
              value={filterRiskType || undefined}
              onChange={setFilterRiskType}
            >
              {Object.entries(RISK_TYPE_LABELS).map(([key, label]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
            <Select
              placeholder="处理状态"
              allowClear
              style={{ width: 120 }}
              value={filterStatus || undefined}
              onChange={setFilterStatus}
            >
              {Object.entries(RISK_STATUS_LABELS).map(([key, label]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
          </Space>
        }
      >
        {state.risks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <FileSearchOutlined style={{ fontSize: 48, color: '#999' }} />
            <p style={{ marginTop: 16, color: '#666' }}>
              暂无风险记录，请点击"执行风险检查"按钮开始检查
            </p>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredRisks}
            rowKey="id"
            scroll={{ x: 1200 }}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
              defaultPageSize: 20
            }}
          />
        )}
      </Card>

      <Card 
        size="small" 
        title="风险类型说明" 
        style={{ marginTop: 16 }}
      >
        <Row gutter={16}>
          <Col span={6}>
            <Space direction="vertical">
              <Tag color="error"><strong>缺文件</strong></Tag>
              <span style={{ fontSize: 12, color: '#666' }}>
                记录缺少扫描文件名，可能存在漏扫情况
              </span>
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical">
              <Tag color="warning"><strong>重复编号</strong></Tag>
              <span style={{ fontSize: 12, color: '#666' }}>
                同一底片盒和张号出现多条记录，可能存在重名问题
              </span>
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical">
              <Tag color="orange"><strong>分辨率不足</strong></Tag>
              <span style={{ fontSize: 12, color: '#666' }}>
                扫描分辨率低于设置的最低要求({state.settings.minResolution} DPI)
              </span>
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical">
              <Tag color="magenta"><strong>已修复未生成交付图</strong></Tag>
              <span style={{ fontSize: 12, color: '#666' }}>
                已标记为修复完成，但未找到对应的交付图片文件
              </span>
            </Space>
          </Col>
        </Row>
      </Card>

      <Modal
        title="处理风险"
        open={isHandleModalOpen}
        onOk={saveHandle}
        onCancel={() => setIsHandleModalOpen(false)}
        width={600}
      >
        {handlingRisk && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <p><strong>风险类型:</strong> {getRiskTypeTag(handlingRisk.riskType)}</p>
              <p><strong>记录编号:</strong> {getRecordInfo(handlingRisk.recordId).uniqueId}</p>
              <p><strong>描述:</strong> {handlingRisk.description}</p>
            </Card>

            <Form
              form={form}
              layout="vertical"
              initialValues={{
                status: RISK_STATUS.RESOLVED
              }}
            >
              <Form.Item
                label="处理状态"
                name="status"
                rules={[{ required: true, message: '请选择处理状态' }]}
              >
                <Select>
                  <Option value={RISK_STATUS.RESOLVED}>
                    <Space><CheckCircleOutlined style={{ color: '#52c41a' }} /> 已解决</Space>
                  </Option>
                  <Option value={RISK_STATUS.CONFIRMED}>
                    <Space><WarningOutlined style={{ color: '#1890ff' }} /> 确认问题</Space>
                  </Option>
                  <Option value={RISK_STATUS.IGNORED}>
                    <Space><CloseCircleOutlined /> 忽略此风险</Space>
                  </Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="处理人"
                name="handler"
                rules={[{ required: true, message: '请输入处理人姓名' }]}
              >
                <Input placeholder="请输入处理人姓名" />
              </Form.Item>

              {handlingRisk.riskType === RISK_TYPE.LOW_RESOLUTION && (
                <Form.Item
                  label="实际分辨率 (DPI)"
                  name="newResolution"
                >
                  <Input.Number min={72} max={1200} style={{ width: '100%' }} placeholder="如果实际分辨率不同，请填写" />
                </Form.Item>
              )}

              {handlingRisk.riskType === RISK_TYPE.MISSING_FILE && (
                <Form.Item
                  label="扫描文件名"
                  name="scanFile"
                >
                  <Input placeholder="补充扫描文件名" />
                </Form.Item>
              )}

              {handlingRisk.riskType === RISK_TYPE.REPAIRED_NO_DELIVERY && (
                <Form.Item
                  label="交付文件名"
                  name="deliveryFile"
                >
                  <Input placeholder="补充交付文件名" />
                </Form.Item>
              )}

              <Form.Item
                label="处理备注"
                name="handleNotes"
              >
                <TextArea rows={3} placeholder="请输入处理说明" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default RiskPage;
