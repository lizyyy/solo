import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Modal,
  Form,
  Select,
  message,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { diffApi, configApi } from '../services/api';
import { DiffReport, ConfigItem } from '../types';

const { Option } = Select;

function DiffReportsPage() {
  const [reports, setReports] = useState<DiffReport[]>([]);
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [configVersions, setConfigVersions] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await diffApi.getList({ page: 1, pageSize: 20 });
      setReports(response.data.data.reports);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadConfigs = async () => {
    try {
      const response = await configApi.getList({ page: 1, pageSize: 100 });
      const uniqueConfigs = Array.from(
        new Map(response.data.data.items.map((item) => [item.key, item])).values()
      );
      setConfigs(uniqueConfigs);
    } catch (error) {
      message.error('加载配置失败');
    }
  };

  useEffect(() => {
    loadReports();
    loadConfigs();
  }, []);

  const handleConfigChange = async (configKey: string) => {
    try {
      const response = await diffApi.getConfigVersions(configKey);
      setConfigVersions(response.data.data);
      form.setFieldsValue({ baseVersion: undefined, targetVersion: undefined });
    } catch (error) {
      message.error('加载版本失败');
    }
  };

  const handleGenerate = async (values: any) => {
    try {
      await diffApi.generate({
        configKey: values.configKey,
        baseVersion: values.baseVersion,
        targetVersion: values.targetVersion,
        generatedBy: values.generatedBy,
      });
      message.success('生成成功');
      setModalVisible(false);
      setConfigVersions([]);
      loadReports();
    } catch (error) {
      message.error('生成失败');
    }
  };

  const handleExport = (id: string) => {
    diffApi.exportReport(id);
  };

  const columns = [
    { title: '配置Key', dataIndex: ['configItem', 'key'], key: 'configKey', width: 150 },
    { title: '基准版本', dataIndex: 'baseVersion', key: 'baseVersion', width: 100 },
    { title: '目标版本', dataIndex: 'targetVersion', key: 'targetVersion', width: 100 },
    { title: '受影响实例', dataIndex: 'affectedInstances', key: 'affectedInstances', width: 120 },
    { title: '生成者', dataIndex: 'generatedBy', key: 'generatedBy', width: 100 },
    { title: '生成时间', dataIndex: 'generatedAt', key: 'generatedAt', width: 180, render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: DiffReport) => (
        <Button
          icon={<ExportOutlined />}
          size="small"
          onClick={() => handleExport(record.id)}
        >
          导出
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="差异报告"
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              生成报告
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadReports} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索配置ID"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
          />
        </Space>

        <Table
          loading={loading}
          dataSource={reports}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="生成差异报告"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setConfigVersions([]);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleGenerate}>
          <Form.Item name="configKey" label="选择配置" rules={[{ required: true }]}>
            <Select placeholder="请选择配置" onChange={handleConfigChange}>
              {configs.map((c) => (
                <Option key={c.key} value={c.key}>
                  {c.key}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="baseVersion" label="基准版本" rules={[{ required: true }]}>
            <Select placeholder="请选择基准版本" disabled={configVersions.length === 0}>
              {configVersions.map((v) => (
                <Option key={v} value={v}>
                  版本 {v}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="targetVersion" label="目标版本" rules={[{ required: true }]}>
            <Select placeholder="请选择目标版本" disabled={configVersions.length === 0}>
              {configVersions.map((v) => (
                <Option key={v} value={v}>
                  版本 {v}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="generatedBy" label="生成者">
            <Input defaultValue="admin" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                生成
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                setConfigVersions([]);
              }}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default DiffReportsPage;
