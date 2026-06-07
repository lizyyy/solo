import CategoryTabs from '../components/list/CategoryTabs';
import FilterBar from '../components/list/FilterBar';
import RecordList from '../components/list/RecordList';
import { FileText, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { mockRecords } from '../data/mockRecords';

const ListPage = () => {
  const stats = {
    total: mockRecords.length,
    pending: mockRecords.filter(r => r.status === 'pending').length,
    confirmed: mockRecords.filter(r => r.status === 'confirmed').length,
    duplicate: mockRecords.filter(r => r.type === 'duplicate').length,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-primary-900 mb-2">灰度回看记录</h1>
        <p className="text-gray-500">查看和复核模型 A/B 灰度测试的用户反馈记录</p>
      </div>
      
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary-800">{stats.total}</p>
              <p className="text-sm text-gray-500">总记录数</p>
            </div>
          </div>
        </div>
        
        <div className="card-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-sm text-gray-500">待复核</p>
            </div>
          </div>
        </div>
        
        <div className="card-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
              <p className="text-sm text-gray-500">已确认</p>
            </div>
          </div>
        </div>
        
        <div className="card-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{stats.duplicate}</p>
              <p className="text-sm text-gray-500">重复计入</p>
            </div>
          </div>
        </div>
      </div>
      
      <CategoryTabs />
      <FilterBar />
      <RecordList />
    </div>
  );
};

export default ListPage;
