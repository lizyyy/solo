import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Music,
  Guitar,
  Layers,
  Clock,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Volume2,
  ChevronRight,
  Info,
  Package,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useMaterialStore, initializeMaterialData } from '@/store/useMaterialStore';
import { useUserStore } from '@/store/useUserStore';
import { playChord, resumeAudioContext, playPhrase } from '@/utils/audio';
import { cn } from '@/lib/utils';
import type { Chord, Phrase, ChordProgression, RhythmPattern, Difficulty } from '@/types/music';

const Materials: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useUserStore();
  const { chords, phrases, chordProgressions, rhythmPatterns, loadMaterials } = useMaterialStore();

  const [activeTab, setActiveTab] = useState<'chords' | 'phrases' | 'progressions' | 'rhythms'>('chords');
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>('all');

  useEffect(() => {
    if (!role) {
      navigate('/');
      return;
    }
    initializeMaterialData();
    loadMaterials();
  }, [role, navigate, loadMaterials]);

  const filteredChords = useMemo(() => {
    if (!searchTerm) return chords;
    const term = searchTerm.toLowerCase();
    return chords.filter(
      (c) => c.symbol.toLowerCase().includes(term) || c.root.toLowerCase().includes(term)
    );
  }, [chords, searchTerm]);

  const filteredPhrases = useMemo(() => {
    let filtered = phrases;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(term) || p.tags.some((t) => t.toLowerCase().includes(term))
      );
    }
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter((p) => p.difficulty === difficultyFilter);
    }
    return filtered;
  }, [phrases, searchTerm, difficultyFilter]);

  const filteredProgressions = useMemo(() => {
    if (!searchTerm) return chordProgressions;
    const term = searchTerm.toLowerCase();
    return chordProgressions.filter((p) => p.name.toLowerCase().includes(term));
  }, [chordProgressions, searchTerm]);

  const filteredRhythms = useMemo(() => {
    if (!searchTerm) return rhythmPatterns;
    const term = searchTerm.toLowerCase();
    return rhythmPatterns.filter(
      (r) =>
        `${r.timeSignature[0]}/${r.timeSignature[1]}`.includes(term) ||
        r.bpm.toString().includes(term)
    );
  }, [rhythmPatterns, searchTerm]);

  const handlePlayChord = async (chord: Chord) => {
    await resumeAudioContext();
    playChord(chord.allowedNotes, 4, 0, 1.5, 0.2);
  };

  const handlePlayPhrase = async (phrase: Phrase, rhythm: RhythmPattern) => {
    await resumeAudioContext();
    playPhrase(phrase, rhythm, 0, 0.3);
  };

  const getDifficultyColor = (difficulty: Difficulty) => {
    const colors = {
      easy: 'bg-jazz-green/20 text-jazz-greenLight',
      medium: 'bg-jazz-orange/20 text-jazz-orangeLight',
      hard: 'bg-jazz-burgundy/20 text-jazz-burgundyLight',
    };
    return colors[difficulty];
  };

  const getDifficultyLabel = (difficulty: Difficulty) => {
    const labels = { easy: '简单', medium: '中等', hard: '困难' };
    return labels[difficulty];
  };

  const getQualityLabel = (quality: string) => {
    const labels: Record<string, string> = {
      maj: '大和弦',
      min: '小和弦',
      dom: '属和弦',
      dim: '减和弦',
      aug: '增和弦',
    };
    return labels[quality] || quality;
  };

  if (!role) return null;

  return (
    <div className="min-h-screen bg-jazz-bg">
      <header className="glass border-b border-jazz-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate('/console')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                返回控制台
              </Button>
              <div>
                <h1 className="font-display text-xl font-bold text-jazz-gold">材料库管理</h1>
                <p className="text-xs text-jazz-textMuted">管理和弦、乐句、和弦进行和节奏模式</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="brass" className="gap-2" disabled>
                <Plus className="w-4 h-4" />
                添加材料
              </Button>
            </div>
          </div>

          <div className="flex gap-1 mt-4 bg-jazz-bgLight p-1 rounded-xl w-fit">
            {([
              { key: 'chords', label: '和弦库', icon: Guitar },
              { key: 'phrases', label: '乐句库', icon: Music },
              { key: 'progressions', label: '和弦进行', icon: Layers },
              { key: 'rhythms', label: '节奏模式', icon: Clock },
            ] as const).map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === item.key
                    ? 'bg-jazz-gold text-jazz-bg'
                    : 'text-jazz-textMuted hover:text-jazz-text'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                <span className="text-xs opacity-70">
                  {item.key === 'chords' && chords.length}
                  {item.key === 'phrases' && phrases.length}
                  {item.key === 'progressions' && chordProgressions.length}
                  {item.key === 'rhythms' && rhythmPatterns.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jazz-textMuted" />
            <input
              type="text"
              placeholder={`搜索${activeTab === 'chords' ? '和弦' : activeTab === 'phrases' ? '乐句' : activeTab === 'progressions' ? '和弦进行' : '节奏模式'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-jazz-bgLight border border-jazz-border rounded-lg pl-9 pr-4 py-2 text-sm text-jazz-text placeholder-jazz-textMuted focus:outline-none focus:ring-2 focus:ring-jazz-gold"
            />
          </div>

          {activeTab === 'phrases' && (
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value as Difficulty | 'all')}
              className="bg-jazz-bgLight border border-jazz-border rounded-lg px-3 py-2 text-sm text-jazz-text focus:outline-none focus:ring-2 focus:ring-jazz-gold"
            >
              <option value="all">全部难度</option>
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </select>
          )}
        </div>

        {activeTab === 'chords' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredChords.map((chord) => (
              <Card key={chord.id} glass hover>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="font-display text-3xl font-bold text-jazz-gold mb-1">
                        {chord.symbol}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="gold">{getQualityLabel(chord.quality)}</Badge>
                        {chord.extensions.length > 0 && (
                          <Badge variant="info">{chord.extensions.join(', ')}</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlayChord(chord)}
                      className="flex-shrink-0"
                      title="试听和弦"
                    >
                      <Volume2 className="w-5 h-5 text-jazz-gold" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-jazz-textMuted mb-1">和弦内音</div>
                      <div className="flex flex-wrap gap-1">
                        {chord.allowedNotes.map((note) => (
                          <span
                            key={note}
                            className="px-2 py-1 rounded bg-jazz-green/20 text-jazz-greenLight text-xs font-mono"
                          >
                            {note}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-jazz-textMuted mb-1">经过音</div>
                      <div className="flex flex-wrap gap-1">
                        {chord.passingNotes.map((note) => (
                          <span
                            key={note}
                            className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-mono"
                          >
                            {note}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-jazz-border/50">
                    <Button variant="ghost" size="sm" className="flex-1 gap-1" disabled>
                      <Edit className="w-4 h-4" />
                      编辑
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 gap-1 text-jazz-burgundy" disabled>
                      <Trash2 className="w-4 h-4" />
                      删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'phrases' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPhrases.map((phrase) => {
              const defaultRhythm = rhythmPatterns[0];
              const compatibleChordObjects = phrase.compatibleChords
                .map((id) => chords.find((c) => c.id === id))
                .filter((c): c is Chord => c !== undefined);

              return (
                <Card key={phrase.id} glass hover>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-display text-lg font-bold text-jazz-text mb-1">
                          {phrase.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn('text-xs px-2 py-0.5 rounded', getDifficultyColor(phrase.difficulty))}>
                            {getDifficultyLabel(phrase.difficulty)}
                          </span>
                          <span className="text-xs text-jazz-textMuted">
                            {phrase.notes.length} 音符 · {phrase.totalDuration} 拍
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => defaultRhythm && handlePlayPhrase(phrase, defaultRhythm)}
                        className="flex-shrink-0"
                        title="试听乐句"
                      >
                        <Volume2 className="w-5 h-5 text-jazz-gold" />
                      </Button>
                    </div>

                    <div className="mb-3">
                      <div className="text-xs text-jazz-textMuted mb-1">兼容和弦</div>
                      <div className="flex flex-wrap gap-1">
                        {compatibleChordObjects.slice(0, 4).map((chord) => (
                          <Badge key={chord.id} variant="gold" className="text-xs">
                            {chord.symbol}
                          </Badge>
                        ))}
                        {compatibleChordObjects.length > 4 && (
                          <Badge variant="default" className="text-xs">
                            +{compatibleChordObjects.length - 4}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="text-xs text-jazz-textMuted mb-1">音符预览</div>
                      <div className="flex gap-1 overflow-x-auto pb-1">
                        {phrase.notes.slice(0, 8).map((note, idx) => (
                          <div
                            key={idx}
                            className="w-8 h-8 rounded bg-jazz-bg flex items-center justify-center text-xs font-mono text-jazz-gold flex-shrink-0"
                            title={`${note.pitch}${note.accidental !== 'natural' ? note.accidental : ''}`}
                          >
                            {note.pitch}
                            {note.accidental !== 'natural' && note.accidental}
                          </div>
                        ))}
                        {phrase.notes.length > 8 && (
                          <span className="text-xs text-jazz-textMuted flex items-center">
                            +{phrase.notes.length - 8}
                          </span>
                        )}
                      </div>
                    </div>

                    {phrase.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {phrase.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 rounded bg-jazz-bg text-jazz-textMuted"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 mt-4 pt-4 border-t border-jazz-border/50">
                      <Button variant="ghost" size="sm" className="flex-1 gap-1" disabled>
                        <Edit className="w-4 h-4" />
                        编辑
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-1 gap-1 text-jazz-burgundy" disabled>
                        <Trash2 className="w-4 h-4" />
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {activeTab === 'progressions' && (
          <div className="space-y-4">
            {filteredProgressions.map((progression) => (
              <Card key={progression.id} glass hover>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-display text-xl font-bold text-jazz-text">
                          {progression.name}
                        </h3>
                        <Badge variant="info">{progression.totalMeasures} 小节</Badge>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {progression.chords.map((item, idx) => {
                          const chord = chords.find((c) => c.id === item.chordId);
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-jazz-bgLight"
                            >
                              <span className="text-xs text-jazz-textMuted">
                                第{item.measure}小节
                              </span>
                              <span className="font-display text-lg font-bold text-jazz-gold">
                                {chord?.symbol || '?'}
                              </span>
                              {idx < progression.chords.length - 1 && (
                                <ChevronRight className="w-4 h-4 text-jazz-textMuted ml-1" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button variant="ghost" size="sm" className="gap-1" disabled>
                        <Edit className="w-4 h-4" />
                        编辑
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1 text-jazz-burgundy" disabled>
                        <Trash2 className="w-4 h-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'rhythms' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRhythms.map((rhythm) => (
              <Card key={rhythm.id} glass hover>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-jazz-gold/20 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-jazz-gold" />
                    </div>
                    <div>
                      <div className="font-display text-2xl font-bold text-jazz-text">
                        {rhythm.timeSignature[0]}/{rhythm.timeSignature[1]}
                      </div>
                      <div className="text-sm text-jazz-textMuted">拍号</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-jazz-bgLight">
                      <div className="text-xs text-jazz-textMuted mb-1">速度</div>
                      <div className="font-display text-xl font-bold text-jazz-gold">
                        {rhythm.bpm} BPM
                      </div>
                    </div>
                    {rhythm.swingFactor !== undefined && rhythm.swingFactor > 0 && (
                      <div className="p-3 rounded-lg bg-purple-500/10">
                        <div className="text-xs text-jazz-textMuted mb-1">摇摆系数</div>
                        <div className="font-display text-xl font-bold text-purple-400">
                          {Math.round(rhythm.swingFactor * 100)}%
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="flex-1 gap-1" disabled>
                      <Edit className="w-4 h-4" />
                      编辑
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 gap-1 text-jazz-burgundy" disabled>
                      <Trash2 className="w-4 h-4" />
                      删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {(activeTab === 'chords' && filteredChords.length === 0) ||
        (activeTab === 'phrases' && filteredPhrases.length === 0) ||
        (activeTab === 'progressions' && filteredProgressions.length === 0) ||
        (activeTab === 'rhythms' && filteredRhythms.length === 0) ? (
          <Card glass className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-jazz-textMuted opacity-30" />
            <h3 className="font-display text-xl text-jazz-text mb-2">暂无材料</h3>
            <p className="text-jazz-textMuted">当前筛选条件下没有找到材料</p>
          </Card>
        ) : null}

        <Card glass className="mt-8">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-jazz-gold" />
              <h3 className="font-display text-lg text-jazz-text">材料库说明</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-jazz-textMuted">
              <div>
                <h4 className="font-medium text-jazz-text mb-2">和弦库</h4>
                <p>
                  包含爵士乐常用的和弦类型，每个和弦标注了和弦内音和经过音。和弦内音是构成该和弦的基本音符，经过音可以在旋律中使用但不应作为强拍重音。
                </p>
              </div>
              <div>
                <h4 className="font-medium text-jazz-text mb-2">乐句库</h4>
                <p>
                  包含不同难度的即兴乐句片段，每个乐句标注了兼容的和弦和难度级别。学生可以根据当前小节的和弦选择合适的乐句。
                </p>
              </div>
              <div>
                <h4 className="font-medium text-jazz-text mb-2">和弦进行</h4>
                <p>
                  定义游戏中使用的和弦序列，如II-V-I进行、12小节布鲁斯等。每个和弦进行包含多个小节，每小节对应一个和弦。
                </p>
              </div>
              <div>
                <h4 className="font-medium text-jazz-text mb-2">节奏模式</h4>
                <p>
                  定义游戏的节拍和速度，包括拍号、BPM和摇摆系数。摇摆系数大于0.3时会产生爵士摇摆的感觉。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Materials;
