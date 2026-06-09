import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu, Button, Table, Tag, Space, Input, Select, DatePicker, Modal, Form, InputNumber, message, Drawer, Tabs, Timeline, Card, Descriptions, Tooltip, Divider, Popover, Alert } from 'antd';
import { PlusOutlined, SearchOutlined, HistoryOutlined, ExportOutlined, ReloadOutlined, EyeOutlined, EditOutlined, SafetyCertificateOutlined, WarningOutlined, FileSearchOutlined, RollbackOutlined, FilterOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas';
import { reportAPI, partsAPI, modelAPI, exportAPI } from './api';

const { Header, Content, Sider } = Layout;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const STATUS_OPTIONS = ['待复核', '复核中', '有风险', '已通过', '需补录', '已驳回'];
const RISK_COLORS = { '高': 'red', '中': 'orange', '低': 'green' };
const STATUS_COLORS = { '待复核': 'default', '复核中': 'processing', '有风险': 'warning', '已通过': 'success', '需补录': 'warning', '已驳回': 'error' };
const ARRIVAL_STATUS_OPTIONS = ['待确认', '未到货', '已发货', '已到货', '到货晚于停机窗口'];
const ARRIVAL_COLORS = { '待确认': 'default', '未到货': 'warning', '已发货': 'processing', '已到货': 'success', '到货晚于停机窗口': 'error' };

function ExportCard({ data, traceId }) {
  const { report, parts, replacements, audits, snapshots, filters } = data;
  const riskParts = parts.filter(p => p.arrival_status === '到货晚于停机窗口');
  const pendingParts = parts.filter(p => ['待确认', '未到货'].includes(p.arrival_status));

  return (
    <div className="export-card" id="export-card" style={{ width: 900, margin: '0 auto', background: '#fff' }}>
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: '#0a3d91' }}>盾构刀盘报告复核说明</h1>
          <div style={{ marginTop: 8, color: '#666' }}>
            报告编号：<strong style={{ color: '#0a3d91' }}>{report.report_no}</strong>
            &nbsp;&nbsp;|&nbsp;&nbsp; 追溯号：<strong style={{ color: '#d4380d' }}>{traceId}</strong>
          </div>
        </div>
        <div>
          <Tag color={STATUS_COLORS[report.current_status]} style={{ fontSize: 14, padding: '4px 12px' }}>{report.current_status}</Tag>
          <span className="risk-tag" style={{ background: RISK_COLORS[report.risk_level], color: '#fff' }}>风险 {report.risk_level}</span>
        </div>
      </div>

      <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
        <Descriptions.Item label="项目名称">{report.project_name}</Descriptions.Item>
        <Descriptions.Item label="盾构机号">{report.shield_no}</Descriptions.Item>
        <Descriptions.Item label="刀盘编号">{report.cutter_disc_no || '-'}</Descriptions.Item>
        <Descriptions.Item label="复核人">{report.reviewer}</Descriptions.Item>
        <Descriptions.Item label="停机窗口" span={2}>
          {report.shutdown_window_start || '-'} ~ {report.shutdown_window_end || '-'}
        </Descriptions.Item>
      </Descriptions>

      <div className="section-title">复核结论</div>
      <div style={{ padding: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, lineHeight: 1.8 }}>
        <strong>结论：</strong>{report.current_conclusion || '（无）'}
        {snapshots && snapshots[0] && snapshots[0].change_reason && (
          <div style={{ marginTop: 8, color: '#555', fontSize: 13 }}>
            <strong>改判原因：</strong>{snapshots[0].change_reason}
          </div>
        )}
      </div>

      <div className="section-title">风险摘要</div>
      <div className="summary-grid">
        <div className="summary-item">
          <div style={{ color: '#888', fontSize: 12 }}>备件总数</div>
          <div style={{ fontSize: 22, fontWeight: 'bold' }}>{parts.length} <span style={{ fontSize: 13, color: '#888' }}>项</span></div>
        </div>
        <div className="summary-item" style={{ background: '#fff7e6' }}>
          <div style={{ color: '#888', fontSize: 12 }}>待确认/未到货</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: '#fa8c16' }}>{pendingParts.length} <span style={{ fontSize: 13 }}>项</span></div>
        </div>
        <div className="summary-item" style={{ background: '#fff1f0' }}>
          <div style={{ color: '#888', fontSize: 12 }}>到货晚于窗口 ⚠️</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: '#ff4d4f' }}>{riskParts.length} <span style={{ fontSize: 13 }}>项</span></div>
        </div>
        <div className="summary-item" style={{ background: '#e6f7ff' }}>
          <div style={{ color: '#888', fontSize: 12 }}>型号替换记录</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: '#1890ff' }}>{replacements.length} <span style={{ fontSize: 13 }}>次</span></div>
        </div>
      </div>

      <div className="section-title">关键备件清单</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }} border="1" cellPadding="6">
        <thead style={{ background: '#f0f5ff' }}>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>备件名称</th>
            <th>型号规格</th>
            <th style={{ width: 60 }}>数量</th>
            <th>到货状态</th>
            <th>预计到货</th>
            <th>来源批次</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p, i) => (
            <tr key={i} style={p.arrival_status === '到货晚于停机窗口' ? { background: '#fff1f0' } : {}}>
              <td align="center">{p.source_line_no || i + 1}</td>
              <td>{p.part_name}</td>
              <td>{p.model_spec}</td>
              <td align="center">{p.quantity}</td>
              <td>{p.arrival_status}</td>
              <td>{p.estimated_arrival || '-'}</td>
              <td>批次{p.batch_no} v{p.version}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {replacements.length > 0 && (
        <>
          <div className="section-title">型号替换说明</div>
          {replacements.map((r, i) => (
            <div key={i} style={{ padding: 10, marginBottom: 8, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4, fontSize: 13 }}>
              <div><strong>替换 #{i + 1}：</strong>
                <span style={{ textDecoration: 'line-through', color: '#999' }}>{r.original_model}</span>
                &nbsp; → &nbsp;
                <span style={{ color: '#d4380d', fontWeight: 'bold' }}>{r.new_model}</span>
              </div>
              <div style={{ marginTop: 4, color: '#555' }}>
                来源行号：{r.affected_line_nos || '无'} &nbsp;|&nbsp; 影响范围：{r.affected_scope || '待评估'}
              </div>
              <div style={{ marginTop: 4, color: '#555' }}>原因：{r.replacement_reason || '-'}</div>
            </div>
          ))}
        </>
      )}

      <div style={{ marginTop: 24, borderTop: '1px dashed #ccc', paddingTop: 12, fontSize: 12, color: '#888', display: 'flex', justifyContent: 'space-between' }}>
        <div>导出时间：{new Date().toLocaleString('zh-CN')} &nbsp;|&nbsp; 操作人：阿敏（维保主管）</div>
        <div>筛选条件：{filters ? JSON.stringify(filters).replace(/"/g, '') : '（无）'}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [filters, setFilters] = useState({ status: '全部', risk_level: '全部', keyword: '' });
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [partsModal, setPartsModal] = useState(false);
  const [replaceModal, setReplaceModal] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [traceRestoreModal, setTraceRestoreModal] = useState(false);
  const [traceInput, setTraceInput] = useState('');
  const [lastTraceId, setLastTraceId] = useState('');
  const [exportList, setExportList] = useState([]);

  const [partsForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [replaceForm] = Form.useForm();
  const [newParts, setNewParts] = useState([{ part_name: '', model_spec: '', quantity: 1, arrival_status: '待确认', estimated_arrival: '' }]);

  const cardRef = useRef(null);

  useEffect(() => { loadReports(); loadExports(); }, []);

  function loadReports() {
    setLoading(true);
    reportAPI.list(filters).then(r => { if (r.code === 0) setReports(r.data); }).finally(() => setLoading(false));
  }

  function loadExports() { exportAPI.list().then(r => { if (r.code === 0) setExportList(r.data); }); }

  function loadDetail(id) {
    reportAPI.get(id).then(r => {
      if (r.code === 0) {
        setDetailData(r.data);
        setSelectedReport(r.data.report);
        setDetailDrawer(true);
      } else message.error(r.message);
    });
  }

  function handleReviewSubmit() {
    reviewForm.validateFields().then(values => {
      reportAPI.review(selectedReport.id, values).then(r => {
        if (r.code === 0) {
          message.success(r.data.message);
          setReviewModal(false); reviewForm.resetFields();
          loadDetail(selectedReport.id); loadReports();
        } else message.error(r.message);
      });
    });
  }

  function handlePartsSubmit() {
    const submitted = newParts.map(p => ({ ...p, _action: p.id ? 'update' : 'create' })).filter(p => p.part_name || p.id);
    if (submitted.length === 0) return message.warning('请至少填写一条备件');
    const values = partsForm.getFieldsValue();
    partsAPI.submit(selectedReport.id, { parts: submitted, batchRemark: values.batchRemark }).then(r => {
      if (r.code === 0) {
        message.success(r.data.message);
        setPartsModal(false); partsForm.resetFields();
        setNewParts([{ part_name: '', model_spec: '', quantity: 1, arrival_status: '待确认', estimated_arrival: '' }]);
        loadDetail(selectedReport.id); loadReports();
      } else message.error(r.message);
    });
  }

  function handleReplaceSubmit() {
    replaceForm.validateFields().then(values => {
      modelAPI.replace(selectedReport.id, values).then(r => {
        if (r.code === 0) {
          message.success(r.data.message);
          setReplaceModal(false); replaceForm.resetFields();
          loadDetail(selectedReport.id); loadReports();
        } else message.error(r.message);
      });
    });
  }

  async function handleExport() {
    const exportFilters = { ...filters, report_id: selectedReport?.id };
    const r = await exportAPI.create({ report_id: selectedReport?.id, filter_conditions: exportFilters, export_type: '复核说明截图', remark: '人工导出' });
    if (r.code !== 0) return message.error('保存导出记录失败');
    const traceId = r.data.trace_id;
    setLastTraceId(traceId);
    loadExports();

    await new Promise(res => setTimeout(res, 100));
    const card = document.getElementById('export-card');
    if (!card) return;
    try {
      message.loading({ content: '正在生成截图...', key: 'exp', duration: 0 });
      const canvas = await html2canvas(card, { scale: 2, useCORS: true, backgroundColor: '#fff' });
      const link = document.createElement('a');
      link.download = `刀盘复核说明_${selectedReport?.report_no || '汇总'}_${traceId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      message.success({ content: `截图已导出，追溯号：${traceId}`, key: 'exp' });
    } catch (e) {
      message.error({ content: '截图生成失败', key: 'exp' });
      console.error(e);
    }
  }

  function handleRestoreTrace() {
    if (!traceInput.trim()) return message.warning('请输入追溯号');
    exportAPI.getByTrace(traceInput.trim()).then(r => {
      if (r.code !== 0) return message.error(r.message || '追溯号不存在');
      const fc = r.data.filter_conditions || {};
      setFilters({ status: fc.status || '全部', risk_level: fc.risk_level || '全部', keyword: fc.keyword || '' });
      if (fc.report_id) {
        loadDetail(fc.report_id);
      } else {
        loadReports();
      }
      message.success(`已还原 ${r.data.exported_at} 导出时的筛选条件`);
      setTraceRestoreModal(false); setTraceInput('');
    });
  }

  const reportColumns = [
    { title: '报告编号', dataIndex: 'report_no', width: 150, fixed: 'left', render: t => <a onClick={() => loadDetail(reports.find(r => r.report_no === t).id)}><strong>{t}</strong></a> },
    { title: '项目名称', dataIndex: 'project_name', width: 200 },
    { title: '盾构机号', dataIndex: 'shield_no', width: 100 },
    { title: '刀盘编号', dataIndex: 'cutter_disc_no', width: 110 },
    { title: '停机窗口', width: 240, render: (_, r) => <span style={{ fontSize: 12 }}>{r.shutdown_window_start}<br/>~ {r.shutdown_window_end}</span> },
    { title: '风险等级', dataIndex: 'risk_level', width: 90, render: v => <Tag color={RISK_COLORS[v]}>风险{v}</Tag> },
    { title: '当前状态', dataIndex: 'current_status', width: 100, render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: '复核人', dataIndex: 'reviewer', width: 130 },
    { title: '更新时间', dataIndex: 'updated_at', width: 160 },
    { title: '操作', width: 150, fixed: 'right', render: (_, r) => (
      <Space>
        <Button size="small" icon={<EyeOutlined />} onClick={() => loadDetail(r.id)}>查看</Button>
        <Button size="small" type="primary" icon={<EditOutlined />} onClick={() => { setSelectedReport(r); loadDetail(r.id); setTimeout(() => setReviewModal(true), 300); }}>改判</Button>
      </Space>
    )}
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#0a3d91', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
        <SafetyCertificateOutlined style={{ fontSize: 24, color: '#fff' }} />
        <span style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 12 }}>盾构刀盘报告复核系统</span>
        <span style={{ color: '#91caff', marginLeft: 12, fontSize: 12 }}>维保主管 · 阿敏工作台</span>
        <div style={{ marginLeft: 'auto' }}>
          <Space>
            <Button icon={<FilterOutlined />} onClick={() => setTraceRestoreModal(true)}>按追溯号还原</Button>
            <Button type="primary" icon={<ExportOutlined />} onClick={() => { if (!selectedReport) message.warning('请先选择一份报告'); else setExportModal(true); }}>导出复核说明</Button>
            <Button icon={<PlusOutlined />} type="default" onClick={() => message.info('创建报告：可在实际部署中扩展表单弹窗，当前演示模式已预置2份报告')}>新建报告</Button>
          </Space>
        </div>
      </Header>

      <Layout>
        <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #e8e8e8' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #e8e8e8' }}>
            <div style={{ color: '#888', fontSize: 12 }}>最近导出追溯号</div>
            <div style={{ marginTop: 8, color: '#d4380d', fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
              {lastTraceId || '（尚未导出）'}
            </div>
          </div>
          <Menu mode="inline" defaultSelectedKeys={['list']} style={{ border: 'none' }}>
            <Menu.Item key="list" icon={<FileSearchOutlined />}>报告列表</Menu.Item>
            <Menu.Item key="history" icon={<HistoryOutlined />}>
              审计历史
              <div style={{ fontSize: 11, color: '#999', paddingLeft: 4 }}>每次改判留痕可查</div>
            </Menu.Item>
            <Menu.Item key="export" icon={<ExportOutlined />}>导出记录（{exportList.length}）</Menu.Item>
          </Menu>
          <div style={{ padding: 16, fontSize: 12, color: '#888', lineHeight: 1.8, position: 'absolute', bottom: 0, width: '100%', background: '#fafafa' }}>
            <div><strong>📌 核心机制</strong></div>
            <div>✓ 备件版本化，不覆盖旧数据</div>
            <div>✓ 每次改判写入审计表</div>
            <div>✓ 结论变更自动快照</div>
            <div>✓ 导出带追溯号，可还原</div>
          </div>
        </Sider>

        <Layout style={{ padding: 16 }}>
          <Content>
            <Card size="small" style={{ marginBottom: 12 }}>
              <Space wrap>
                <Input allowClear prefix={<SearchOutlined />} placeholder="报告号/项目/盾构机号" style={{ width: 260 }}
                  value={filters.keyword} onChange={e => setFilters({ ...filters, keyword: e.target.value })} onPressEnter={loadReports} />
                <Select style={{ width: 140 }} value={filters.status} onChange={v => setFilters({ ...filters, status: v })}>
                  {['全部', ...STATUS_OPTIONS].map(s => <Option key={s} value={s}>状态：{s}</Option>)}
                </Select>
                <Select style={{ width: 120 }} value={filters.risk_level} onChange={v => setFilters({ ...filters, risk_level: v })}>
                  {['全部', '高', '中', '低'].map(s => <Option key={s} value={s}>风险{s === '全部' ? '全部' : s}</Option>)}
                </Select>
                <Button type="primary" onClick={loadReports}>筛选</Button>
                <Button icon={<ReloadOutlined />} onClick={() => { setFilters({ status: '全部', risk_level: '全部', keyword: '' }); setTimeout(loadReports, 0); }}>重置</Button>
                <Alert type="info" showIcon style={{ border: 'none', padding: '0 8px', background: 'transparent' }}
                  message={<span style={{ fontSize: 12 }}>当前筛选条件会随导出一起保存，使用追溯号可一键还原</span>} />
              </Space>
            </Card>

            <Table
              size="small"
              rowKey="id"
              loading={loading}
              columns={reportColumns}
              dataSource={reports}
              scroll={{ x: 1400 }}
              pagination={{ pageSize: 8, showSizeChanger: false, showTotal: t => `共 ${t} 份报告` }}
              onRow={r => ({ onClick: () => loadDetail(r.id) })}
            />

            <Card size="small" title={<span><HistoryOutlined /> 最近导出记录（点击追溯号可还原筛选）</span>} style={{ marginTop: 16 }}>
              <Table size="small" rowKey="id" dataSource={exportList.slice(0, 5)} pagination={false}>
                <Table.Column title="追溯号" dataIndex="trace_id" width={200}
                  render={t => <a style={{ fontFamily: 'monospace', color: '#d4380d' }} onClick={() => { setTraceInput(t); handleRestoreTrace(); }}><LinkOutlined /> {t}</a>} />
                <Table.Column title="导出类型" dataIndex="export_type" width={120} />
                <Table.Column title="关联报告" dataIndex="report_id" width={120} render={id => id ? reports.find(r => r.id === id)?.report_no || id : '汇总'} />
                <Table.Column title="筛选条件快照" dataIndex="filter_conditions" render={fc => <code style={{ fontSize: 11, color: '#666' }}>{JSON.stringify(fc).replace(/"/g, '')}</code>} />
                <Table.Column title="导出时间" dataIndex="exported_at" width={180} />
                <Table.Column title="操作人" dataIndex="export_by" width={150} />
              </Table>
            </Card>
          </Content>
        </Layout>
      </Layout>

      <Drawer title={<span><FileSearchOutlined /> 报告复核详情 &nbsp;
        {selectedReport && <Tag color={STATUS_COLORS[selectedReport.current_status]}>{selectedReport.current_status}</Tag>}
        {selectedReport && <Tag color={RISK_COLORS[selectedReport.risk_level]}>风险{selectedReport.risk_level}</Tag>}
      </span>} width={1100} open={detailDrawer} onClose={() => setDetailDrawer(false)}
        extra={
          <Space>
            <Button icon={<PlusOutlined />} onClick={() => { partsForm.resetFields(); setNewParts([{ part_name: '', model_spec: '', quantity: 1, arrival_status: '待确认', estimated_arrival: '' }]); setPartsModal(true); }}>补录备件/第N批次</Button>
            <Button icon={<SafetyCertificateOutlined />} type="default" onClick={() => { replaceForm.resetFields(); setReplaceModal(true); }}>型号替换</Button>
            <Button icon={<EditOutlined />} type="primary" onClick={() => { reviewForm.resetFields(); setReviewModal(true); }}>改判/复核</Button>
            <Button icon={<ExportOutlined />} type="primary" ghost onClick={() => setExportModal(true)}>导出说明</Button>
          </Space>
        }>
        {detailData && (
          <Tabs items={[
            {
              key: 'base',
              label: '📋 基本信息 & 备件清单',
              children: (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Descriptions column={3} bordered size="small" title="报告基本信息">
                    <Descriptions.Item label="报告编号">{detailData.report.report_no}</Descriptions.Item>
                    <Descriptions.Item label="项目">{detailData.report.project_name}</Descriptions.Item>
                    <Descriptions.Item label="盾构机">{detailData.report.shield_no}</Descriptions.Item>
                    <Descriptions.Item label="刀盘编号">{detailData.report.cutter_disc_no || '-'}</Descriptions.Item>
                    <Descriptions.Item label="复核人">{detailData.report.reviewer}</Descriptions.Item>
                    <Descriptions.Item label="风险等级"><Tag color={RISK_COLORS[detailData.report.risk_level]}>{detailData.report.risk_level}</Tag></Descriptions.Item>
                    <Descriptions.Item label="停机窗口起始" span={3}>{detailData.report.shutdown_window_start} ~ {detailData.report.shutdown_window_end}</Descriptions.Item>
                    <Descriptions.Item label="当前结论" span={3}>
                      <div style={{ padding: 8, background: '#e6f7ff', borderRadius: 4, lineHeight: 1.8 }}>{detailData.report.current_conclusion}</div>
                    </Descriptions.Item>
                    <Descriptions.Item label="备注" span={3}>{detailData.report.remark || '（无）'}</Descriptions.Item>
                  </Descriptions>

                  <Card size="small"
                    title={<span>备件清单（{detailData.parts.length}项，版本化存储）
                      <Tooltip title="修改备件不会覆盖旧版本，每次修改都会升级 version；不同批次使用 batch_no 区分">
                        <WarningOutlined style={{ color: '#faad14', marginLeft: 8 }} />
                      </Tooltip>
                    </span>}
                    extra={<Button size="small" type="link" onClick={async () => {
                      const r = await reportAPI.partsHistory(detailData.report.id);
                      if (r.code === 0) {
                        Modal.info({
                          width: 900,
                          title: `备件完整历史（共${r.data.length}条版本记录，按批次+版本递增）`,
                          content: <Table size="small" rowKey="id" dataSource={r.data} pagination={false}
                            columns={[
                              { title: '批次', dataIndex: 'batch_no', width: 60, render: v => <Tag color="blue">批次{v}</Tag> },
                              { title: '版本', dataIndex: 'version', width: 60, render: v => `v${v}` },
                              { title: '是否最新', dataIndex: 'is_latest', width: 80, render: v => v ? <Tag color="green">当前</Tag> : <Tag>历史</Tag> },
                              { title: '备件名称', dataIndex: 'part_name' },
                              { title: '型号规格', dataIndex: 'model_spec' },
                              { title: '数量', dataIndex: 'quantity', width: 60 },
                              { title: '到货状态', dataIndex: 'arrival_status', render: v => <Tag color={ARRIVAL_COLORS[v] || 'default'}>{v}</Tag> },
                              { title: '来源行', dataIndex: 'source_line_no', width: 70 },
                              { title: '创建时间', dataIndex: 'created_at', width: 160 }
                            ]} />
                        });
                      }
                    }}>查看完整版本历史</Button>}>
                    <Table size="small" rowKey="id" dataSource={detailData.parts} pagination={false}
                      columns={[
                        { title: '行号', dataIndex: 'source_line_no', width: 60 },
                        { title: '批次/版本', width: 110, render: (_, r) => <Space direction="vertical" size={0}><Tag color="purple">批次{r.batch_no}</Tag><span style={{ fontSize: 11, color: '#888' }}>版本 v{r.version}</span></Space> },
                        { title: '备件名称', dataIndex: 'part_name' },
                        { title: '型号规格', dataIndex: 'model_spec', render: (v, r) => r.remark?.includes('[型号替换]') ? <span style={{ color: '#d4380d' }}>{v}</span> : v },
                        { title: '数量', dataIndex: 'quantity', width: 60 },
                        { title: '到货状态', dataIndex: 'arrival_status', width: 140, render: v => <Tag color={ARRIVAL_COLORS[v] || 'default'}>{v}</Tag> },
                        { title: '预计到货', dataIndex: 'estimated_arrival', width: 120 },
                        { title: '操作', width: 140, render: (_, r) => (
                          <Space>
                            <Button size="small" onClick={() => {
                              setNewParts([{ ...r, _action: 'update' }]);
                              partsForm.setFieldsValue({ batchRemark: `手动更新：${r.part_name}` });
                              setPartsModal(true);
                            }}>更新</Button>
                            <Button size="small" danger onClick={() => Modal.confirm({
                              title: '软删除备件？', content: '历史版本将保留，仅标记为删除，可在完整历史中查看',
                              onOk: () => {
                                partsAPI.submit(detailData.report.id, { parts: [{ id: r.id, _action: 'delete' }], batchRemark: `删除：${r.part_name}` }).then(res => {
                                  if (res.code === 0) { message.success('已删除（历史可查）'); loadDetail(detailData.report.id); loadReports(); }
                                });
                              }
                            })}>删除</Button>
                          </Space>
                        )}
                      ]} />
                  </Card>
                </Space>
              )
            },
            {
              key: 'replace',
              label: '🔄 型号替换记录（影响范围+来源行）',
              children: detailData.replacements.length === 0 ? <EmptyTip text="暂无型号替换，点击右上角「型号替换」可登记，系统会自动记录原型号、新型号、影响范围、来源行号" /> : (
                <Table size="small" rowKey="id" dataSource={detailData.replacements} pagination={false}
                  columns={[
                    { title: '登记时间', dataIndex: 'created_at', width: 170 },
                    { title: '原型号', dataIndex: 'original_model', render: v => <span style={{ textDecoration: 'line-through', color: '#999' }}>{v}</span> },
                    { title: '新型号', dataIndex: 'new_model', render: v => <span style={{ color: '#d4380d', fontWeight: 'bold' }}>{v}</span> },
                    { title: '来源行号', dataIndex: 'affected_line_nos', width: 120 },
                    { title: '影响范围', dataIndex: 'affected_scope' },
                    { title: '替换原因', dataIndex: 'replacement_reason' },
                    { title: '审批', dataIndex: 'approved_by', width: 120 },
                  ]} />
              )
            },
            {
              key: 'snapshot',
              label: '📸 结论快照（历史版本对比）',
              children: detailData.snapshots.length === 0 ? <EmptyTip text="暂无结论快照，首次「改判」操作时会自动快照旧材料、新备注与改判原因" /> : (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {detailData.snapshots.map((s, i) => (
                    <Card key={s.id} size="small"
                      title={<span>v{s.version} · {s.created_at} · by {s.operator}
                        {i === 0 && <Tag color="green" style={{ marginLeft: 8 }}>当前版本</Tag>}
                      </span>}
                      style={{ borderLeft: `4px solid ${i === 0 ? '#52c41a' : '#d9d9d9'}` }}>
                      <Alert type={i === 0 ? 'success' : 'info'} showIcon message={<strong>结论：</strong>{s.conclusion}} style={{ marginBottom: 8 }} />
                      <Alert type="warning" showIcon message={<strong>改判原因：</strong>{s.change_reason}} style={{ marginBottom: 8 }} />
                      {s.old_materials_snapshot && (() => {
                        let parts; try { parts = JSON.parse(s.old_materials_snapshot); } catch (e) { parts = []; }
                        return (
                          <div>
                            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>📦 当时的备件材料快照（共{parts.length}项）：</div>
                            <div style={{ maxHeight: 200, overflow: 'auto', background: '#fafafa', padding: 8, borderRadius: 4 }}>
                              {parts.map((p, j) => (
                                <div key={j} style={{ fontSize: 12, padding: '3px 0', borderBottom: j < parts.length - 1 ? '1px dashed #eee' : 'none' }}>
                                  <span style={{ color: '#666' }}>[{j + 1}]</span> {p.part_name} <span style={{ color: '#1890ff' }}>{p.model_spec}</span>
                                  &nbsp;×{p.quantity} &nbsp;
                                  <Tag color={ARRIVAL_COLORS[p.arrival_status] || 'default'} style={{ fontSize: 10 }}>{p.arrival_status}</Tag>
                                  {p.estimated_arrival && <span style={{ color: '#888' }}> 预计:{p.estimated_arrival}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </Card>
                  ))}
                </Space>
              )
            },
            {
              key: 'audit',
              label: '🕓 审计追踪（每次操作来源可查）',
              children: (
                <Timeline
                  mode="left"
                  items={detailData.audits.map(a => ({
                    color: a.action_type.includes('改判') ? 'red' : a.action_type.includes('补录') || a.action_type.includes('更新') ? 'blue' : a.action_type.includes('删除') ? 'gray' : 'green',
                    label: <div style={{ fontSize: 11, color: '#888' }}>{a.operated_at}<br /><Tag color="purple" style={{ fontSize: 10, marginTop: 4 }}>{a.operator}</Tag>{a.batch_no && <Tag style={{ fontSize: 10, marginTop: 4 }}>批次{a.batch_no}</Tag>}</div>,
                    children: (
                      <Card size="small" style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 'bold', color: '#0a3d91', marginBottom: 4 }}>{a.action_type}</div>
                        {a.field_name && <div style={{ fontSize: 12, color: '#666' }}>字段：<code>{a.field_name}</code></div>}
                        {(a.old_value !== null && a.old_value !== undefined) && (
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            <Tooltip title="修改前的值"><span style={{ textDecoration: 'line-through', color: '#999', background: '#f5f5f5', padding: '2px 6px', borderRadius: 2 }}>旧：{a.old_value}</span></Tooltip>
                            &nbsp; → &nbsp;
                            <Tooltip title="修改后的值"><span style={{ color: '#d4380d', background: '#fff1f0', padding: '2px 6px', borderRadius: 2 }}>新：{a.new_value}</span></Tooltip>
                          </div>
                        )}
                        {a.change_reason && <div style={{ fontSize: 12, marginTop: 6, color: '#555', padding: '4px 8px', background: '#fffbe6', borderRadius: 2 }}>💡 {a.change_reason}</div>}
                      </Card>
                    )
                  }))}
                />
              )
            }
          ]} />
        )}
      </Drawer>

      <Modal title="改判 / 复核结论" open={reviewModal} onCancel={() => setReviewModal(false)} onOk={handleReviewSubmit} width={600} okText="确认改判（将记录审计+快照）">
        <Form form={reviewForm} layout="vertical">
          <Form.Item label="新状态" name="new_status" rules={[{ required: true, message: '请选择状态' }]} initialValue={selectedReport?.current_status}>
            <Select>
              {STATUS_OPTIONS.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="风险等级" name="risk_level" initialValue={selectedReport?.risk_level}>
            <Select>
              <Option value="高">高（红色预警）</Option>
              <Option value="中">中（常规关注）</Option>
              <Option value="低">低（无风险）</Option>
            </Select>
          </Form.Item>
          <Form.Item label="新结论" name="new_conclusion" rules={[{ required: true, message: '请填写复核结论' }]}>
            <TextArea rows={3} placeholder="例：备件到货情况已核实，保径刀到货晚于停机窗口，建议调整施工顺序或启动应急预案" />
          </Form.Item>
          <Form.Item label="改判原因" name="change_reason" rules={[{ required: true, message: '改判原因必填，将写入审计记录' }]}
            extra={<span style={{ color: '#d4380d' }}>⚠️ 此原因将永久保存在审计日志与结论快照中，不可修改</span>}>
            <TextArea rows={3} placeholder="例：第2批次备件补录完成后重新评估，发现保径刀预计6月20日到货，晚于6月15-17日停机窗口" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={selectedReport ? `补录备件（将创建新的批次，不覆盖旧数据）` : ''} open={partsModal} onCancel={() => setPartsModal(false)} onOk={handlePartsSubmit} width={900} okText="提交本批次">
        <Form form={partsForm} layout="vertical">
          <Form.Item label="本批次备注（如：第2批补录，来自2026-06-11供应商邮件）" name="batchRemark">
            <Input placeholder="选填，但建议说明本批来源" />
          </Form.Item>
          <div style={{ maxHeight: 400, overflow: 'auto', padding: 8, background: '#fafafa', borderRadius: 4 }}>
            <Table size="small" rowKey={(r, i) => r.id || `new-${i}`} dataSource={newParts} pagination={false}
              columns={[
                { title: '备件名称', dataIndex: 'part_name', render: (v, r, i) => <Input value={v} onChange={e => updatePart(i, 'part_name', e.target.value)} placeholder="必填" /> },
                { title: '型号规格', dataIndex: 'model_spec', render: (v, r, i) => <Input value={v} onChange={e => updatePart(i, 'model_spec', e.target.value)} placeholder="必填" /> },
                { title: '数量', dataIndex: 'quantity', width: 80, render: (v, r, i) => <InputNumber min={1} value={v} onChange={n => updatePart(i, 'quantity', n)} style={{ width: '100%' }} /> },
                { title: '到货状态', dataIndex: 'arrival_status', width: 150, render: (v, r, i) => <Select value={v} onChange={n => updatePart(i, 'arrival_status', n)}>{ARRIVAL_STATUS_OPTIONS.map(a => <Option key={a} value={a}>{a}</Option>)}</Select> },
                { title: '预计到货', dataIndex: 'estimated_arrival', width: 140, render: (v, r, i) => <Input value={v} onChange={e => updatePart(i, 'estimated_arrival', e.target.value)} placeholder="YYYY-MM-DD" /> },
                { title: '来源行号', dataIndex: 'source_line_no', width: 90, render: (v, r, i) => <InputNumber min={1} value={v} onChange={n => updatePart(i, 'source_line_no', n)} placeholder="对应清单行号" style={{ width: '100%' }} /> },
                { title: '', width: 60, render: (_, r, i) => <Button size="small" danger onClick={() => setNewParts(newParts.filter((_, j) => j !== i))}>删</Button> }
              ]} />
          </div>
          <div style={{ marginTop: 8 }}>
            <Button onClick={() => setNewParts([...newParts, { part_name: '', model_spec: '', quantity: 1, arrival_status: '待确认', estimated_arrival: '' }])}>+ 新增一行</Button>
            <span style={{ marginLeft: 12, fontSize: 12, color: '#888' }}>
              💡 提示：本批次提交后，原备件不会被覆盖，旧版本可在「完整版本历史」中查看
            </span>
          </div>
        </Form>
      </Modal>

      <Modal title="登记型号替换（自动记录影响范围和来源行）" open={replaceModal} onCancel={() => setReplaceModal(false)} onOk={handleReplaceSubmit} width={600} okText="确认替换">
        <Form form={replaceForm} layout="vertical">
          <Form.Item label="关联备件（可选）" name="spare_part_id" extra="如选择，系统会自动为该备件创建新版本，型号替换后不覆盖旧版本">
            <Select allowClear showSearch placeholder="选择备件后将自动更新其版本" optionFilterProp="label">
              {detailData?.parts.map(p => <Option key={p.id} value={p.id} label={p.part_name}>{p.part_name} - {p.model_spec}（行{p.source_line_no}）</Option>)}
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item label="原型号" name="original_model" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="例：φ432×120 标准型" />
            </Form.Item>
            <Form.Item label="新型号" name="new_model" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="例：φ432×120 耐磨加强型" />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item label="来源行号（影响行）" name="affected_line_nos" style={{ flex: 1 }} extra="对应原始清单的行号，可逗号分隔">
              <Input placeholder="例：1,3,5-8" />
            </Form.Item>
            <Form.Item label="影响范围" name="affected_scope" style={{ flex: 1 }} extra="例如：正滚刀全部16把">
              <Input placeholder="描述影响范围" />
            </Form.Item>
          </div>
          <Form.Item label="替换原因" name="replacement_reason" rules={[{ required: true }]}>
            <TextArea rows={2} placeholder="例：原标准型停产，供应商统一改为耐磨加强型，物理尺寸兼容，经技术部确认可替代" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={<span><ExportOutlined /> 导出复核说明（可截图+保留追溯号）</span>} open={exportModal} onCancel={() => setExportModal(false)} width={1000}
        footer={[
          selectedReport && <Button key="info" type="default" onClick={() => {
            Modal.info({ width: 480, title: '追溯号说明', content: (
              <div>
                <p>本次导出会生成一个<strong style={{ color: '#d4380d' }}>追溯号</strong>，它会：</p>
                <ol>
                  <li>出现在截图右上角，供沟通时对方引用</li>
                  <li>连同当时的筛选条件一起存入数据库</li>
                  <li>以后在顶部「按追溯号还原」输入，可一键回到同一批记录</li>
                </ol>
                <p style={{ color: '#888' }}>有效避免：「这张截图是哪天看的？当时筛了什么条件？」</p>
              </div>
            )});
          }}>关于追溯号</Button>,
          <Button key="copy" icon={<LinkOutlined />} onClick={() => { if (lastTraceId) { navigator.clipboard.writeText(lastTraceId); message.success('已复制追溯号：' + lastTraceId); } else message.warning('请先点击「确认导出并截图」生成追溯号'); }}>复制追溯号</Button>,
          <Button key="close" onClick={() => setExportModal(false)}>关闭</Button>,
          <Button key="ok" type="primary" icon={<ExportOutlined />} onClick={handleExport}>确认导出并截图</Button>
        ]}>
        {!selectedReport ? (
          <Alert type="warning" showIcon message="请先从列表中选择一份报告，再导出对应说明" />
        ) : (
          <>
            <Alert type="info" showIcon style={{ marginBottom: 12 }} message={
              <span>下方预览即最终导出效果。导出后会保存追溯号 + 筛选条件快照，之后可一键还原。<br />
              <strong>当前筛选条件：</strong><code style={{ background: '#fffbe6', padding: '2px 6px' }}>{JSON.stringify(filters).replace(/"/g, '')}</code>
              {lastTraceId && <> &nbsp; 上次追溯号：<strong style={{ color: '#d4380d' }}>{lastTraceId}</strong></>}
              </span>
            } />
            <div ref={cardRef} style={{ maxHeight: 560, overflow: 'auto', background: '#f0f2f5', padding: 16 }}>
              <ExportCard data={{ ...detailData, filters }} traceId={lastTraceId || '（导出后自动生成）'} />
            </div>
          </>
        )}
      </Modal>

      <Modal title={<span><RollbackOutlined /> 按追溯号还原筛选</span>} open={traceRestoreModal} onCancel={() => setTraceRestoreModal(false)}
        onOk={handleRestoreTrace} okText="还原筛选和报告" width={520}>
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message={
          <div>
            <p>导出复核说明时，系统会自动记录当时的<strong>筛选条件 + 关联报告ID</strong>，并生成一个追溯号。</p>
            <p>任何时候把追溯号贴入下方，即可<strong style={{ color: '#1890ff' }}>一键还原到当时看到的同一批记录</strong>。</p>
            <p style={{ color: '#888' }}>适用场景：沟通群里发了截图 → 对方要追溯号 → 贴回来立刻回到同样视图</p>
          </div>
        } />
        <Input size="large" value={traceInput} onChange={e => setTraceInput(e.target.value)} placeholder="粘贴追溯号，如：EXP-LY2ABC12DEF"
          prefix={<LinkOutlined />} allowClear onPressEnter={handleRestoreTrace} />
        {exportList.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>或从最近导出中点击：</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {exportList.slice(0, 8).map(e => (
                <Tag key={e.id} style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 12 }} color="blue" onClick={() => setTraceInput(e.trace_id)}>
                  {e.trace_id}
                  <span style={{ color: '#999', marginLeft: 4, fontSize: 10 }}>{e.exported_at?.substring(5, 16)}</span>
                </Tag>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );

  function updatePart(i, k, v) {
    const arr = [...newParts];
    arr[i] = { ...arr[i], [k]: v };
    setNewParts(arr);
  }
}

function EmptyTip({ text }) {
  return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>{text}</div>;
}
