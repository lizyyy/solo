import { useState, useEffect } from 'react';
import { Card, Space, DatePicker, Select, Button, message, Form, Descriptions, Alert } from 'antd';
import { ExportOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { exportAPI, logAPI } from '../api';
import { ExportFilter, OperationType } from '../types';

const { RangePicker } = DatePicker;
const { Option } = Select;

const operationTypeMap: Record<OperationType, string> = {
  [OperationType.CREATE]: '创建',
  [OperationType.UPDATE]: '更新',
  [OperationType.DELETE]: '删除',
  [OperationType.CONFIRM]: '确认',
  [OperationType.REJECT]: '拒绝',
  [OperationType.CHECK_IN]: '入园',
  [OperationType.CHECK_OUT]: '离园',
  [OperationType.MANUAL_REVIEW]: '人工复核',
  [OperationType.BLACKLIST_ADD]: '添加黑名单',
  [OperationType.BLACKLIST_REMOVE]: '移除黑名单',
};

function ExportPage() {
  const [form] = Form.useForm();
  const [operators, setOperators] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchOperators = async () => {
      try {
        const data = await logAPI.getOperators();
        setOperators(data);
      } catch (error) {
        console.error('获取操作人列表失败', error);
      }
    };
    fetchOperators();
  }, []);

  const handleExport = async (values: any) => {
    const filter: ExportFilter = {
      operator: values.operator,
      operationType: values.operationType,
    };

    if (values.dateRange && values.dateRange[0] && values.dateRange[1]) {
      filter.startTime = values.dateRange[0].toISOString();
      filter.endTime = values.dateRange[1].toISOString();
    }

    setExporting(true);
    try {
      const blob = await exportAPI.export(filter);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `访客系统报表_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('报表导出成功');
    } catch (error) {
      message.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <Card title="报表导出" style={{ marginBottom: 16 }}>
        <Alert
          message="导出说明"
          description="导出的报表包含操作日志和黑名单变更记录，可以按操作人、时间范围、操作类型进行筛选。黑名单变更记录会显示谁修改的、修改原因以及影响的记录。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleExport}
        >
          <Descriptions title="筛选条件" bordered column={2} style={{ marginBottom: 24 }}>
            <Descriptions.Item label="时间范围">
              <Form.Item name="dateRange" style={{ marginBottom: 0 }}>
                <RangePicker
                  showTime
                  format="YYYY-MM-DD HH:mm:ss"
                  placeholder={['开始时间', '结束时间']}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label="操作人">
              <Form.Item name="operator" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="选择操作人"
                  allowClear
                  style={{ width: '100%' }}
                >
                  {operators.map(op => (
                    <Option key={op} value={op}>{op}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label="操作类型">
              <Form.Item name="operationType" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="选择操作类型"
                  allowClear
                  style={{ width: '100%' }}
                >
                  {Object.entries(operationTypeMap).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Descriptions.Item>
          </Descriptions>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<ExportOutlined />}
                loading={exporting}
                size="large"
              >
                导出 Excel 报表
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="报表内容说明">
        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li>
            <b>操作日志 Sheet：</b>包含所有操作记录，包括操作时间、操作人、操作人角色、操作类型、访客ID、操作描述、修改前后的值
          </li>
          <li>
            <b>黑名单变更记录 Sheet：</b>包含黑名单的添加和移除记录，包括操作时间、操作人、操作类型、访客信息、原因、影响的记录数及记录ID
          </li>
          <li>
            <b>修改追踪：</b>对于被访人确认、车牌入园、门禁二维码等操作，系统会保留修改前后的值，便于审计追踪
          </li>
          <li>
            <b>责任追溯：</b>所有操作都会记录操作人及操作时间，支持按责任人和处理时间筛选，便于事后追溯和审计
          </li>
        </ul>
      </Card>
    </div>
  );
}

export default ExportPage;
