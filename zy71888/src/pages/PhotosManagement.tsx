import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  message,
  Drawer,
  List,
  Avatar,
  Space,
  InputNumber,
} from 'antd';
import {
  Upload as UploadIcon,
  Plus,
  Eye,
  MessageSquare,
  FileText,
  Tag as TagIcon,
  Clock,
  User,
} from 'lucide-react';
import { useAppStore } from '../store';
import { tagColors, tagLabels } from '../data/mockData';
import { PhotoTag } from '../types';

const { TextArea } = Input;
const { Option } = Select;

export const PhotosManagement: React.FC = () => {
  const {
    photos,
    filterTags,
    searchKeyword,
    setFilterTags,
    setSearchKeyword,
    addPhoto,
    addCorrection,
  } = useAppStore();

  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [isDetailDrawerVisible, setIsDetailDrawerVisible] = useState(false);
  const [uploadForm] = Form.useForm();
  const [correctionForm] = Form.useForm();

  const filteredPhotos = photos.filter((photo) => {
    const matchesTag =
      filterTags.length === 0 ||
      filterTags.some((tag) => photo.tags.includes(tag));
    const matchesSearch =
      searchKeyword === '' ||
      photo.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      photo.description.toLowerCase().includes(searchKeyword.toLowerCase());
    return matchesTag && matchesSearch;
  });

  const selectedPhoto = photos.find((p) => p.id === selectedPhotoId);

  const handleUpload = (values: any) => {
    addPhoto({
      name: values.name,
      url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=scientific%20laboratory%20data%20graph&image_size=square',
      tags: values.tags,
      timestamp: new Date().toLocaleString('zh-CN'),
      uploader: '张助教',
      sensorLogs: [],
      corrections: [],
      description: values.description,
    });
    setIsUploadModalVisible(false);
    uploadForm.resetFields();
    message.success('照片上传成功');
  };

  const handleAddCorrection = (values: any) => {
    if (selectedPhotoId) {
      addCorrection(selectedPhotoId, values.content, values.author);
      correctionForm.resetFields();
      message.success('批改意见已添加');
    }
  };

  const handleViewDetail = (photoId: string) => {
    setSelectedPhotoId(photoId);
    setIsDetailDrawerVisible(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Input.Search
            placeholder="搜索照片名称或描述"
            style={{ width: 300 }}
            allowClear
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <Select
            mode="multiple"
            placeholder="按标签筛选"
            style={{ width: 300 }}
            value={filterTags}
            onChange={(value) => setFilterTags(value as PhotoTag[])}
            tagRender={(props) => {
              const { label, value, closable, onClose } = props;
              return (
                <Tag
                  color={tagColors[value as string]}
                  closable={closable}
                  onClose={onClose}
                  style={{ marginRight: 3 }}
                >
                  {label}
                </Tag>
              );
            }}
          >
            {Object.entries(tagLabels).map(([key, label]) => (
              <Option key={key} value={key}>
                {label}
              </Option>
            ))}
          </Select>
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => setIsUploadModalVisible(true)}
        >
          上传异常照片
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {filteredPhotos.map((photo) => (
          <Col span={6} key={photo.id}>
            <Card
              hoverable
              cover={
                <div className="relative h-48 overflow-hidden">
                  <img
                    alt={photo.name}
                    src={photo.url}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    {photo.tags.map((tag) => (
                      <Tag
                        key={tag}
                        color={tagColors[tag]}
                        style={{ margin: 0 }}
                      >
                        {tagLabels[tag]}
                      </Tag>
                    ))}
                  </div>
                </div>
              }
              actions={[
                <Button
                  type="text"
                  icon={<Eye size={16} />}
                  onClick={() => handleViewDetail(photo.id)}
                >
                  查看详情
                </Button>,
                <Button
                  type="text"
                  icon={<MessageSquare size={16} />}
                  onClick={() => handleViewDetail(photo.id)}
                >
                  {photo.corrections.length} 条意见
                </Button>,
              ]}
            >
              <Card.Meta
                title={
                  <div className="truncate" title={photo.name}>
                    {photo.name}
                  </div>
                }
                description={
                  <div className="space-y-1">
                    <div className="flex items-center text-xs text-gray-500">
                      <User size={12} className="mr-1" />
                      {photo.uploader}
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock size={12} className="mr-1" />
                      {photo.timestamp}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {photo.description}
                    </div>
                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title="上传异常照片"
        open={isUploadModalVisible}
        onCancel={() => setIsUploadModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={uploadForm}
          layout="vertical"
          onFinish={handleUpload}
        >
          <Form.Item
            name="upload"
            label="上传照片"
          >
            <Upload.Dragger
              accept="image/*"
              beforeUpload={() => false}
              showUploadList={true}
            >
              <p className="ant-upload-drag-icon">
                <UploadIcon size={48} className="mx-auto text-blue-500" />
              </p>
              <p className="ant-upload-text">点击或拖拽照片到此区域上传</p>
              <p className="ant-upload-hint">支持 JPG、PNG 格式</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item
            name="name"
            label="照片名称"
            rules={[{ required: true, message: '请输入照片名称' }]}
          >
            <Input placeholder="请输入照片名称" />
          </Form.Item>
          <Form.Item
            name="tags"
            label="异常标签"
            rules={[{ required: true, message: '请选择至少一个标签' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择异常类型"
              tagRender={(props) => {
                const { label, value, closable, onClose } = props;
                return (
                  <Tag
                    color={tagColors[value as string]}
                    closable={closable}
                    onClose={onClose}
                    style={{ marginRight: 3 }}
                  >
                    {label}
                  </Tag>
                );
              }}
            >
              {Object.entries(tagLabels).map(([key, label]) => (
                <Option key={key} value={key}>
                  {label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="description"
            label="描述说明"
          >
            <TextArea rows={3} placeholder="请输入异常描述" />
          </Form.Item>
          <Form.Item className="mb-0 flex justify-end">
            <Space>
              <Button onClick={() => setIsUploadModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确认上传
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="照片详情"
        placement="right"
        width={600}
        open={isDetailDrawerVisible}
        onClose={() => setIsDetailDrawerVisible(false)}
      >
        {selectedPhoto && (
          <div className="space-y-6">
            <div>
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.name}
                className="w-full rounded-lg"
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">{selectedPhoto.name}</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedPhoto.tags.map((tag) => (
                  <Tag key={tag} color={tagColors[tag]}>
                    <TagIcon size={12} className="inline mr-1" />
                    {tagLabels[tag]}
                  </Tag>
                ))}
              </div>
              <p className="text-gray-600 text-sm">{selectedPhoto.description}</p>
              <div className="mt-2 text-xs text-gray-500">
                <span>上传者：{selectedPhoto.uploader}</span>
                <span className="mx-2">|</span>
                <span>上传时间：{selectedPhoto.timestamp}</span>
              </div>
            </div>

            {selectedPhoto.sensorLogs.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center">
                  <FileText size={16} className="mr-2" />
                  关联传感器日志
                </h4>
                <List
                  size="small"
                  dataSource={selectedPhoto.sensorLogs}
                  renderItem={(log) => (
                    <List.Item>
                      <span className="text-sm">{log.name}</span>
                      <Tag className="text-xs">{log.type.toUpperCase()}</Tag>
                    </List.Item>
                  )}
                />
              </div>
            )}

            <div>
              <h4 className="font-medium mb-3 flex items-center">
                <MessageSquare size={16} className="mr-2" />
                批改意见 ({selectedPhoto.corrections.length})
              </h4>
              
              {selectedPhoto.corrections.length > 0 ? (
                <List
                  className="mb-4"
                  dataSource={[...selectedPhoto.corrections].reverse()}
                  renderItem={(correction) => (
                    <List.Item
                      className={`p-3 rounded-lg ${
                        correction.isLatest ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                      }`}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar size="small" className="bg-blue-500">
                            {correction.author[0]}
                          </Avatar>
                        }
                        title={
                          <div className="flex items-center">
                            <span className="font-medium text-sm">
                              {correction.author}
                            </span>
                            <Tag
                              color={correction.isLatest ? 'blue' : 'default'}
                              className="ml-2 text-xs"
                            >
                              v{correction.version}
                              {correction.isLatest && ' (最新)'}
                            </Tag>
                          </div>
                        }
                        description={
                          <div>
                            <p className="text-sm text-gray-700 mt-1">
                              {correction.content}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {correction.timestamp}
                            </p>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <p className="text-gray-400 text-sm mb-4">暂无批改意见</p>
              )}

              <div className="border-t pt-4">
                <h5 className="font-medium mb-2">添加批改意见</h5>
                <Form
                  form={correctionForm}
                  layout="vertical"
                  onFinish={handleAddCorrection}
                >
                  <Form.Item
                    name="author"
                    label="作者"
                    initialValue="张助教"
                  >
                    <Input size="small" />
                  </Form.Item>
                  <Form.Item
                    name="content"
                    label="意见内容"
                    rules={[{ required: true, message: '请输入批改意见' }]}
                  >
                    <TextArea rows={3} size="small" placeholder="请输入批改意见..." />
                  </Form.Item>
                  <Form.Item className="mb-0">
                    <Button type="primary" size="small" htmlType="submit">
                      提交意见
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
