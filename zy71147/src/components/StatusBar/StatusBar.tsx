
import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { CollisionResult } from '../../types';

export const StatusBar: React.FC = () => {
  const { collisions, sceneData } = useAppStore();

  const errorCount = collisions.filter((c) => c.severity === 'error').length;
  const warningCount = collisions.filter((c) => c.severity === 'warning').length;

  const getCollisionIcon = (collision: CollisionResult) => {
    if (collision.severity === 'error') {
      return <XCircle size={16} className="text-red-500" />;
    }
    return <AlertTriangle size={16} className="text-orange-500" />;
  };

  const getCollisionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pier: '支墩碰撞',
      rail: '轨道越界',
      liftingPoint: '吊点异常',
      path: '路径冲突',
    };
    return labels[type] || type;
  };

  return (
    <div className="w-72 bg-gray-900 bg-opacity-95 text-white flex flex-col h-full border-l border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
          <Info size={20} />
          状态面板
        </h2>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-800 rounded p-2 text-center">
            <div className="text-2xl font-bold text-green-400">
              {sceneData.blocks.length}
            </div>
            <div className="text-xs text-gray-400">分段数量</div>
          </div>
          <div className="bg-gray-800 rounded p-2 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {sceneData.piers.length}
            </div>
            <div className="text-xs text-gray-400">支墩数量</div>
          </div>
        </div>

        <div className="flex gap-2">
          <div className={`flex-1 flex items-center justify-center gap-1 rounded py-2 ${
            errorCount > 0 ? 'bg-red-900 bg-opacity-50' : 'bg-gray-800'
          }`}>
            <XCircle size={14} className={errorCount > 0 ? 'text-red-500' : 'text-gray-500'} />
            <span className={`text-sm font-bold ${errorCount > 0 ? 'text-red-400' : 'text-gray-500'}`}>
              {errorCount}
            </span>
          </div>
          <div className={`flex-1 flex items-center justify-center gap-1 rounded py-2 ${
            warningCount > 0 ? 'bg-orange-900 bg-opacity-50' : 'bg-gray-800'
          }`}>
            <AlertTriangle size={14} className={warningCount > 0 ? 'text-orange-500' : 'text-gray-500'} />
            <span className={`text-sm font-bold ${warningCount > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
              {warningCount}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <AlertCircle size={16} />
          冲突检测结果
        </h3>

        {collisions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <CheckCircle size={48} className="mb-2 text-green-600" />
            <p className="text-sm">未检测到冲突</p>
            <p className="text-xs text-gray-600">吊装方案安全</p>
          </div>
        ) : (
          <div className="space-y-2">
            {collisions.map((collision) => (
              <div
                key={collision.id}
                className={`p-3 rounded border ${
                  collision.severity === 'error'
                    ? 'bg-red-900 bg-opacity-30 border-red-700'
                    : 'bg-orange-900 bg-opacity-30 border-orange-700'
                }`}
              >
                <div className="flex items-start gap-2">
                  {getCollisionIcon(collision)}
                  <div className="flex-1">
                    <div className="text-xs font-medium mb-1">
                      {getCollisionTypeLabel(collision.type)}
                    </div>
                    <div className="text-xs text-gray-300">
                      {collision.message}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-400 mb-2">图例说明</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-gray-300">正常吊点</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-gray-300">异常吊点</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-gray-300">吊装路径</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-700" />
            <span className="text-gray-300">临时支墩</span>
          </div>
        </div>
      </div>
    </div>
  );
};

