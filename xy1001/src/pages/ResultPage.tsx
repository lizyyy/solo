import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { 
  SIZE_LABELS, 
  PET_TYPE_LABELS, 
  BODY_SHAPE_LABELS, 
  COAT_TYPE_LABELS, 
  SEASON_LABELS, 
  SCENARIO_LABELS,
  SizeCode,
  MaterialType
} from '../types';
import { getMaterialByType } from '../data/materialRules';
import { getSizeChartsByCriteria } from '../data/sizeCharts';

const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { 
    currentMeasurement, 
    currentRecommendation, 
    historyRecords, 
    addHistoryRecord 
  } = useAppContext();
  
  const [petName, setPetName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const measurement = id 
    ? historyRecords.find(r => r.id === id)?.measurement 
    : currentMeasurement;
  
  const recommendation = id 
    ? historyRecords.find(r => r.id === id)?.recommendation 
    : currentRecommendation;

  const isFromHistory = !!id;

  if (!measurement || !recommendation) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">暂无推荐结果</h2>
          <p className="text-gray-600 mb-6">请先完成测量步骤，获取专业的尺码和材质推荐</p>
          <Link to="/measure" className="btn-primary inline-flex items-center gap-2">
            <span>开始测量</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    );
  }

  const sizeCharts = getSizeChartsByCriteria(measurement.petType, measurement.bodyShape);
  
  const handleSave = () => {
    if (!petName.trim()) return;
    
    addHistoryRecord({
      petName: petName.trim(),
      measurement,
      recommendation,
    });
    
    setSaveSuccess(true);
    setTimeout(() => {
      setShowSaveModal(false);
      setSaveSuccess(false);
      setPetName('');
    }, 1500);
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'exact':
        return { label: '完全匹配', class: 'bg-green-100 text-green-700' };
      case 'between':
        return { label: '介于两码之间', class: 'bg-yellow-100 text-yellow-700' };
      case 'borderline':
        return { label: '接近边界', class: 'bg-orange-100 text-orange-700' };
      default:
        return { label: confidence, class: 'bg-gray-100 text-gray-700' };
    }
  };

  const confidenceBadge = getConfidenceBadge(recommendation.sizeConfidence);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">
            {isFromHistory ? '历史记录详情' : '推荐结果'}
          </h1>
          <p className="text-gray-600">
            根据您的测量数据，为您推荐以下尺码和材质
          </p>
        </div>
        {!isFromHistory && (
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/share')}
              className="btn-secondary flex items-center gap-2"
            >
              <span>📤</span>
              <span>分享</span>
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <span>💾</span>
              <span>保存</span>
            </button>
          </div>
        )}
      </div>

      <div className="card bg-gradient-to-r from-primary-500 to-accent-500 text-white">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="text-6xl">
              {measurement.petType === 'dog' ? '🐕' : '🐱'}
            </div>
            <div>
              <div className="text-lg opacity-90 mb-1">推荐尺码</div>
              <div className="text-5xl font-bold">
                {recommendation.recommendedSize}
              </div>
              <div className="text-lg opacity-90 mt-1">
                {SIZE_LABELS[recommendation.recommendedSize as SizeCode]}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <span className={`badge ${confidenceBadge.class}`}>
              {confidenceBadge.label}
            </span>
            {recommendation.alternativeSizes.length > 0 && (
              <div className="text-sm opacity-90">
                备选尺码：{recommendation.alternativeSizes.join('、')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📏 尺码详情</h2>
          
          <div className="mb-6">
            <h3 className="font-medium text-gray-700 mb-3">推荐理由</h3>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
              {recommendation.sizeReasoning}
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-700 mb-3">参考尺码表</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">尺码</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">胸围(cm)</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">背长(cm)</th>
                  </tr>
                </thead>
                <tbody>
                  {sizeCharts.slice(0, 6).map((chart) => (
                    <tr 
                      key={chart.id}
                      className={`border-b border-gray-100 ${
                        chart.sizeCode === recommendation.recommendedSize
                          ? 'bg-primary-50'
                          : ''
                      }`}
                    >
                      <td className="py-2 px-3">
                        <span className={`font-medium ${
                          chart.sizeCode === recommendation.recommendedSize
                            ? 'text-primary-600'
                            : 'text-gray-800'
                        }`}>
                          {chart.sizeCode}
                          {chart.sizeCode === recommendation.recommendedSize && (
                            <span className="ml-2 text-primary-500">★</span>
                          )}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-600">
                        {chart.chestMin}-{chart.chestMax}
                      </td>
                      <td className="py-2 px-3 text-gray-600">
                        {chart.lengthMin}-{chart.lengthMax}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold text-gray-800 mb-4">🧵 材质推荐</h2>
          
          <div className="space-y-4">
            {recommendation.recommendedMaterials.map((material, index) => {
              const materialData = getMaterialByType(material.materialType as MaterialType);
              const priorityColors = {
                high: 'border-green-200 bg-green-50',
                medium: 'border-yellow-200 bg-yellow-50',
                low: 'border-gray-200 bg-gray-50',
              };
              
              return (
                <div 
                  key={index}
                  className={`p-4 rounded-xl border ${priorityColors[material.priority]}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {material.materialType === 'cotton' ? '👕' :
                         material.materialType === 'linen' ? '🌿' :
                         material.materialType === 'fleece' ? '🧥' :
                         material.materialType === 'wool' ? '🐑' :
                         material.materialType === 'down' ? '🦆' :
                         material.materialType === 'nylon' ? '🎽' :
                         material.materialType === 'waterproof' ? '☔' : '✨'}
                      </span>
                      <span className="font-semibold text-gray-800">{material.name}</span>
                    </div>
                    <span className={`badge ${
                      material.priority === 'high' ? 'bg-green-100 text-green-700' :
                      material.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {material.priority === 'high' ? '强烈推荐' : 
                       material.priority === 'medium' ? '推荐' : '可选'}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{material.reason}</p>
                  
                  {materialData && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">{materialData.description}</p>
                      <div className="flex flex-wrap gap-2">
                        <div className="text-xs">
                          <span className="text-gray-500">优点：</span>
                          <span className="text-gray-700">{materialData.pros.slice(0, 2).join('、')}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-gray-800 mb-4">📝 综合建议</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendation.overallTips.map((tip, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-primary-500 mt-0.5">💡</span>
              <p className="text-sm text-gray-600 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-gray-800 mb-4">📋 测量数据回顾</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <div className="text-xs text-gray-500 mb-1">宠物类型</div>
            <div className="font-semibold text-gray-800">
              {PET_TYPE_LABELS[measurement.petType]}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <div className="text-xs text-gray-500 mb-1">体型分类</div>
            <div className="font-semibold text-gray-800">
              {BODY_SHAPE_LABELS[measurement.bodyShape]}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <div className="text-xs text-gray-500 mb-1">毛发类型</div>
            <div className="font-semibold text-gray-800">
              {COAT_TYPE_LABELS[measurement.coatType]}
            </div>
          </div>
          <div className="p-4 bg-primary-50 rounded-xl text-center">
            <div className="text-xs text-gray-500 mb-1">胸围</div>
            <div className="font-semibold text-primary-600">{measurement.chest} cm</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <div className="text-xs text-gray-500 mb-1">背长</div>
            <div className="font-semibold text-gray-800">{measurement.length} cm</div>
          </div>
          {measurement.neck && (
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <div className="text-xs text-gray-500 mb-1">颈围</div>
              <div className="font-semibold text-gray-800">{measurement.neck} cm</div>
            </div>
          )}
          {measurement.weight && (
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <div className="text-xs text-gray-500 mb-1">体重</div>
              <div className="font-semibold text-gray-800">{measurement.weight} kg</div>
            </div>
          )}
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <div className="text-xs text-gray-500 mb-1">季节</div>
            <div className="font-semibold text-gray-800">
              {SEASON_LABELS[measurement.season]}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <div className="text-xs text-gray-500 mb-1">穿着场景</div>
            <div className="font-semibold text-gray-800">
              {SCENARIO_LABELS[measurement.scenario]}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4 pt-4">
        <Link to="/measure" className="btn-secondary">
          重新测量
        </Link>
        <Link to="/" className="btn-primary">
          返回首页
        </Link>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            {saveSuccess ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">保存成功！</h3>
                <p className="text-gray-600">已保存到历史记录</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-800 mb-4">保存到历史记录</h3>
                <p className="text-gray-600 text-sm mb-4">
                  为您的宠物命名，方便下次快速查看
                </p>
                <div className="mb-6">
                  <label className="form-label">宠物名称</label>
                  <input
                    type="text"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    placeholder="例如：豆豆、小白..."
                    className="input-field"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowSaveModal(false);
                      setPetName('');
                    }}
                    className="btn-secondary flex-1"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!petName.trim()}
                    className={`flex-1 ${
                      petName.trim() ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed rounded-xl'
                    }`}
                  >
                    保存
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultPage;
