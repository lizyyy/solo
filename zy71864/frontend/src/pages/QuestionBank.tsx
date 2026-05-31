import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Tag,
  Space,
  Typography,
  message,
  Popconfirm,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusCircleOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { questionApi } from '@/api';
import type { QuestionBank, EquivalentAnswer } from '@/types';
import { formatDate } from '@/utils';
import { useAppStore } from '@/store';

const { Title, Text } = Typography;
const { TextArea } = Input;

const QuestionBank: React.FC = () => {
  const { showError, showNotification } = useAppStore();
  const [questions, setQuestions] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [equivalentModalVisible, setEquivalentModalVisible] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionBank | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionBank | null>(null);
  const [versions, setVersions] = useState<QuestionBank[]>([]);
  const [equivalentAnswers, setEquivalentAnswers] = useState<EquivalentAnswer[]>([]);
  const [form] = Form.useForm();
  const [eqForm] = Form.useForm();

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const response = await questionApi.list();
      setQuestions(response.data);
    } catch (error: any) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingQuestion(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (question: QuestionBank) => {
    setEditingQuestion(question);
    form.setFieldsValue({
      question_no: question.question_no,
      content: question.content,
      standard_answer: question.standard_answer,
      recurrence_formula: question.recurrence_formula,
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingQuestion) {
        await questionApi.update(editingQuestion.id, {
          ...values,
          created_by: '当前用户',
        });
        showNotification({
          type: 'success',
          message: '题目更新成功',
          suggestion: '已自动创建新版本，旧版本已归档',
        });
      } else {
        await questionApi.create({
          ...values,
          created_by: '当前用户',
        });
        showNotification({
          type: 'success',
          message: '题目创建成功',
        });
      }
      setModalVisible(false);
      loadQuestions();
    } catch (error: any) {
      showError(error);
    }
  };

  const handleViewVersions = async (question: QuestionBank) => {
    setSelectedQuestion(question);
    try {
      const response = await questionApi.getVersions(question.question_no);
      setVersions(response.data);
      setVersionModalVisible(true);
    } catch (error: any) {
      showError(error);
    }
  };

  const handleViewEquivalent = async (question: QuestionBank) => {
    setSelectedQuestion(question);
    try {
      const response = await questionApi.getEquivalentAnswers(question.id);
      setEquivalentAnswers(response.data);
      eqForm.resetFields();
      setEquivalentModalVisible(true);
    } catch (error: any) {
      showError(error);
    }
  };

  const handleAddEquivalent = async (values: any) => {
    try {
      await questionApi.addEquivalentAnswer({
        question_bank_id: selectedQuestion!.id,
        ...values,
      });
      showNotification({
        type: 'success',
        message: '等价答案添加成功',
        suggestion: '将在下次诊断中自动匹配该等价答案',
      });
      eqForm.resetFields();
      const response = await questionApi.getEquivalentAnswers(selectedQuestion!.id);
      setEquivalentAnswers(response.data);
    } catch (error: any) {
      showError(error);
    }
  };

  const columns = [
    {
      title: '题目编号',
      dataIndex: 'question_no',
      key: 'question_no',
      width: 120,
      render: (text: string) => <span className="font-mono font-medium">{text}</span>,
    },
    {
      title: '题目内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '标准答案',
      dataIndex: 'standard_answer',
      key: 'standard_answer',
      width: 200,
      render: (text: string) => (
        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{text}</code>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (version: number, record: QuestionBank) => (
        <Tag color={record.is_active ? 'blue' : 'default'}>
          v{version} {!record.is_active && '(已归档)'}
        </Tag>
      ),
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
      width: 240,
      render: (_: any, record: QuestionBank) => (
        <Space size="small">
          {record.is_active && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                编辑
              </Button>
              <Button
                type="link"
                size="small"
                icon={<PlusCircleOutlined />}
                onClick={() => handleViewEquivalent(record)}
              >
                等价答案
              </Button>
            </>
          )}
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleViewVersions(record)}
          >
            版本历史
          </Button>
        </Space>
      ),
    },
  ];

  const versionColumns = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: number) => <Tag color="blue">v{v}</Tag>,
    },
    {
      title: '题目内容',
      dataIndex: 'content',
      key: 'content',
    },
    {
      title: '标准答案',
      dataIndex: 'standard_answer',
      key: 'standard_answer',
      render: (t: string) => <code className="bg-gray-100 px-2 py-1 rounded text-xs">{t}</code>,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active: boolean) =>
        active ? <Tag color="green">当前版本</Tag> : <Tag color="default">已归档</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => formatDate(date, 'YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Title level={3} className="!m-0 !text-primary-900">
            题库管理
          </Title>
          <Text type="secondary">管理数列递推题目、版本留底、等价答案配置</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新增题目
        </Button>
      </div>

      <Card className="card-hover">
        <Table
          columns={columns}
          dataSource={questions}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      </Card>

      <Modal
        title={editingQuestion ? '编辑题目（将创建新版本）' : '新增题目'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="question_no"
                label="题目编号"
                rules={[{ required: true, message: '请输入题目编号' }]}
              >
                <Input placeholder="例如：SEQ001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="recurrence_formula" label="递推公式（可选）">
                <Input placeholder="例如：a_{n+1} = a_n + 2" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="content"
            label="题目内容"
            rules={[{ required: true, message: '请输入题目内容' }]}
          >
            <TextArea rows={3} placeholder="请输入完整的题目描述" />
          </Form.Item>
          <Form.Item
            name="standard_answer"
            label="标准答案"
            rules={[{ required: true, message: '请输入标准答案' }]}
            extra="请输入标准的递推公式，例如：a_{n+1} = a_n + 2"
          >
            <Input placeholder="例如：a_{n+1} = a_n + 2" />
          </Form.Item>
          <div className="flex justify-end space-x-3 pt-4">
            <Button onClick={() => setModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit">
              {editingQuestion ? '更新并创建新版本' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={`${selectedQuestion?.question_no} - 版本历史`}
        open={versionModalVisible}
        onCancel={() => setVersionModalVisible(false)}
        footer={null}
        width={900}
      >
        <Table
          columns={versionColumns}
          dataSource={versions}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Modal>

      <Modal
        title={`${selectedQuestion?.question_no} - 等价答案管理`}
        open={equivalentModalVisible}
        onCancel={() => setEquivalentModalVisible(false)}
        footer={null}
        width={700}
      >
        <div className="mb-4">
          <Text type="secondary">
            <BookOutlined className="mr-1" />
            等价答案将在诊断时自动匹配，避免误判
          </Text>
        </div>

        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm">
            <span className="font-medium">标准答案：</span>
            <code className="bg-white px-2 py-1 rounded ml-2">{selectedQuestion?.standard_answer}</code>
          </div>
        </div>

        {equivalentAnswers.length > 0 && (
          <div className="mb-4">
            <div className="font-medium mb-2">已配置的等价答案：</div>
            {equivalentAnswers.map((eq) => (
              <div key={eq.id} className="p-2 bg-gray-50 rounded mb-2 flex justify-between items-center">
                <div>
                  <code className="bg-white px-2 py-1 rounded">{eq.answer_expression}</code>
                  {eq.description && <span className="text-gray-500 text-sm ml-2">({eq.description})</span>}
                </div>
                <span className="text-gray-400 text-xs">{formatDate(eq.created_at, 'MM-DD HH:mm')}</span>
              </div>
            ))}
          </div>
        )}

        <Form form={eqForm} layout="vertical" onFinish={handleAddEquivalent}>
          <Form.Item
            name="answer_expression"
            label="添加等价答案"
            rules={[{ required: true, message: '请输入等价答案表达式' }]}
            extra="输入与标准答案数学上等价的表达式"
          >
            <Input placeholder="例如：a_{n+1} - a_n = 2" />
          </Form.Item>
          <Form.Item name="description" label="说明（可选）">
            <Input placeholder="例如：移项形式" />
          </Form.Item>
          <div className="flex justify-end">
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
              添加等价答案
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default QuestionBank;
