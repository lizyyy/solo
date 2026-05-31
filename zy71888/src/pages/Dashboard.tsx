import React from 'react';
import { Card, Row, Col, Statistic, List, Tag } from 'antd';
import {
  Image,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { tagColors, tagLabels } from '../data/mockData';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { photos, validationResults, operationLogs } = useAppStore();

  const anomalyCount = photos.filter((p) =>
    p.tags.some((t) => t !== 'other')
  ).length;

  const highSeverityCount = validationResults.filter(
    (v) => v.severity === 'high'
  ).length;

  const recentLogs = operationLogs.slice(0, 5);

  const stats = [
    {
      title: '异常照片总数',
      value: photos.length,
      icon: <Image size={24} className="text-blue-500" />,
      color: '#165DFF',
    },
    {
      title: '待处理异常',
      value: anomalyCount,
      icon: <AlertTriangle size={24} className="text-orange-500" />,
      color: '#FF7D00',
    },
    {
      title: '高严重度问题',
      value: highSeverityCount,
      icon: <AlertTriangle size={24} className="text-red-500" />,
      color: '#F53F3F',
    },
    {
      title: '已关联证据',
      value: photos.filter((p) => p.corrections.length > 0).length,
      icon: <CheckCircle size={24} className="text-green-500" />,
      color: '#00B42A',
    },
  ];

  return (
    <div className="space-y-6">
      <Row gutter={16}>
        {stats.map((stat, index) => (
          <Col span={6} key={index}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center justify-between">
                <Statistic title={stat.title} value={stat.value} />
                {stat.icon}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card
            title="异常类型分布"
            extra={
              <a
                onClick={() => navigate('/photos')}
                className="flex items-center text-blue-500 cursor-pointer"
              >
                查看全部 <ArrowRight size={14} className="ml-1" />
              </a>
            }
          >
            <div className="flex flex-wrap gap-3">
              {Object.entries(tagLabels).map(([key, label]) => {
                const count = photos.filter((p) => p.tags.includes(key as any)).length;
                return (
                  <Tag
                    key={key}
                    color={tagColors[key]}
                    className="px-4 py-2 text-sm"
                  >
                    {label}: {count}
                  </Tag>
                );
              })}
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card
            title="最近操作日志"
            extra={
              <a
                onClick={() => navigate('/versions')}
                className="flex items-center text-blue-500 cursor-pointer"
              >
                查看全部 <ArrowRight size={14} className="ml-1" />
              </a>
            }
          >
            <List
              dataSource={recentLogs}
              renderItem={(log) => (
                <List.Item className="py-2">
                  <List.Item.Meta
                    avatar={
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <Clock size={16} className="text-gray-500" />
                      </div>
                    }
                    title={
                      <span className="text-sm font-medium">{log.action}</span>
                    }
                    description={
                      <div className="text-xs text-gray-500">
                        <span>{log.details}</span>
                        <span className="ml-2">- {log.operator}</span>
                      </div>
                    }
                  />
                  <span className="text-xs text-gray-400">{log.timestamp}</span>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Card
            title="快捷入口"
          >
            <div className="grid grid-cols-4 gap-4">
              <Card
                hoverable
                className="text-center cursor-pointer"
                onClick={() => navigate('/photos')}
              >
                <Image size={32} className="mx-auto mb-2 text-blue-500" />
                <div className="text-sm font-medium">上传异常照片</div>
              </Card>
              <Card
                hoverable
                className="text-center cursor-pointer"
                onClick={() => navigate('/scanner')}
              >
                <AlertTriangle size={32} className="mx-auto mb-2 text-orange-500" />
                <div className="text-sm font-medium">标记异常点</div>
              </Card>
              <Card
                hoverable
                className="text-center cursor-pointer"
                onClick={() => navigate('/validator')}
              >
                <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                <div className="text-sm font-medium">运行数据校验</div>
              </Card>
              <Card
                hoverable
                className="text-center cursor-pointer"
                onClick={() => navigate('/versions')}
              >
                <Clock size={32} className="mx-auto mb-2 text-purple-500" />
                <div className="text-sm font-medium">查看版本历史</div>
              </Card>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
