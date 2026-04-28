import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Palette,
  Lock,
  Unlock,
  Trash2,
  Eye,
  Edit3,
  X,
  Heart,
  ChevronRight,
  Sparkles,
  Share2,
  Download
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { emotionMap } from '../data/mockData';
import { UserArtwork } from '../types';

export default function ArtworkGalleryPage() {
  const navigate = useNavigate();
  const { state, deleteArtwork, toggleArtworkPrivacy } = useApp();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPrivateArtworks, setShowPrivateArtworks] = useState(false);
  const [selectedArtwork, setSelectedArtwork] = useState<UserArtwork | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'public' | 'private'>('all');

  const handleVerifyPassword = () => {
    if (passwordInput === '123456') {
      setShowPrivateArtworks(true);
      setShowPasswordModal(false);
      setPasswordInput('');
      setPasswordError('');
    } else {
      setPasswordError('密码错误，请重试');
    }
  };

  const getVisibleArtworks = () => {
    let artworks = state.userArtworks;
    
    if (!showPrivateArtworks) {
      artworks = artworks.filter(a => !a.isPrivate);
    }
    
    if (filterType === 'public') {
      artworks = artworks.filter(a => !a.isPrivate);
    } else if (filterType === 'private') {
      artworks = artworks.filter(a => a.isPrivate);
    }
    
    return artworks;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const visibleArtworks = getVisibleArtworks();
  const publicCount = state.userArtworks.filter(a => !a.isPrivate).length;
  const privateCount = state.userArtworks.filter(a => a.isPrivate).length;

  return (
    <div className="fade-in">
      <h1 className="page-title">我的作品集 🎨</h1>

      {/* 统计卡片 */}
      <div className="card mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div 
            className={`text-center p-3 rounded-xl cursor-pointer transition-colors ${
              filterType === 'all' ? 'bg-amber-100' : 'bg-gray-50'
            }`}
            onClick={() => setFilterType('all')}
          >
            <p className="text-2xl font-bold text-amber-500">{state.userArtworks.length}</p>
            <p className="text-xs text-gray-500">全部作品</p>
          </div>
          <div 
            className={`text-center p-3 rounded-xl cursor-pointer transition-colors ${
              filterType === 'public' ? 'bg-green-100' : 'bg-gray-50'
            }`}
            onClick={() => setFilterType('public')}
          >
            <p className="text-2xl font-bold text-green-500">{publicCount}</p>
            <p className="text-xs text-gray-500">公开作品</p>
          </div>
          <div 
            className={`text-center p-3 rounded-xl cursor-pointer transition-colors ${
              filterType === 'private' ? 'bg-pink-100' : 'bg-gray-50'
            }`}
            onClick={() => {
              if (!showPrivateArtworks && privateCount > 0) {
                setShowPasswordModal(true);
              } else {
                setFilterType('private');
              }
            }}
          >
            <p className="text-2xl font-bold text-pink-500">
              {showPrivateArtworks ? privateCount : '🔒'}
            </p>
            <p className="text-xs text-gray-500">私密作品</p>
          </div>
        </div>
      </div>

      {/* 私密解锁状态 */}
      {showPrivateArtworks && (
        <div className="card mb-6 bg-pink-50 border-pink-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Unlock size={20} className="text-pink-500" />
              <span className="text-pink-700 font-medium">私密作品已解锁</span>
            </div>
            <button
              onClick={() => {
                setShowPrivateArtworks(false);
                setFilterType('all');
              }}
              className="text-sm text-pink-600 hover:text-pink-800"
            >
              重新锁定
            </button>
          </div>
        </div>
      )}

      {/* 快捷操作 */}
      <div 
        className="card mb-6 cursor-pointer hover:shadow-lg transition-all"
        onClick={() => navigate('/drawing-canvas')}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
          >
            <Edit3 size={28} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-800">创作新作品</h3>
            <p className="text-sm text-gray-500">在空白画布上自由表达</p>
          </div>
          <ChevronRight size={24} className="text-gray-400" />
        </div>
      </div>

      {/* 作品列表 */}
      {visibleArtworks.length === 0 ? (
        <div className="empty-state">
          <Palette size={64} className="text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            {filterType === 'private' ? '没有私密作品' : '还没有作品'}
          </h3>
          <p className="text-gray-500 text-center mb-4">
            {filterType === 'private' 
              ? '你的所有作品都是公开的' 
              : '去随心画板创作你的第一幅作品吧'}
          </p>
          <button
            onClick={() => navigate('/drawing-canvas')}
            className="btn btn-primary"
          >
            <Edit3 size={18} className="mr-2" />
            开始创作
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {[...visibleArtworks].reverse().map(artwork => (
            <div
              key={artwork.id}
              className="card cursor-pointer hover:shadow-lg transition-all"
              onClick={() => setSelectedArtwork(artwork)}
            >
              <div className="flex gap-4">
                {/* 作品缩略图 */}
                <div className="relative w-24 h-24 flex-shrink-0">
                  <img
                    src={artwork.imageData}
                    alt={artwork.title}
                    className="w-full h-full object-cover rounded-xl"
                  />
                  {artwork.isPrivate && (
                    <div className="absolute top-1 left-1 bg-black/50 text-white px-2 py-0.5 rounded text-xs flex items-center gap-1">
                      <Lock size={10} />
                      私密
                    </div>
                  )}
                </div>

                {/* 作品信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-800 truncate">{artwork.title}</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleArtworkPrivacy(artwork.id);
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        artwork.isPrivate 
                          ? 'bg-pink-100 text-pink-600 hover:bg-pink-200' 
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {artwork.isPrivate ? <Lock size={16} /> : <Unlock size={16} />}
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 mb-3">
                    {formatDate(artwork.createdAt)}
                  </p>

                  {/* 色彩情绪分析 */}
                  {artwork.emotionAnalysis && (
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{emotionMap[artwork.emotionAnalysis.dominantEmotion].icon}</span>
                        <span className="text-xs font-medium text-gray-700">
                          色彩情绪：{emotionMap[artwork.emotionAnalysis.dominantEmotion].name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {artwork.emotionAnalysis.description}
                      </p>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedArtwork(artwork);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-amber-50 text-amber-600 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors"
                    >
                      <Eye size={14} />
                      查看
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteArtwork(artwork.id);
                      }}
                      className="flex items-center justify-center gap-1 py-2 px-3 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部提示 */}
      {state.userArtworks.length > 0 && (
        <div className="card mt-6" style={{ background: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)' }}>
          <div className="flex items-start gap-3">
            <Sparkles size={24} className="text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-green-800 mb-1">💡 创作小贴士</h4>
              <p className="text-sm text-green-700">
                创作是表达情绪的好方式。你可以随时查看自己的色彩情绪分析，了解内心的情绪倾向。记得将私密的作品设为私密保护哦！
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 底部空间 */}
      <div className="h-4" />

      {/* 作品详情模态框 */}
      {selectedArtwork && (
        <div className="modal-overlay" onClick={() => setSelectedArtwork(null)}>
          <div 
            className="modal-content fade-in max-h-[90vh] overflow-y-auto p-0"
            onClick={e => e.stopPropagation()}
          >
            {/* 顶部操作栏 */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{selectedArtwork.title}</h3>
              <button
                onClick={() => setSelectedArtwork(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* 作品图片 */}
            <div className="p-4">
              <img
                src={selectedArtwork.imageData}
                alt={selectedArtwork.title}
                className="w-full rounded-xl max-h-64 object-contain bg-gray-50"
              />
            </div>

            {/* 作品信息 */}
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {formatDate(selectedArtwork.createdAt)}
                  </span>
                </div>
                <span className={`tag ${
                  selectedArtwork.isPrivate 
                    ? 'bg-pink-100 text-pink-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {selectedArtwork.isPrivate ? <Lock size={12} className="inline mr-1" /> : <Unlock size={12} className="inline mr-1" />}
                  {selectedArtwork.isPrivate ? '私密' : '公开'}
                </span>
              </div>

              {/* 色彩情绪分析 */}
              {selectedArtwork.emotionAnalysis && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 mb-4">
                  <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                    <Sparkles size={18} />
                    简易色彩情绪解读
                  </h4>
                  
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${emotionMap[selectedArtwork.emotionAnalysis.dominantEmotion].color}20` }}
                    >
                      <span className="text-2xl">{emotionMap[selectedArtwork.emotionAnalysis.dominantEmotion].icon}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        主导情绪：{emotionMap[selectedArtwork.emotionAnalysis.dominantEmotion].name}
                      </p>
                      <p className="text-sm text-gray-500">
                        置信度：{Math.round(selectedArtwork.emotionAnalysis.confidence * 100)}%
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-amber-700 mb-4">
                    {selectedArtwork.emotionAnalysis.description}
                  </p>

                  <div>
                    <p className="text-sm font-medium text-amber-800 mb-2">💡 温馨建议：</p>
                    <ul className="space-y-1">
                      {selectedArtwork.emotionAnalysis.suggestions.map((suggestion, i) => (
                        <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                          <Heart size={14} className="mt-0.5 flex-shrink-0" />
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-xs text-amber-600/70 mt-4 italic">
                    ※ 此分析为非诊断性质，仅供参考。如有需要，请寻求专业帮助。
                  </p>
                </div>
              )}

              {/* 调色板 */}
              {selectedArtwork.colors.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-800 mb-2">使用的颜色</h4>
                  <div className="flex gap-2">
                    {selectedArtwork.colors.slice(0, 8).map((color, i) => (
                      <div
                        key={i}
                        className="w-10 h-10 rounded-lg border-2 border-white shadow-sm"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    {selectedArtwork.colors.length > 8 && (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                        +{selectedArtwork.colors.length - 8}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    toggleArtworkPrivacy(selectedArtwork.id);
                    setSelectedArtwork(null);
                  }}
                  className="btn btn-secondary"
                >
                  {selectedArtwork.isPrivate ? (
                    <><Unlock size={18} className="mr-2" /> 设为公开</>
                  ) : (
                    <><Lock size={18} className="mr-2" /> 设为私密</>
                  )}
                </button>
                <button
                  onClick={() => {
                    deleteArtwork(selectedArtwork.id);
                    setSelectedArtwork(null);
                  }}
                  className="btn btn-secondary text-red-500 border-red-200 hover:bg-red-50"
                >
                  <Trash2 size={18} className="mr-2" /> 删除作品
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 密码验证模态框 */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div 
            className="modal-content fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock size={32} className="text-pink-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">私密作品集</h3>
              <p className="text-gray-500 text-sm">请输入密码访问你的私密作品</p>
            </div>
            
            <div className="form-group">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError('');
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleVerifyPassword()}
                placeholder="请输入密码（默认：123456）"
                className={`input ${passwordError ? 'border-red-500' : ''}`}
                autoFocus
              />
              {passwordError && (
                <p className="text-red-500 text-sm mt-2">{passwordError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordInput('');
                  setPasswordError('');
                }}
                className="flex-1 btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleVerifyPassword}
                disabled={!passwordInput}
                className={`flex-1 btn ${
                  passwordInput ? 'btn-primary' : 'btn-secondary opacity-50'
                }`}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
