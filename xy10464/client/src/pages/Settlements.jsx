import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Card,
  Select,
  Row,
  Col,
  Statistic,
  message,
  Spin,
  Modal,
  Descriptions,
  Popconfirm,
  Divider
} from 'antd';
import {
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  CheckOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { settlementsAPI } from '../services/api';

const Settlements = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [settlements, setSettlements] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);

  const currentDate = new Date();
  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

  const loadSettlements = async () => {
    try {
      setLoading(true);
      const response = await settlementsAPI.getAll();
      setSettlements(response.data.map(s => ({ ...s, key: s.id })));
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettlements();
  }, []);

  const handlePreview = async () => {
    if (!selectedMonth || !selectedYear) {
      message.warning('请选择月份和年份');
      return;
    }

    try {
      setPreviewLoading(true);
      const response = await settlementsAPI.getPreview(selectedMonth, selectedYear);
      setPreviewData(response.data);
    } catch (error) {
      message.error('预览失败');
      console.error(error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateSettlement = async () => {
    if (!selectedMonth || !selectedYear) {
      message.warning('请选择月份和年份');
      return;
    }

    try {
      await settlementsAPI.create({
        month: selectedMonth,
        year: selectedYear
      });
      message.success('结算单创建成功');
      setPreviewData(null);
      loadSettlements();
    } catch (error) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const handleSubmitSettlement = async (id) => {
    try {
      await settlementsAPI.submit(id);
      message.success('结算单提交成功');
      loadSettlements();
    } catch (error) {
      message.error(error.response?.data?.error || '提交失败');
    }
  };

  const handleExport = async (id) => {
    try {
      const response = await settlementsAPI.export(id);
      
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlement-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
      console.error(error);
    }
  };

  const columns = [
    {
      title: '结算单编号',
      dataIndex: 'settlement_number',
      key: 'settlement_number',
      render: (text, record) => (
        <a onClick={() => navigate(`/settlements/${record.id}`)}>{text}</a>
      )
    },
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      render: (month, record) => `${record.year}年${month}月`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colorMap = {
          draft: 'blue',
          submitted: 'green'
        };
        const textMap = {
          draft: '草稿',
          submitted: '已提交'
        };
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
      }
    },
    {
      title: '总罚款',
      dataIndex: 'total_fine',
      key: 'total_fine',
      render: (amount) => `¥${amount.toFixed(2)}`
    },
    {
      title: '已减免',
      dataIndex: 'total_exempted',
      key: 'total_exempted',
      render: (amount) => `¥${amount.toFixed(2)}`
    },
    {
      title: '净罚款',
      dataIndex: 'net_fine',
      key: 'net_fine',
      render: (amount) => (
        <span style={{ fontWeight: 'bold', color: amount > 0 ? '#ff4d4f' : '#52c41a' }}>
          ¥{amount.toFixed(2)}
        </span>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/settlements/${record.id}`)}
          >
            详情
          </Button>
          {record.status === 'draft' && (
            <Popconfirm
              title="确认提交此结算单？提交后无法修改关联工单。"
              onConfirm={() => handleSubmitSettlement(record.id)}
              okText="确认提交"
              okType="primary"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
              >
                提交
              </Button>
            </Popconfirm>
          )}
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleExport(record.id)}
          >
            导出
          </Button>
        </Space>
      )
    }
  ];

  const previewColumns = [
    {
      title: '工单编号',
      dataIndex: 'work_order_number',
      key: 'work_order_number'
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      key: 'customer_name'
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '响应罚款',
      key: 'response_fine',
      render: (_, record) => {
        const fine = record.sla?.responseSla?.fine || 0;
        return <span style={{ color: fine > 0 ? '#ff4d4f' : '#52c41a' }}>¥{fine.toFixed(2)}</span>;
      }
    },
    {
      title: '修复罚款',
      key: 'repair_fine',
      render: (_, record) => {
        const fine = record.sla?.repairSla?.fine || 0;
        return <span style={{ color: fine > 0 ? '#ff4d4f' : '#52c41a' }}>¥{fine.toFixed(2)}</span>;
      }
    },
    {
      title: '已批准减免',
      key: 'exempted',
      render: (_, record) => {
        const amount = record.sla?.approvedExemptionAmount || 0;
        return <span style={{ color: '#52c41a' }}>¥{amount.toFixed(2)}</span>;
      }
    },
    {
      title: '净罚款',
      key: 'net_fine',
      render: (_, record) => {
        const fine = record.sla?.netFine || 0;
        return (
          <span style={{ 
            fontWeight: 'bold',
            color: fine > 0 ? '#ff4d4f' : '#52c41a'
          }}>
            ¥{fine.toFixed(2)}
          </span>
        );
      }
    }
  ];

  return (
    <div>
      <Card title="月度结算预览" style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="选择年份"
            style={{ width: 120 }}
            value={selectedYear}
            onChange={setSelectedYear}
          >
            {years.map(year => (
              <Select.Option key={year} value={year}>{year}年</Select.Option>
            ))}
          </Select>

          <Select
            placeholder="选择月份"
            style={{ width: 120 }}
            value={selectedMonth}
            onChange={setSelectedMonth}
          >
            {months.map(month => (
              <Select.Option key={month} value={month}>{month}月</Select.Option>
            ))}
          </Select>

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handlePreview}
            loading={previewLoading}
          >
            预览
          </Button>
        </Space>

        {previewData && (
          <div>
            <Divider />
            
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic 
                  title="响应超时罚款" 
                  value={previewData.summary.totalResponseFine.toFixed(2)}
                  prefix="¥"
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={6}>
                <Statistic 
                  title="修复超时罚款" 
                  value={previewData.summary.totalRepairFine.toFixed(2)}
                  prefix="¥"
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={6}>
                <Statistic 
                  title="已批准减免" 
                  value={previewData.summary.totalExempted.toFixed(2)}
                  prefix="¥"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <Statistic 
                  title="净罚款金额" 
                  value={previewData.summary.netFine.toFixed(2)}
                  prefix="¥"
                  valueStyle={{ 
                    color: previewData.summary.netFine > 0 ? '#ff4d4f' : '#52c41a',
                    fontWeight: 'bold'
                  }}
                />
              </Col>
            </Row>

            <Table
              columns={previewColumns}
              dataSource={previewData.workOrders.map(wo => ({ ...wo, key: wo.id }))}
              pagination={false}
              size="small"
            />

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateSettlement}
              >
                创建结算单
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card title="结算单历史">
        <Table
          columns={columns}
          dataSource={settlements}
          loading={loading}
          rowKey="id"
        />
      </Card>
    </div>
  );
};

export default Settlements;
