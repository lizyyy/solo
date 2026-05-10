import React, { useState, useEffect } from 'react';
import { statsApi, roomsApi, damageReportsApi } from '../api';
import { BedDouble, Users, AlertTriangle, Package, TrendingUp } from 'lucide-react';

function Dashboard() {
  const [stats, setStats] = useState({});
  const [recentDamages, setRecentDamages] = useState([]);

  useEffect(() => {
    loadStats();
    loadRecentDamages();
  }, []);

  const loadStats = async () => {
    try {
      const res = await statsApi.get();
      setStats(res.data);
    } catch (err) {
      console.error('加载统计失败', err);
    }
  };

  const loadRecentDamages = async () => {
    try {
      const res = await damageReportsApi.getAll();
      setRecentDamages(res.data.slice(0, 5));
    } catch (err) {
      console.error('加载报损失败', err);
    }
  };

  const statCards = [
    { label: '总客房数', value: stats.rooms, icon: BedDouble, color: 'bg-blue-500' },
    { label: '在住客房', value: stats.occupied_rooms, icon: Users, color: 'bg-green-500' },
    { label: '未结房单', value: stats.open_orders, icon: TrendingUp, color: 'bg-orange-500' },
    { label: '待处理报损', value: stats.pending_damages, icon: AlertTriangle, color: 'bg-red-500' },
    { label: '今日库存变动', value: stats.today_transactions, icon: Package, color: 'bg-purple-500' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">总览</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className={`${card.color} p-2 rounded-lg text-white`}>
                  <Icon size={24} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-800">{card.value || 0}</div>
                  <div className="text-sm text-gray-500">{card.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">最近报损记录</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {recentDamages.length === 0 ? (
              <div className="p-4 text-center text-gray-500">暂无报损记录</div>
            ) : (
              recentDamages.map((damage) => (
                <div key={damage.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-800">
                        {damage.room_number} - {damage.linen_name} × {damage.quantity}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        客人: {damage.guest_name} | 报告人: {damage.reporter_name || '未知'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {damage.report_time}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      damage.payment_status === 'paid' 
                        ? 'bg-green-100 text-green-700' 
                        : damage.status === 'cancelled'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {damage.payment_status === 'paid' ? '已赔付' : 
                       damage.status === 'cancelled' ? '已取消' : 
                       damage.status === 'confirmed' ? '待赔付' : '待确认'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">系统功能说明</h3>
          </div>
          <div className="p-4 space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span><strong>客房管理</strong>: 管理酒店客房信息和状态</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span><strong>客房房单</strong>: 客人入住登记和退房处理</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span><strong>清洁检查</strong>: 清洁员对客房进行清洁检查</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span><strong>报损登记</strong>: 发现布草损坏时登记，防止重复报损</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span><strong>客人赔付</strong>: 报损确认后自动生成赔付单，关联房单</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span><strong>库存管理</strong>: 报损确认后自动调整布草库存</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span><strong>导出日报</strong>: 导出当日房单、赔付、库存变动汇总</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
