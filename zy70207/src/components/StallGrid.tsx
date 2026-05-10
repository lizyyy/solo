import { useApp } from '../context/AppContext';
import { getStatusColor, getStatusText, getIssueTypeText } from '../utils/helpers';
import type { Stall } from '../types';

interface StallGridProps {
  onStallClick: (stall: Stall) => void;
  selectedStallId?: string;
}

export const StallGrid = ({ onStallClick, selectedStallId }: StallGridProps) => {
  const { state, getIssuesByStall } = useApp();
  const { stalls } = state;

  const maxRow = Math.max(...stalls.map((s) => s.row));
  const maxCol = Math.max(...stalls.map((s) => s.col));

  const grid: (Stall | null)[][] = Array(maxRow + 1)
    .fill(null)
    .map(() => Array(maxCol + 1).fill(null));

  stalls.forEach((stall) => {
    grid[stall.row][stall.col] = stall;
  });

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">夜市摊位网格</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 bg-green-100 border border-green-300 rounded"></span>
          <span className="text-sm text-gray-600">正常</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 bg-red-100 border border-red-300 rounded"></span>
          <span className="text-sm text-gray-600">有问题</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></span>
          <span className="text-sm text-gray-600">整改中</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></span>
          <span className="text-sm text-gray-600">已整改</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-2">
            {row.map((stall, colIndex) => {
              if (!stall) {
                return (
                  <div
                    key={`empty-${rowIndex}-${colIndex}`}
                    className="w-40 h-24 border border-dashed border-gray-300 rounded-lg bg-gray-50"
                  />
                );
              }

              const issues = getIssuesByStall(stall.id);
              const isSelected = selectedStallId === stall.id;

              return (
                <div
                  key={stall.id}
                  onClick={() => onStallClick(stall)}
                  className={`w-40 h-24 border-2 rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${
                    getStatusColor(stall.status)
                  } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="font-medium text-sm truncate">{stall.name}</div>
                  <div className="text-xs opacity-80 mt-1">{stall.owner}</div>
                  <div className="text-xs mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      stall.status === 'normal' ? 'bg-green-200' : 
                      stall.status === 'has_issue' ? 'bg-red-200' :
                      stall.status === 'pending_rectification' ? 'bg-yellow-200' : 'bg-blue-200'
                    }`}>
                      {getStatusText(stall.status)}
                    </span>
                  </div>
                  {issues.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {issues.slice(0, 2).map((issue) => (
                        <span
                          key={issue.id}
                          className={`text-xs px-1 rounded ${
                            issue.type === 'oil' ? 'bg-amber-200' : 'bg-orange-200'
                          }`}
                        >
                          {getIssueTypeText(issue.type)}
                        </span>
                      ))}
                      {issues.length > 2 && (
                        <span className="text-xs">+{issues.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
