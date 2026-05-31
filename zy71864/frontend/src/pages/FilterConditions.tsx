import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Tag,
  Space,
  Typography,
  Select,
  Alert,
  Divider,
  Switch,
} from 'antd';
import {
  SaveOutlined,
  CheckOutlined,
  DeleteOutlined,
  FilterOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { filterApi } from '@/api';
import type { FilterCondition } from '@/types';
import { formatDate } from '@/utils';
import { useAppStore } from '@/store';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const FilterConditions: React.FC = () => {
  const { showError, showNotification, currentUser, currentFilter, setCurrentFilter } = useAppStore();
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const [filterForm, setFilterForm] = useState({
    diagnosis_type: '',
    is_correct: '',
    min_score: undefined as number | undefined,
    max_score: undefined as number | undefined,
    question_no: '',
    student_id: '',
  });

  useEffect(() => {
    loadFilters();
  }, []);

  const loadFilters = async () => {
    setLoading(true);
    try {
      const response = await filterApi.list(currentUser.id);
      setFilters(response.data);
      const current = response.data.find((f) => f.is_current);
      if (current) {
        setCurrentFilter(current);
      }
    } catch (error: any) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetCurrent = async (id: number) => {
    try {
      const response = await filterApi.setCurrent(id);
      setCurrentFilter(response.data);
      await loadFilters();
      showNotification({
        type: 'success',
        message: '已设为当前筛选条件',
        suggestion: '导出讲评稿时将自动使用该条件',
      });
    } catch (error: any) {
      showError(error);
    }
  };

  const handleSave = async (values: any) => {
    const conditionJson = {
      ...filterForm,
      ...values.condition_json,
    };

    Object.keys(conditionJson).forEach((key) => {
      if (conditionJson[key] === '' || conditionJson[key] === undefined || conditionJson[key] === null) {
        delete conditionJson[key];
      }
    });

    try {
      await filterApi.save({
        user_id: currentUser.id,
        condition_name: values.condition_name,
        condition_json: conditionJson,
      });
      showNotification({
        type: 'success',
        message: '筛选条件保存成功',
        suggestion: '下次诊断时可以直接使用该条件',
      });
      setModalVisible(false);
      form.resetFields();
      loadFilters();
    } catch (error: any) {
      showError(error);
    }
  };

  const renderConditionPreview = (conditionJson: Record<string, any>) => {
    const tags: React.ReactNode[] = [];

    if (conditionJson.diagnosis_type) {
      const labels: Record<string, string> = {
        correct: '正确',
        format_error: '格式错误',
        type_mismatch: '递推类型不匹配',
        wrong_common_difference: '公差错误',
        wrong_common_ratio: '公比错误',
        wrong_coefficient: '系数错误',
        wrong_constant: '常数项错误',
        calculation_error: '计算错误',
      };
      tags.push(
        <Tag key="type" color="blue">
          诊断类型：{labels[conditionJson.diagnosis_type] || conditionJson.diagnosis_type}
        </Tag>
      );
    }

    if (conditionJson.is_correct !== undefined && conditionJson.is_correct !== '') {
      tags.push(
        <Tag key="correct" color={conditionJson.is_correct ? 'green' : 'red'}>
          {conditionJson.is_correct ? '仅正确' : '仅错误'}
        </Tag>
      );
    }

    if (conditionJson.question_no) {
      tags.push(
        <Tag key="question" color="purple">
          题目：{conditionJson.question_no}
        </Tag>
      );
    }

    if (conditionJson.student_id) {
      tags.push(
        <Tag key="student" color="cyan">
          学号：{conditionJson.student_id}
        </Tag>
      );
    }

    if (conditionJson.min_score !== undefined || conditionJson.max_score !== undefined) {
      const min = conditionJson.min_score ?? '-';
      const max = conditionJson.max_score ?? '-';
      tags.push(
        <Tag key="score" color="orange">
          得分：{min} ~ {max}
        </Tag>
      );
    }

    return tags.length > 0 ? <Space wrap>{tags}</Space> : <Text type="secondary">无筛选条件</Text>;
  };

  const columns = [
    {
      title: '条件名称',
      dataIndex: 'condition_name',
      key: 'condition_name',
      render: (text: string, record: FilterCondition) => (
        <div>
          <span className="font-medium">{text}</span>
          {record.is_current && (
            <Tag color="green" icon={<CheckOutlined />} className="ml-2">
              当前使用
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: '筛选条件',
      dataIndex: 'condition_json',
      key: 'condition_json',
      render: (json: Record<string, any>) => renderConditionPreview(json),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => formatDate(date, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: FilterCondition) => (
        <Space size="small">
          {!record.is_current && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleSetCurrent(record.id)}
            >
              设为当前
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Title level={3} className="!m-0 !text-primary-900">
            筛选条件管理
          </Title>
          <Text type="secondary">
            保存常用的筛选条件，确保屏幕显示范围与导出讲评稿内容一致
          </Text>
        </div>
        <Button type="primary" icon={<SaveOutlined />} onClick={() => setModalVisible(true)}>
          保存当前条件
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<SettingOutlined />}
        message="为什么需要保存筛选条件？"
        description={
          <div>
            <Paragraph className="!m-0">
              为了确保屏幕上看到的内容和导出的讲评稿完全一致，系统需要记录您使用的筛选条件。
              当您设置了"当前筛选条件"后，导出讲评稿时会自动使用相同的条件。
            </Paragraph>
            <div className="mt-2 space-y-1 text-sm">
              <p>
                <strong>✓ </strong>
                刷新页面后，当前筛选条件会自动恢复
              </p>
              <p>
                <strong>✓ </strong>
                重启系统后，上次使用的筛选条件仍然有效
              </p>
              <p>
                <strong>✓ </strong>
                更换筛选条件后，系统会提示您重新保存以保持一致性
              </p>
            </div>
          </div>
        }
        className="mb-6"
      />

      <Card
        title="筛选条件配置预览"
        className="mb-6"
        extra={
          <Button size="small" onClick={() => setFilterForm({
            diagnosis_type: '',
            is_correct: '',
            min_score: undefined,
            max_score: undefined,
            question_no: '',
            student_id: '',
          })}>
            重置
          </Button>
        }
      >
        <div className="mb-4">
          <Text strong className="block mb-3">当前配置：</Text>
          {renderConditionPreview(filterForm as any)}
        </div>
        <Divider />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">诊断类型</label>
            <Select
              className="w-full"
              placeholder="选择诊断类型"
              allowClear
              value={filterForm.diagnosis_type || undefined}
              onChange={(v) => setFilterForm({ ...filterForm, diagnosis_type: v || '' })}
            >
              <Option value="correct">正确</Option>
              <Option value="format_error">格式错误</Option>
              <Option value="type_mismatch">递推类型不匹配</Option>
              <Option value="wrong_common_difference">公差错误</Option>
              <Option value="wrong_common_ratio">公比错误</Option>
              <Option value="wrong_coefficient">系数错误</Option>
              <Option value="wrong_constant">常数项错误</Option>
              <Option value="calculation_error">计算错误</Option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">正确状态</label>
            <Select
              className="w-full"
              placeholder="选择正确状态"
              allowClear
              value={filterForm.is_correct || undefined}
              onChange={(v) => setFilterForm({ ...filterForm, is_correct: v || '' })}
            >
              <Option value="true">仅显示正确</Option>
              <Option value="false">仅显示错误</Option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">题目编号</label>
            <Input
              placeholder="输入题目编号"
              value={filterForm.question_no}
              onChange={(e) => setFilterForm({ ...filterForm, question_no: e.target.value })}
              allowClear
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">学生学号</label>
            <Input
              placeholder="输入学号"
              value={filterForm.student_id}
              onChange={(e) => setFilterForm({ ...filterForm, student_id: e.target.value })}
              allowClear
            />
          </div>
        </div>
      </Card>

      <Card title="已保存的筛选条件" className="card-hover">
        <Table
          columns={columns}
          dataSource={filters}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="middle"
          locale={{ emptyText: '暂无保存的筛选条件' }}
        />
      </Card>

      <Modal
        title="保存筛选条件"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <FilterOutlined className="text-blue-500 mr-2" />
          <span className="text-sm">
            保存后，该条件可用于后续诊断和导出，确保屏幕显示与导出内容一致
          </span>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="condition_name"
            label="条件名称"
            rules={[{ required: true, message: '请输入条件名称' }]}
            extra="请输入一个有意义的名称，方便后续识别"
          >
            <Input placeholder="例如：高三1班-12月月考-错误分析" />
          </Form.Item>

          <div className="mb-4">
            <Text strong className="block mb-2">即将保存的条件：</Text>
            {renderConditionPreview(filterForm as any)}
          </div>

          <div className="flex justify-end space-x-3">
            <Button onClick={() => setModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              保存
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default FilterConditions;
