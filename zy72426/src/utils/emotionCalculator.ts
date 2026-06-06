import type { SongRecord, EmotionTag } from '@/types';
import { EMOTION_TAGS } from '@/types';

const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

export const calculateEmotionTag = (liveName: string, copyrightName: string, audioNote?: string): { tag: EmotionTag; confidence: number } => {
  const combined = `${liveName}|${copyrightName}|${audioNote || ''}`;
  const hash = hashString(combined);

  let confidence = 0.6 + (hash % 40) / 100;

  if (audioNote && audioNote.trim().length > 0) {
    confidence = Math.min(0.95, confidence + 0.15);

    const noteLower = audioNote.toLowerCase();
    if (noteLower.includes('欢快') || noteLower.includes('开心') || noteLower.includes('快乐')) {
      return { tag: '欢快', confidence };
    }
    if (noteLower.includes('激昂') || noteLower.includes('震撼') || noteLower.includes('燃')) {
      return { tag: '激昂', confidence };
    }
    if (noteLower.includes('温柔') || noteLower.includes('抒情') || noteLower.includes('细腻')) {
      return { tag: '温柔', confidence };
    }
    if (noteLower.includes('感伤') || noteLower.includes('悲伤') || noteLower.includes('难过')) {
      return { tag: '感伤', confidence };
    }
    if (noteLower.includes('平静') || noteLower.includes('舒缓') || noteLower.includes('放松')) {
      return { tag: '平静', confidence };
    }
    if (noteLower.includes('神秘') || noteLower.includes('悬疑') || noteLower.includes('奇幻')) {
      return { tag: '神秘', confidence };
    }
    if (noteLower.includes('紧张') || noteLower.includes('刺激') || noteLower.includes('惊险')) {
      return { tag: '紧张', confidence };
    }
    if (noteLower.includes('浪漫') || noteLower.includes('甜蜜') || noteLower.includes('爱情')) {
      return { tag: '浪漫', confidence };
    }
    if (noteLower.includes('励志') || noteLower.includes('奋斗') || noteLower.includes('加油')) {
      return { tag: '励志', confidence };
    }
    if (noteLower.includes('怀旧') || noteLower.includes('回忆') || noteLower.includes('经典')) {
      return { tag: '怀旧', confidence };
    }
  }

  const tagIndex = hash % EMOTION_TAGS.length;
  return { tag: EMOTION_TAGS[tagIndex], confidence };
};

export const recalculateEmotionForRecord = (record: SongRecord): Pick<SongRecord, 'emotionTag' | 'emotionConfidence' | 'emotionUpdatedAt'> => {
  const { tag, confidence } = calculateEmotionTag(record.liveName, record.copyrightName, record.audioNote);
  return {
    emotionTag: tag,
    emotionConfidence: confidence,
    emotionUpdatedAt: Date.now(),
  };
};
