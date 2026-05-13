import { useState, useEffect } from 'react';
import { Table, Card, Row, Col, Badge, Button, Space, DatePicker, Tag, Modal, Form, Select, Input, message } from 'antd';
import dayjs from 'dayjs';
import axios from 'axios';

const { TextArea } = Input;

interface AbnormalRecord {
  id: string;
  studentName: string;
  studentNo: string;
  parentName: string;
  parentPhone: string;
  routeName: string;
  stopName: string;
  actualStopName?: string;
  attendanceDate: string;
  direction: string;
  status: string;
  parentConfirmed: number;
}

interface Stop {
  id: string;
  name: string;
  routeId: string;
}

export default function Dashboard() {
  const [records, setRecords] = useState<AbnormalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [changeModalVisible, setChangeModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AbnormalRecord | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/attendance/abnormal?date=${selectedDate}`);
      setRecords(res.data);
    } catch (error) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleChangeStop = async (values: any) => {
    if (!selectedRecord) return;
    try {
      await axios.post(`/api/attendance/${selectedRecord.id}/change-stop`, {
        newStopId: values.newStopId,
        changedBy: '操作员',
        changeReason: values.changeReason,
      });
      message.success('改站成功');
      setChangeModalVisible(false);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '改站失败');
    }
  };

  const handleParentConfirm = async (record: AbnormalRecord) => {
    try {
      await axios.post(`/api/attendance/${record.id}/confirm`);
      message.success('确认成功');
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '确认失败');
    }
  };

  const openChangeModal = async (record: AbnormalRecord) => {
    setSelectedRecord(record);
    const routeRes = await axios.get('/api/routes');
    const currentRoute = routeRes.data.find((r: any) => r.name === record.routeName);
    if (currentRoute) {
      const stopsRes = await axios.get(`/api/routes/${currentRoute.id}/stops`);
      setStops(stopsRes.data);
    }
    setChangeModalVisible(true);
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      normal: { color: 'green', text: '正常' },
      absent: { color: 'red', text: '缺勤' },
      changed: { color: 'orange', text: '改站' },
      leave: { color: 'blue', text: '请假' },
    };
    const { color, text } = statusMap[status] || { color: 'default', text: status };
    return <Tag color={color}>{text}</Tag>;
  };

  const columns = [
    {
      title: '学生姓名',
      dataIndex: 'studentName',
      key: 'studentName',
    },
    {
      title: '学号',
      dataIndex: 'studentNo',
      key: 'studentNo',
    },
    {
      title: '线路',
      dataIndex: 'routeName',
      key: 'routeName',
    },
    {
      title: '站点',
      dataIndex: 'stopName',
      key: 'stopName',
      render: (text: string, record: AbnormalRecord) => (
        <div>
          <div>原定: {text}</div>
          {record.actualStopName && <div style={{ color: '#fa8c16' }}>实际: {record.actualStopName}</div>}
        </div>
      ),
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      render: (text: string) => (text === 'morning' ? '上学' : '放学'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => getStatusTag(text),
    },
    {
      title: '家长确认',
      dataIndex: 'parentConfirmed',
      key: 'parentConfirmed',
      render: (confirmed: number) => (
        <Badge status={confirmed ? 'success' : 'warning'} text={confirmed ? '已确认' : '待确认'} />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AbnormalRecord) => (
        <Space size="small">
          {record.status !== 'changed' && !record.parentConfirmed && (
            <Button type="link" size="small" onClick={() => openChangeModal(record)}>
              改站
            </Button>
          )}
          {!record.parentConfirmed && (
            <Button type="link" size="small" onClick={() => handleParentConfirm(record)}>
              确认
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const stats = {
    total: records.length,
    changed: records.filter(r => r.status === 'changed').length,
    absent: records.filter(r => r.status === 'absent').length,
    unconfirmed: records.filter(r => !r.parentConfirmed).length,
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <DatePicker
          defaultValue={dayjs()}
          onChange={(date) => date && setSelectedDate(date.format('YYYY-MM-DD'))}
        />
        <Button type="primary" onClick={loadData}>
          刷新
        </Button>
      </Space>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.total}</div>
              <div style={{ color: '#666' }}>异常总数</div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fa8c16' }}>{stats.changed}</div>
              <div style={{ color: '#666' }}>改站记录</div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{stats.absent}</div>
              <div style={{ color: '#666' }}>缺勤记录</div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>{stats.unconfirmed}</div>
              <div style={{ color: '#666' }}>待确认</div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="异常记录列表">
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="改站申请"
        open={changeModalVisible}
        onCancel={() => setChangeModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleChangeStop}>
          <Form.Item label="学生" name="studentName">
            <Input value={selectedRecord?.studentName} disabled />
          </Form.Item>
          <Form.Item label="原站点" name="originalStop">
            <Input value={selectedRecord?.stopName} disabled />
          </Form.Item>
          <Form.Item
            label="新站点"
            name="newStopId"
            rules={[{ required: true, message: '请选择新站点' }]}
          >
            <Select placeholder="请选择新站点">
              {stops.map((stop) => (
                <Select.Option key={stop.id} value={stop.id}>
                  {stop.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="改站原因"
            name="changeReason"
            rules={[{ required: true, message: '请填写改站原因' }]}
          >
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
