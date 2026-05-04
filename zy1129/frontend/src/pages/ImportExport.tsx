import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Tabs,
  Upload,
  Button,
  message,
  Select,
  Alert,
  Descriptions,
  Row,
  Col,
  Divider,
  Space,
  Tag,
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  FileTextOutlined,
  FileMarkdownOutlined,
  TableOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { importApi, exportApi, membersApi } from '../services/api';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import type { Member } from '../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const ImportExport: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importType, setImportType] = useState<string>('policies');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [exportFormat, setExportFormat] = useState<'csv' | 'markdown' | 'html'>('html');
  const [exportMemberId, setExportMemberId] = useState<number | undefined>();
  const [exportPolicyType, setExportPolicyType] = useState<string | undefined>();
  const [exporting, setExporting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const response = await membersApi.list();
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  };

  const handleUploadChange: UploadProps['onChange'] = (info) => {
    let newFileList = [...info.fileList];
    newFileList = newFileList.slice(-5);
    setFileList(newFileList);
  };

  const handleImport = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择要导入的文件');
      return;
    }

    const file = fileList[0];
    if (!file.originFileObj) {
      message.warning('文件无效');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      let response;
      if (importType === 'policies') {
        response = await importApi.importPolicies(file.originFileObj);
      } else if (importType === 'members') {
        response = await importApi.importMembers(file.originFileObj);
      } else if (importType === 'rules') {
        response = await importApi.importClaimRules(file.originFileObj);
      } else {
        throw new Error('未知的导入类型');
      }
      
      setImportResult(response.data);
      message.success('导入成功');
      setFileList([]);
    } catch (error: any) {
      message.error(error.response?.data?.detail || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: any = {
        format: exportFormat,
      };
      if (exportMemberId) {
        params.member_id = exportMemberId;
      }
      if (exportPolicyType) {
        params.policy_type = exportPolicyType;
      }

      const response = await exportApi.exportAllReport(params);
      
      const blob = new Blob([response.data], { 
        type: exportFormat === 'html' ? 'text/html' : 
              exportFormat === 'markdown' ? 'text/markdown' : 'text/csv' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `insurance-report-${new Date().toISOString().split('T')[0]}.${exportFormat === 'markdown' ? 'md' : exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const uploadProps: UploadProps = {
    fileList,
    onChange: handleUploadChange,
    beforeUpload: () => false,
    multiple: true,
    accept: '.csv,.json',
  };

  return (
    <div>
      <Title level={2}>数据导入导出</Title>
      
      <Tabs defaultActiveKey="export">
        <TabPane tab="数据导出" key="export">
          <Card>
            <Title level={4}>导出保险报告</Title>
            <Paragraph>
              支持导出 <Tag color="blue">Markdown</Tag>、<Tag color="green">HTML</Tag>、<Tag color="orange">CSV</Tag> 三种格式。
              可以按成员或险种类型筛选导出内容。
            </Paragraph>

            <Row gutter={16}>
              <Col span={8}>
                <Descriptions column={1} bordered>
                  <Descriptions.Item label="导出格式">
                    <Select
                      value={exportFormat}
                      onChange={setExportFormat}
                      style={{ width: '100%' }}
                    >
                      <Option value="html">
                        <FileTextOutlined /> HTML 格式
                      </Option>
                      <Option value="markdown">
                        <FileMarkdownOutlined /> Markdown 格式
                      </Option>
                      <Option value="csv">
                        <TableOutlined /> CSV 格式
                      </Option>
                    </Select>
                  </Descriptions.Item>
                  <Descriptions.Item label="筛选成员（可选）">
                    <Select
                      value={exportMemberId}
                      onChange={setExportMemberId}
                      style={{ width: '100%' }}
                      allowClear
                      placeholder="全部成员"
                    >
                      <Option value={undefined}>全部成员</Option>
                      {members.map(member => (
                        <Option key={member.id} value={member.id}>
                          {member.name} ({member.relationship})
                        </Option>
                      ))}
                    </Select>
                  </Descriptions.Item>
                  <Descriptions.Item label="筛选险种（可选）">
                    <Select
                      value={exportPolicyType}
                      onChange={setExportPolicyType}
                      style={{ width: '100%' }}
                      allowClear
                      placeholder="全部险种"
                    >
                      <Option value={undefined}>全部险种</Option>
                      <Option value="medical">医疗险</Option>
                      <Option value="accident">意外险</Option>
                      <Option value="auto">车险</Option>
                      <Option value="property">家财险</Option>
                    </Select>
                  </Descriptions.Item>
                </Descriptions>
                
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  loading={exporting}
                  style={{ marginTop: 16, width: '100%' }}
                  size="large"
                >
                  导出报告
                </Button>
              </Col>

              <Col span={16}>
                <Alert
                  message="导出说明"
                  description={
                    <div>
                      <Paragraph>
                        <strong>导出内容包含：</strong>
                      </Paragraph>
                      <ul>
                        <li>家庭成员列表及基本信息</li>
                        <li>保单列表，含保障责任详情</li>
                        <li>出险事件记录</li>
                        <li>理赔申请记录及状态时间线</li>
                        <li>风险看板汇总信息</li>
                      </ul>
                      <Divider />
                      <Paragraph>
                        <strong>格式说明：</strong>
                      </Paragraph>
                      <ul>
                        <li><strong>HTML</strong>：包含样式，可直接用浏览器打开查看</li>
                        <li><strong>Markdown</strong>：纯文本格式，适合编辑和版本控制</li>
                        <li><strong>CSV</strong>：表格格式，适合用 Excel 打开</li>
                      </ul>
                    </div>
                  }
                  type="info"
                  showIcon
                  icon={<InfoCircleOutlined />}
                />
              </Col>
            </Row>
          </Card>
        </TabPane>

        <TabPane tab="数据导入" key="import">
          <Card>
            <Title level={4}>导入保险数据</Title>
            <Paragraph>
              支持导入 <Tag color="blue">policies.csv</Tag>（保单）、<Tag color="green">members.csv</Tag>（成员）、
              <Tag color="orange">claim-rules.json</Tag>（理赔规则）等文件。
            </Paragraph>

            <Row gutter={16}>
              <Col span={10}>
                <Card 
                  title="上传文件" 
                  type="inner"
                  style={{ marginBottom: 16 }}
                >
                  <Descriptions column={1} bordered style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="导入类型">
                      <Select
                        value={importType}
                        onChange={setImportType}
                        style={{ width: '100%' }}
                      >
                        <Option value="policies">保单 (policies.csv)</Option>
                        <Option value="members">成员 (members.csv)</Option>
                        <Option value="rules">理赔规则 (claim-rules.json)</Option>
                      </Select>
                    </Descriptions.Item>
                  </Descriptions>

                  <Upload.Dragger {...uploadProps}>
                    <p className="ant-upload-drag-icon">
                      <UploadOutlined />
                    </p>
                    <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                    <p className="ant-upload-hint">
                      支持 {importType === 'rules' ? 'JSON' : 'CSV'} 格式
                    </p>
                  </Upload.Dragger>
                  
                  <Button
                    type="primary"
                    onClick={handleImport}
                    loading={importing}
                    style={{ marginTop: 16, width: '100%' }}
                    size="large"
                  >
                    开始导入
                  </Button>
                </Card>

                {importResult && (
                  <Card title="导入结果" type="inner">
                    <Descriptions column={1}>
                      <Descriptions.Item label="文件名">
                        {importResult.filename}
                      </Descriptions.Item>
                      {importResult.result && (
                        <Descriptions.Item label="结果">
                          <Tag color="green">成功 {importResult.result.imported || 0} 条</Tag>
                          {importResult.result.errors > 0 && (
                            <Tag color="red" style={{ marginLeft: 8 }}>错误 {importResult.result.errors} 条</Tag>
                          )}
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </Card>
                )}
              </Col>

              <Col span={14}>
                <Alert
                  message="导入文件格式说明"
                  description={
                    <div>
                      <Title level={5}>1. policies.csv（保单文件）</Title>
                      <Paragraph>
                        必需列：policy_number, insurance_company, policy_type, start_date, end_date
                      </Paragraph>
                      <Paragraph>
                        可选列：insured_member_name, waiting_period_days, deductible_amount, premium_amount 等
                      </Paragraph>
                      
                      <Divider />
                      
                      <Title level={5}>2. members.csv（成员文件）</Title>
                      <Paragraph>
                        必需列：name, relationship
                      </Paragraph>
                      <Paragraph>
                        可选列：birth_date, gender, notes
                      </Paragraph>
                      
                      <Divider />
                      
                      <Title level={5}>3. claim-rules.json（理赔规则文件）</Title>
                      <Paragraph>
                        定义各险种的理赔规则，包括材料要求、免赔额规则、等待期规则等。
                      </Paragraph>

                      <Alert
                        message="提示"
                        description="系统自带示例文件位于 backend/samples/ 目录下，可参考格式准备导入数据。"
                        type="info"
                        style={{ marginTop: 16 }}
                      />
                    </div>
                  }
                  type="info"
                  showIcon
                />
              </Col>
            </Row>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default ImportExport;
