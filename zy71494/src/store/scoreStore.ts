import { create } from 'zustand';
import { getDB } from '@/utils/db';
import type { TransitionScore, Track, Beat, Segment } from '@/types';
import { generateId } from '@/types';

interface ScoreState {
  scores: TransitionScore[];
  loading: boolean;
  error: string | null;
  loadScores: (trackId: string) => Promise<void>;
  calculateTransitionScore: (fromTrack: Track, toTrack: Track, fromBeats: Beat[], toBeats: Beat[], fromSegments: Segment[], toSegments: Segment[]) => Promise<TransitionScore>;
  clearScores: () => void;
}

export const useScoreStore = create<ScoreState>((set, get) => ({
  scores: [],
  loading: false,
  error: null,

  loadScores: async (trackId: string) => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const scores = await db.getAllFromIndex('transitionScores', 'trackId', trackId);
      scores.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      set({ scores, loading: false });
    } catch (error) {
      set({ error: '加载评分失败', loading: false });
    }
  },

  calculateTransitionScore: async (
    fromTrack: Track, 
    toTrack: Track, 
    fromBeats: Beat[], 
    toBeats: Beat[],
    fromSegments: Segment[],
    toSegments: Segment[]
  ): Promise<TransitionScore> => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();

      const bpmDiff = Math.abs(fromTrack.currentBPM - toTrack.currentBPM);
      const maxBpmDiff = 30;
      const bpmMatchScore = Math.max(0, 100 - (bpmDiff / maxBpmDiff) * 100);

      let beatAlignScore = 70;
      if (fromBeats.length > 0 && toBeats.length > 0) {
        const fromOutBeat = fromBeats.find(b => b.time >= (fromTrack.bestOutPoint ?? fromTrack.duration * 0.7));
        const toInBeat = toBeats.find(b => b.time <= (toTrack.bestInPoint ?? toTrack.duration * 0.3));
        
        if (fromOutBeat && toInBeat) {
          const beatInterval1 = fromBeats.length > 1 ? fromBeats[1].time - fromBeats[0].time : 0;
          const beatInterval2 = toBeats.length > 1 ? toBeats[1].time - toBeats[0].time : 0;
          
          if (beatInterval1 > 0 && beatInterval2 > 0) {
            const intervalDiff = Math.abs(beatInterval1 - beatInterval2);
            beatAlignScore = Math.max(0, 100 - (intervalDiff / 0.5) * 100);
          }
        }
      }

      let segmentFitScore = 60;
      const fromOutro = fromSegments.find(s => s.type === 'outro');
      const toIntro = toSegments.find(s => s.type === 'intro');
      
      if (fromOutro && toIntro) {
        segmentFitScore = 90;
      } else if (fromOutro || toIntro) {
        segmentFitScore = 75;
      }

      const fromDrop = fromSegments.find(s => s.type === 'drop');
      const toDrop = toSegments.find(s => s.type === 'drop');
      if (fromDrop && toDrop) {
        segmentFitScore = Math.min(100, segmentFitScore + 10);
      }

      const overallScore = Math.round(
        bpmMatchScore * 0.4 + 
        beatAlignScore * 0.3 + 
        segmentFitScore * 0.3
      );

      let recommendation = '';
      if (overallScore >= 90) {
        recommendation = '完美过渡！BPM高度匹配，段落结构非常适合混接。';
      } else if (overallScore >= 75) {
        recommendation = '良好过渡。建议使用简单的EQ调整来平滑过渡。';
      } else if (overallScore >= 60) {
        recommendation = '可接受过渡。需要注意BPM调整和段落对齐。';
      } else {
        recommendation = '过渡难度较大。建议使用效果器辅助或重新选择接歌点。';
      }

      const score: TransitionScore = {
        id: generateId(),
        trackId: fromTrack.id,
        fromTrackId: fromTrack.id,
        toTrackId: toTrack.id,
        overallScore,
        bpmMatchScore: Math.round(bpmMatchScore),
        beatAlignScore: Math.round(beatAlignScore),
        segmentFitScore: Math.round(segmentFitScore),
        recommendation,
        createdAt: new Date(),
      };

      await db.add('transitionScores', score);

      const scores = [...get().scores, score].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      set({ scores, loading: false });

      return score;
    } catch (error) {
      set({ error: '计算过渡评分失败', loading: false });
      throw error;
    }
  },

  clearScores: () => {
    set({ scores: [] });
  },
}));
