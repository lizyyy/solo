import type { Song, DurationAnalysis, DurationPerSong, DurationBreakdown } from '../../shared/types';

export const DurationService = {
  calculateTotalDuration: (songs: Song[]): number => {
    return songs.reduce((total, song) => total + song.duration, 0);
  },

  calculateCumulativeDurations: (songs: Song[]): DurationPerSong[] => {
    let cumulative = 0;
    return songs
      .sort((a, b) => a.order - b.order)
      .map((song) => {
        cumulative += song.duration;
        return {
          songId: song.id,
          songName: song.name,
          duration: song.duration,
          cumulative,
        };
      });
  },

  generateBreakdown: (songs: Song[], maxDuration: number): DurationBreakdown[] => {
    const total = DurationService.calculateTotalDuration(songs);
    const avgDuration = songs.length > 0 ? Math.round(total / songs.length) : 0;
    const longestSong = songs.length > 0 ? Math.max(...songs.map(s => s.duration)) : 0;
    const shortestSong = songs.length > 0 ? Math.min(...songs.map(s => s.duration)) : 0;
    const overDuration = Math.max(0, total - maxDuration);
    const remainingDuration = Math.max(0, maxDuration - total);

    const breakdown: DurationBreakdown[] = [
      {
        source: '歌曲总数',
        value: songs.length,
        explanation: `歌单中共 ${songs.length} 首歌曲`,
      },
      {
        source: '累计总时长',
        value: total,
        explanation: `所有歌曲时长累加：${songs.map(s => `${s.name}(${s.duration}s)`).join(' + ')}`,
      },
      {
        source: '平均单歌时长',
        value: avgDuration,
        explanation: `总时长 ${total}s ÷ ${songs.length} 首 = ${avgDuration}s/首`,
      },
      {
        source: '最长歌曲',
        value: longestSong,
        explanation: songs.length > 0
          ? `${songs.find(s => s.duration === longestSong)?.name}：${longestSong}s`
          : '无歌曲',
      },
      {
        source: '最短歌曲',
        value: shortestSong,
        explanation: songs.length > 0
          ? `${songs.find(s => s.duration === shortestSong)?.name}：${shortestSong}s`
          : '无歌曲',
      },
      {
        source: '最大允许时长',
        value: maxDuration,
        explanation: `演出配置的最大时长限制为 ${maxDuration}s (${formatDuration(maxDuration)})`,
      },
      {
        source: '剩余可用时长',
        value: remainingDuration,
        explanation: `最大时长 ${maxDuration}s - 已用 ${total}s = ${remainingDuration}s`,
      },
      {
        source: '超出时长',
        value: overDuration,
        explanation: overDuration > 0
          ? `已超出 ${overDuration}s (${formatDuration(overDuration)})，建议删减或缩短歌曲`
          : '未超出时长限制',
      },
    ];

    return breakdown;
  },

  analyze: (songs: Song[], maxDuration: number): DurationAnalysis => {
    return {
      perSong: DurationService.calculateCumulativeDurations(songs),
      breakdown: DurationService.generateBreakdown(songs, maxDuration),
    };
  },

  checkDurationLimit: (songs: Song[], maxDuration: number): {
    isOver: boolean;
    overAmount: number;
    message: string;
  } => {
    const total = DurationService.calculateTotalDuration(songs);
    const over = Math.max(0, total - maxDuration);

    if (over === 0) {
      return {
        isOver: false,
        overAmount: 0,
        message: `总时长 ${formatDuration(total)} 在 ${formatDuration(maxDuration)} 限制内`,
      };
    }

    return {
      isOver: true,
      overAmount: over,
      message: `总时长 ${formatDuration(total)} 超出限制 ${formatDuration(over)}`,
    };
  },
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default DurationService;
