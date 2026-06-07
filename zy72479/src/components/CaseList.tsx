import { useCaseStore } from '../store/useCaseStore';
import { StatusBadge, ResultTypeBadge } from './StatusBadge';
import { MapPin, Calendar, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function CaseList() {
  const { cases, selectedCaseId, selectCase } = useCaseStore();
  const navigate = useNavigate();

  const handleCaseClick = (caseId: string) => {
    selectCase(caseId);
    navigate(`/case/${caseId}`);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-700" />
          调解案件列表
        </h2>
      </div>
      <div className="divide-y divide-gray-100">
        {cases.map((caseItem) => (
          <div
            key={caseItem.id}
            onClick={() => handleCaseClick(caseItem.id)}
            className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
              selectedCaseId === caseItem.id ? 'bg-primary-50 border-l-4 border-l-primary-700' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {caseItem.title}
                </h3>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {caseItem.address}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {caseItem.createdAt.split(' ')[0]}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 items-end">
                <StatusBadge status={caseItem.status} />
                <ResultTypeBadge resultType={caseItem.resultType} />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 line-clamp-2">{caseItem.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
