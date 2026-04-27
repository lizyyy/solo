import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { 
  PET_TYPE_LABELS, 
  BODY_SHAPE_LABELS, 
  COAT_TYPE_LABELS, 
  SEASON_LABELS, 
  SCENARIO_LABELS 
} from '../types';

const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { historyRecords, deleteHistoryRecord, updateHistoryRecord } = useAppContext();
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'dog' | 'cat'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecords = historyRecords.filter(record => {
    const matchesType = filterType === 'all' || record.measurement.petType === filterType;
    const matchesSearch = !searchQuery || 
      record.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.recommendation.recommendedSize.includes(searchQuery);
    return matchesType && matchesSearch;
  });

  const handleDelete = (id: string) => {
    deleteHistoryRecord(id);
    setDeleteConfirmId(null);
  };

  const handleStartEdit = (record: { id: string; petName: string }) => {
    setEditingId(record.id);
    setEditName(record.petName);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      updateHistoryRecord(id, { petName: editName.trim() });
    }
    setEditingId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  if (historyRecords.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">历史记录</h1>
          <p className="text-gray-600">查看您保存的宠物测量和推荐记录</p>
        </div>
        
        <div className="card text-center py-16">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">暂无历史记录</h2>
          <p className="text-gray-600 mb-6">
            完成测量后，可以将结果保存到历史记录，方便下次查看
          </p>
          <Link to="/measure" className="btn-primary inline-flex items-center gap-2">
            <span>开始测量</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">历史记录</h1>
        <p className="text-gray-600">查看您保存的宠物测量和推荐记录</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索宠物名称或尺码..."
            className="input-field"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filterType === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setFilterType('dog')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filterType === 'dog'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🐕 狗狗
          </button>
          <button
            onClick={() => setFilterType('cat')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filterType === 'cat'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🐱 猫咪
          </button>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">未找到匹配的记录</h2>
          <p className="text-gray-600">请尝试其他搜索条件</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((record) => (
            <div key={record.id} className="card hover:shadow-md transition-shadow duration-200">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="text-5xl">
                    {record.measurement.petType === 'dog' ? '🐕' : '🐱'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      {editingId === record.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-40"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(record.id)}
                            className="text-green-600 hover:text-green-700 p-1"
                          >
                            ✓
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-gray-500 hover:text-gray-700 p-1"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-lg font-bold text-gray-800 truncate">
                            {record.petName}
                          </h3>
                          <button
                            onClick={() => handleStartEdit({ id: record.id, petName: record.petName })}
                            className="text-gray-400 hover:text-gray-600 p-1"
                          >
                            ✏️
                          </button>
                        </>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="badge bg-primary-100 text-primary-700">
                        推荐尺码: {record.recommendation.recommendedSize}
                      </span>
                      <span className="badge bg-gray-100 text-gray-700">
                        {PET_TYPE_LABELS[record.measurement.petType]}
                      </span>
                      <span className="badge bg-gray-100 text-gray-700">
                        {BODY_SHAPE_LABELS[record.measurement.bodyShape]}
                      </span>
                      <span className="badge bg-gray-100 text-gray-700">
                        {COAT_TYPE_LABELS[record.measurement.coatType]}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>
                        📏 胸围: {record.measurement.chest}cm / 背长: {record.measurement.length}cm
                        {record.measurement.neck && ` / 颈围: ${record.measurement.neck}cm`}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2">
                      <span>🌸 季节: {SEASON_LABELS[record.measurement.season]}</span>
                      <span>📍 场景: {SCENARIO_LABELS[record.measurement.scenario]}</span>
                      <span>📅 {new Date(record.createdAt).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col gap-2">
                  <button
                    onClick={() => navigate(`/history/${record.id}`)}
                    className="btn-primary text-sm py-2 px-4"
                  >
                    查看详情
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(record.id)}
                    className="btn-secondary text-sm py-2 px-4 text-red-500 border-red-300 hover:bg-red-50"
                  >
                    删除
                  </button>
                </div>
              </div>

              {deleteConfirmId === record.id && (
                <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-sm text-red-700 mb-3">
                    确定要删除这条记录吗？此操作无法撤销。
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      确认删除
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filteredRecords.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          共 {filteredRecords.length} 条记录
          {filterType !== 'all' && (
            <span className="ml-2">
              ({filterType === 'dog' ? '狗狗' : '猫咪'})
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
