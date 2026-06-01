import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { 
  Search, 
  Eye, 
  Edit, 
  FileText, 
  Clock, 
  User, 
  Music,
  ChevronDown
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { 
  Notification, 
  NotificationStatus, 
  statusLabels, 
  statusColors 
} from '../types';

const statusOptions: { value: NotificationStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待确认' },
  { value: 'confirmed', label: '已确认' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' }
];

export default function List() {
  const { notifications, versions } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<NotificationStatus | 'all'>('all');

  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.piece.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || n.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedNotifications = [...filteredNotifications].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  if (notifications.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-24 h-24 mx-auto mb-6 bg-parchment-300 rounded-full flex items-center justify-center">
          <FileText className="w-12 h-12 text-burgundy-700" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-gray-800 mb-2">
          暂无通知记录
        </h2>
        <p className="text-gray-600 mb-6">
          点击右上角"加载样例"查看演示数据，或点击"新建通知"开始创建
        </p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => useStore.getState().initializeWithSamples()}
            className="btn-secondary"
          >
            加载样例数据
          </button>
          <Link to="/new" className="btn-primary">
            创建第一条通知
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索标题、学生姓名、曲目..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as NotificationStatus | 'all')}
            className="input-field pr-10 appearance-none cursor-pointer"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="grid gap-4">
        {sortedNotifications.map((notification) => (
          <NotificationCard 
            key={notification.id} 
            notification={notification}
            versionCount={versions[notification.id]?.length || 0}
          />
        ))}
      </div>

      {sortedNotifications.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          没有找到匹配的通知
        </div>
      )}
    </div>
  );
}

function NotificationCard({ 
  notification, 
  versionCount 
}: { 
  notification: Notification; 
  versionCount: number;
}) {
  return (
    <div className="card hover:shadow-lg transition-shadow animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-serif font-bold text-burgundy-900">
              {notification.title}
            </h3>
            <span className={`status-badge ${statusColors[notification.status]}`}>
              {statusLabels[notification.status]}
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-burgundy-600" />
              <span>{notification.studentName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Music className="w-4 h-4 text-burgundy-600" />
              <span>{notification.instrument}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-burgundy-600" />
              <span className="truncate">{notification.piece}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-burgundy-600" />
              <span>v{notification.currentVersion} · {versionCount}版</span>
            </div>
          </div>

          <p className="text-sm text-gray-600 line-clamp-2">
            {notification.reason}
          </p>

          <p className="text-xs text-gray-400 mt-2">
            更新于 {format(new Date(notification.updatedAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
          </p>
        </div>

        <div className="flex sm:flex-col gap-2">
          <Link
            to={`/notification/${notification.id}`}
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-sm bg-burgundy-50 text-burgundy-700 rounded hover:bg-burgundy-100 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>查看</span>
          </Link>
          <Link
            to={`/edit/${notification.id}`}
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-sm border border-burgundy-300 text-burgundy-700 rounded hover:bg-burgundy-50 transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span>编辑</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
