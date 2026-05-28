import { motion } from 'framer-motion';
import { Brush, AlertTriangle, Clock, FileText, Play, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { artworks, artworkDataGaps } from '../data/artworks';
import { Artwork } from '../types';

export function IntroPage() {
  const navigate = useNavigate();
  const startGame = useGameStore(state => state.startGame);

  const handleSelectArtwork = (artwork: Artwork) => {
    const gaps = artworkDataGaps[artwork.id] || [];
    startGame(artwork, gaps);
    navigate('/game');
  };

  return (
    <div className="min-h-screen bg-museum-bg bg-noise">
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <Brush size={48} className="text-museum-gold" />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-museum-paper mb-4 text-shadow">
            艺术品修复抉择局
          </h1>
          <p className="text-lg text-museum-paper/70 max-w-2xl mx-auto">
            每一个选择都将影响作品的命运。在信息不完整的现实世界中，
            识别数据缺口、评估风险、做出专业抉择，完成属于你的修复报告。
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <FeatureCard
            icon={<AlertTriangle />}
            title="识别缺口"
            description="每件作品的数据不总是完整的，学会发现缺失信息比假装全对更重要"
            delay={0.1}
          />
          <FeatureCard
            icon={<Clock />}
            title="风险抉择"
            description="清洁过度、材料不兼容，每个选择都有代价"
            delay={0.2}
          />
          <FeatureCard
            icon={<FileText />}
            title="历史追溯"
            description="每一步操作都被记录，变化清晰可见"
            delay={0.3}
          />
          <FeatureCard
            icon={<Sparkles />}
            title="评分报告"
            description="多维度评分，导出专业修复报告"
            delay={0.4}
          />
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-serif font-bold text-museum-paper mb-6 text-center">
            选择修复任务
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {artworks.map((artwork, index) => (
              <ArtworkCard
                key={artwork.id}
                artwork={artwork}
                index={index}
                onSelect={() => handleSelectArtwork(artwork)}
              />
            ))}
          </div>
        </div>

        <div className="text-center text-museum-paper/50 text-sm">
          <p>提示：选择不同难度的作品体验不同的修复挑战</p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode; title: string; description: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card text-center"
    >
      <div className="inline-flex items-center justify-center w-12 h-12 bg-museum-bronze/20 rounded-xl mb-3">
        <span className="text-museum-bronze">{icon}</span>
      </div>
      <h3 className="text-lg font-serif font-bold text-museum-paper mb-2">{title}</h3>
      <p className="text-sm text-museum-paper/60">{description}</p>
    </motion.div>
  );
}

function ArtworkCard({ artwork, index, onSelect }: { artwork: Artwork; index: number; onSelect: () => void }) {
  const { base, accent, detail } = artwork.imageColors;
  const gaps = artworkDataGaps[artwork.id] || [];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.5 + index * 0.1 }}
    whileHover={{ y: -4 }}
    className="card-paper cursor-pointer group"
    onClick={onSelect}
    onKeyDown={handleKeyDown}
    role="button"
    tabIndex={0}
    aria-label={`选择${artwork.name}进行修复`}
  >
    <div className="flex gap-4">
      <div className="w-24 h-32 rounded-lg overflow-hidden border-2 border-museum-bronze/30 flex-shrink-0">
        <svg viewBox="0 0 100 130" className="w-full h-full">
          <rect width="100" height="130" fill={base} />
          <rect x="10" y="10" width="80" height="110" fill={accent} opacity="0.5" />
          <circle cx="50" cy="65" r="25" fill={detail} opacity="0.7" />
          <path d="M 20 100 Q 50 80 80 100" stroke={detail} strokeWidth="2" fill="none" />
        </svg>
      </div>

      <div className="flex-1">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-serif font-bold text-museum-ink">{artwork.name}</h3>
          <span className={`px-2 py-0.5 text-xs rounded-full ${artwork.difficulty === 'easy' ? 'bg-museum-patina/20 text-museum-patina' : 'bg-museum-cinnabar/20 text-museum-cinnabar'}`}>
            {artwork.difficulty === 'easy' ? '入门' : '困难'}
          </span>
        </div>
        <p className="text-sm text-museum-ink/70 mb-3 line-clamp-2">
          {artwork.description}
        </p>
        <div className="flex items-center gap-4 text-xs text-museum-ink/60 mb-3">
          <span>污渍 {artwork.initialStain}%</span>
          <span>颜料 {artwork.initialPaintLayer}%</span>
          <span>结构 {artwork.initialStructure}%</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs">
            <AlertTriangle size={12} className="text-museum-ochre" />
            <span className="text-museum-ochre">{gaps.length} 项信息待确认</span>
          </div>
          <div className="flex items-center gap-1 text-museum-bronze group-hover:text-museum-bronzeLight transition-colors">
            <Play size={14} />
            <span className="text-sm font-medium">开始修复</span>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);
}
