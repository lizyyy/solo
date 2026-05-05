import React from 'react';
import {
  Card,
  Collapse,
  Table,
  Alert,
  Row,
  Col,
  Statistic,
  Tag,
  Space,
  Divider,
} from 'antd';
import {
  QuestionCircleOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';

const { Panel } = Collapse;

function KnowledgePage() {
  const capColumns = [
    {
      title: '特性',
      dataIndex: 'feature',
      key: 'feature',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '一致性 (C)',
      dataIndex: 'consistency',
      key: 'consistency',
    },
    {
      title: '可用性 (A)',
      dataIndex: 'availability',
      key: 'availability',
    },
    {
      title: '分区容错 (P)',
      dataIndex: 'partition',
      key: 'partition',
    },
  ];

  const capData = [
    {
      key: '1',
      feature: '强一致性系统',
      consistency: <Tag color="green">✓</Tag>,
      availability: <Tag color="red">✗</Tag>,
      partition: <Tag color="green">✓</Tag>,
    },
    {
      key: '2',
      feature: '高可用系统',
      consistency: <Tag color="red">✗</Tag>,
      availability: <Tag color="green">✓</Tag>,
      partition: <Tag color="green">✓</Tag>,
    },
    {
      key: '3',
      feature: '传统单机数据库',
      consistency: <Tag color="green">✓</Tag>,
      availability: <Tag color="green">✓</Tag>,
      partition: <Tag color="red">✗</Tag>,
    },
  ];

  const consistencyComparisonColumns = [
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '延迟',
      dataIndex: 'latency',
      key: 'latency',
    },
    {
      title: '一致性',
      dataIndex: 'consistency',
      key: 'consistency',
    },
    {
      title: '复杂度',
      dataIndex: 'complexity',
      key: 'complexity',
    },
    {
      title: '适用场景',
      dataIndex: 'scenario',
      key: 'scenario',
    },
  ];

  const consistencyComparisonData = [
    {
      key: '1',
      model: '强一致性',
      latency: <Tag color="red">高</Tag>,
      consistency: <Tag color="green">最强</Tag>,
      complexity: <Tag color="blue">低</Tag>,
      scenario: '银行、金融交易',
    },
    {
      key: '2',
      model: '最终一致性',
      latency: <Tag color="green">低</Tag>,
      consistency: <Tag color="orange">最弱</Tag>,
      complexity: <Tag color="blue">低</Tag>,
      scenario: '社交网络、内容分发',
    },
    {
      key: '3',
      model: 'Raft',
      latency: <Tag color="orange">中等</Tag>,
      consistency: <Tag color="green">强</Tag>,
      complexity: <Tag color="orange">中等</Tag>,
      scenario: '分布式配置、服务发现',
    },
    {
      key: '4',
      model: 'Paxos',
      latency: <Tag color="orange">中等</Tag>,
      consistency: <Tag color="green">最强</Tag>,
      complexity: <Tag color="red">高</Tag>,
      scenario: '核心基础设施',
    },
  ];

  return (
    <div>
      <Alert
        message="知识库说明"
        description="本页面汇总了分布式系统一致性相关的核心概念、理论和算法，供后端新人学习参考。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={24}>
        <Col span={6}>
          <Card>
            <Statistic
              title="核心概念"
              value={4}
              prefix={<QuestionCircleOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="一致性算法"
              value={2}
              prefix={<SafetyCertificateOutlined />}
              suffix="种"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="一致性模型"
              value={4}
              prefix={<DatabaseOutlined />}
              suffix="种"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="分布式锁机制"
              value={1}
              prefix={<LockOutlined />}
              suffix="种"
            />
          </Card>
        </Col>
      </Row>

      <Divider />

      <Card title="核心理论" className="knowledge-card">
        <Collapse defaultActiveKey={['cap', 'base']}>
          <Panel header="CAP 定理" key="cap">
            <div>
              <p>
                <strong>CAP 定理</strong>（也称为 Brewer 定理）是计算机科学中的一个定理，它指出对于一个分布式计算系统来说，不可能同时满足以下三点：
              </p>
              
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" title="一致性 (Consistency)">
                    <p>所有节点在同一时间看到的数据是相同的。</p>
                    <p><strong>关键点：</strong>读取操作必须返回最新的写入结果。</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="可用性 (Availability)">
                    <p>每个请求都能获得（非错误的）响应，但不保证响应包含最新的写入。</p>
                    <p><strong>关键点：</strong>系统始终可用，即使部分节点故障。</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="分区容错 (Partition Tolerance)">
                    <p>系统在网络分区（节点间通信延迟或中断）的情况下仍能继续运行。</p>
                    <p><strong>关键点：</strong>分布式系统必须处理分区问题。</p>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <h4>CAP 权衡表</h4>
              <Table
                columns={capColumns}
                dataSource={capData}
                pagination={false}
                size="small"
              />

              <Alert
                message="重要提示"
                description="在分布式系统中，分区容错（P）是必须的，因此实际上只能在一致性（C）和可用性（A）之间进行权衡选择。"
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            </div>
          </Panel>

          <Panel header="BASE 理论" key="base">
            <div>
              <p>
                <strong>BASE 理论</strong>是对 CAP 理论的延伸，是对大规模互联网分布式系统实践的总结。它与 ACID 相反，强调牺牲强一致性来获得高可用性。
              </p>
              
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" title="基本可用 (Basically Available)">
                    <p>系统在出现不可预知故障时，允许损失部分可用性。</p>
                    <p><strong>例如：</strong>响应时间增加、功能降级。</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="软状态 (Soft State)">
                    <p>允许系统中的数据存在中间状态，并认为该状态不影响系统的整体可用性。</p>
                    <p><strong>关键点：</strong>数据副本同步存在延迟。</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="最终一致性 (Eventually Consistent)">
                    <p>系统中的所有数据副本经过一段时间后，最终能够达到一致的状态。</p>
                    <p><strong>关键点：</strong>不需要实时强一致。</p>
                  </Card>
                </Col>
              </Row>

              <Alert
                message="ACID vs BASE"
                description={
                  <div>
                    <p><strong>ACID：</strong>传统关系型数据库使用，强调强一致性。</p>
                    <p><strong>BASE：</strong>大型分布式系统使用，强调可用性和最终一致性。</p>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginTop: 16 }}
              />
            </div>
          </Panel>
        </Collapse>
      </Card>

      <Divider />

      <Card title="一致性算法" className="knowledge-card">
        <Collapse defaultActiveKey={['raft']}>
          <Panel header="Raft 算法" key="raft">
            <div>
              <Alert
                message="Raft 是一种易于理解的分布式共识算法，目的是替代复杂的 Paxos 算法。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <h4>核心概念</h4>
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" title="Leader 选举">
                    <p>Raft 使用心跳机制触发 Leader 选举。</p>
                    <ul>
                      <li>Follower 在超时时间内没收到心跳 → 变成 Candidate</li>
                      <li>Candidate 发起投票，获得多数票 → 变成 Leader</li>
                      <li>Leader 定期发送心跳维持地位</li>
                    </ul>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="日志复制">
                    <p>Leader 负责将日志复制到所有 Follower。</p>
                    <ul>
                      <li>Client 发送请求给 Leader</li>
                      <li>Leader 追加日志条目，复制给 Follower</li>
                      <li>多数 Follower 确认后，Leader 提交日志</li>
                      <li>Leader 响应 Client，通知 Follower 提交</li>
                    </ul>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="安全性">
                    <p>Raft 保证日志的一致性。</p>
                    <ul>
                      <li>每个日志条目包含任期号</li>
                      <li>日志条目一旦被提交就不会被覆盖</li>
                      <li>Candidate 必须包含所有已提交日志才能当选</li>
                    </ul>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <h4>节点状态转换</h4>
              <Alert
                message="Follower → Candidate → Leader → Follower"
                description="节点在这三种状态之间转换，选举超时和心跳机制驱动状态变化。"
                type="info"
                showIcon
              />
            </div>
          </Panel>

          <Panel header="Paxos 算法" key="paxos">
            <div>
              <Alert
                message="Paxos 是一种基于消息传递的高度可容错的共识算法，由 Leslie Lamport 于 1990 年提出。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <h4>角色定义</h4>
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" title="Proposer (提议者)">
                    <p>提出提案（Proposal），包含提案编号和值。</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="Acceptor (接受者)">
                    <p>对提案进行投票，可以接受或拒绝提案。</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="Learner (学习者)">
                    <p>学习被选定的提案值。</p>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <h4>两阶段提交</h4>
              
              <Card size="small" title="第一阶段：Prepare (准备)">
                <ol>
                  <li>Proposer 选择一个提案编号 n，向多数 Acceptor 发送 Prepare 请求</li>
                  <li>Acceptor 收到 Prepare 请求后：
                    <ul>
                      <li>如果 n 大于该 Acceptor 已响应的所有 Prepare 编号，则响应并承诺不再接受编号小于 n 的提案</li>
                      <li>同时返回该 Acceptor 已接受的编号最大的提案（如果有）</li>
                    </ul>
                  </li>
                </ol>
              </Card>

              <Card size="small" title="第二阶段：Accept (接受)" style={{ marginTop: 16 }}>
                <ol>
                  <li>如果 Proposer 收到多数 Acceptor 对 Prepare 的响应：
                    <ul>
                      <li>将值设置为响应中编号最大的提案的值</li>
                      <li>如果没有已接受的提案，则可以自由选择值</li>
                    </ul>
                  </li>
                  <li>Proposer 向多数 Acceptor 发送 Accept 请求，包含提案编号 n 和值 v</li>
                  <li>Acceptor 收到 Accept 请求后：
                    <ul>
                      <li>如果该 Acceptor 没有对编号大于 n 的 Prepare 请求做出响应，则接受该提案</li>
                    </ul>
                  </li>
                </ol>
              </Card>

              <Alert
                message="Paxos vs Raft"
                description={
                  <div>
                    <p><strong>Paxos：</strong>理论更完善，但理解和实现都更复杂。没有 Leader 概念，更灵活。</p>
                    <p><strong>Raft：</strong>专门为可理解性设计，有明确的 Leader 概念，实现更简单。</p>
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            </div>
          </Panel>
        </Collapse>
      </Card>

      <Divider />

      <Card title="一致性模型对比" className="knowledge-card">
        <Table
          columns={consistencyComparisonColumns}
          dataSource={consistencyComparisonData}
          pagination={false}
        />
      </Card>

      <Divider />

      <Card title="分布式锁" className="knowledge-card">
        <Collapse defaultActiveKey={['distributed-lock']}>
          <Panel header="分布式锁机制" key="distributed-lock">
            <div>
              <Alert
                message="分布式锁是控制分布式系统之间同步访问共享资源的一种方式。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <h4>核心特性</h4>
              <Row gutter={16}>
                <Col span={6}>
                  <Card size="small" title="互斥性">
                    <p>同一时刻只能有一个客户端持有锁。</p>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" title="防止死锁">
                    <p>锁必须有超时机制，防止客户端崩溃后锁无法释放。</p>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" title="容错性">
                    <p>只要大部分节点存活，锁服务就可用。</p>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" title="可重入性">
                    <p>同一客户端可以多次获取同一把锁。</p>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <h4>常见实现方案</h4>
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" title="基于 Redis">
                    <ul>
                      <li>使用 SETNX + EXPIRE 命令</li>
                      <li>RedLock 算法（多实例）</li>
                      <li>优点：性能高，实现简单</li>
                      <li>缺点：可能存在数据不一致</li>
                    </ul>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="基于 ZooKeeper">
                    <ul>
                      <li>使用临时顺序节点</li>
                      <li>Watcher 机制监听锁释放</li>
                      <li>优点：强一致性，可靠性高</li>
                      <li>缺点：性能相对较低</li>
                    </ul>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="基于数据库">
                    <ul>
                      <li>使用唯一约束或行级锁</li>
                      <li>SELECT ... FOR UPDATE</li>
                      <li>优点：实现简单</li>
                      <li>缺点：性能差，单点故障</li>
                    </ul>
                  </Card>
                </Col>
              </Row>

              <Alert
                message="锁超时问题"
                description={
                  <div>
                    <p><strong>问题：</strong>如果持有锁的客户端执行时间超过锁超时时间，会导致其他客户端提前获取锁。</p>
                    <p><strong>解决方案：</strong></p>
                    <ul>
                      <li>使用看门狗（Watchdog）机制自动续期</li>
                      <li>设置合理的超时时间</li>
                      <li>使用唯一标识区分锁的持有者</li>
                    </ul>
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            </div>
          </Panel>
        </Collapse>
      </Card>

      <Divider />

      <Card title="最终一致性" className="knowledge-card">
        <Collapse defaultActiveKey={['eventual-consistency']}>
          <Panel header="最终一致性详解" key="eventual-consistency">
            <div>
              <Alert
                message="最终一致性是指系统中的所有数据副本经过一段时间后，最终能够达到一致的状态。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <h4>一致性模型变体</h4>
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" title="因果一致性">
                    <p>有因果关系的操作必须按顺序被所有进程看到。</p>
                    <p><strong>示例：</strong>回复必须在原消息之后被看到。</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="读己之所写">
                    <p>客户端写入后，总能读到自己写入的值。</p>
                    <p><strong>示例：</strong>发微博后立即刷新能看到自己的微博。</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="会话一致性">
                    <p>在同一个会话内，保证读己之所写一致性。</p>
                    <p><strong>示例：</strong>同一个登录会话内的操作。</p>
                  </Card>
                </Col>
              </Row>

              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={8}>
                  <Card size="small" title="单调读">
                    <p>如果一个进程已经读到某个值，后续不会读到更早的值。</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="单调写">
                    <p>来自同一进程的写操作按顺序执行。</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="前缀一致">
                    <p>副本按写入顺序更新，不会看到部分更新。</p>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <h4>处理冲突的策略</h4>
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" title="最后写入 wins">
                    <p>选择时间戳最新的写入作为最终值。</p>
                    <p><strong>问题：</strong>时钟同步问题。</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="向量时钟">
                    <p>使用逻辑时钟追踪因果关系，检测并发写入。</p>
                    <p><strong>问题：</strong>实现复杂，需要合并。</p>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="应用层解决">
                    <p>将冲突暴露给应用层，由业务逻辑处理。</p>
                    <p><strong>示例：</strong>Git 的冲突解决。</p>
                  </Card>
                </Col>
              </Row>

              <Alert
                message="脏读现象"
                description={
                  <div>
                    <p><strong>定义：</strong>在最终一致性系统中，客户端可能读取到不是最新的值。</p>
                    <p><strong>发生场景：</strong></p>
                    <ul>
                      <li>写入主节点后立即从副本节点读取</li>
                      <li>网络分区导致副本同步延迟</li>
                      <li>副本节点故障恢复后的数据追赶</li>
                    </ul>
                    <p><strong>解决方法：</strong></p>
                    <ul>
                      <li>读取主节点（牺牲可用性）</li>
                      <li>读取修复（Read Repair）</li>
                      <li>Quorum 读取（R + W > N）</li>
                    </ul>
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            </div>
          </Panel>
        </Collapse>
      </Card>
    </div>
  );
}

export default KnowledgePage;
