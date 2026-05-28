import React, { useState } from 'react';
import { Select, Button, message, Card, Tag, Space } from 'antd';
import { ExperimentOutlined, LoadingOutlined } from '@ant-design/icons';
import { pensionApi } from '../api';
import { 试算方案 } from '../types';

interface Props {
  on加载案例: (案例: 试算方案) => void;
}

const 案例类型: Record<string, string> = {
  '补缴重复案例': '补缴重复 - 测试补缴月份与正常缴费重叠的边界校验',
  '多地参保案例': '多地参保 - 测试多个参保地满10年的领取地确定规则',
  '提前退休案例': '提前退休 - 测试特殊工种提前退休的年龄边界校验',
  '缴费年限不足案例': '缴费不足 - 测试累计缴费不足15年的边界提示'
};

const 边界案例加载器: React.FC<Props> = ({ on加载案例 }) => {
  const [选中案例, set选中案例] = useState<string>('');
  const [加载中, set加载中] = useState(false);
  const [案例数据, set案例数据] = useState<any>(null);

  const 加载案例 = async () => {
    if (!选中案例) {
      message.warning('请选择要加载的案例');
      return;
    }

    set加载中(true);
    try {
      const response = await pensionApi.getSampleCases();
      if (response.data.success) {
        const 案例 = response.data.data[选中案例];
        if (案例) {
          set案例数据(案例);
          on加载案例(案例);
          message.success(`已加载"${选中案例}"`);
        }
      }
    } catch (error) {
      message.error('加载案例失败');
    } finally {
      set加载中(false);
    }
  };

  return (
    <Card 
      size="small" 
      title={
        <Space>
          <ExperimentOutlined />
          边界案例测试
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Select
          value={选中案例}
          onChange={set选中案例}
          placeholder="选择边界案例..."
          style={{ flex: 1 }}
          options={Object.entries(案例类型).map(([key, desc]) => ({
            label: (
              <div>
                <Tag color="orange">{key}</Tag>
                <span style={{ marginLeft: 8 }}>{desc}</span>
              </div>
            ),
            value: key
          }))}
        />
        <Button
          type="primary"
          onClick={加载案例}
          loading={加载中}
          icon={加载中 ? <LoadingOutlined /> : <ExperimentOutlined />}
        >
          加载案例
        </Button>
      </div>

      {案例数据 && (
        <div style={{ marginTop: 12, padding: 12, background: '#fffbe6', borderRadius: 4 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>案例说明:</strong> {案例类型[选中案例]}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            参保记录: {案例数据.参保记录?.length || 0}条 | 
            补缴单: {案例数据.补缴单?.length || 0}条 | 
            姓名: {案例数据.参保人信息?.姓名}
          </div>
        </div>
      )}
    </Card>
  );
};

export default 边界案例加载器;
