import React from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useBatchStore } from '@/store/batchStore';
import { FileUp, Play, Database, AlertTriangle, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { MATERIAL_TYPE_LABELS } from '@/types';

const Dashboard: React.FC = () => {
  const { currentBatch, materials, holdings, targetWeights, priceQuotes, validationErrors, loadDemoData, clearAll } = useBatchStore();

  const materialStatus = {
    holding: materials.some(m => m.type === 'holding'),
    target: materials.some(m => m.type === 'target'),
    price: materials.some(m => m.type === 'price'),
  };

  const canCalculate = materialStatus.holding && materialStatus.target;

  const getBatchStatusBadge = () => {
    if (!currentBatch) return <Badge variant="secondary">未开始</Badge>;
    switch (currentBatch.status) {
      case 'draft': return <Badge variant="secondary">草稿</Badge>;
      case 'validating': return <Badge variant="warning">校验中</Badge>;
      case 'ready': return <Badge variant="success">就绪</Badge>;
      case 'calculating': return <Badge variant="warning">计算中</Badge>;
      case 'completed': return <Badge variant="success">已完成</Badge>;
      case 'error': return <Badge variant="danger">错误</Badge>;
      case 'pending_data': return <Badge variant="warning">待补料</Badge>;
      default: return <Badge variant="secondary">未知</Badge>;
    }
  };

  const quickActions = [
    {
      title: '导入样例数据',
      description: '加载预设的演示数据，体验完整功能',
      icon: Database,
      action: loadDemoData,
      variant: 'secondary' as const,
    },
    {
      title: '清空所有数据',
      description: '重置当前工作区，开始新的批次',
      icon: Clock,
      action: clearAll,
      variant: 'ghost' as const,
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">投资组合税后再平衡</h1>
            <p className="mt-1 text-sm text-slate-400">
              综合税费、亏损抵扣、持有期约束的专业再平衡优化工具
            </p>
          </div>
          <div className="flex items-center gap-3">
            {getBatchStatusBadge()}
            {currentBatch && (
              <span className="text-sm text-slate-500">
                批次号：{currentBatch.id.slice(-8)}
              </span>
            )}
          </div>
        </div>

        {!currentBatch ? (
          <Card className="p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <FileUp className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">开始新的再平衡任务</h2>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              导入持仓表、目标权重、买卖报价三类材料，系统将自动计算最优调仓方案，考虑税费、亏损抵扣和持有期约束。
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/import">
                <Button variant="primary">
                  <FileUp className="w-4 h-4 mr-2" />
                  导入材料
                </Button>
              </Link>
              <Button variant="secondary" onClick={loadDemoData}>
                <Database className="w-4 h-4 mr-2" />
                加载样例
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              {(['holding', 'target', 'price'] as const).map((type) => (
                <Card key={type} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        type === 'holding' ? 'bg-blue-500' : 
                        type === 'target' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`} />
                      <span className="font-medium text-white">{MATERIAL_TYPE_LABELS[type]}</span>
                    </div>
                    {materialStatus[type] ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                  <div className="text-sm text-slate-400">
                    {materialStatus[type] ? (
                      type === 'holding' ? `${holdings.length} 条持仓记录` :
                      type === 'target' ? `${targetWeights.length} 条权重配置` :
                      `${priceQuotes.length} 条报价记录`
                    ) : (
                      '尚未导入'
                    )}
                  </div>
                  {materials.find(m => m.type === type) && (
                    <div className="mt-2 text-xs text-slate-500">
                      版本 {materials.find(m => m.type === type)!.version} · 
                      {materials.find(m => m.type === type)!.fileName}
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {validationErrors.length > 0 && (
              <Card className="p-4 border-amber-500/30 bg-amber-500/5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-amber-400 mb-1">存在 {validationErrors.length} 个校验问题</h3>
                    <p className="text-sm text-slate-400 mb-2">
                      {validationErrors[0].message}
                      {validationErrors.length > 1 && ` 等 ${validationErrors.length} 项`}
                    </p>
                    <Link to="/diagnose">
                      <Button variant="ghost" size="sm">
                        查看详细诊断 <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
              {quickActions.map((action, index) => (
                <Card key={index} className="p-4 hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={action.action}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                      <action.icon className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{action.title}</h3>
                      <p className="text-sm text-slate-400">{action.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-slate-500">
                {canCalculate 
                  ? '材料已齐备，可以开始再平衡计算' 
                  : '请至少导入持仓表和目标权重后再计算'}
              </div>
              <div className="flex items-center gap-3">
                <Link to="/import">
                  <Button variant="secondary">
                    <FileUp className="w-4 h-4 mr-2" />
                    管理材料
                  </Button>
                </Link>
                <Link to="/configure">
                  <Button variant="primary" disabled={!canCalculate}>
                    <Play className="w-4 h-4 mr-2" />
                    开始计算
                  </Button>
                </Link>
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4 mt-8">
          <Card className="p-4">
            <h3 className="font-medium text-white mb-3">功能说明</h3>
            <div className="space-y-2 text-sm text-slate-400">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />
                <span>支持持仓表、目标权重、买卖报价三类材料分别导入</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />
                <span>精确计算印花税、佣金、资本利得税，支持短期/长期税率差异</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />
                <span>亏损抵扣自动计算，支持wash sale规则和5年结转</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />
                <span>完整证据链追溯，每笔计算均可复查原始材料</span>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="font-medium text-white mb-3">数据安全</h3>
            <div className="space-y-2 text-sm text-slate-400">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                <span>所有数据处理在本地浏览器完成，不上传任何服务器</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                <span>原始材料完整留存，支持版本对比和重复提交检测</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                <span>支持导出完整报告，包含所有计算过程和证据链</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
