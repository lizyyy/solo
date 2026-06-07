import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { Search, ChevronRight, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import DateDisplay from '../components/DateDisplay';

export default function InspectionList() {
  const navigate = useNavigate();
  const { inspections } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = inspections.filter(
    (i) => i.areaName.includes(searchTerm) || i.inspector.includes(searchTerm)
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="网格员巡查表"
        subtitle="查看网格员提交的巡查记录，与红线图备注互相关联"
      />

      <div className="card p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索区域名称、巡查员..."
            className="input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((inspection) => (
          <div
            key={inspection.id}
            className="card p-6 card-hover cursor-pointer"
            onClick={() => navigate(`/inspection/${inspection.id}`)}
          >
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-primary-50">
                <ClipboardList className="w-6 h-6 text-primary-700" />
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </div>
            <h3 className="mt-4 font-semibold text-gray-900">{inspection.areaName}</h3>
            <p className="text-sm text-gray-500 mt-1">
              巡查人：{inspection.inspector}
            </p>
            <div className="flex flex-wrap gap-3 mt-4 text-sm">
              <span className="text-orange-600">
                宠物区投诉：{inspection.petAreaComplaints} 起
              </span>
              <span className="text-red-600">
                坡道问题：{inspection.rampIssues.length} 项
              </span>
            </div>
            <p className="mt-4 text-xs text-gray-400">
              <DateDisplay date={inspection.inspectionDate} formatStr="yyyy-MM-dd" />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
