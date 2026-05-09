import React, { useState } from 'react';
import {
  Card,
  Button,
  Space,
  Select,
  DatePicker,
  Radio,
  message,
  Row,
  Col,
  Divider,
  Typography
} from 'antd';
import {
  FileExcelOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

function Reports() {
  const [reportType, setReportType] = useState('inventory');
  const [format, setFormat] = useState('excel');
  const [filters, setFilters] = useState({
    storeId: null,
    lowStock: false,
    startDate: null,
    endDate: null,
    operationType: null
  });
  const [exporting, setExporting] = useState(false);

  const mockStores = [
    { id: 'store-1', name: '总店', code: 'ST001' },
    { id: 'store-2', name: '分店A', code: 'ST002' },
    { id: 'store-3', name: '分店B', code: 'ST003' }
  ];

  const operationTypes = [
    { value: 'CREATE', label: '创建' },
    { value: 'UPDATE', label: '更新' },
    { value: 'ADJUST', label: '调整' },
    { value: 'TRANSFER_IN', label: '调入' },
    { value: 'TRANSFER_OUT', label: '调出' },
    { value: 'PRICE_CHANGE', label: '改价' }
  ];

  const formatIcons = {
    excel: <FileExcelOutlined style={{ color: '#217346' }} />,
    markdown: <FileTextOutlined style={{ color: '#083fa1' }} />,
    pdf: <FilePdfOutlined style={{ color: '#b30b00' }} />
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      let url = '/reports';
      const params = {};

      if (reportType === 'inventory') {
        url += `/inventory/${format}`;
        if (filters.storeId) params.storeId = filters.storeId;
        if (filters.lowStock) params.lowStock = 'true';
      } else if (reportType === 'operations') {
        url += `/operations/excel`;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
        if (filters.operationType) params.operationType = filters.operationType;
      }

      const token = localStorage.getItem('token');
      const response = await api.get(url, {
        params,
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const contentType = response.headers['content-type'];
      let extension = 'bin';
      let filename = `report_${dayjs().format('YYYYMMDD_HHmmss')}`;

      if (contentType.includes('excel') || contentType.includes('spreadsheetml')) {
        extension = 'xlsx';
      } else if (contentType.includes('markdown')) {
        extension = 'md';
      } else if (contentType.includes('pdf')) {
        extension = 'pdf';
      }

      filename += `.${extension}`;

      const blob = new Blob([response.data], { type: contentType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      message.success('导出成功');
    } catch (error) {
      console.error('Export error:', error);
      message.error('导出失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setExporting(false);
    }
  };

  const isExportDisabled = () => {
    if (reportType === 'operations') {
      return !filters.startDate || !filters.endDate || exporting;
    }
    return exporting;
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>报表导出</h2>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="报表配置">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={5} style={{ marginBottom: 8 }}>报表类型</Title>
                <Radio.Group 
                  value={reportType} 
                  onChange={(e) => setReportType(e.target.value)}
                  size="large"
                >
                  <Radio.Button value="inventory">库存报表</Radio.Button>
                  <Radio.Button value="operations">操作日志报表</Radio.Button>
                </Radio.Group>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <div>
                <Title level={5} style={{ marginBottom: 8 }}>导出格式</Title>
                <Radio.Group 
                  value={format} 
                  onChange={(e) => setFormat(e.target.value)}
                  size="large"
                >
                  <Radio.Button value="excel">
                    <Space>
                      {formatIcons.excel}
                      <span>Excel</span>
                    </Space>
                  </Radio.Button>
                  <Radio.Button value="markdown" disabled={reportType === 'operations'}>
                    <Space>
                      {formatIcons.markdown}
                      <span>Markdown</span>
                    </Space>
                  </Radio.Button>
                  <Radio.Button value="pdf" disabled={reportType === 'operations'}>
                    <Space>
                      {formatIcons.pdf}
                      <span>PDF</span>
                    </Space>
                  </Radio.Button>
                </Radio.Group>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <div>
                <Title level={5} style={{ marginBottom: 8 }}>筛选条件</Title>
                
                {reportType === 'inventory' ? (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div>
                      <Text strong>门店筛选（可选）：</Text>
                      <Select
                        placeholder="全部门店"
                        style={{ width: 200, marginLeft: 8 }}
                        allowClear
                        value={filters.storeId}
                        onChange={(value) => setFilters({ ...filters, storeId: value })}
                      >
                        {mockStores.map(store => (
                          <Option key={store.id} value={store.id}>
                            {store.name} ({store.code})
                          </Option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Radio
                        checked={filters.lowStock}
                        onChange={(e) => setFilters({ ...filters, lowStock: e.target.checked })}
                      >
                        仅显示低库存商品（库存 ≤ 最低库存）
                      </Radio>
                    </div>
                  </Space>
                ) : (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div>
                      <Text strong>日期范围：</Text>
                      <RangePicker
                        style={{ marginLeft: 8 }}
                        onChange={(dates) => {
                          if (dates) {
                            setFilters({
                              ...filters,
                              startDate: dates[0].format('YYYY-MM-DD'),
                              endDate: dates[1].format('YYYY-MM-DD')
                            });
                          } else {
                            setFilters({
                              ...filters,
                              startDate: null,
                              endDate: null
                            });
                          }
                        }}
                      />
                      <Text type="secondary" style={{ marginLeft: 8 }}>（必填）</Text>
                    </div>
                    <div>
                      <Text strong>操作类型（可选）：</Text>
                      <Select
                        placeholder="全部类型"
                        style={{ width: 150, marginLeft: 8 }}
                        allowClear
                        value={filters.operationType}
                        onChange={(value) => setFilters({ ...filters, operationType: value })}
                      >
                        {operationTypes.map(type => (
                          <Option key={type.value} value={type.value}>
                            {type.label}
                          </Option>
                        ))}
                      </Select>
                    </div>
                  </Space>
                )}
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined />}
                onClick={handleExport}
                loading={exporting}
                disabled={isExportDisabled()}
                style={{ width: 200 }}
              >
                {exporting ? '导出中...' : '导出报表'}
              </Button>

              {reportType === 'operations' && (!filters.startDate || !filters.endDate) && (
                <Text type="danger">请选择日期范围</Text>
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="格式说明">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Card size="small">
                <Space>
                  {formatIcons.excel}
                  <Text strong>Excel (.xlsx)</Text>
                </Space>
                <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, color: '#666' }}>
                  适合数据分析、进一步处理和打印
                </p>
              </Card>

              <Card size="small">
                <Space>
                  {formatIcons.markdown}
                  <Text strong>Markdown (.md)</Text>
                </Space>
                <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, color: '#666' }}>
                  适合文档记录、版本控制和技术报告
                </p>
              </Card>

              <Card size="small">
                <Space>
                  {formatIcons.pdf}
                  <Text strong>PDF (.pdf)</Text>
                </Space>
                <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, color: '#666' }}>
                  适合正式报告、归档和分发
                </p>
              </Card>
            </Space>
          </Card>

          <Card title="报表内容" style={{ marginTop: 16 }}>
            {reportType === 'inventory' ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>门店编码和名称</li>
                <li>商品SKU、名称和分类</li>
                <li>库存数量和单价</li>
                <li>库存总值计算</li>
                <li>版本号和最后更新时间</li>
                <li>汇总统计（总数量、总价值等）</li>
              </ul>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>操作序号和类型</li>
                <li>相关商品和门店</li>
                <li>变更前后数量对比</li>
                <li>操作人和时间</li>
                <li>操作状态（成功/失败）</li>
                <li>请求ID用于追踪</li>
              </ul>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Reports;
