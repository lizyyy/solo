import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  RefreshCw, Users, Building2, Ship, Package, 
  AlertTriangle, CheckCircle, Clock, ArrowRight,
  TrendingUp
} from 'lucide-react';
import { useAppStore } from '../store/store';

export default function Dashboard() {
  const { status, guests, rooms, ships, supplies, batches, fetchAll, loading } = useAppStore();

  const priorityGuests = guests.filter(g => 
    (g.is_elderly || g.is_child || g.has_disability) && !g.is_evacuated
  );

  const pendingGuests = guests.filter(g => !g.is_evacuated);
  const evacuatedGuests = guests.filter(g => g.is_evacuated);

  const criticalSupplies = supplies.filter(s => s.quantity <= s.min_threshold);
  const sealedRooms = rooms.filter(r => r.is_window_sealed);
  const evacuatedRooms = rooms.filter(r => r.is_evacuated);

  const getStatusColor = (percentage) => {
    if (percentage >= 100) return 'bg-success-500';
    if (percentage >= 50) return 'bg-primary-500';
    return 'bg-warning-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">台风撤房物资联动表</h1>
          <p className="text-gray-500 mt-1">实时监控撤离进度、物资状态和船班安排</p>
        </div>
        <button 
          onClick={fetchAll}
          disabled={loading.status}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading.status ? 'animate-spin' : ''}`} />
          刷新数据
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/guests" className="card hover:shadow-md transition-shadow">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">住客撤离</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {status?.guests?.evacuated || 0}/{status?.guests?.total || 0}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                (status?.guests?.percentage || 0) >= 100 ? 'bg-success-50' : 'bg-primary-50'
              }`}>
                <Users className={`w-6 h-6 ${
                  (status?.guests?.percentage || 0) >= 100 ? 'text-success-600' : 'text-primary-600'
                }`} />
              </div>
            </div>
            <div className="mt-3">
              <div className="progress-bar">
                <div 
                  className={`progress-bar-fill ${getStatusColor(status?.guests?.percentage || 0)}`}
                  style={{ width: `${status?.guests?.percentage || 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{status?.guests?.percentage || 0}% 已完成</p>
            </div>
          </div>
        </Link>

        <Link to="/rooms" className="card hover:shadow-md transition-shadow">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">房间状态</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {evacuatedRooms.length}/{rooms.length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-warning-50 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-warning-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-success-600" />
                {sealedRooms.length} 间已封窗
              </span>
            </div>
          </div>
        </Link>

        <Link to="/ships" className="card hover:shadow-md transition-shadow">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">可用船班</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {ships.filter(s => s.status === 'available').length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center">
                <Ship className="w-6 h-6 text-primary-600" />
              </div>
            </div>
            <div className="mt-3 text-sm">
              <span className="text-gray-500">总容量: </span>
              <span className="font-medium">
                {ships.reduce((sum, s) => sum + s.capacity, 0)} 人
              </span>
            </div>
          </div>
        </Link>

        <Link to="/supplies" className="card hover:shadow-md transition-shadow">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">物资状态</p>
                <p className={`text-2xl font-bold mt-1 ${
                  criticalSupplies.length > 0 ? 'text-danger-600' : 'text-success-600'
                }`}>
                  {criticalSupplies.length > 0 ? `${criticalSupplies.length} 项不足` : '充足'}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                criticalSupplies.length > 0 ? 'bg-danger-50' : 'bg-success-50'
              }`}>
                {criticalSupplies.length > 0 ? (
                  <AlertTriangle className="w-6 h-6 text-danger-600" />
                ) : (
                  <Package className="w-6 h-6 text-success-600" />
                )}
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-500">
              共 {supplies.length} 项物资
            </div>
          </div>
        </Link>
      </div>

      {priorityGuests.length > 0 && (
        <div className="card border-warning-300">
          <div className="card-header bg-warning-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning-600" />
              <h2 className="font-semibold text-warning-900">高优先级住客</h2>
              <span className="badge badge-warning">{priorityGuests.length} 人</span>
            </div>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {priorityGuests.map(guest => (
                <div key={guest.id} className="p-3 bg-warning-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{guest.name}</span>
                    <span className="badge badge-danger">
                      {guest.is_elderly ? '老人' : guest.is_child ? '儿童' : '行动不便'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    房间: {guest.room_number || '未分配'} | 
                    {guest.evacuation_batch_id ? ' 已分配批次' : ' 待分配'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">撤离批次进度</h2>
            <Link to="/batches" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              查看全部 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="card-body">
            {batches.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">暂无撤离批次</p>
                <Link to="/batches" className="btn btn-primary mt-4">
                  生成撤离方案
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {batches.slice(0, 5).map(batch => (
                  <div key={batch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">第 {batch.batch_number} 批次</span>
                        <span className={`badge ${
                          batch.status === 'completed' ? 'badge-success' :
                          batch.status === 'in_progress' ? 'badge-primary' : 'badge-warning'
                        }`}>
                          {batch.status === 'completed' ? '已完成' :
                           batch.status === 'in_progress' ? '进行中' : '计划中'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {batch.guest_count}/{batch.max_capacity} 人 | 
                        {batch.ship_name || ' 船班待定'}
                      </p>
                    </div>
                    <div className="w-20">
                      <div className="progress-bar">
                        <div 
                          className={`progress-bar-fill ${
                            batch.status === 'completed' ? 'bg-success-500' :
                            batch.status === 'in_progress' ? 'bg-primary-500' : 'bg-warning-500'
                          }`}
                          style={{ width: `${batch.max_capacity > 0 ? (batch.guest_count / batch.max_capacity * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">最近活动</h2>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-success-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {evacuatedGuests.length} 名住客已撤离
                  </p>
                  <p className="text-xs text-gray-500">剩余 {pendingGuests.length} 人待撤离</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {sealedRooms.length} 间房已封窗
                  </p>
                  <p className="text-xs text-gray-500">
                    共 {rooms.length} 间房，{rooms.filter(r => r.is_occupied).length} 间有人
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  criticalSupplies.length > 0 ? 'bg-danger-100' : 'bg-success-100'
                }`}>
                  <Package className={`w-4 h-4 ${
                    criticalSupplies.length > 0 ? 'text-danger-600' : 'text-success-600'
                  }`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {criticalSupplies.length > 0 
                      ? `${criticalSupplies.length} 项物资不足` 
                      : '所有物资充足'}
                  </p>
                  <p className="text-xs text-gray-500">
                    共监控 {supplies.length} 项物资
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-warning-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {batches.filter(b => b.status === 'in_progress').length} 个批次进行中
                  </p>
                  <p className="text-xs text-gray-500">
                    {batches.filter(b => b.status === 'completed').length} 个批次已完成
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
