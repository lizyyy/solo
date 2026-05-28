import React, { useState } from 'react';
import { Table, Button, Modal, message, Card, Tag } from 'antd';
import { BarChartOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { 方案对比结果, 试算方案 } from '../types';
import { pensionApi } from '../api';

interface Props {
  当前方案: 试算方案;
  方案列表: 试算方案[];
  on方案列表变化: (列表: 试算方案[]) => void;
}

const 方案对比面板: React.FC<Props> = ({ 当前方案, 方案列表, on方案列表变化 }) => {
  const [对比中, set对比中] = useState(false);
  const [对比结果, set对比结果] = useState<方案对比结果[] | null>(null);
  const [显示对比, set显示对比] = useState(false);

  const 添加当前方案 = () => {
    const 方案名 = `方案${方案列表.length + 1}`;
    const 新方案: 试算方案 = {
      ...当前方案,
      name: 方案名
    };
    on方案列表变化([...方案列表, 新方案]);
    message.success(`已添加"${方案名}"到对比列表`);
  };

  const 删除方案 = (index: number) => {
    on方案列表变化(方案列表.filter((_, i) => i !== index));
  };

  const 执行对比 = async () => {
    if (方案列表.length < 2) {
      message.warning('请至少添加2个方案进行对比');
      return;
    }

    set对比中(true);
    try {
      const response = await pensionApi.compare(方案列表);
      if (response.data.success) {
        set对比结果(response.data.data);
        set显示对比(true);
      }
    } catch (error) {
      message.error('方案对比失败');
    } finally {
      set对比中(false);
    }
  };

  const 列 = [
    {
      title: '方案名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string, _: any, index: number) => (
        <Tag color="blue">{name}</Tag>
      )
    },
    {
      title: '参保地数量',
      dataIndex: '参保记录',
      key: '参保地数量',
      width: 120,
      render: (记录: any[]) => 记录?.length || 0
    },
    {
      title: '补缴单数',
      dataIndex: '补缴单',
      key: '补缴单数',
      width: 100,
      render: (单: any[]) => 单?.length || 0
    },
    {
      title: '退休年龄',
      key: '退休年龄',
      width: 100,
      render: (_: any, 记录: 试算方案) => 记录.年龄信息?.退休年龄 || '-'
    },
    {
      title: '领取地',
      key: '领取地',
      width: 120,
      render: (_: any, 记录: 试算方案) => 记录.领取地信息?.城市 || '-'
    },
    {
      title: '操作',
      key: '操作',
      width: 100,
      render: (_: any, __: any, index: number) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => 删除方案(index)}
        >
          删除
        </Button>
      )
    }
  ];

  const 对比结果列 = [
    {
      title: '方案名称',
      dataIndex: '方案名称',
      key: '方案名称'
    },
    {
      title: '每月领取总额',
      dataIndex: '每月领取总额',
      key: '每月领取总额',
      render: (val: string) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
          ¥{parseFloat(val).toLocaleString()}
        </span>
      ),
      sorter: (a: any, b: any) => parseFloat(a.每月领取总额) - parseFloat(b.每月领取总额)
    },
    {
      title: '累计缴费年限',
      dataIndex: '累计缴费年限',
      key: '累计缴费年限',
      render: (val: number) => `${val}年`
    },
    {
      title: '平均缴费指数',
      dataIndex: '平均缴费指数',
      key: '平均缴费指数'
    },
    {
      title: '个人账户储存额',
      dataIndex: '个人账户储存额',
      key: '个人账户储存额',
      render: (val: string) => `¥${parseFloat(val).toLocaleString()}`
    },
    {
      title: '边界提示数量',
      dataIndex: '边界提示数量',
      key: '边界提示数量',
      render: (val: number) => (
        <Tag color={val > 0 ? 'orange' : 'green'}>{val}条</Tag>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>方案对比 ({方案列表.length}个方案)</h3>
        <div>
          <Button
            icon={<PlusOutlined />}
            onClick={添加当前方案}
            style={{ marginRight: 8 }}
          >
            添加当前方案
          </Button>
          <Button
            type="primary"
            icon={<BarChartOutlined />}
            onClick={执行对比}
            loading={对比中}
            disabled={方案列表.length < 2}
          >
            执行对比
          </Button>
        </div>
      </div>

      <Table
        columns={列}
        dataSource={方案列表}
        rowKey={(record, index) => `scheme_${index}`}
        pagination={false}
        size="small"
      />

      <Modal
        title="方案对比结果"
        open={显示对比}
        onCancel={() => set显示对比(false)}
        footer={[
          <Button key="close" onClick={() => set显示对比(false)}>
            关闭
          </Button>
        ]}
        width={900}
      >
        <Table
          columns={对比结果列}
          dataSource={对比结果 || []}
          rowKey="方案名称"
          pagination={false}
        />
      </Modal>
    </div>
  );
};

export default 方案对比面板;
