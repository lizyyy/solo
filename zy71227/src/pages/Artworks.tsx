import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { ArtworkCard } from '../components/ArtworkCard';

export default function Artworks() {
  const navigate = useNavigate();
  const { artworks, updateArtwork, resolveConflict, initGame } = useGameStore();

  useEffect(() => {
    if (artworks.length === 0) {
      initGame();
    }
  }, [artworks.length, initGame]);

  const flaggedCount = artworks.filter(a => a.conflictStatus === 'flagged').length;

  return (
    <div className="container mx-auto px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif text-amber-100 mb-2">作品管理</h1>
          <p className="text-slate-400">检查作品信息，处理数据冲突</p>
        </div>
        
        <div className="flex items-center gap-4">
          {flaggedCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertTriangle className="text-red-400" size={18} />
              <span className="text-red-300 text-sm">{flaggedCount} 个作品存在冲突</span>
            </div>
          )}
          
          <button
            onClick={() => navigate('/curation')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-rose-500 rounded-lg font-semibold hover:shadow-lg hover:shadow-amber-500/20 transition-all"
          >
            进入策展
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {artworks.map(artwork => (
          <ArtworkCard
            key={artwork.id}
            artwork={artwork}
            onUpdate={updateArtwork}
            onResolveConflict={resolveConflict}
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
}
