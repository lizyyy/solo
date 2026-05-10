import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Select, Space, message, Modal, Descriptions, List } from 'antd';
import { FileTextOutlined, DownloadOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const { Option } = Select;

function ReportPage() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getOrders().then(res => setOrders(res.data));
  }, []);

  const loadReport = async () => {
    if (!selectedOrder) {
      message.warning('请选择订单');
      return;
    }
    setLoading(true);
    try {
      const res = await api.getOrderReport(selectedOrder);
      setReportData(res.data);
    } catch (e) {
      message.error('加载报告失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOrder) {
      loadReport();
    }
  }, [selectedOrder]);

  const exportReport = () => {
    if (!reportData) return;
    const jsonStr = JSON.stringify(reportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${reportData.订单号}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('报告已导出');
  };

  const orderColumns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      render: t => <code>{t}</code>
    },
    {
      title: '患者',
      dataIndex: 'patient_name',
      key: 'patient_name'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: s => {
        const map = {
          pending: { text: '待处理', color: 'default' },
          completed: { text: '已完成', color: 'success' },
          cancelled: { text: '已取消', color: 'red' },
          refunded: { text: '已退款', color: 'orange' }
        };
        const info = map[s] || { text: s, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '金额',
      key: 'amount',
      render: (_, r) => (
        <span>
          ¥{r.total_amount || 0}
          {r.refund_amount > 0 && (
            <span style={{ color: '#52c41a', marginLeft: 8 }}>(退款 ¥{r.refund_amount})</span>
          )}
        </span>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, r) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => setSelectedOrder(r.id)}
        >
          查看报告
        </Button>
      )
    }
  ];

  return (
    <div>
      <Card
        title="报告导出"
        extra={
          <Space>
            <Select
              placeholder="选择订单查看报告"
              style={{ width: 300 }}
              value={selectedOrder}
              onChange={setSelectedOrder}
              allowClear
            >
              {orders
                .filter(o => ['completed', 'refunded', 'cancelled'].includes(o.status))
                .map(o => (
                  <Option key={o.id} value={o.id}>
                    {o.order_no} - {o.patient_name}
                  </Option>
                ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={loadReport}>刷新</Button>
          </Space>
        }
      >
        <Table
          columns={orderColumns}
          dataSource={orders.filter(o => ['completed', 'refunded', 'cancelled'].includes(o.status))}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: '暂无已结束的订单可生成报告' }}
        />
      </Card>

      {reportData && (
        <Card
          title={`客户报告 - ${reportData.订单号}`}
          style={{ marginTop: 16 }}
          extra={
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={exportReport}
            >
              导出JSON报告
            </Button>
          }
        >
          <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
            <Descriptions.Item label="订单号" span={1}>
              <code>{reportData.订单号}</code>
            </Descriptions.Item>
            <Descriptions.Item label="订单状态" span={1}>
              <Tag color="green">{reportData.订单状态}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="患者姓名" span={1}>
              {reportData.患者信息.姓名}
            </Descriptions.Item>
            <Descriptions.Item label="联系方式" span={1}>
              {reportData.患者信息.电话}
            </Descriptions.Item>
            <Descriptions.Item label="陪诊员" span={1}>
              {reportData.陪诊员}
            </Descriptions.Item>
            <Descriptions.Item label="服务时间" span={1}>
              {reportData.服务时间}
            </Descriptions.Item>
            <Descriptions.Item label="就诊医院" span={1}>
              {reportData.医院}
            </Descriptions.Item>
            <Descriptions.Item label="就诊科室" span={1}>
              {reportData.科室}
            </Descriptions.Item>
          </Descriptions>

          <Card type="inner" title="✅ 已完成服务事项" style={{ marginBottom: 16 }}>
            <Table
              dataSource={reportData.完成事项}
              pagination={false}
              rowKey="节点"
              columns={[
                { title: '服务节点', dataIndex: '节点', key: '节点' },
                { title: '完成时间', dataIndex: '完成时间', key: '完成时间' },
                { title: '操作人', dataIndex: '操作人', key: '操作人' },
                { title: '备注', dataIndex: '备注', key: '备注' }
              ]}
              locale={{ emptyText: '暂无完成记录' }}
            />
          </Card>

          {reportData.检查项目?.length > 0 && (
            <Card type="inner" title="📋 检查项目明细" style={{ marginBottom: 16 }}>
              <Table
                dataSource={reportData.检查项目}
                pagination={false}
                rowKey="项目"
                columns={[
                  { title: '项目名称', dataIndex: '项目', key: '项目' },
                  { title: '科室', dataIndex: '科室', key: '科室' },
                  { title: '单价', dataIndex: '单价', key: '单价', render: v => `¥${v}` },
                  { title: '数量', dataIndex: '数量', key: '数量' },
                  { title: '小计', dataIndex: '小计', key: '小计', render: v => `¥${v}` },
                  { title: '类型', dataIndex: '类型', key: '类型', render: t => <Tag>{t}</Tag> }
                ]}
              />
            </Card>
          )}

          <Card type="inner" title="💰 费用明细">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="陪诊服务费">
                <span style={{ color: '#1890ff' }}>¥{reportData.费用明细.陪诊服务费}</span>
              </Descriptions.Item>
              <Descriptions.Item label="检查/治疗费">
                <span style={{ color: '#722ed1' }}>¥{reportData.费用明细.检查治疗费}</span>
              </Descriptions.Item>
              <Descriptions.Item label="退款金额">
                <span style={{ color: '#52c41a' }}>-¥{reportData.费用明细.退款}</span>
              </Descriptions.Item>
              <Descriptions.Item label="实付金额">
                <span style={{ color: '#f5222d', fontWeight: 'bold', fontSize: 18 }}>
                  ¥{reportData.费用明细.实付金额}
                </span>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <p style={{ textAlign: 'right', color: '#999', marginTop: 16 }}>
            报告生成时间：{reportData.生成时间}
          </p>
        </Card>
      )}

      <Card title="报告说明" type="inner" style={{ marginTop: 16 }}>
        <p><strong>📄 报告用途：</strong></p>
        <ul>
          <li>为客户提供完整的服务记录和费用明细</li>
          <li>包含从接单到完成的全流程时间线</li>
          <li>区分预约项目和临时加项，透明展示所有服务</li>
          <li>可导出为JSON格式，方便存档和系统对接</li>
          <li>所有金额都经过幂等性校验，确保数据准确</li>
        </ul>
      </Card>
    </div>
  );
}

export default ReportPage;
