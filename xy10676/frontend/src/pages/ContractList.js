import React, { useEffect, useState } from 'react';
import { 
  Table, 
  Input, 
  Select, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  message,
  Drawer,
  Descriptions,
  Badge
} from 'antd';
import { SearchOutlined, EditOutlined, HistoryOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

function ContractList() {
  const [contracts, setContracts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [form] = Form.useForm();

  const loadContracts = async (page = 1, limit = 10, filterParams = {}) => {
    setLoading(true);
    try {
      const params = { page, limit, ...filterParams };
      const res = await axios.get('/api/contracts', { params });
      setContracts(res.data.data);
      setPagination({
        page: res.data.pagination.page,
        limit: res.data.pagination.limit,
        total: res.data.pagination.total
      });
    } catch (error) {
      message.error('加载合同列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (id) => {
    try {
      const res = await axios.get(`/api/contracts/${id}/history`);
      setHistoryData(res.data);
      setHistoryVisible(true);
    } catch (error) {
      message.error('加载历史记录失败');
    }
  };

  const handleEdit = (record) => {
    setEditingContract(record);
    form.setFieldsValue({
      electronic_sign_status: record.electronic_sign_status,
      paper_archived: record.paper_archived ? 1 : 0,
      status: record.status,
      responsible_person: record.responsible_person
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async (values) => {
    try {
      await axios.put(`/api/contracts/${editingContract.id}`, {
        ...values,
        changed_by: '当前用户'
      });
      message.success('更新成功');
      setEditModalVisible(false);
      loadContracts(pagination.page, pagination.limit, filters);
    } catch (error) {
      message.error(error.response?.data?.error || '更新失败');
    }
  };

  useEffect(() => {
    loadContracts();
  }, []);

  const columns = [
    {
      title: '合同编号',
      dataIndex: 'contract_no',
      key: 'contract_no',
      width: 140
    },
    {
      title: '合同名称',
      dataIndex: 'contract_name',
      key: 'contract_name',
      ellipsis: true
    },
    {
      title: '合同金额',
      dataIndex: 'contract_amount',
      key: 'contract_amount',
      width: 120,
      render: (val) => `¥${val.toLocaleString()}`
    },
    {
      title: '电子签状态',
      dataIndex: 'electronic_sign_status',
      key: 'electronic_sign_status',
      width: 120,
      render: (val) => (
        <Tag color={val === 'signed' ? 'green' : val === 'pending' ? 'orange' : 'red'}>
          {val === 'signed' ? '已签署' : val === 'pending' ? '待签署' : '已拒绝'}
        </Tag>
      )
    },
    {
      title: '纸质归档',
      dataIndex: 'paper_archived',
      key: 'paper_archived',
      width: 100,
      render: (val) => val ? <Badge status="success" text="已归档" /> : <Badge status="warning" text="未归档" />
    },
    {
      title: '负责人',
      dataIndex: 'responsible_person',
      key: 'responsible_person',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val) => {
        const statusMap = {
          active: { color: 'blue', text: '生效中' },
          expired: { color: 'gray', text: '已到期' },
          renewed: { color: 'green', text: '已续约' },
          terminated: { color: 'red', text: '已终止' }
        };
        return <Tag color={statusMap[val]?.color}>{statusMap[val]?.text}</Tag>;
      }
    },
    {
      title: '到期日',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 120,
      render: (val) => dayjs(val).format('YYYY-MM-DD')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => loadHistory(record.id)}>
            历史
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索合同编号/名称/甲乙双方"
          prefix={<SearchOutlined />}
          style={{ width: 300 }}
          allowClear
          onPressEnter={(e) => {
            setFilters({ ...filters, search: e.target.value });
            loadContracts(1, pagination.limit, { ...filters, search: e.target.value });
          }}
        />
        <Select
          placeholder="电子签状态"
          style={{ width: 120 }}
          allowClear
          onChange={(val) => {
            const newFilters = { ...filters };
            if (val) newFilters.electronic_sign_status = val;
            else delete newFilters.electronic_sign_status;
            setFilters(newFilters);
            loadContracts(1, pagination.limit, newFilters);
          }}
        >
          <Option value="pending">待签署</Option>
          <Option value="signed">已签署</Option>
          <Option value="rejected">已拒绝</Option>
        </Select>
        <Select
          placeholder="纸质归档"
          style={{ width: 120 }}
          allowClear
          onChange={(val) => {
            const newFilters = { ...filters };
            if (val !== undefined) newFilters.paper_archived = val;
            else delete newFilters.paper_archived;
            setFilters(newFilters);
            loadContracts(1, pagination.limit, newFilters);
          }}
        >
          <Option value={1}>已归档</Option>
          <Option value={0}>未归档</Option>
        </Select>
        <Select
          placeholder="负责人"
          style={{ width: 120 }}
          allowClear
          onChange={(val) => {
            const newFilters = { ...filters };
            if (val) newFilters.responsible_person = val;
            else delete newFilters.responsible_person;
            setFilters(newFilters);
            loadContracts(1, pagination.limit, newFilters);
          }}
        >
          <Option value="李员工">李员工</Option>
          <Option value="王员工">王员工</Option>
          <Option value="张经理">张经理</Option>
        </Select>
        <Button onClick={() => {
          setFilters({});
          loadContracts(1, pagination.limit, {});
        }}>
          重置
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={contracts}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => loadContracts(page, pageSize, filters)
        }}
      />

      <Modal
        title="编辑合同"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdate}>
          <Form.Item name="electronic_sign_status" label="电子签状态">
            <Select>
              <Option value="pending">待签署</Option>
              <Option value="signed">已签署</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>
          </Form.Item>
          <Form.Item name="paper_archived" label="纸质归档">
            <Select>
              <Option value={1}>已归档</Option>
              <Option value={0}>未归档</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="合同状态">
            <Select>
              <Option value="active">生效中</Option>
              <Option value="expired">已到期</Option>
              <Option value="renewed">已续约</Option>
              <Option value="terminated">已终止</Option>
            </Select>
          </Form.Item>
          <Form.Item name="responsible_person" label="负责人">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="变更历史"
        placement="right"
        width={600}
        open={historyVisible}
        onClose={() => setHistoryVisible(false)}
      >
        <Table
          dataSource={historyData}
          rowKey="id"
          pagination={false}
        >
          <Table.Column title="字段" dataIndex="field_name" />
          <Table.Column title="旧值" dataIndex="old_value" />
          <Table.Column title="新值" dataIndex="new_value" />
          <Table.Column title="操作人" dataIndex="changed_by" />
          <Table.Column 
            title="变更时间" 
            dataIndex="changed_at" 
            render={(val) => dayjs(val).format('YYYY-MM-DD HH:mm')}
          />
        </Table>
      </Drawer>
    </div>
  );
}

export default ContractList;
