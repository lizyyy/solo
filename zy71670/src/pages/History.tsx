import React from 'react';
import { useStore } from '../store';
import { formatDate } from '../utils/tension';
import { RISK_LEVEL_LABELS, ERROR_TYPE_LABELS } from '../types';
import { ArrowLeft, Trash2, Eye, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const History: React.FC = () => {
  const navigate = useNavigate();
  const { records, customers, instruments, deleteRecord, setCurrentRecord } = useStore();
  const [searchTerm, setSearchTerm] = React.useState('');

  const getInstrument = (instrumentId: string) => {
    return instruments.find((i) => i.id === instrumentId);
  };

  const getCustomer = (customerId: string) => {
    return customers.find((c) => c.id === customerId);
  };

  const filteredRecords = records.filter((r) => {
    if (!searchTerm) return true;
    const instrument = getInstrument(r.instrumentId);
    const customer = instrument ? getCustomer(instrument.customerId) : null;
    const searchLower = searchTerm.toLowerCase();
    return (
      customer?.name.toLowerCase().includes(searchLower) ||
      instrument?.brand.toLowerCase().includes(searchLower) ||
      instrument?.model.toLowerCase().includes(searchLower) ||
      r.stringSpec.includes(searchTerm) ||
      r.pitch.toLowerCase().includes(searchLower)
    );
  });

  const handleViewRecord = (recordId: string) => {
    setCurrentRecord(recordId);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary-800 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-serif text-xl font-semibold">历史记录</h1>
              <p className="text-xs text-primary-200">浏览和管理所有张力记录</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-primary-200">
              共 {records.length} 条记录
            </span>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索客户、乐器、规格..."
            className="input-base pl-10"
          />
        </div>
      </div>

      {/* Records List */}
      <div className="p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          {filteredRecords.map((record) => {
            const instrument = getInstrument(record.instrumentId);
            const customer = instrument ? getCustomer(instrument.customerId) : null;
            const unresolvedTags = record.errorTags.filter((t) => !t.resolved);
            
            return (
              <div
                key={record.id}
                className={`card-base hover:shadow-md transition-shadow ${
                  unresolvedTags.length > 0 ? 'border-l-4 border-l-warning-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-800">
                        {customer?.name || '未知客户'}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {instrument?.brand} {instrument?.model}
                      </span>
                      {unresolvedTags.length > 0 && (
                        <span className="badge badge-warning">
                          {unresolvedTags.length} 个待解决
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <span>第{record.stringNumber}弦</span>
                      <span className="font-mono">{record.stringSpec}</span>
                      <span className="font-mono">{record.pitch}</span>
                      <span>张力: <span className="font-mono font-medium">{record.final.tension.toFixed(1)}N</span></span>
                      <span className={`badge ${
                        record.final.riskLevel >= 4 ? 'badge-danger' :
                        record.final.riskLevel >= 3 ? 'badge-warning' : 'badge-success'
                      }`}>
                        {RISK_LEVEL_LABELS[record.final.riskLevel]}
                      </span>
                    </div>

                    {unresolvedTags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {unresolvedTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="badge badge-danger text-xs"
                            title={tag.description}
                          >
                            {ERROR_TYPE_LABELS[tag.type]}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-gray-400 mt-2">
                      创建: {formatDate(record.createdAt)} · 更新: {formatDate(record.updatedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewRecord(record.id)}
                      className="p-2 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors"
                      title="查看并编辑"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('确定要删除这条记录吗？')) {
                          deleteRecord(record.id);
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-danger-50 text-danger-600 transition-colors"
                      title="删除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredRecords.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg">暂无记录</p>
              <p className="text-sm mt-2">
                {searchTerm ? '没有找到匹配的记录' : '在工作台创建第一条记录吧'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
