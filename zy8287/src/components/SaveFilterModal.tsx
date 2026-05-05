import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';

interface SaveFilterModalProps {
  onClose: () => void;
}

const SaveFilterModal: React.FC<SaveFilterModalProps> = ({ onClose }) => {
  const { filters, saveCurrentFilter, savedFilters, loadSavedFilter, deleteSavedFilter } = useDashboard();
  const [filterName, setFilterName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hasActiveFilters =
    filters.hallIds.length > 0 ||
    filters.boothIds.length > 0 ||
    filters.timeSlots.length > 0 ||
    filters.industries.length > 0;

  const handleSave = () => {
    if (!filterName.trim()) {
      setError('请输入筛选名称');
      return;
    }
    saveCurrentFilter(filterName.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">保存筛选</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {!hasActiveFilters ? (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无筛选条件</h3>
              <p className="text-gray-500">请先设置筛选条件后再保存</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">当前筛选条件</label>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                  {filters.hallIds.length > 0 && (
                    <span className="tag tag-primary">展馆: {filters.hallIds.length}个</span>
                  )}
                  {filters.boothIds.length > 0 && (
                    <span className="tag tag-primary">摊位: {filters.boothIds.length}个</span>
                  )}
                  {filters.timeSlots.length > 0 && (
                    <span className="tag tag-primary">时段: {filters.timeSlots.length}个</span>
                  )}
                  {filters.industries.length > 0 && (
                    <span className="tag tag-primary">行业: {filters.industries.length}个</span>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  筛选名称 <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => {
                    setFilterName(e.target.value);
                    setError(null);
                  }}
                  placeholder="例如：上午时段 1号馆"
                  className={`input w-full ${error ? 'border-danger' : ''}`}
                />
                {error && <p className="mt-1 text-sm text-danger">{error}</p>}
              </div>

              {savedFilters.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">已保存的筛选</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {savedFilters.map((savedFilter) => (
                      <div
                        key={savedFilter.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <button
                          onClick={() => loadSavedFilter(savedFilter)}
                          className="text-sm text-primary hover:underline text-left"
                        >
                          <div className="font-medium">{savedFilter.name}</div>
                          <div className="text-xs text-gray-500">
                            保存于 {new Date(savedFilter.createdAt).toLocaleString('zh-CN')}
                          </div>
                        </button>
                        <button
                          onClick={() => deleteSavedFilter(savedFilter.id)}
                          className="text-gray-400 hover:text-danger p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-secondary">
            取消
          </button>
          {hasActiveFilters && (
            <button onClick={handleSave} className="btn btn-primary">
              保存
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SaveFilterModal;
