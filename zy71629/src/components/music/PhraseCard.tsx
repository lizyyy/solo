import React from 'react';
import { Play, Check, Music } from 'lucide-react';
import type { Phrase, Chord } from '@/types/music';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { getNoteName, getDurationName } from '@/engine/musicTheory';
import { playPhrase } from '@/utils/audio';
import type { RhythmPattern } from '@/types/music';

interface PhraseCardProps {
  phrase: Phrase;
  compatibleChords?: Chord[];
  isSelected?: boolean;
  isUsed?: boolean;
  isRecommended?: boolean;
  rhythmPattern?: RhythmPattern;
  onClick?: () => void;
  onPreview?: () => void;
}

export const PhraseCard: React.FC<PhraseCardProps> = ({
  phrase,
  compatibleChords = [],
  isSelected = false,
  isUsed = false,
  isRecommended = false,
  rhythmPattern,
  onClick,
  onPreview,
}) => {
  const difficultyColors = {
    easy: 'bg-jazz-green/20 text-jazz-greenLight',
    medium: 'bg-jazz-orange/20 text-jazz-orangeLight',
    hard: 'bg-jazz-burgundy/20 text-jazz-burgundyLight',
  };

  const difficultyLabels = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  };

  const handlePreview = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (rhythmPattern) {
      await playPhrase(phrase, rhythmPattern, 0, 0.3);
    }
    onPreview?.();
  };

  return (
    <Card
      glass
      hover={!isUsed}
      onClick={isUsed ? undefined : onClick}
      className={cn(
        'phrase-card relative overflow-hidden',
        isSelected && 'ring-2 ring-jazz-gold shadow-lg shadow-jazz-gold/20',
        isUsed && 'opacity-50 cursor-not-allowed',
        isRecommended && 'ring-2 ring-jazz-green/50'
      )}
    >
      {isRecommended && (
        <div className="absolute top-0 right-0 bg-jazz-green text-jazz-bg text-xs px-2 py-0.5 rounded-bl-lg font-medium">
          推荐
        </div>
      )}
      {isUsed && (
        <div className="absolute inset-0 flex items-center justify-center bg-jazz-bg/50 backdrop-blur-sm z-10">
          <span className="text-jazz-textMuted text-sm">已使用</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-jazz-gold/20 flex items-center justify-center">
              <Music className="w-4 h-4 text-jazz-gold" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-jazz-text text-sm">
                {phrase.name}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-1.5 py-0.5 rounded ${difficultyColors[phrase.difficulty]}`}>
                  {difficultyLabels[phrase.difficulty]}
                </span>
                <span className="text-xs text-jazz-textMuted">
                  {phrase.notes.length} 音符
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handlePreview}
            className="w-8 h-8 rounded-full bg-jazz-bgLight hover:bg-jazz-border flex items-center justify-center transition-colors group"
            title="试听"
          >
            <Play className="w-3.5 h-3.5 text-jazz-gold group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {compatibleChords.slice(0, 3).map((chord) => (
            <Badge key={chord.id} variant="gold" className="text-xs">
              {chord.symbol}
            </Badge>
          ))}
          {compatibleChords.length > 3 && (
            <Badge variant="default" className="text-xs">
              +{compatibleChords.length - 3}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-jazz-textMuted mb-3">
          <span>总时长: {phrase.totalDuration} 拍</span>
          <span>•</span>
          <span>{getDurationName(phrase.notes[0]?.duration || 0.25)}</span>
        </div>

        <div className="flex items-center gap-1">
          {phrase.notes.slice(0, 5).map((note, idx) => (
            <div
              key={idx}
              className="w-6 h-6 rounded bg-jazz-bg flex items-center justify-center text-xs font-mono text-jazz-gold"
              title={getNoteName(note)}
            >
              {note.pitch}
              {note.accidental !== 'natural' && note.accidental}
            </div>
          ))}
          {phrase.notes.length > 5 && (
            <span className="text-xs text-jazz-textMuted">+{phrase.notes.length - 5}</span>
          )}
        </div>

        {phrase.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-jazz-border/50">
            {phrase.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded bg-jazz-bg text-jazz-textMuted"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {isSelected && (
          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-jazz-gold flex items-center justify-center">
            <Check className="w-4 h-4 text-jazz-bg" />
          </div>
        )}
      </div>
    </Card>
  );
};
