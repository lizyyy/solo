import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Typography, Descriptions, Timeline, Tag, Row, Col, Statistic, Space } from 'antd';
import { ArrowLeftOutlined, TeamOutlined, SafetyOutlined, HistoryOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Title, Text } = Typography;

function StudentTimeline() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [events, setEvents] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStudentDetail();
  }, [id]);

  const fetchStudentDetail = async () => {
    setLoading(true);
    try {
      const studentRes = await fetch(`/api/students/${id}`);
      const studentData = await studentRes.json();
      setStudent(studentData);

      const eventsRes = await fetch(`/api/events?entity_id=${id}`);
      const eventsData = await eventsRes.json();
      setEvents(eventsData);

      const permRes = await fetch(`/api/permissions?student_id=${id}`);
      const permData = await permRes.json();
      setPermissions(permData);
    } catch (error) {
      console.error('获取学员详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type) => {
    if (type.includes('enroll') || type.includes('student')) return <TeamOutlined />;
    if (type.includes('permission') || type.includes('auth')) return <SafetyOutlined />;
    return <HistoryOutlined />;
  };

  const getEventColor = (type) => {
    if (type.includes('refund') || type.includes('revoke')) return 'red';
    if (type.includes('enroll') || type.includes('grant')) return 'green';
    if (type.includes('transfer')) return 'blue';
    return 'gray';
  };

  const activePermissions = permissions.filter(p => p.status === 'active');
  const revokedPermissions = permissions.filter(p => p.status === 'revoked');

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/students')}>
          返回学员列表
        </Button>
      </div>

      <Card title={`学员详情 - ${student?.name || '加载中...'}`} loading={loading}>
        {student && (
          <>
            <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="学员姓名">{student.name}</Descriptions.Item>
              <Descriptions.Item label="手机号">{student.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{student.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="身份证号">{student.id_card || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={student.status === 'active' ? 'green' : 'default'}>
                  {student.status === 'active' ? '在读' : '已结业'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="注册时间">
                {student.created_at ? moment(student.created_at).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={12} sm={6}>
                <Card>
                  <Statistic
                    title="报名班级数"
                    value={student.enrollments?.length || 0}
                    prefix={<TeamOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card>
                  <Statistic
                    title="活跃权限"
                    value={activePermissions.length}
                    valueStyle={{ color: '#3f8600' }}
                    prefix={<SafetyOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card>
                  <Statistic
                    title="已回收权限"
                    value={revokedPermissions.length}
                    valueStyle={{ color: '#cf1322' }}
                    prefix={<SafetyOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card>
                  <Statistic
                    title="绑定账号数"
                    value={student.accounts?.length || 0}
                    prefix={<TeamOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="操作历史时间线" style={{ marginTop: 24 }}>
              {events.length > 0 ? (
                <Timeline mode="left">
                  {events.map((event, index) => (
                    <Timeline.Item
                      key={event.id}
                      dot={getEventIcon(event.event_type)}
                      color={getEventColor(event.event_type)}
                      label={moment(event.created_at).format('YYYY-MM-DD HH:mm')}
                    >
                      <div className="timeline-node-content">
                        <Space direction="vertical" size="small">
                          <div>
                            <Tag color={getEventColor(event.event_type)}>
                              {event.description}
                            </Tag>
                          </div>
                          {event.operator && (
                            <Text type="secondary" size="small">
                              操作人: {event.operator}
                            </Text>
                          )}
                        </Space>
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Text type="secondary">暂无操作记录</Text>
                </div>
              )}
            </Card>
          </>
        )}
      </Card>
    </div>
  );
}

export default StudentTimeline;
