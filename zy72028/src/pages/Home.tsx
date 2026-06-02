import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Clock, User, FileText, CheckCircle, XCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { ValidationAlert } from '../components/ValidationAlert';
import { ResourceBar } from '../components/ResourceBar';

export function Home() {
  const navigate = useNavigate();
  const { materials, validationResults, initMaterials, selectMaterial } = useGameStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    initMaterials();
  }, [initMaterials]);

  const handleSelect = (materialId: string) => {
    setSelectedId(materialId);
    selectMaterial(materialId);
    setShowValidation(true);
  };

  const handleStartGame = () => {
    if (selectedId) {
      navigate(`/game/${selectedId}`);
    }
  };

  const selectedValidation = selectedId ? validationResults[selectedId] : null;
  const selectedMaterial = materials.find(m => m.id === selectedId);

  const normalMaterials = materials.filter(m => !m.isBadConfig);
  const badConfigMaterials = materials.filter(m => m.isBadConfig);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-800 mb-3">
            🚌 城市公交调度棋
          </h1>
          <p className="text-slate-600 text-lg">
            快速决策模拟训练 · 1-2分钟一局 · 完整判断过程可追溯
          </p>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            选择材料包
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {normalMaterials.map(material => (
              <MaterialCard
                key={material.id}
                material={material}
                validation={validationResults[material.id]}
                isSelected={selectedId === material.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>

        {badConfigMaterials.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              配置验证测试
              <span className="text-sm font-normal text-slate-500">（选择后可查看错误提示，无法开始游戏）</span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {badConfigMaterials.map(material => (
                <MaterialCard
                  key={material.id}
                  material={material}
                  validation={validationResults[material.id]}
                  isSelected={selectedId === material.id}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>
        )}

        {showValidation && selectedValidation && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              配置验证结果
            </h3>
            <ValidationAlert validation={selectedValidation} showSuccess={true} />
          </div>
        )}

        {selectedMaterial && (
          <div className="mb-8 p-5 bg-white rounded-xl border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">材料包信息</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">来源：</span>
                <span className="text-slate-700">{selectedMaterial.source}</span>
              </div>
              <div>
                <span className="text-slate-500">创建时间：</span>
                <span className="text-slate-700">
                  {new Date(selectedMaterial.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
              <div>
                <span className="text-slate-500">创建人：</span>
                <span className="text-slate-700">{selectedMaterial.createdBy}</span>
              </div>
              <div>
                <span className="text-slate-500">事件数：</span>
                <span className="text-slate-700">{selectedMaterial.events.length}个</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={handleStartGame}
            disabled={!selectedId || !selectedValidation?.isValid}
            className={`
              px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-2 transition-all
              ${selectedId && selectedValidation?.isValid
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            <Play className="w-6 h-6" />
            开始游戏
          </button>
        </div>

        <div className="mt-12 p-6 bg-white/50 rounded-xl border border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-4">📖 使用说明</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>• 选择一个材料包后，系统会自动验证配置是否正确</li>
            <li>• 游戏时间为 90-120 秒，需要在规定时间内完成所有调度决策</li>
            <li>• 每个事件有多个选项，请根据调度规则选择最佳方案</li>
            <li>• 游戏中可随时暂停，进度自动保存，回来后继续</li>
            <li>• 结算页面会详细展示你的关键选择和扣分原因</li>
            <li>• 课程助教可以在结算后补录备注，系统会保留完整审计记录</li>
            <li>• 配置验证测试区可验证系统对坏配置的提示能力</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

interface MaterialCardProps {
  material: {
    id: string;
    name: string;
    description: string;
    isSample: boolean;
    isBadConfig?: boolean;
    gameDuration: number;
    events: { length: number };
    createdBy: string;
    initialResources: {
      buses: number;
      drivers: number;
      budget: number;
      reputation: number;
    };
  };
  validation: { isValid: boolean } | undefined;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function MaterialCard({ material, validation, isSelected, onSelect }: MaterialCardProps) {
  const statusIcon = validation?.isValid
    ? <CheckCircle className="w-5 h-5 text-green-500" />
    : <XCircle className="w-5 h-5 text-red-500" />;

  return (
    <div
      onClick={() => onSelect(material.id)}
      className={`
        relative p-5 rounded-xl cursor-pointer transition-all duration-200
        ${isSelected 
          ? 'bg-white shadow-lg border-2 border-blue-500 scale-[1.02]' 
          : material.isBadConfig
            ? 'bg-red-50/70 hover:bg-red-50 hover:shadow-md border border-red-200'
            : 'bg-white/70 hover:bg-white hover:shadow-md border border-slate-200'
        }
      `}
    >
      {material.isSample && !material.isBadConfig && (
        <span className="absolute top-3 right-3 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
          样例
        </span>
      )}
      {material.isBadConfig && (
        <span className="absolute top-3 right-3 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
          坏配置
        </span>
      )}
      
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-bold text-slate-800 text-lg">{material.name}</h3>
        {statusIcon}
      </div>
      
      <p className="text-sm text-slate-600 mb-4 line-clamp-2">
        {material.description}
      </p>

      <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {material.gameDuration}秒
        </span>
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          {material.events.length}个事件
        </span>
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {material.createdBy}
        </span>
      </div>

      <ResourceBar resources={material.initialResources} showLabels={false} />
    </div>
  );
}
