import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { ArrowLeft, MapPin, FileWarning } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DateDisplay from '../components/DateDisplay';

export default function InspectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { inspections, redlineRemarks, complaints } = useAppStore();

  const inspection = inspections.find((i) => i.id === id);
  const relatedRedline = redlineRemarks.find((r) => r.id === inspection?.redlineRemarkId);
  const relatedComplaints = complaints.filter((c) => c.inspectionId === id);

  if (!inspection) {
    return <div className="text-center py-20 text-gray-500">巡查表不存在</div>;
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate('/inspection')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回巡查表列表
      </button>

      <PageHeader
        title={inspection.areaName}
        subtitle={`巡查人：${inspection.inspector}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">巡查详情</h3>
            
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-500">巡查日期</p>
                <p className="font-medium text-gray-900 mt-1">
                  <DateDisplay date={inspection.inspectionDate} formatStr="yyyy年MM月dd日" />
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">宠物活动区投诉</p>
                <p className="font-medium text-orange-600 mt-1 text-xl">
                  {inspection.petAreaComplaints} 起
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">发现的坡道问题</p>
              {inspection.rampIssues.length > 0 ? (
                <div className="space-y-2">
                  {inspection.rampIssues.map((issue, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-sm text-red-800">{issue}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-green-600">未发现坡道问题</p>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">巡查备注</p>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                "{inspection.remarks}"
              </p>
            </div>
          </div>

          {inspection.photos.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">现场照片</h3>
              <div className="grid grid-cols-3 gap-4">
                {inspection.photos.map((_photo, i) => (
                  <div key={i} className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-gray-400">照片 {i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {relatedRedline && (
            <div className="card p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                关联红线图备注
              </h3>
              <Link
                to={`/redline/${relatedRedline.id}`}
                className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <p className="font-medium text-gray-900">{relatedRedline.code}</p>
                <p className="text-sm text-gray-500 mt-1">{relatedRedline.location}</p>
              </Link>
            </div>
          )}

          <div className="card p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <FileWarning className="w-4 h-4" />
              相关投诉 ({relatedComplaints.length})
            </h3>
            {relatedComplaints.length > 0 ? (
              <div className="space-y-2">
                {relatedComplaints.map((c) => (
                  <Link
                    key={c.id}
                    to={`/complaints/${c.id}`}
                    className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{c.code}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">暂无相关投诉</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
