import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const ShareCard: React.FC = () => {
  const navigate = useNavigate();
  const { currentMeasurement, currentRecommendation } = useAppContext();
  
  const [copied, setCopied] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<'blue' | 'pink' | 'green' | 'orange'>('blue');

  if (!currentMeasurement || !currentRecommendation) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">暂无分享内容</h2>
          <p className="text-gray-600 mb-6">请先完成测量步骤，获取专业的尺码和材质推荐</p>
          <Link to="/measure" className="btn-primary inline-flex items-center gap-2">
            <span>开始测量</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    );
  }

  const themes = {
    blue: {
      bg: 'from-blue-500 to-cyan-400',
      accent: 'bg-blue-500',
      light: 'bg-blue-50',
      text: 'text-blue-600',
    },
    pink: {
      bg: 'from-pink-500 to-rose-400',
      accent: 'bg-pink-500',
      light: 'bg-pink-50',
      text: 'text-pink-600',
    },
    green: {
      bg: 'from-emerald-500 to-teal-400',
      accent: 'bg-emerald-500',
      light: 'bg-emerald-50',
      text: 'text-emerald-600',
    },
    orange: {
      bg: 'from-orange-500 to-amber-400',
      accent: 'bg-orange-500',
      light: 'bg-orange-50',
      text: 'text-orange-600',
    },
  };

  const theme = themes[selectedTheme];

  const generateShareText = (): string => {
    const petTypeLabel = PET_TYPE_LABELS[currentMeasurement.petType];
    const bodyShapeLabel = BODY_SHAPE_LABELS[currentMeasurement.bodyShape];
    const coatTypeLabel = COAT_TYPE_LABELS[currentMeasurement.coatType];
    const seasonLabel = SEASON_LABELS[currentMeasurement.season];
    const scenarioLabel = SCENARIO_LABELS[currentMeasurement.scenario];
    
    let text = `🐾 宠物服装推荐结果 🐾\n\n`;
    text += `【宠物信息】\n`;
    text += `类型：${petTypeLabel}\n`;
    text += `体型：${bodyShapeLabel}\n`;
    text += `毛发：${coatTypeLabel}\n\n`;
    
    text += `【测量数据】\n`;
    text += `胸围：${currentMeasurement.chest} cm\n`;
    text += `背长：${currentMeasurement.length} cm`;
    if (currentMeasurement.neck) {
      text += `\n颈围：${currentMeasurement.neck} cm`;
    }
    if (currentMeasurement.weight) {
      text += `\n体重：${currentMeasurement.weight} kg`;
    }
    text += `\n\n`;
    
    text += `【使用场景】\n`;
    text += `季节：${seasonLabel}\n`;
    text += `场景：${scenarioLabel}\n\n`;
    
    text += `【推荐结果】\n`;
    text += `✅ 推荐尺码：${currentRecommendation.recommendedSize} (${SIZE_LABELS[currentRecommendation.recommendedSize as SizeCode]})\n`;
    
    if (currentRecommendation.alternativeSizes.length > 0) {
      text += `🔄 备选尺码：${currentRecommendation.alternativeSizes.join('、')}\n`;
    }
    text += `\n`;
    
    text += `【推荐材质】\n`;
    currentRecommendation.recommendedMaterials.forEach((m, i) => {
      const priority = m.priority === 'high' ? '⭐ 强烈推荐' : m.priority === 'medium' ? '✨ 推荐' : '💡 可选';
      text += `${i + 1}. ${m.name} - ${priority}\n`;
      text += `   ${m.reason}\n`;
    });
    text += `\n`;
    
    text += `【温馨提示】\n`;
    currentRecommendation.overallTips.slice(0, 3).forEach((tip) => {
      text += `💡 ${tip}\n`;
    });
    text += `\n`;
    
    text += `—— 来自「宠物服装助手」`;
    
    return text;
  };

  const handleCopy = async () => {
    const text = generateShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleShare = async () => {
    const text = generateShareText();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: '宠物服装推荐结果',
          text: text,
        });
      } catch (err) {
        console.log('分享取消');
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">分享卡片</h1>
          <p className="text-gray-600">生成精美的推荐结果卡片，与好友分享</p>
        </div>
        <button
          onClick={() => navigate('/result')}
          className="btn-secondary"
        >
          ← 返回结果
        </button>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">选择主题</h3>
        <div className="flex gap-3">
          {(['blue', 'pink', 'green', 'orange'] as const).map(themeOption => (
            <button
              key={themeOption}
              onClick={() => setSelectedTheme(themeOption)}
              className={`w-12 h-12 rounded-xl border-4 transition-all ${
                selectedTheme === themeOption
                  ? 'border-gray-800 scale-110'
                  : 'border-transparent hover:border-gray-300'
              } ${
                themeOption === 'blue' ? 'bg-gradient-to-br from-blue-500 to-cyan-400' :
                themeOption === 'pink' ? 'bg-gradient-to-br from-pink-500 to-rose-400' :
                themeOption === 'green' ? 'bg-gradient-to-br from-emerald-500 to-teal-400' :
                'bg-gradient-to-br from-orange-500 to-amber-400'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <div 
          id="share-card"
          className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl"
          style={{ aspectRatio: '9/16' }}
        >
          <div className={`bg-gradient-to-br ${theme.bg} text-white p-6`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-3xl">🐾</span>
                <span className="font-bold">宠物服装助手</span>
              </div>
              <span className="text-sm opacity-80">
                {new Date().toLocaleDateString('zh-CN')}
              </span>
            </div>
            
            <div className="text-center py-4">
              <div className="text-8xl mb-4">
                {currentMeasurement.petType === 'dog' ? '🐕' : '🐱'}
              </div>
              <div className="text-lg opacity-90 mb-2">推荐尺码</div>
              <div className="text-7xl font-black">
                {currentRecommendation.recommendedSize}
              </div>
              <div className="text-lg mt-2 opacity-90">
                {SIZE_LABELS[currentRecommendation.recommendedSize as SizeCode]}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                测量数据
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-800">
                    {currentMeasurement.chest}
                  </div>
                  <div className="text-xs text-gray-500">胸围(cm)</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-800">
                    {currentMeasurement.length}
                  </div>
                  <div className="text-xs text-gray-500">背长(cm)</div>
                </div>
                {currentMeasurement.neck && (
                  <div className="text-center p-3 bg-gray-50 rounded-xl">
                    <div className="text-2xl font-bold text-gray-800">
                      {currentMeasurement.neck}
                    </div>
                    <div className="text-xs text-gray-500">颈围(cm)</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                使用场景
              </h4>
              <div className="flex flex-wrap gap-2">
                <span className={`badge ${theme.light} ${theme.text}`}>
                  {SEASON_LABELS[currentMeasurement.season]}
                </span>
                <span className="badge bg-gray-100 text-gray-700">
                  {SCENARIO_LABELS[currentMeasurement.scenario]}
                </span>
                <span className="badge bg-gray-100 text-gray-700">
                  {BODY_SHAPE_LABELS[currentMeasurement.bodyShape]}
                </span>
                <span className="badge bg-gray-100 text-gray-700">
                  {COAT_TYPE_LABELS[currentMeasurement.coatType]}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                推荐材质
              </h4>
              <div className="space-y-2">
                {currentRecommendation.recommendedMaterials.slice(0, 3).map((m, i) => {
                  const materialData = getMaterialByType(m.materialType as MaterialType);
                  return (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${
                      m.priority === 'high' ? theme.light : 'bg-gray-50'
                    }`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${
                        m.priority === 'high' ? theme.accent : 'bg-gray-400'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 text-sm">{m.name}</div>
                        {materialData && (
                          <div className="text-xs text-gray-500 truncate">
                            {materialData.description}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs font-medium ${
                        m.priority === 'high' ? theme.text : 'text-gray-400'
                      }`}>
                        {m.priority === 'high' ? '强烈推荐' : m.priority === 'medium' ? '推荐' : '可选'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🐾</span>
                  <div>
                    <div className="text-sm font-medium text-gray-800">宠物服装助手</div>
                    <div className="text-xs text-gray-400">精准测量 · 科学推荐</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">生成时间</div>
                  <div className="text-sm text-gray-600">
                    {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">分享文本预览</h3>
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
          {generateShareText()}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={handleCopy}
          className={`flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all ${
            copied
              ? 'bg-green-500 text-white'
              : 'btn-primary'
          }`}
        >
          <span>{copied ? '✅' : '📋'}</span>
          <span>{copied ? '已复制' : '复制文本'}</span>
        </button>
        
        <button
          onClick={handleShare}
          className="btn-secondary flex items-center justify-center gap-2 px-8 py-4"
        >
          <span>📤</span>
          <span>系统分享</span>
        </button>
        
        <Link
          to="/result"
          className="btn-secondary flex items-center justify-center gap-2 px-8 py-4"
        >
          <span>←</span>
          <span>返回结果页</span>
        </Link>
      </div>
    </div>
  );
};

export default ShareCard;
