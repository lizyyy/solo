import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, AlertTriangle, Clock, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { ExceptionChart } from '../components/charts/ExceptionChart';
import { useRecordStore } from '../store/useRecordStore';
import { formatCurrency } from '../utils/fileParser';

export const Dashboard = () => {
  const navigate = useNavigate();
  const initRecords = useRecordStore(state => state.initRecords);
  const getStatistics = useRecordStore(state => state.getStatistics);
  const getFilteredRecords = useRecordStore(state => state.getFilteredRecords);
  const setFilters = useRecordStore(state => state.setFilters);

  useEffect(() => {
    initRecords();
  }, [initRecords]);

  const statistics = getStatistics();
  const recentRecords = getFilteredRecords().slice(0, 5);

  const statCards = [
    {
      label: '待处理',
      value: statistics.pending,
      icon: Clock,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      filter: 'pending' as const
    },
    {
      label: '异常',
      value: statistics.abnormal,
      icon: AlertTriangle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      filter: 'abnormal' as const
    },
    {
      label: '正常',
      value: statistics.normal,
      icon: CheckCircle,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      filter: 'normal' as const
    },
    {
      label: '误命中',
      value: statistics.falsePositive,
      icon: XCircle,
      color: 'bg-gray-500',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-700',
      filter: 'false_positive' as const
    }
  ];

  const handleCardClick = (status: typeof statCards[0]['filter']) => {
    setFilters({ status });
    navigate('/exceptions');
  };

  return (
    <Layout title="工作台">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">场外期权敞口穿透预警</h1>
            <p className="text-sm text-gray-500 mt-1">共 {statistics.total} 条估值记录</p>
          </div>
          <button
            onClick={() => navigate('/import')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-sm hover:bg-blue-700 transition-colors"
          >
            <FileUp size={16} />
            导入材料
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                onClick={() => handleCardClick(card.filter)}
                className={`${card.bgColor} p-4 rounded-sm border border-gray-200 cursor-pointer hover:shadow-md transition-all`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${card.textColor}`}>{card.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                  </div>
                  <div className={`${card.color} w-10 h-10 rounded-sm flex items-center justify-center`}>
                    <Icon size={20} className="text-white" />
                  </div>
                </div>
                <div className="mt-3 flex items-center text-xs text-gray-500">
                  <span>点击查看详情</span>
                  <ArrowRight size={12} className="ml-1" />
                </div>
              </div>
            );
          })}
        </div>

        <ExceptionChart />

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white border border-gray-200 rounded-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">最近记录</h3>
              <button
                onClick={() => navigate('/exceptions')}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                查看全部
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 py-2 px-2">交易编号</th>
                    <th className="text-left text-xs font-medium text-gray-500 py-2 px-2">交易对手</th>
                    <th className="text-left text-xs font-medium text-gray-500 py-2 px-2">产品类型</th>
                    <th className="text-right text-xs font-medium text-gray-500 py-2 px-2">名义本金</th>
                    <th className="text-left text-xs font-medium text-gray-500 py-2 px-2">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRecords.map((record) => (
                    <tr
                      key={record.id}
                      onClick={() => navigate(`/record/${record.id}`)}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="text-sm text-blue-600 py-3 px-2 font-mono">{record.tradeId}</td>
                      <td className="text-sm text-gray-900 py-3 px-2">{record.counterparty}</td>
                      <td className="text-sm text-gray-600 py-3 px-2">{record.productType}</td>
                      <td className="text-sm text-gray-900 py-3 px-2 text-right font-mono">
                        {formatCurrency(record.notionalAmount)}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${
                          record.currentStatus === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          record.currentStatus === 'normal' ? 'bg-green-50 text-green-700 border-green-200' :
                          record.currentStatus === 'abnormal' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            record.currentStatus === 'pending' ? 'bg-amber-500' :
                            record.currentStatus === 'normal' ? 'bg-green-500' :
                            record.currentStatus === 'abnormal' ? 'bg-red-500' :
                            'bg-gray-400'
                          }`} />
                          {record.currentStatus === 'pending' ? '待处理' :
                           record.currentStatus === 'normal' ? '正常' :
                           record.currentStatus === 'abnormal' ? '异常' : '误命中'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">快速入口</h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/import')}
                className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-sm hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-sm flex items-center justify-center">
                  <FileUp size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">导入估值材料</p>
                  <p className="text-xs text-gray-500">上传Excel/CSV文件</p>
                </div>
              </button>
              
              <button
                onClick={() => {
                  setFilters({ status: 'abnormal' });
                  navigate('/exceptions');
                }}
                className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-sm hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-red-100 rounded-sm flex items-center justify-center">
                  <AlertTriangle size={16} className="text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">处理异常记录</p>
                  <p className="text-xs text-gray-500">{statistics.abnormal} 条待处理</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/docs')}
                className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-sm hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-sm flex items-center justify-center">
                  <FileUp size={16} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">查看操作说明</p>
                  <p className="text-xs text-gray-500">导入、改判步骤指南</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
