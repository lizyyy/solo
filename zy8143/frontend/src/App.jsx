import React, { useState } from 'react';
import { Layout, Menu, Typography, Card, Alert, Button, Upload, message, Tree, Table, Tag, Modal, Space, Popconfirm, Divider, Progress, Descriptions, Tabs, TreeSelect } from 'antd';
import { 
  UploadOutlined, 
  FileTextOutlined, 
  CheckCircleOutlined, 
  ExportOutlined, 
  WarningOutlined, 
  FolderOpenOutlined, 
  FileOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

// 风险等级颜色映射
const riskLevelColors = {
  high: 'red',
  medium: 'orange',
  low: 'blue'
};

// 风险等级标签
const RiskLevelTag = ({ level }) => {
  const colors = {
    high: 'error',
    medium: 'warning',
    low: 'processing'
  };
  const labels = {
    high: '高风险',
    medium: '中风险',
    low: '低风险'
  };
  return <Tag color={colors[level]}>{labels[level]}</Tag>;
};

// 校验状态标签
const ValidationStatusTag = ({ status }) => {
  if (status === 'passed') {
    return <Tag icon={<CheckCircleOutlined />} color="success">通过</Tag>;
  } else if (status === 'failed') {
    return <Tag icon={<WarningOutlined />} color="error">未通过</Tag>;
  } else if (status === 'pending') {
    return <Tag color="default">待校验</Tag>;
  }
  return <Tag color="default">{status}</Tag>;
};

const App = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // 文件上传属性
  const uploadProps = {
    multiple: true,
    accept: '.json,.jsonl,.csv,.yaml,.yml',
    fileList: uploadedFiles,
    onChange(info) {
      const { status } = info.file;
      if (status !== 'uploading') {
        console.log(info.file, info.fileList);
      }
      if (status === 'done') {
        message.success(`${info.file.name} 上传成功`);
      } else if (status === 'error') {
        message.error(`${info.file.name} 上传失败`);
      }
      setUploadedFiles(info.fileList);
    },
    beforeUpload: (file) => {
      const validTypes = [
        'case_manifest.json', 
        'documents.csv', 
        'ocr_text.jsonl', 
        'signature_log.jsonl', 
        'archive_rules.yaml',
        'archive_rules.yml'
      ];
      if (!validTypes.includes(file.name)) {
        message.error(`文件 ${file.name} 不是有效的归档文件`);
        return Upload.LIST_IGNORE;
      }
      return false; // 不上传，只在前端收集
    }
  };

  // 开始校验
  const handleValidate = async () => {
    if (uploadedFiles.length === 0) {
      message.error('请先上传需要校验的文件');
      return;
    }

    // 检查是否上传了必需的文件
    const requiredFiles = [
      'case_manifest.json', 
      'documents.csv', 
      'ocr_text.jsonl', 
      'signature_log.jsonl',
      'archive_rules.yaml',
      'archive_rules.yml'
    ];

    const uploadedFileNames = uploadedFiles.map(f => f.name);
    const missingFiles = requiredFiles.filter(f => {
      if (f === 'archive_rules.yaml' || f === 'archive_rules.yml') {
        return !uploadedFileNames.includes('archive_rules.yaml') && !uploadedFileNames.includes('archive_rules.yml');
      }
      return !uploadedFileNames.includes(f);
    });

    if (missingFiles.length > 0) {
      message.error(`缺少必需的文件: ${missingFiles.join(', ')}`);
      return;
    }

    setIsValidating(true);

    try {
      // 构建 FormData
      const formData = new FormData();
      uploadedFiles.forEach(file => {
        formData.append('files', file.originFileObj || file);
      });

      // 发送到后端
      const response = await axios.post('/api/validate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log('上传进度:', percentCompleted);
        }
      });

      setValidationResult(response.data);
      message.success('校验完成');
    } catch (error) {
      console.error('校验出错:', error);
      message.error('校验过程中发生错误: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsValidating(false);
    }
  };

  // 构建案件/材料树数据
  const buildTreeData = () => {
    if (!validationResult || !validationResult.cases) return [];

    return validationResult.cases.map(caseItem => ({
      title: (
        <span>
          <FolderOpenOutlined /> {caseItem.caseNumber} 
          {caseItem.risks && caseItem.risks.length > 0 && (
            <Tag color="error" style={{ marginLeft: 8 }}>
              {caseItem.risks.length} 个风险
            </Tag>
          )}
        </span>
      ),
      key: `case-${caseItem.caseNumber}`,
      caseData: caseItem,
      children: caseItem.documents?.map(doc => ({
        title: (
          <span>
            <FileOutlined /> {doc.documentName} (页: {doc.startPage}-{doc.endPage})
            {doc.risks && doc.risks.length > 0 && (
              <Tag color="orange" style={{ marginLeft: 8 }}>
                {doc.risks.length} 个风险
              </Tag>
            )}
          </span>
        ),
        key: `doc-${doc.documentId}`,
        docData: doc
      })) || []
    }));
  };

  // 处理树节点点击
  const handleTreeSelect = (selectedKeys, info) => {
    if (!selectedKeys || selectedKeys.length === 0) {
      setSelectedCase(null);
      setSelectedDocument(null);
      return;
    }

    const key = selectedKeys[0];
    if (key.startsWith('case-')) {
      setSelectedCase(info.node.caseData);
      setSelectedDocument(null);
    } else if (key.startsWith('doc-')) {
      setSelectedDocument(info.node.docData);
      // 查找所属案件
      const treeData = buildTreeData();
      for (const caseNode of treeData) {
        if (caseNode.children.some(child => child.key === key)) {
          setSelectedCase(caseNode.caseData);
          break;
        }
      }
    }
  };

  // 导出功能
  const handleExport = async (type) => {
    if (!validationResult) {
      message.error('没有可导出的校验结果');
      return;
    }

    setIsExporting(true);
    try {
      const response = await axios.post(`/api/export/${type}`, {
        validationResult: validationResult
      }, {
        responseType: 'blob'
      });

      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // 根据类型设置文件名
      let fileName = '';
      if (type === 'report') {
        fileName = 'review_report.md';
      } else if (type === 'issues') {
        fileName = 'issues.csv';
      }
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success(`导出 ${fileName} 成功`);
    } catch (error) {
      console.error('导出出错:', error);
      message.error('导出失败: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // 处理确认风险
  const handleConfirmRisk = (riskId) => {
    if (!validationResult) return;

    const newResult = JSON.parse(JSON.stringify(validationResult));
    // 查找并更新风险状态
    for (const caseItem of newResult.cases) {
      for (const risk of caseItem.risks || []) {
        if (risk.id === riskId) {
          risk.confirmed = true;
          risk.confirmedAt = new Date().toISOString();
        }
      }
      for (const doc of caseItem.documents || []) {
        for (const risk of doc.risks || []) {
          if (risk.id === riskId) {
            risk.confirmed = true;
            risk.confirmedAt = new Date().toISOString();
          }
        }
      }
    }
    setValidationResult(newResult);
    message.success('已确认风险');
  };

  // 风险表格列
  const riskColumns = [
    {
      title: '风险等级',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level) => <RiskLevelTag level={level} />
    },
    {
      title: '风险类型',
      dataIndex: 'type',
      key: 'type',
      width: 150
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: '建议',
      dataIndex: 'suggestion',
      key: 'suggestion'
    },
    {
      title: '状态',
      dataIndex: 'confirmed',
      key: 'confirmed',
      width: 120,
      render: (confirmed) => confirmed ? 
        <Tag color="success">已确认</Tag> : 
        <Tag color="warning">待确认</Tag>
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          {!record.confirmed && (
            <Button 
              type="link" 
              size="small"
              onClick={() => handleConfirmRisk(record.id)}
            >
              确认
            </Button>
          )}
        </Space>
      )
    }
  ];

  // 文档表格列
  const documentColumns = [
    {
      title: '文书名称',
      dataIndex: 'documentName',
      key: 'documentName'
    },
    {
      title: '文书类型',
      dataIndex: 'documentType',
      key: 'documentType'
    },
    {
      title: '页码范围',
      key: 'pageRange',
      render: (_, record) => `${record.startPage} - ${record.endPage}`
    },
    {
      title: '总页数',
      dataIndex: 'pageCount',
      key: 'pageCount'
    },
    {
      title: '电子签名',
      dataIndex: 'hasSignature',
      key: 'hasSignature',
      render: (has) => has ? 
        <Tag color="green">有签名</Tag> : 
        <Tag color="default">无签名</Tag>
    },
    {
      title: '风险数量',
      key: 'riskCount',
      render: (_, record) => (
        record.risks?.length > 0 ? 
          <Tag color="error">{record.risks.length} 个</Tag> : 
          <Tag color="success">0 个</Tag>
      )
    }
  ];

  // 统计信息
  const getStatistics = () => {
    if (!validationResult) return null;

    let totalCases = 0;
    let totalDocuments = 0;
    let totalRisks = 0;
    let highRisks = 0;
    let mediumRisks = 0;
    let lowRisks = 0;
    let confirmedRisks = 0;

    validationResult.cases.forEach(caseItem => {
      totalCases++;
      totalDocuments += caseItem.documents?.length || 0;
      
      caseItem.risks?.forEach(risk => {
        totalRisks++;
        if (risk.level === 'high') highRisks++;
        else if (risk.level === 'medium') mediumRisks++;
        else lowRisks++;
        if (risk.confirmed) confirmedRisks++;
      });

      caseItem.documents?.forEach(doc => {
        doc.risks?.forEach(risk => {
          totalRisks++;
          if (risk.level === 'high') highRisks++;
          else if (risk.level === 'medium') mediumRisks++;
          else lowRisks++;
          if (risk.confirmed) confirmedRisks++;
        });
      });
    });

    return {
      totalCases,
      totalDocuments,
      totalRisks,
      highRisks,
      mediumRisks,
      lowRisks,
      confirmedRisks,
      unconfirmedRisks: totalRisks - confirmedRisks
    };
  };

  const stats = getStatistics();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!collapsed && <Text strong style={{ color: 'white' }}>电子卷宗验收</Text>}
        </div>
        <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline">
          <Menu.Item key="1" icon={<FileTextOutlined />}>
            文件上传与校验
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout className="site-layout">
        <Header style={{ padding: 0, background: '#fff', boxShadow: '0 1px 4px rgba(0,21,41,0.08)' }}>
          <div style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Title level={3} style={{ margin: 0 }}>电子卷宗归档验收工作台</Title>
            <Space>
              {validationResult && (
                <>
                  <Button 
                    icon={<ExportOutlined />} 
                    onClick={() => handleExport('report')}
                    loading={isExporting}
                  >
                    导出审查报告
                  </Button>
                  <Button 
                    icon={<ExportOutlined />} 
                    onClick={() => handleExport('issues')}
                    loading={isExporting}
                  >
                    导出问题清单
                  </Button>
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={() => {
                      setValidationResult(null);
                      setUploadedFiles([]);
                      setSelectedCase(null);
                      setSelectedDocument(null);
                    }}
                  >
                    重新开始
                  </Button>
                </>
              )}
            </Space>
          </div>
        </Header>
        <Content style={{ margin: '16px' }}>
          {!validationResult ? (
            // 文件上传区域
            <Card title="上传归档文件">
              <Alert
                message="支持的文件类型"
                description="请上传以下文件：case_manifest.json、documents.csv、ocr_text.jsonl、signature_log.jsonl、archive_rules.yaml (或 .yml)"
                type="info"
                style={{ marginBottom: 24 }}
              />
              
              <Upload.Dragger {...uploadProps}>
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">
                  支持 .json, .jsonl, .csv, .yaml, .yml 格式
                </p>
              </Upload.Dragger>

              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Button 
                  type="primary" 
                  size="large" 
                  onClick={handleValidate}
                  loading={isValidating}
                  disabled={uploadedFiles.length === 0}
                >
                  {isValidating ? '校验中...' : '开始校验'}
                </Button>
              </div>
            </Card>
          ) : (
            // 校验结果展示区域
            <div>
              {/* 统计信息 */}
              {stats && (
                <Card style={{ marginBottom: 16 }}>
                  <Title level={4}>校验统计</Title>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: 24, display: 'block' }}>{stats.totalCases}</Text>
                      <Text type="secondary">案件数量</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: 24, display: 'block' }}>{stats.totalDocuments}</Text>
                      <Text type="secondary">文档数量</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: 24, display: 'block', color: '#ff4d4f' }}>{stats.totalRisks}</Text>
                      <Text type="secondary">风险总数</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: 24, display: 'block', color: '#ff4d4f' }}>{stats.highRisks}</Text>
                      <Text type="secondary">高风险</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: 24, display: 'block', color: '#fa8c16' }}>{stats.mediumRisks}</Text>
                      <Text type="secondary">中风险</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: 24, display: 'block', color: '#1890ff' }}>{stats.lowRisks}</Text>
                      <Text type="secondary">低风险</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ marginTop: 10 }}>
                        <Progress 
                          percent={stats.totalRisks > 0 ? Math.round((stats.confirmedRisks / stats.totalRisks) * 100) : 100} 
                          format={(percent) => `${percent}% 已确认`}
                        />
                      </div>
                      <Text type="secondary">确认进度</Text>
                    </div>
                  </div>
                </Card>
              )}

              {/* 主内容区：左侧树，右侧详情 */}
              <Layout style={{ background: '#fff', borderRadius: 8 }}>
                <Sider width={350} style={{ background: '#fafafa', borderRight: '1px solid #e8e8e8' }}>
                  <div style={{ padding: 16, borderBottom: '1px solid #e8e8e8' }}>
                    <Text strong>案件/材料树</Text>
                  </div>
                  <div style={{ padding: '8px 16px' }}>
                    <Tree
                      showLine={{ showLeafIcon: false }}
                      defaultExpandAll
                      onSelect={handleTreeSelect}
                      treeData={buildTreeData()}
                    />
                  </div>
                </Sider>
                <Layout style={{ background: '#fff' }}>
                  <Content style={{ padding: 16 }}>
                    {!selectedCase ? (
                      <div style={{ textAlign: 'center', padding: 50 }}>
                        <Text type="secondary">请从左侧选择案件或材料查看详情</Text>
                      </div>
                    ) : selectedDocument ? (
                      // 文档详情
                      <div>
                        <Title level={4}>文书详情</Title>
                        <Divider />
                        <Descriptions bordered column={2} size="middle" style={{ marginBottom: 24 }}>
                          <Descriptions.Item label="文书名称">{selectedDocument.documentName}</Descriptions.Item>
                          <Descriptions.Item label="文书类型">{selectedDocument.documentType}</Descriptions.Item>
                          <Descriptions.Item label="文书ID">{selectedDocument.documentId}</Descriptions.Item>
                          <Descriptions.Item label="所属案件">{selectedCase.caseNumber}</Descriptions.Item>
                          <Descriptions.Item label="开始页码">{selectedDocument.startPage}</Descriptions.Item>
                          <Descriptions.Item label="结束页码">{selectedDocument.endPage}</Descriptions.Item>
                          <Descriptions.Item label="总页数">{selectedDocument.pageCount}</Descriptions.Item>
                          <Descriptions.Item label="密级">{selectedDocument.classification || '未设置'}</Descriptions.Item>
                          <Descriptions.Item label="电子签名" span={2}>
                            {selectedDocument.hasSignature ? (
                              <span>
                                <Tag color="green">有签名</Tag>
                                {selectedDocument.signatureInfo && (
                                  <Text type="secondary" style={{ marginLeft: 8 }}>
                                    签名人: {selectedDocument.signatureInfo.signer || '未知'}, 
                                    有效期: {selectedDocument.signatureInfo.validFrom} - {selectedDocument.signatureInfo.validTo}
                                  </Text>
                                )}
                              </span>
                            ) : (
                              <Tag color="default">无签名</Tag>
                            )}
                          </Descriptions.Item>
                        </Descriptions>

                        {/* 文档风险 */}
                        {selectedDocument.risks && selectedDocument.risks.length > 0 && (
                          <div>
                            <Title level={5}>风险信息</Title>
                            <Table 
                              columns={riskColumns}
                              dataSource={selectedDocument.risks}
                              rowKey="id"
                              pagination={false}
                              size="small"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      // 案件详情
                      <div>
                        <Title level={4}>案件详情</Title>
                        <Divider />
                        <Descriptions bordered column={2} size="middle" style={{ marginBottom: 24 }}>
                          <Descriptions.Item label="案号">{selectedCase.caseNumber}</Descriptions.Item>
                          <Descriptions.Item label="案件类型">{selectedCase.caseType}</Descriptions.Item>
                          <Descriptions.Item label="年度">{selectedCase.year}</Descriptions.Item>
                          <Descriptions.Item label="法院">{selectedCase.court || '未设置'}</Descriptions.Item>
                          <Descriptions.Item label="开始页码">{selectedCase.startPage}</Descriptions.Item>
                          <Descriptions.Item label="结束页码">{selectedCase.endPage}</Descriptions.Item>
                          <Descriptions.Item label="总页数">{selectedCase.totalPages}</Descriptions.Item>
                          <Descriptions.Item label="文档数量">{selectedCase.documents?.length || 0}</Descriptions.Item>
                        </Descriptions>

                        <Tabs defaultActiveKey="documents">
                          <TabPane tab="文书列表" key="documents">
                            <Table 
                              columns={documentColumns}
                              dataSource={selectedCase.documents || []}
                              rowKey="documentId"
                              pagination={{ pageSize: 10 }}
                              size="small"
                              onRow={(record) => ({
                                onClick: () => setSelectedDocument(record)
                              })}
                            />
                          </TabPane>
                          <TabPane tab={`风险信息 (${selectedCase.risks?.length || 0})`} key="risks">
                            {selectedCase.risks && selectedCase.risks.length > 0 ? (
                              <Table 
                                columns={riskColumns}
                                dataSource={selectedCase.risks}
                                rowKey="id"
                                pagination={false}
                                size="small"
                              />
                            ) : (
                              <div style={{ textAlign: 'center', padding: 50 }}>
                                <Text type="secondary">该案件无风险</Text>
                              </div>
                            )}
                          </TabPane>
                        </Tabs>
                      </div>
                    )}
                  </Content>
                </Layout>
              </Layout>
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
