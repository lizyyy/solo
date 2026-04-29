import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { RawMaterial } from '../types';

type CraftingPhase = 'prepare' | 'crafting' | 'complete';

interface SelectedMaterial {
  materialId: string;
  amount: number;
}

interface SelectedOption {
  [key: string]: string;
}

const Crafting = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getItemById, addCreation, userCreations } = useApp();
  
  const [phase, setPhase] = useState<CraftingPhase>('prepare');
  const [selectedMaterials, setSelectedMaterials] = useState<SelectedMaterial[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption>({});
  const [itemName, setItemName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPoster, setShowPoster] = useState(false);
  const [posterReady, setPosterReady] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const item = getItemById(id || '');

  useEffect(() => {
    if (item) {
      setSelectedMaterials(prev => {
        if (prev.length > 0) return prev;
        return item.rawMaterials.map(m => ({
          materialId: m.id,
          amount: 50,
        }));
      });
    }
  }, [item]);

  const handleMaterialChange = (materialId: string, amount: number) => {
    setSelectedMaterials(prev =>
      prev.map(m =>
        m.materialId === materialId ? { ...m, amount: Math.max(0, Math.min(100, amount)) } : m
      )
    );
  };

  const handleOptionChange = (optionType: string, value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionType]: value,
    }));
  };

  const canStartCrafting = () => {
    if (!item) return false;
    const hasMaterials = selectedMaterials.some(m => m.amount > 0);
    const hasAllOptions = item.craftingOptions.every(opt => 
      Object.prototype.hasOwnProperty.call(selectedOptions, opt.type) && 
      selectedOptions[opt.type] !== undefined &&
      selectedOptions[opt.type] !== ''
    );
    return hasMaterials && hasAllOptions;
  };

  const handleCompleteCrafting = () => {
    if (!item) return;
    
    setIsGenerating(true);
    
    setTimeout(() => {
      addCreation({
        itemId: item.id,
        itemName: item.name,
        name: itemName || `我的${item.name}`,
        materials: selectedMaterials.filter(m => m.amount > 0),
        options: selectedOptions,
        image: item.coverImage,
      });
      
      setIsGenerating(false);
      setPhase('complete');
    }, 2000);
  };

  const getMaterialInfo = (materialId: string): RawMaterial | undefined => {
    return item?.rawMaterials.find(m => m.id === materialId);
  };

  const getOptionLabel = (optionType: string, value: string): string => {
    const option = item?.craftingOptions.find(o => o.type === optionType);
    return option?.options.find(o => o.value === value)?.name || value;
  };

  const getColorOption = (optionType: string): string | undefined => {
    const option = item?.craftingOptions.find(o => o.type === optionType);
    if (option?.type === 'color') {
      return selectedOptions[optionType];
    }
    return undefined;
  };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const generatePoster = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !item) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 400;
    const height = 600;
    canvas.width = width;
    canvas.height = height;

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#6B73FF');
    gradient.addColorStop(0.5, '#A5B4FC');
    gradient.addColorStop(1, '#F472B6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    roundRect(ctx, 20, 20, width - 40, height - 40, 20);
    ctx.fill();

    const colorOption = item.craftingOptions.find(o => o.type === 'color');
    const bgColor = colorOption ? selectedOptions['color'] : undefined;

    ctx.save();
    ctx.translate(width / 2, 100);
    ctx.fillStyle = bgColor || '#F9FAFB';
    roundRect(ctx, -60, -60, 120, 120, 20);
    ctx.fill();
    ctx.restore();

    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#333';
    ctx.fillText(item.emoji, width / 2, 100);

    const creationName = itemName || `我的${item.name}`;
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#1F2937';
    ctx.fillText(creationName, width / 2, 170);

    ctx.font = '14px Arial';
    ctx.fillStyle = '#6B73FF';
    ctx.fillText('✨ 专属定制 · 小小制造工厂', width / 2, 195);

    ctx.beginPath();
    ctx.moveTo(40, 220);
    ctx.lineTo(width - 40, 220);
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#1F2937';
    ctx.textAlign = 'left';
    ctx.fillText('📜 造物配方', 40, 250);

    const materials = selectedMaterials.filter(m => m.amount > 0);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#4B5563';
    
    materials.forEach((m, idx) => {
      const material = item.rawMaterials.find(rm => rm.id === m.materialId);
      const y = 280 + idx * 30;
      ctx.fillText(`${material?.icon} ${material?.name}: ${m.amount}%`, 40, y);
    });

    const startY = 280 + materials.length * 30 + 20;
    if (item.craftingOptions.length > 0) {
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#1F2937';
      ctx.fillText('🎨 款式选择', 40, startY);

      ctx.font = '14px Arial';
      ctx.fillStyle = '#4B5563';
      const optionsText = item.craftingOptions
        .map(opt => {
          const option = item.craftingOptions.find(o => o.type === opt.type);
          return option?.options.find(o => o.value === selectedOptions[opt.type])?.name || selectedOptions[opt.type];
        })
        .join(' · ');
      ctx.fillText(optionsText, 40, startY + 25);
    }

    const qrY = startY + (item.craftingOptions.length > 0 ? 60 : 0);
    
    ctx.fillStyle = '#6B73FF';
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        ctx.fillRect(width / 2 - 20 + i * 14, qrY + j * 14, 12, 12);
      }
    }

    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText('长按保存图片 · 分享给朋友', width / 2, height - 50);

    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#6B73FF';
    ctx.fillText('🏭 小小制造工厂', width / 2, height - 30);

    setPosterReady(true);
  }, [item, itemName, selectedMaterials, selectedOptions]);

  useEffect(() => {
    if (showPoster && item) {
      const timer = setTimeout(() => {
        generatePoster();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showPoster, item, generatePoster]);

  const savePoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${itemName || '我的造物'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const shareLink = () => {
    const shareText = `我在【小小制造工厂】制作了专属的${item?.name}！快来看看我的造物配方吧～`;
    
    if (navigator.share) {
      navigator.share({
        title: '我的专属造物',
        text: shareText,
        url: window.location.href,
      }).catch(() => {
        copyToClipboard();
      });
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    const shareText = `我在【小小制造工厂】制作了专属的${item?.name}！快来看看我的造物配方吧～ ${window.location.href}`;
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!item) {
    return (
      <div className="text-center py-12">
        <span className="text-6xl block mb-4">🔍</span>
        <h2 className="text-xl font-bold text-gray-800 mb-2">物品不存在</h2>
        <button
          onClick={() => navigate('/')}
          className="text-primary hover:underline"
        >
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
      >
        <span>←</span>
        <span>返回</span>
      </button>

      <div className="text-center">
        <span className="text-5xl block mb-3">{item.emoji}</span>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">制作：{item.name}</h1>
        <p className="text-gray-500">按照你的喜好，创造专属的{item.name}</p>
      </div>

      <div className="flex justify-center gap-2">
        {['准备材料', '开始制作', '完成'].map((label, idx) => {
          const phases: CraftingPhase[] = ['prepare', 'crafting', 'complete'];
          const currentIdx = phases.indexOf(phase);
          return (
            <div
              key={label}
              className={`flex items-center gap-2 ${idx < currentIdx ? 'text-green-500' : idx === currentIdx ? 'text-primary' : 'text-gray-400'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  idx < currentIdx
                    ? 'bg-green-100'
                    : idx === currentIdx
                    ? 'bg-primary text-white'
                    : 'bg-gray-100'
                }`}
              >
                {idx < currentIdx ? '✓' : idx + 1}
              </div>
              <span className="text-sm font-medium hidden md:block">{label}</span>
              {idx < 2 && (
                <div
                  className={`w-8 h-0.5 ${idx < currentIdx ? 'bg-green-100' : 'bg-gray-200'}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {phase === 'prepare' && (
        <div className="space-y-6">
          <section className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-xl">⚖️</span>
              调配原料
            </h2>
            <p className="text-gray-500 text-sm mb-4">调整各种原料的比例，创造你的独特配方</p>
            
            <div className="space-y-4">
              {item.rawMaterials.map((material) => {
                const selected = selectedMaterials.find(m => m.materialId === material.id);
                const amount = selected?.amount || 0;
                
                return (
                  <div key={material.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg ${material.color} flex items-center justify-center`}>
                          {material.icon}
                        </div>
                        <span className="font-medium text-gray-700">{material.name}</span>
                      </div>
                      <span className="text-sm text-gray-500">{amount}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={amount}
                      onChange={(e) => handleMaterialChange(material.id, parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-xl">🎨</span>
              选择款式
            </h2>
            
            <div className="space-y-6">
              {item.craftingOptions.map((option) => (
                <div key={option.type} className="space-y-3">
                  <h3 className="font-medium text-gray-700">{option.name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {option.options.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleOptionChange(option.type, opt.value)}
                        className={`p-3 rounded-xl text-center transition-all ${
                          selectedOptions[option.type] === opt.value
                            ? 'bg-primary/10 text-primary ring-2 ring-primary/30'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {option.type === 'color' ? (
                          <div
                            className="w-8 h-8 mx-auto rounded-full mb-2 border-2 border-gray-200"
                            style={{ backgroundColor: opt.value }}
                          />
                        ) : (
                          <span className="text-2xl block mb-1">{opt.icon}</span>
                        )}
                        <span className="text-sm font-medium">{opt.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-xl">✏️</span>
              给你的造物起名
            </h2>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={`例如：我的专属${item.name}`}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
            />
          </section>

          <button
            onClick={() => {
              setPhase('crafting');
            }}
            disabled={!canStartCrafting()}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all btn-press ${
              canStartCrafting()
                ? 'bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg hover:shadow-primary/30'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            🛠️ 开始制作
          </button>
        </div>
      )}

      {phase === 'crafting' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          {isGenerating ? (
            <div className="space-y-6 py-8">
              <div className="relative inline-block">
                <span className="text-8xl block animate-pulse">{item.emoji}</span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">正在制作中...</h2>
                <p className="text-gray-500">你的专属{item.name}即将诞生</p>
              </div>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full bg-primary animate-pulse`}
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800">确认你的配方</h3>
                <div
                  className="w-32 h-32 mx-auto rounded-2xl flex items-center justify-center text-6xl shadow-lg"
                  style={{ backgroundColor: getColorOption('color') || '#F9FAFB' }}
                >
                  {item.emoji}
                </div>
                <p className="text-xl font-bold text-gray-800">
                  {itemName || `我的${item.name}`}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3">
                <h4 className="font-medium text-gray-700">原料配方</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedMaterials.filter(m => m.amount > 0).map((m) => {
                    const material = getMaterialInfo(m.materialId);
                    return (
                      <span key={m.materialId} className="px-3 py-1 bg-white rounded-full text-sm text-gray-600 shadow-sm">
                        {material?.icon} {material?.name} {m.amount}%
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3">
                <h4 className="font-medium text-gray-700">款式选择</h4>
                <div className="grid grid-cols-2 gap-2">
                  {item.craftingOptions.map((opt) => (
                    <div key={opt.type} className="flex items-center justify-between bg-white rounded-lg p-2">
                      <span className="text-sm text-gray-500">{opt.name}</span>
                      <span className="text-sm font-medium text-gray-700">
                        {getOptionLabel(opt.type, selectedOptions[opt.type])}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPhase('prepare')}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  修改配方
                </button>
                <button
                  onClick={handleCompleteCrafting}
                  className="flex-1 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-medium hover:shadow-lg transition-all btn-press"
                >
                  ✨ 确认制作
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'complete' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 rounded-3xl p-8 text-center">
            <div className="text-6xl mb-4 animate-float">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">恭喜！制作完成！</h2>
            <p className="text-gray-600">你的专属{item.name}已经诞生</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-center space-y-4">
              <div
                className="w-40 h-40 mx-auto rounded-2xl flex items-center justify-center text-8xl shadow-lg"
                style={{ backgroundColor: getColorOption('color') || '#F9FAFB' }}
              >
                {item.emoji}
              </div>
              <h3 className="text-2xl font-bold text-gray-800">
                {itemName || `我的${item.name}`}
              </h3>
              <div className="flex justify-center gap-2">
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                  ✨ 专属定制
                </span>
                <span className="px-3 py-1 bg-calm/10 text-green-600 rounded-full text-sm">
                  ✓ 已完成
                </span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <h4 className="font-medium text-gray-700 mb-3">📜 造物配方</h4>
              <div className="space-y-2 text-sm text-gray-600">
                {selectedMaterials.filter(m => m.amount > 0).map((m) => {
                  const material = getMaterialInfo(m.materialId);
                  return (
                    <div key={m.materialId} className="flex justify-between">
                      <span>{material?.icon} {material?.name}</span>
                      <span className="font-medium">{m.amount}%</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h5 className="font-medium text-gray-700 mb-2">款式选择</h5>
                <div className="flex flex-wrap gap-2">
                  {item.craftingOptions.map((opt) => (
                    <span key={opt.type} className="px-3 py-1 bg-white rounded-full text-sm text-gray-600 shadow-sm">
                      {getOptionLabel(opt.type, selectedOptions[opt.type])}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPoster(true);
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-medium hover:shadow-lg transition-all btn-press flex items-center justify-center gap-2"
                >
                  <span>🖼️</span>
                  生成海报
                </button>
                <button
                  onClick={shareLink}
                  className="flex-1 py-3 bg-accent/10 text-accent rounded-xl font-medium hover:bg-accent/20 transition-all btn-press flex items-center justify-center gap-2"
                >
                  <span>{copied ? '✅' : '📤'}</span>
                  {copied ? '已复制' : '分享链接'}
                </button>
              </div>

              {showPoster && (
                <div className="mt-4 space-y-4">
                  <div className="bg-gray-100 rounded-xl p-4 flex justify-center">
                    <canvas
                      ref={canvasRef}
                      className="rounded-xl shadow-lg max-w-full"
                      style={{ maxWidth: '300px' }}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={savePoster}
                      disabled={!posterReady}
                      className={`flex-1 py-3 rounded-xl font-medium transition-all btn-press flex items-center justify-center gap-2 ${
                        posterReady
                          ? 'bg-primary text-white hover:bg-primary/90'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <span>💾</span>
                      保存图片
                    </button>
                    <button
                      onClick={() => setShowPoster(false)}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                    >
                      关闭
                    </button>
                  </div>
                  <p className="text-center text-sm text-gray-500">
                    💡 提示：也可以长按海报图片保存
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setPhase('prepare');
                  setItemName('');
                  setSelectedOptions({});
                  setShowPoster(false);
                  setPosterReady(false);
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                🔄 再做一个
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-medium hover:shadow-lg transition-all btn-press"
              >
                🏠 返回首页
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-warm/20 to-accent/20 rounded-2xl p-6 text-center">
            <span className="text-3xl block mb-2">💾</span>
            <p className="text-gray-700 font-medium">你的造物配方已自动保存</p>
            <p className="text-gray-500 text-sm mt-1">可以在收藏中查看你的所有创作</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Crafting;