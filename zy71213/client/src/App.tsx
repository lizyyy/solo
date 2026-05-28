import React, { useState, useEffect } from 'react';
import { Layout, Menu, Card, Button, message, Spin, Tabs, Tag } from 'antd';
import {
  CalculatorOutlined,
  UserOutlined,
  FileTextOutlined,
  PlusSquareOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  ReloadOutlined,
  SaveOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { pensionApi } from './api';
import { useLocalStorage } from './hooks/useLocalStorage';
import 参保人信息表单 from './components/参保人信息表单';
import 参保记录列表 from './components/参保记录列表';
import 补缴单列表 from './components/补缴单列表';
import 年龄信息表单 from './components/年龄信息表单';
import 领取地信息表单 from './components/领取地信息表单';
import 试算结果展示 from './components/试算结果展示';
import 方案对比面板 from './components/方案对比面板';
import 边界案例加载器 from './components/边界案例加载器';
import 边界提示面板 from './components/边界提示面板';
import { 试算方案, 试算结果 } from './types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
  const { 数据, 保存数据, 清除数据, 已加载 } = useLocalStorage();
  const [试算中, set试算中] = useState(false);
  const [年龄校验结果, set年龄校验结果] = useState<any>(null);
  const [领取地确定结果, set领取地确定结果] = useState<any>(null);
  const [缴费校验提示, set缴费校验提示] = useState<any[]>([]);
  const [当前Tab, set当前Tab] = useState('1');

  useEffect(() => {
    if (已加载 && 数据.年龄信息.出生日期 && 数据.年龄信息.退休年月) {
      pensionApi.validateAge({
        出生日期: 数据.年龄信息.出生日期,
        退休年月: 数据.年龄信息.退休年月,
        性别: 数据.年龄信息.性别,
        工种: 数据.年龄信息.工种
      }).then(response => {
        if (response.data.success) {
          set年龄校验结果(response.data.data);
        }
      }).catch(() => {});
    }
  }, [已加载, 数据.年龄信息]);

  useEffect(() => {
    if (已加载 && 数据.参保记录.length > 0) {
      pensionApi.validatePaymentMonths(数据.参保记录, 数据.补缴单)
        .then(response => {
          if (response.data.success) {
            set缴费校验提示(response.data.data.边界提示);
          }
        }).catch(() => {});
    }
  }, [已加载, 数据.参保记录, 数据.补缴单]);

  useEffect(() => {
    if (已加载 && 数据.参保记录.length > 0) {
      pensionApi.determineLocation(数据.参保记录, 数据.领取地信息.城市)
        .then(response => {
          if (response.data.success) {
            set领取地确定结果(response.data.data);
          }
        }).catch(() => {});
    }
  }, [已加载, 数据.参保记录, 数据.领取地信息.城市]);

  const 执行试算 = async () => {
    if (数据.参保记录.length === 0) {
      message.error('请至少添加一条参保记录');
      return;
    }

    if (!数据.年龄信息.出生日期 || !数据.年龄信息.退休年月) {
      message.error('请完整填写年龄信息');
      return;
    }

    set试算中(true);
    try {
      const response = await pensionApi.calculate({
        参保人信息: 数据.参保人信息,
        参保记录: 数据.参保记录,
        补缴单: 数据.补缴单,
        领取地信息: 数据.领取地信息,
        年龄信息: 数据.年龄信息
      });

      if (response.data.success) {
        保存数据({ 试算结果: response.data.data });
        set当前Tab('2');
        message.success('试算完成');
      } else {
        message.error(response.data.message || '试算失败');
      }
    } catch (error: any) {
      message.error('试算失败: ' + (error.response?.data?.message || error.message));
    } finally {
      set试算中(false);
    }
  };

  const 导出PDF = () => {
    if (!数据.试算结果) {
      message.error('请先进行试算');
      return;
    }

    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('养老金领取试算报告', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`姓名: ${数据.参保人信息.姓名 || '未填写'}`, 20, 40);
    doc.text(`身份证号: ${数据.参保人信息.身份证号 || '未填写'}`, 120, 40);
    doc.text(`试算时间: ${new Date().toLocaleString('zh-CN')}`, 20, 50);

    const tableData = [
      ['项目', '数值'],
      ['累计缴费年限', `${数据.试算结果.缴费明细.累计缴费年限} 年`],
      ['实际缴费年限', `${数据.试算结果.缴费明细.实际缴费年限} 年`],
      ['视同缴费年限', `${数据.试算结果.缴费明细.视同缴费年限} 年`],
      ['平均缴费指数', 数据.试算结果.缴费明细.平均缴费指数],
      ['个人账户储存额', `¥${数据.试算结果.账户信息.个人账户储存额}`],
      ['计发月数', `${数据.试算结果.账户信息.计发月数} 个月`],
      ['基础养老金', `¥${数据.试算结果.养老金构成.基础养老金}/月`],
      ['个人账户养老金', `¥${数据.试算结果.养老金构成.个人账户养老金}/月`],
      ['过渡性养老金', `¥${数据.试算结果.养老金构成.过渡性养老金}/月`],
      ['过渡性调节金', `¥${数据.试算结果.养老金构成.过渡性调节金}/月`],
      ['每月领取总额', `¥${数据.试算结果.养老金构成.每月领取总额}/月`],
      ['最终领取地', 数据.试算结果.领取地信息.最终领取地],
      ['计发基数', `¥${数据.试算结果.领取地信息.计发基数}`]
    ];

    autoTable(doc, {
      startY: 65,
      head: [tableData[0]],
      body: tableData.slice(1),
      theme: 'grid',
      styles: { fontSize: 10 }
    });

    if (数据.试算结果.边界提示?.length > 0) {
      const finalY = (doc as any).lastAutoTable.finalY || 150;
      doc.setFontSize(14);
      doc.text('边界提示', 20, finalY + 15);
      
      数据.试算结果.边界提示.forEach((提示: any, index: number) => {
        doc.setFontSize(10);
        doc.text(
          `${index + 1}. [${提示.severity}] ${提示.type}: ${提示.message}`,
          20,
          finalY + 25 + index * 10
        );
      });
    }

    doc.save(`养老金试算报告_${数据.参保人信息.姓名 || '未知'}_${Date.now()}.pdf`);
    message.success('PDF导出成功');
  };

  const 保存当前方案 = () => {
    const 新方案: 试算方案 = {
      name: `方案${数据.方案列表.length + 1}`,
      参保人信息: 数据.参保人信息,
      参保记录: 数据.参保记录,
      补缴单: 数据.补缴单,
      领取地信息: 数据.领取地信息,
      年龄信息: 数据.年龄信息
    };
    保存数据({ 方案列表: [...数据.方案列表, 新方案] });
    message.success('方案已保存');
  };

  const 加载案例 = (案例: 试算方案) => {
    保存数据({
      参保人信息: 案例.参保人信息,
      参保记录: 案例.参保记录,
      补缴单: 案例.补缴单,
      领取地信息: 案例.领取地信息,
      年龄信息: 案例.年龄信息,
      试算结果: null
    });
    set当前Tab('1');
  };

  const 重置数据 = () => {
    if (window.confirm('确定要清空所有数据吗？此操作不可恢复。')) {
      清除数据();
      message.success('数据已重置');
    }
  };

  if (!已加载) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  const 当前方案: 试算方案 = {
    name: '当前方案',
    参保人信息: 数据.参保人信息,
    参保记录: 数据.参保记录,
    补缴单: 数据.补缴单,
    领取地信息: 数据.领取地信息,
    年龄信息: 数据.年龄信息
  };

  const tabItems = [
    {
      key: '1',
      label: (
        <span>
          <CalculatorOutlined />
          数据录入与试算
        </span>
      ),
      children: (
        <div>
          <边界案例加载器 on加载案例={加载案例} />

          {缴费校验提示.length > 0 && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <边界提示面板 边界提示列表={缴费校验提示} title="缴费数据校验提示" />
            </Card>
          )}

          <Card title="参保人信息" style={{ marginBottom: 16 }}>
            <参保人信息表单
              初始数据={数据.参保人信息}
              onChange={(参保人信息) => 保存数据({ 参保人信息 })}
            />
          </Card>

          <Card title="年龄信息" style={{ marginBottom: 16 }}>
            <年龄信息表单
              初始数据={数据.年龄信息}
              校验结果={年龄校验结果}
              onChange={(年龄信息) => 保存数据({ 年龄信息 })}
            />
          </Card>

          <Card title="参保记录" style={{ marginBottom: 16 }}>
            <参保记录列表
              数据={数据.参保记录}
              onChange={(参保记录) => 保存数据({ 参保记录 })}
            />
          </Card>

          <Card title="补缴单" style={{ marginBottom: 16 }}>
            <补缴单列表
              数据={数据.补缴单}
              参保记录列表={数据.参保记录}
              onChange={(补缴单) => 保存数据({ 补缴单 })}
            />
          </Card>

          <Card title="领取地信息" style={{ marginBottom: 16 }}>
            <领取地信息表单
              数据={数据.领取地信息}
              确定结果={领取地确定结果}
              onChange={(领取地信息) => 保存数据({ 领取地信息 })}
            />
          </Card>

          <div style={{ textAlign: 'center', padding: 24, background: '#f5f5f5', borderRadius: 8 }}>
            <Button
              type="primary"
              size="large"
              icon={<CalculatorOutlined />}
              onClick={执行试算}
              loading={试算中}
              style={{ width: 200 }}
            >
              {试算中 ? '试算中...' : '开始试算'}
            </Button>
            <Button
              style={{ marginLeft: 16 }}
              icon={<ReloadOutlined />}
              onClick={重置数据}
              danger
            >
              重置所有数据
            </Button>
          </div>
        </div>
      )
    },
    {
      key: '2',
      label: (
        <span>
          <FileTextOutlined />
          试算结果
          {数据.试算结果 && <Tag color="green" style={{ marginLeft: 8 }}>已完成</Tag>}
        </span>
      ),
      children: (
        <试算结果展示
          结果={数据.试算结果}
          onExportPDF={导出PDF}
          onSaveScheme={保存当前方案}
        />
      )
    },
    {
      key: '3',
      label: (
        <span>
          <BarChartOutlined />
          方案对比
          {数据.方案列表.length > 0 && <Tag color="blue" style={{ marginLeft: 8 }}>{数据.方案列表.length}个</Tag>}
        </span>
      ),
      children: (
        <Card>
          <方案对比面板
            当前方案={当前方案}
            方案列表={数据.方案列表}
            on方案列表变化={(方案列表) => 保存数据({ 方案列表 })}
          />
        </Card>
      )
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', display: 'flex', alignItems: 'center' }}>
        <div style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
          <CalculatorOutlined style={{ marginRight: 12 }} />
          养老金领取试算系统
        </div>
        <div style={{ marginLeft: 'auto', color: 'white' }}>
          {数据.最后更新时间 && (
            <span style={{ fontSize: 12, opacity: 0.8 }}>
              最后保存: {new Date(数据.最后更新时间).toLocaleString('zh-CN')}
            </span>
          )}
        </div>
      </Header>
      <Layout>
        <Content style={{ padding: 24 }}>
          <Tabs
            activeKey={当前Tab}
            onChange={set当前Tab}
            items={tabItems}
            size="large"
          />
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
