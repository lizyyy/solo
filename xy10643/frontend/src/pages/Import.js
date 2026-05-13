import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Upload, Select, message, Space, Typography } from 'antd';
import { UploadOutlined, FileTextOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;
const { Text } = Typography;

function ImportPage() {
  const [records, setRecords] = useState([]);
  const [importType, setImportType] = useState('member');
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadImportRecords();
  }, []);

  const loadImportRecords = async () => {
    try {
      const res = await axios.get('/api/import-records');
      setRecords(res.data);
    } catch (err) {
      message.error('加载导入记录失败');
    }
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.error('请选择文件');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', fileList[0].originFileObj);
    formData.append('type', importType);
    formData.append('operator', '管理员');

    try {
      const res = await axios.post('/api/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(`导入成功！成功${res.data.successCount}条，失败${res.data.failedCount}条`);
      setFileList([]);
      loadImportRecords();
    } catch (err) {
      message.error('导入失败');
    }
    setUploading(false);
  };

  const columns = [
    { title: '导入编号', dataIndex: 'import_no', key: 'import_no' },
    { title: '文件名', dataIndex: 'file_name', key: 'file_name' },
    { title: '总数量', dataIndex: 'total_count', key: 'total_count' },
    { title: '成功数量', dataIndex: 'success_count', key: 'success_count' },
    { title: '失败数量', dataIndex: 'failed_count', key: 'failed_count' },
    { title: '操作人', dataIndex: 'operator', key: 'operator' },
    { title: '导入时间', dataIndex: 'import_time', key: 'import_time',
      render: (time) => moment(time).format('YYYY-MM-DD HH:mm')
    }
  ];

  return (
    <div>
      <h2>批量导入</h2>
      
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>选择导入类型：</Text>
            <Select
              value={importType}
              onChange={setImportType}
              style={{ width: 200, marginLeft: 16 }}
            >
              <Option value="member">会员数据</Option>
              <Option value="verification">核销记录</Option>
            </Select>
          </div>
          
          <div style={{ marginTop: 16 }}>
            <Text strong>选择CSV文件：</Text>
            <Upload
              fileList={fileList}
              beforeUpload={(file) => {
                setFileList([file]);
                return false;
              }}
              onRemove={() => setFileList([])}
              accept=".csv"
              style={{ marginLeft: 16 }}
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </div>

          <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
            <Text type="secondary">
              <FileTextOutlined style={{ marginRight: 8 }} />
              CSV文件格式说明：
              <br />
              - 会员数据：member_no, name, phone, level(可选), points(可选)
              <br />
              - 核销记录：verification_no, coupon_id, member_id, store_id, operator, verification_time, order_amount, discount_amount
            </Text>
          </div>

          <Button
            type="primary"
            onClick={handleUpload}
            loading={uploading}
            style={{ marginTop: 16 }}
          >
            开始导入
          </Button>
        </Space>
      </Card>

      <Card title="导入历史">
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

export default ImportPage;
