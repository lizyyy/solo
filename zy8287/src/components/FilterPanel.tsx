import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import type { Filters } from '../types';

const FilterPanel: React.FC = () => {
  const { filters, getDistinctOptions, applyFilter, savedFilters, loadSavedFilter, deleteSavedFilter } = useDashboard();
  const [isExpanded, setIsExpanded] = useState(true);

  const { hallIds, hallNames, timeSlots, industries } = getDistinctOptions();

  const handleHallChange = (hallId: string) => {
    const newHallIds = filters.hallIds.includes(hallId)
      ? filters.hallIds.filter((id) => id !== hallId)
      : [...filters.hallIds, hallId];
    applyFilter({ hallIds: newHallIds });
  };

  const handleTimeSlotChange = (timeSlot: string) => {
    const newTimeSlots = filters.timeSlots.includes(timeSlot)
      ? filters.timeSlots.filter((ts) => ts !== timeSlot)
      : [...filters.timeSlots, timeSlot];
    applyFilter({ timeSlots: newTimeSlots });
  };

  const handleIndustryChange = (industry: string) => {
    const newIndustries = filters.industries.includes(industry)
      ? filters.industries.filter((ind) => ind !== industry)
      : [...filters.industries, industry];
    applyFilter({ industries: newIndustries });
  };

  const activeFilterCount =
    filters.hallIds.length + filters.timeSlots.length + filters.industries.length;

  return (
    <div className="card mb-6">
      <div
        className="card-header flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span>筛选条件</span>
          {activeFilterCount > 0 && (
            <span className="tag tag-primary">{activeFilterCount} 个筛选</span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isExpanded && (
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">展馆</label>
              <div className="flex flex-wrap gap-2">
                {hallIds.map((hallId) => (
                  <button
                    key={hallId}
                    onClick={() => handleHallChange(hallId)}
                    className={`tag cursor-pointer transition-colors ${
                      filters.hallIds.includes(hallId)
                        ? 'tag-primary'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {hallNames.get(hallId) || hallId}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">时段</label>
              <div className="flex flex-wrap gap-2">
                {timeSlots.map((timeSlot) => (
                  <button
                    key={timeSlot}
                    onClick={() => handleTimeSlotChange(timeSlot)}
                    className={`tag cursor-pointer transition-colors ${
                      filters.timeSlots.includes(timeSlot)
                        ? 'tag-primary'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {timeSlot}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">行业</label>
              <div className="flex flex-wrap gap-2">
                {industries.map((industry) => (
                  <button
                    key={industry}
                    onClick={() => handleIndustryChange(industry)}
                    className={`tag cursor-pointer transition-colors ${
                      filters.industries.includes(industry)
                        ? 'tag-primary'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {industry}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {savedFilters.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">已保存的筛选</label>
              <div className="flex flex-wrap gap-2">
                {savedFilters.map((savedFilter) => (
                  <div
                    key={savedFilter.id}
                    className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1"
                  >
                    <button
                      onClick={() => loadSavedFilter(savedFilter)}
                      className="text-sm text-primary hover:underline"
                    >
                      {savedFilter.name}
                    </button>
                    <button
                      onClick={() => deleteSavedFilter(savedFilter.id)}
                      className="text-gray-400 hover:text-danger"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
