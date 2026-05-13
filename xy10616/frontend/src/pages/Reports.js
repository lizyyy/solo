import React from 'react';
import { Card, Button, Space, Typography, Row, Col, message } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import { reportAPI } from '../services/api';

const { Title, Text } = Typography;

const Reports = () => {
  const handleExport = (type) => {
    reportAPI.export({ type });
    message.success('开始导出，请等待下载完成');
  };

  const reportList = [
    {
      title: '续费报表',
      description: '导出所有续费支付记录，包含车牌号、交易号、金额、支付方式、续费月份等信息',
      type: 'renewal',
    },
    {
      title: '欠费报表',
      description: '导出所有欠费记录，包含车牌号、账期、欠费金额、已缴金额、状态等信息',
      type: 'arrears',
    },
    {
      title: '流转记录报表',
      description: '导出所有操作流转记录，包含业务类型、操作类型、原值、新值、操作人等信息',
      type: 'flow',
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3}>报表导出</Title>
        <Text type="secondary">支持按责任人和处理时间筛选导出各类业务报表</Text>
      </div>

      <Row gutter={[16, 16]}>
        {reportList.map((report) => (
          <Col span={8} key={report.type}>
            <Card
              hoverable
              title={
                <Space>
                  <FileExcelOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                  {report.title}
                </Space>
              }
              extra={
                <Button type="primary" onClick={() => handleExport(report.type)}>
                  导出
                </Button>
              }
            >
              <Text type="secondary">{report.description}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="导出说明">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>所有报表导出为CSV格式，可用Excel打开</li>
          <li>支持按车牌号、状态、时间范围等条件进行筛选导出</li>
          <li>流转记录中包含所有修改前后的对比数据</li>
          <li>导出文件编码为UTF-8，支持中文显示</li>
        </ul>
      </Card>
    </Space>
  );
};

export default Reports;
