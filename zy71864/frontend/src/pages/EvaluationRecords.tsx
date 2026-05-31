import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Upload,
  Modal,
  Form,
  Input,
  InputNumber,
  Tag,
  Space,
  Typography,
  Row,
  Col,
  Select,
  message,
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { evaluationApi } from '@/api';
import type { UploadProps } from 'antd';
import type { EvaluationRecord } from '@/types';
import { formatDate } from '@/utils';
import { useAppStore } from '@/store';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const EvaluationRecords: React.FC = () => {
  const { showError, showNotification, selectedRecords, toggleRecordSelection, clearSelection, setSelectedRecords } = useAppStore();
  const [records, setRecords] = useState<EvaluationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterStudentId, setFilterStudentId] = useState<string>('');
  const [filterQuestionNo, setFilterQuestionNo] = useState<string>('');
  const [form] = Form.useForm();

  useEffect(() => {
    loadRecords();
  }, [filterStudentId, filterQuestionNo]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (filterStudentId) params.student_id = filterStudentId;
      if (filterQuestionNo) params.question_no = filterQuestionNo;
      const response = await evaluationApi.list(params);
      setRecords(response.data);
    } catch (error: any) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      await evaluationApi.create(values);
      showNotification({
        type: 'success',
        message: '讲评记录创建成功',
      });
      setModalVisible(false);
      loadRecords();
    } catch (error: any) {
      showError(error);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    customRequest: async ({ file }) => {
      try {
        setLoading(true);
        const response = await evaluationApi.upload(file as File);
        setRecords([...response.data, ...records]);
        showNotification({
          type: 'success',
          message: `成功导入 ${response.data.length} 条记录`,
        });
      } catch (error: any) {
        showError(error);
      } finally {
        setLoading(false);
      }
    },
  };

  const rowSelection = {
    selectedRowKeys: selectedRecords.map((r) => r.id),
    onChange: (_selectedRowKeys: React.Key[], selectedRows: EvaluationRecord[]) => {
      setSelectedRecords(selectedRows);
    },
  };

  const columns = [
    {
      title: '学号',
      dataIndex: 'student_id',
      key: 'student_id',
      width: 120,
      render: (text: string) => <span className="font-mono">{text}</span>,
    },
    {
      title: '学生姓名',
      dataIndex: 'student_name',
      key: 'student_name',
      width: 120,
    },
    {
      title: '题目编号',
      dataIndex: 'question_no',
      key: 'question_no',
      width: 120,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '学生答案',
      dataIndex: 'student_answer',
      key: 'student_answer',
      ellipsis: true,
      render: (text: string) => (
        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{text}</code>
      ),
    },
    {
      title: '得分',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      render: (score?: number) =>
        score !== undefined ? (
          <span className="font-mono font-medium">{score}</span>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: '上传时间',
      dataIndex: 'evaluation_time',
      key: 'evaluation_time',
      width: 160,
      render: (date: string) => formatDate(date, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
  ];

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Title level={3} className="!m-0 !text-primary-900">
            讲评记录
          </Title>
          <Text type="secondary">管理学生答题记录，支持单条录入和批量导入</Text>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={handleCreate}>
            单条录入
          </Button>
          <Upload {...uploadProps}>
            <Button type="primary" icon={<UploadOutlined />}>
              批量导入
            </Button>
          </Upload>
        </Space>
      </div>

      {selectedRecords.length > 0 && (
        <Card className="mb-4 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <CheckCircleOutlined className="text-blue-500 mr-2" />
              <span className="font-medium">已选择 {selectedRecords.length} 条记录</span>
            </div>
            <Space>
              <Button size="small" onClick={clearSelection}>
                取消选择
              </Button>
            </Space>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Input
              placeholder="按学号筛选"
              allowClear
              value={filterStudentId}
              onChange={(e) => setFilterStudentId(e.target.value)}
              prefix={<span className="text-gray-400">学号</span>}
            />
          </Col>
          <Col span={8}>
            <Input
              placeholder="按题目编号筛选"
              allowClear
              value={filterQuestionNo}
              onChange={(e) => setFilterQuestionNo(e.target.value)}
              prefix={<span className="text-gray-400">题目</span>}
            />
          </Col>
          <Col span={8}>
            <Space>
              <Button onClick={loadRecords}>查询</Button>
              <Button
                onClick={() => {
                  setFilterStudentId('');
                  setFilterQuestionNo('');
                }}
              >
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card className="card-hover">
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-start">
            <FileExcelOutlined className="text-blue-500 text-xl mt-0.5 mr-3" />
            <div>
              <Paragraph className="!m-0 text-sm">
                <strong>批量导入说明：</strong>
              </Paragraph>
              <Paragraph className="!m-0 text-xs text-gray-600 mt-1">
                支持 Excel (.xlsx, .xls) 和 CSV 格式。文件必须包含以下列：
                <code className="bg-white px-1 mx-1">student_id</code>（学号）、
                <code className="bg-white px-1 mx-1">student_name</code>（学生姓名）、
                <code className="bg-white px-1 mx-1">question_no</code>（题目编号）、
                <code className="bg-white px-1 mx-1">student_answer</code>（学生答案）。
                可选列：<code className="bg-white px-1 mx-1">score</code>（得分）、
                <code className="bg-white px-1 mx-1">remark</code>（备注）。
              </Paragraph>
            </div>
          </div>
        </div>

        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          size="middle"
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title="单条录入讲评记录"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="student_id"
                label="学号"
                rules={[{ required: true, message: '请输入学号' }]}
              >
                <Input placeholder="请输入学生学号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="student_name"
                label="学生姓名"
                rules={[{ required: true, message: '请输入学生姓名' }]}
              >
                <Input placeholder="请输入学生姓名" />
              </Form.Item>
            </Col>
          </Row>
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
              <Form.Item name="score" label="得分（可选）">
                <InputNumber min={0} max={100} className="w-full" placeholder="请输入得分" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="student_answer"
            label="学生答案"
            rules={[{ required: true, message: '请输入学生答案' }]}
            extra="请输入学生的递推公式答案"
          >
            <Input placeholder="例如：a_{n+1} = a_n + 2" />
          </Form.Item>
          <Form.Item name="remark" label="备注（可选）">
            <TextArea rows={2} placeholder="可选的备注信息" />
          </Form.Item>
          <div className="flex justify-end space-x-3 pt-4">
            <Button onClick={() => setModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default EvaluationRecords;
