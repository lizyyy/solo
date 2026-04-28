import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Eraser,
  Undo2,
  Save,
  Palette,
  PenTool,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const colors = [
  '#000000',
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#F39C12',
  '#E74C3C',
  '#2C3E50',
  '#95A5A6',
  '#6C5CE7',
];

const brushSizes = [2, 4, 6, 10, 14, 20, 30];

export default function DrawingCanvasPage() {
  const navigate = useNavigate();
  const { addArtwork } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [artworkTitle, setArtworkTitle] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [usedColors, setUsedColors] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<string>('');
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([imageData]);
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const pos = getPosition(e);
    lastPos.current = pos;

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    if (!isEraser) {
      setUsedColors(prev => new Set([...prev, currentColor]));
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !lastPos.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPosition(e);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = brushSize * 2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = brushSize;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPos.current = pos;
  };

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(false);
    lastPos.current = null;

    ctx.globalCompositeOperation = 'source-over';

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev, imageData]);
  }, [isDrawing]);

  const undo = () => {
    if (history.length <= 1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newHistory = history.slice(0, -1);
    setHistory(newHistory);

    const previousState = newHistory[newHistory.length - 1];
    ctx.putImageData(previousState, 0, 0);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev, imageData]);
    setUsedColors(new Set());
  };

  const openSaveModal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);

    setPreviewImage(tempCanvas.toDataURL('image/png'));
    setShowSaveModal(true);
  };

  const saveArtwork = () => {
    if (!artworkTitle.trim()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);

    const colorsArray = Array.from(usedColors);
    
    const colorEmotions: Record<string, { emotion: string; weight: number }> = {
      '#000000': { emotion: 'depression', weight: 1 },
      '#FF6B6B': { emotion: 'irritability', weight: 2 },
      '#4ECDC4': { emotion: 'anxiety', weight: 2 },
      '#45B7D1': { emotion: 'insomnia', weight: 2 },
      '#96CEB4': { emotion: 'depression', weight: 2 },
      '#FFEAA7': { emotion: 'fatigue', weight: 1 },
      '#DDA0DD': { emotion: 'depression', weight: 1 },
      '#F39C12': { emotion: 'irritability', weight: 1 },
      '#E74C3C': { emotion: 'irritability', weight: 2 },
      '#2C3E50': { emotion: 'depression', weight: 1 },
      '#6C5CE7': { emotion: 'anxiety', weight: 1 },
      '#95A5A6': { emotion: 'fatigue', weight: 1 },
    };

    const scores: Record<string, number> = {
      anxiety: 0,
      insomnia: 0,
      depression: 0,
      fatigue: 0,
      irritability: 0
    };

    colorsArray.forEach(color => {
      const analysis = colorEmotions[color];
      if (analysis) {
        scores[analysis.emotion] += analysis.weight;
      }
    });

    let dominantEmotion = 'anxiety';
    let maxScore = 0;

    Object.entries(scores).forEach(([emotion, score]) => {
      if (score > maxScore) {
        maxScore = score;
        dominantEmotion = emotion;
      }
    });

    const descriptions: Record<string, string> = {
      anxiety: '你的用色偏向冷静的色调，可能反映出内心需要更多的平静与安宁。',
      insomnia: '你的色彩选择偏向宁静的蓝色调，这可能暗示着你渴望内心的平静与放松。',
      depression: '你选择的颜色中包含了一些代表希望的绿色和温暖色调。这可能反映出你内心深处渴望温暖与关怀。',
      fatigue: '你的用色充满了活力和温暖的色调，这可能反映出你内心渴望更多的能量和活力。',
      irritability: '你的色彩选择包含了一些温暖的红色和橙色调。这可能暗示着你内心有一些需要释放的情绪能量。'
    };

    const suggestions: Record<string, string[]> = {
      anxiety: [
        '尝试在画作中加入更多柔和的蓝色和绿色',
        '可以听听舒缓的音乐，配合绘画来放松'
      ],
      insomnia: [
        '继续使用宁静的蓝色调，这有助于放松',
        '可以尝试在睡前进行简单的绘画活动'
      ],
      depression: [
        '尝试加入更多温暖的色调，如黄色和橙色',
        '可以画一些代表希望的元素，如阳光、花朵'
      ],
      fatigue: [
        '温暖的色调很适合表达活力',
        '可以尝试画一些动态的场景'
      ],
      irritability: [
        '尝试在画作中加入更多冷静的蓝色调',
        '绘画是释放情绪的好方式'
      ]
    };

    const imageData = tempCanvas.toDataURL('image/png');

    addArtwork({
      title: artworkTitle,
      imageData,
      isPrivate,
      colors: colorsArray,
      emotionAnalysis: {
        dominantEmotion: dominantEmotion as any,
        confidence: 0.7,
        description: descriptions[dominantEmotion],
        suggestions: suggestions[dominantEmotion],
        colorPalette: colorsArray
      }
    });

    setShowSaveModal(false);
    setArtworkTitle('');
    navigate('/painting-therapy');
  };

  return (
    <div className="fade-in">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate('/painting-therapy')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-semibold">随心画板 🎨</h1>
      </div>

      <div className="bg-gray-100 rounded-xl p-2 mb-4">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="w-full bg-white rounded-lg shadow-sm touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="card p-4 mb-4">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Palette size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-600">颜色</span>
            </div>
            {isEraser && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                橡皮擦模式
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {colors.map(color => (
              <button
                key={color}
                onClick={() => {
                  setCurrentColor(color);
                  setIsEraser(false);
                }}
                className={`w-9 h-9 rounded-full border-3 transition-all transform ${
                  currentColor === color && !isEraser
                    ? 'border-amber-500 scale-115 shadow-md'
                    : 'border-gray-200 hover:border-gray-400 hover:scale-105'
                } ${color === '#FFFFFF' ? 'ring-2 ring-gray-300' : ''}`}
                style={{ 
                  backgroundColor: color,
                  borderWidth: currentColor === color && !isEraser ? '3px' : '2px'
                }}
              />
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <PenTool size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-600">
              {isEraser ? '橡皮擦大小' : '笔刷大小'}
            </span>
            <span className="text-xs text-gray-400 ml-auto">
              当前: {brushSize}px
            </span>
          </div>
          <div className="flex items-center gap-3">
            {brushSizes.map(size => (
              <button
                key={size}
                onClick={() => setBrushSize(size)}
                className={`flex items-center justify-center w-11 h-11 rounded-lg transition-all ${
                  brushSize === size
                    ? 'bg-amber-100 ring-2 ring-amber-500 shadow-sm'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <div
                  className={`rounded-full ${isEraser ? 'bg-gray-400' : 'bg-black'}`}
                  style={{ 
                    width: Math.min(size, 20), 
                    height: Math.min(size, 20) 
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsEraser(!isEraser)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isEraser
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Eraser size={16} />
            橡皮擦
            {isEraser && <EyeOff size={14} />}
          </button>

          <button
            onClick={undo}
            disabled={history.length <= 1}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              history.length <= 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Undo2 size={16} />
            撤销
          </button>

          <button
            onClick={clearCanvas}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-all"
          >
            <Trash2 size={16} />
            清空
          </button>

          <button
            onClick={openSaveModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-md transition-all ml-auto"
          >
            <Save size={16} />
            保存
          </button>
        </div>
      </div>

      <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
        <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
          <span className="text-lg">💡</span>
          简易色彩情绪解读
        </h4>
        <p className="text-sm text-green-700 mb-4">
          完成创作后，系统会根据你使用的颜色进行温和的情绪分析（非诊断性质）。
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
            <div className="w-5 h-5 rounded shadow-sm" style={{ backgroundColor: '#45B7D1' }} />
            <span className="text-green-700">蓝色 - 平静、放松</span>
          </div>
          <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
            <div className="w-5 h-5 rounded shadow-sm" style={{ backgroundColor: '#96CEB4' }} />
            <span className="text-green-700">绿色 - 希望、成长</span>
          </div>
          <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
            <div className="w-5 h-5 rounded shadow-sm" style={{ backgroundColor: '#FFEAA7' }} />
            <span className="text-green-700">黄色 - 活力、快乐</span>
          </div>
          <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
            <div className="w-5 h-5 rounded shadow-sm" style={{ backgroundColor: '#FF6B6B' }} />
            <span className="text-green-700">红色 - 热情、能量</span>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div
            className="modal-content fade-in"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-6 text-center">保存作品 💾</h3>

            <div className="flex justify-center mb-6">
              <div className="w-48 h-48 bg-gray-100 rounded-xl overflow-hidden shadow-lg border-2 border-gray-200">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="作品预览"
                    className="w-full h-full object-contain bg-white"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    预览加载中...
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">作品标题</label>
              <input
                type="text"
                value={artworkTitle}
                onChange={(e) => setArtworkTitle(e.target.value)}
                placeholder="给你的作品起个名字..."
                className="input"
              />
            </div>

            <div className="form-group">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-gray-700 font-medium flex items-center gap-2">
                    {isPrivate ? <EyeOff size={16} /> : <Eye size={16} />}
                    设为私密作品
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    私密作品需要密码才能查看，保护你的隐私
                  </p>
                </div>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={saveArtwork}
                disabled={!artworkTitle.trim()}
                className={`flex-1 btn font-medium ${
                  artworkTitle.trim() 
                    ? 'btn-primary' 
                    : 'btn-secondary opacity-50 cursor-not-allowed'
                }`}
              >
                保存作品
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
