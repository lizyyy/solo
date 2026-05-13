import React, { useState, useEffect } from 'react';
import { Layout, Menu, Table, Button, Space, Card, Row, Col, message, Modal, Form, Input, Select, DatePicker, Upload, Timeline, Tag } from 'antd';
import { ExportOutlined, ImportOutlined, FileTextOutlined, CheckCircleOutlined, StopOutlined, UserOutlined, RetweetOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { Option } = Select;

const App = () => {
    const [licenses, setLicenses] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [logs, setLogs] = useState([]);
    const [selectedLicense, setSelectedLicense] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [timelineVisible, setTimelineVisible] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        fetchLicenses();
        fetchCompanies();
        fetchLogs();
    }, []);

    const fetchLicenses = async (filters = {}) => {
        try {
            const res = await axios.get('/api/licenses', { params: filters });
            setLicenses(res.data);
        } catch (error) {
            message.error('获取证照列表失败');
        }
    };

    const fetchCompanies = async () => {
        try {
            const res = await axios.get('/api/companies');
            setCompanies(res.data);
        } catch (error) {
            message.error('获取公司列表失败');
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await axios.get('/api/logs');
            setLogs(res.data);
        } catch (error) {
            message.error('获取操作日志失败');
        }
    };

    const fetchTimeline = async (licenseId) => {
        try {
            const res = await axios.get(`/api/licenses/${licenseId}/timeline`);
            setTimeline(res.data);
            setTimelineVisible(true);
        } catch (error) {
            message.error('获取时间线失败');
        }
    };

    const handleExport = async () => {
        try {
            const res = await axios.post('/api/licenses/export', {}, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', '证照列表.xlsx');
            document.body.appendChild(link);
            link.click();
            message.success('导出成功');
        } catch (error) {
            message.error('导出失败');
        }
    };

    const handleImport = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await axios.post('/api/licenses/import', formData);
            message.success(`导入成功: ${res.data.success} 条，失败: ${res.data.failed} 条`);
            fetchLicenses();
        } catch (error) {
            message.error('导入失败');
        }
        return false;
    };

    const runDemo = async (type) => {
        try {
            const res = await axios.post(`/api/demo/${type}`);
            message.success(res.data.message);
            fetchLicenses();
            fetchLogs();
        } catch (error) {
            message.error(error.response?.data?.error || '演示失败');
        }
    };

    const handleSubmit = async (values) => {
        try {
            await axios.post(`/api/licenses/${selectedLicense.id}/submit`, {
                ...values,
                operator: 'current_user'
            });
            message.success('提交成功');
            setModalVisible(false);
            fetchLicenses();
            fetchLogs();
        } catch (error) {
            message.error(error.response?.data?.error || '提交失败');
        }
    };

    const columns = [
        { title: '公司名称', dataIndex: 'company_name', key: 'company_name' },
        { title: '证照类型', dataIndex: 'license_type_name', key: 'license_type_name' },
        { title: '证照编号', dataIndex: 'license_number', key: 'license_number' },
        { title: '年检截止日期', dataIndex: 'annual_check_deadline', key: 'annual_check_deadline',
            render: (text) => <span style={{ color: dayjs(text).isBefore(dayjs()) ? 'red' : 'inherit' }}>{text}</span>
        },
        { title: '负责人', dataIndex: 'responsible_person', key: 'responsible_person' },
        { title: '状态', dataIndex: 'status', key: 'status',
            render: (status) => {
                const colorMap = { pending: 'orange', completed: 'green', reviewing: 'blue' };
                const textMap = { pending: '待处理', completed: '已完成', reviewing: '审核中' };
                return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
            }
        },
        { title: '风险等级', dataIndex: 'risk_level', key: 'risk_level',
            render: (level) => {
                const colorMap = { low: 'green', medium: 'orange', high: 'red' };
                return <Tag color={colorMap[level]}>{level === 'low' ? '低' : level === 'medium' ? '中' : '高'}</Tag>;
            }
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space>
                    <Button type="link" onClick={() => { setSelectedLicense(record); setModalVisible(true); }}>提交年检</Button>
                    <Button type="link" onClick={() => fetchTimeline(record.id)}>查看时间线</Button>
                </Space>
            )
        }
    ];

    const statusColorMap = {
        success: 'green',
        blocked: 'red',
        manual: 'blue',
        idempotent: 'purple'
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
                <h1 style={{ margin: 0 }}>企业证照年检催办系统</h1>
            </Header>
            <Layout>
                <Sider width={200} style={{ background: '#fff' }}>
                    <Menu mode="inline" defaultSelectedKeys={['1']} style={{ height: '100%' }}>
                        <Menu.Item key="1" icon={<FileTextOutlined />}>证照列表</Menu.Item>
                    </Menu>
                    <div style={{ padding: 16 }}>
                        <h4>演示路径</h4>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Button icon={<CheckCircleOutlined />} type="primary" block onClick={() => runDemo('success')}>成功路径</Button>
                            <Button icon={<StopOutlined />} danger block onClick={() => runDemo('blocked')}>拦截路径</Button>
                            <Button icon={<UserOutlined />} block onClick={() => runDemo('manual')}>人工修正</Button>
                            <Button icon={<RetweetOutlined />} block onClick={() => runDemo('duplicate')}>重复提交</Button>
                        </Space>
                    </div>
                </Sider>
                <Layout style={{ padding: '24px' }}>
                    <Content>
                        <Card>
                            <Row gutter={16} style={{ marginBottom: 16 }}>
                                <Col>
                                    <Space>
                                        <Button icon={<ExportOutlined />} onClick={handleExport}>导出Excel</Button>
                                        <Upload beforeUpload={handleImport} showUploadList={false}>
                                            <Button icon={<ImportOutlined />}>导入Excel</Button>
                                        </Upload>
                                    </Space>
                                </Col>
                            </Row>
                            <Table columns={columns} dataSource={licenses} rowKey="id" />
                        </Card>

                        {logs.length > 0 && (
                            <Card title="最近操作日志" style={{ marginTop: 24 }}>
                                <Table
                                    dataSource={logs.slice(0, 10)}
                                    rowKey="id"
                                    columns={[
                                        { title: '操作类型', dataIndex: 'operation_type', key: 'operation_type' },
                                        { title: '状态', dataIndex: 'operation_status', key: 'operation_status',
                                            render: (status) => <Tag color={statusColorMap[status] || 'default'}>{status}</Tag>
                                        },
                                        { title: '详情', dataIndex: 'details', key: 'details' },
                                        { title: '失败原因', dataIndex: 'failure_reason', key: 'failure_reason' },
                                        { title: '操作人', dataIndex: 'operator', key: 'operator' },
                                        { title: '时间', dataIndex: 'created_at', key: 'created_at' }
                                    ]}
                                    pagination={false}
                                />
                            </Card>
                        )}
                    </Content>
                </Layout>
            </Layout>

            <Modal title="提交年检" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null}>
                <Form form={form} onFinish={handleSubmit} layout="vertical">
                    <Form.Item name="responsible_person" label="负责人" rules={[{ required: true }]}>
                        <Input placeholder="请输入负责人姓名" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block>提交</Button>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal title="操作时间线" open={timelineVisible} onCancel={() => setTimelineVisible(false)} footer={null} width={600}>
                <Timeline>
                    {timeline.map((item, index) => (
                        <Timeline.Item key={index} color={statusColorMap[item.operation_status] || 'blue'}>
                            <p><strong>{item.details}</strong></p>
                            <p style={{ fontSize: 12, color: '#999' }}>操作人: {item.operator} | {item.created_at}</p>
                            {item.failure_reason && <p style={{ color: 'red' }}>失败原因: {item.failure_reason}</p>}
                        </Timeline.Item>
                    ))}
                </Timeline>
            </Modal>
        </Layout>
    );
};

export default App;
