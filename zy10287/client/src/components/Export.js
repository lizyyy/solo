import React, { useState } from 'react';
import { Card, Button, Space, Select, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;

function Export({ projects }) {
  const [selectedProject, setSelectedProject] = useState('');
  const [exportType, setExportType] = useState('all');

  const handleExport = async () => {
    try {
      const res = await axios.get('/api/export', {
        params: {
          project: selectedProject || undefined,
          type: exportType
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `export_${exportType}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('导出成功');
    } catch (err) {
      message.error('导出失败');
    }
  };

  return (
    <Card title="数据导出">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <div style={{ marginBottom: 8 }}>选择项目：</div>
          <Select
            style={{ width: 300 }}
            placeholder="全部项目"
            value={selectedProject || undefined}
            onChange={setSelectedProject}
          >
            <Option value="">全部项目</Option>
            {projects.map(p => <Option key={p} value={p}>{p}</Option>)}
          </Select>
        </div>

        <div>
          <div style={{ marginBottom: 8 }}>导出类型：</div>
          <Select
            style={{ width: 300 }}
            value={exportType}
            onChange={setExportType}
          >
            <Option value="all">全部人员数据</Option>
            <Option value="noTraining">未培训人员</Option>
            <Option value="noBadgeReturn">未回收工牌人员</Option>
          </Select>
        </div>

        <Button
          type="primary"
          icon={<DownloadOutlined />}
          size="large"
          onClick={handleExport}
        >
          导出 Excel
        </Button>
      </Space>
    </Card>
  );
}

export default Export;
