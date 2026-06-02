import { useCallback } from 'react';
import { Track, FileItem, Conflict } from '@/types';
import { generateId } from '@/utils/storage';
import { similarityScore, extractTrackNumber, extractTrackName, parseDurationString } from '@/utils/stringUtils';
import { checkDurationMatch } from '@/utils/audioUtils';
import { useAppStore } from '@/store/useAppStore';

export function useTrackMatcher() {
  const { currentRecordId, tracks, files, setTracks, setConflicts } = useAppStore();

  const matchTracks = useCallback(() => {
    if (!currentRecordId) return { tracks: [], conflicts: [] };

    const tracklistFiles = files.filter(f => f.type === 'tracklist' && f.status === 'success');
    const audioFiles = files.filter(f => f.type === 'audio' && f.status !== 'error');

    const parsedTracks: Array<{
      trackNo: number;
      name: string;
      composer?: string;
      duration?: number;
    }> = [];

    tracklistFiles.forEach(file => {
      if (file.metadata?.tracks) {
        parsedTracks.push(...file.metadata.tracks);
      }
    });

    if (parsedTracks.length === 0) {
      return { tracks: [], conflicts: [] };
    }

    const matchedTracks: Track[] = [];
    const conflicts: Conflict[] = [];

    parsedTracks.forEach(parsed => {
      let matchedFile: FileItem | null = null;
      let matchScore = 0;
      let matchType: string = '';

      audioFiles.forEach(audioFile => {
        const trackNo = extractTrackNumber(audioFile.name);
        const trackName = extractTrackName(audioFile.name);

        if (trackNo === parsed.trackNo) {
          const nameSimilarity = similarityScore(trackName, parsed.name);
          if (nameSimilarity > 0.7) {
            matchedFile = audioFile;
            matchScore = nameSimilarity;
            matchType = nameSimilarity > 0.9 ? '精确匹配' : '编号+名称匹配';
            return;
          }
        }

        if (!matchedFile) {
          const nameSimilarity = similarityScore(trackName, parsed.name);
          if (nameSimilarity > matchScore) {
            matchScore = nameSimilarity;
            if (nameSimilarity > 0.85) {
              matchedFile = audioFile;
              matchType = '名称模糊匹配';
            }
          }
        }

        if (!matchedFile && parsed.trackNo <= audioFiles.length) {
          const sortedAudios = [...audioFiles].sort((a, b) => a.name.localeCompare(b.name));
          const index = sortedAudios.findIndex(f => f.id === audioFile.id);
          if (index === parsed.trackNo - 1 && matchScore < 0.5) {
            matchedFile = audioFile;
            matchScore = 0.5;
            matchType = '顺序匹配';
          }
        }
      });

      const track: Track = {
        id: generateId(),
        recordId: currentRecordId,
        fileId: matchedFile?.id,
        name: parsed.name,
        trackNo: parsed.trackNo,
        composer: parsed.composer,
        duration: matchedFile?.duration,
        expectedDuration: parsed.duration,
        status: matchedFile ? 'matched' : 'unmatched',
        rawData: {
          matchScore,
          matchType,
        },
      };

      matchedTracks.push(track);

      if (matchedFile && parsed.duration && matchedFile.duration) {
        const durationCheck = checkDurationMatch(matchedFile.duration, parsed.duration, 10);
        if (!durationCheck.match) {
          const conflict: Conflict = {
            id: generateId(),
            recordId: currentRecordId,
            trackId: track.id,
            type: 'duration_mismatch',
            sideA: {
              source: '曲目表',
              value: `${Math.floor(parsed.duration / 60)}:${Math.round(parsed.duration % 60).toString().padStart(2, '0')} (${parsed.duration}秒)`,
              evidence: tracklistFiles[0]?.name || '曲目表',
            },
            sideB: {
              source: '实际音频',
              value: `${Math.floor(matchedFile.duration / 60)}:${Math.round(matchedFile.duration % 60).toString().padStart(2, '0')} (${matchedFile.duration}秒)`,
              evidence: matchedFile.name,
            },
            suggestion: `时长偏差${durationCheck.diffPercent}%，差${durationCheck.diffSeconds}秒。如果是开头结尾没剪齐问题不大，差太多就需要核对一下。`,
            resolution: 'unresolved',
          };
          conflicts.push(conflict);
        }
      }
    });

    const chatFiles = files.filter(f => f.type === 'text' && f.metadata?.annotations);
    const chatAnnotations: Array<{ author: string; content: string }> = [];
    chatFiles.forEach(f => {
      if (f.metadata?.annotations) {
        chatAnnotations.push(...f.metadata.annotations);
      }
    });

    chatAnnotations.forEach(chat => {
      let matchedTrackId: string | undefined;
      let bestScore = 0;

      matchedTracks.forEach(track => {
        const score = similarityScore(chat.content, track.name);
        if (score > bestScore && score > 0.3) {
          bestScore = score;
          matchedTrackId = track.id;
        }

        if (chat.content.includes(track.name)) {
          matchedTrackId = track.id;
          bestScore = 1;
        }
      });

      if (matchedTrackId) {
        const track = matchedTracks.find(t => t.id === matchedTrackId);
        if (track && track.expectedDuration) {
          const durationMatch = chat.content.match(/(\d+分\d+秒|\d+:\d{2})/);
          if (durationMatch) {
            const durationStr = durationMatch[0].replace('分', ':').replace('秒', '');
            const chatDuration = parseDurationString(durationStr);
            if (chatDuration && Math.abs(chatDuration - track.expectedDuration) > 5) {
              const existingConflict = conflicts.find(
                c => c.trackId === matchedTrackId && c.type === 'duration_mismatch'
              );
              
              if (existingConflict) {
                existingConflict.sideB = {
                  source: `群聊（${chat.author}）`,
                  value: `${Math.floor(chatDuration / 60)}:${Math.round(chatDuration % 60).toString().padStart(2, '0')} (${chatDuration}秒)`,
                  evidence: chat.content,
                };
                existingConflict.suggestion = `有三方说法：曲目表${existingConflict.sideA.value}，群聊说${existingConflict.sideB.value}，实际音频${track.duration ? `${Math.floor(track.duration / 60)}:${Math.round(track.duration % 60).toString().padStart(2, '0')}` : '未知'}。建议按老许说的来，或者群里再问一下。`;
              } else {
                const conflict: Conflict = {
                  id: generateId(),
                  recordId: currentRecordId,
                  trackId: matchedTrackId,
                  type: 'duration_mismatch',
                  sideA: {
                    source: '曲目表',
                    value: `${Math.floor(track.expectedDuration / 60)}:${Math.round(track.expectedDuration % 60).toString().padStart(2, '0')} (${track.expectedDuration}秒)`,
                    evidence: tracklistFiles[0]?.name || '曲目表',
                  },
                  sideB: {
                    source: `群聊（${chat.author}）`,
                    value: `${Math.floor(chatDuration / 60)}:${Math.round(chatDuration % 60).toString().padStart(2, '0')} (${chatDuration}秒)`,
                    evidence: chat.content,
                  },
                  suggestion: `群聊说的时长和曲目表不一样。如果是老许说的，按老许的来。`,
                  resolution: 'unresolved',
                };
                conflicts.push(conflict);
              }
            }
          }
        }
      }
    });

    return { tracks: matchedTracks, conflicts };
  }, [currentRecordId, files]);

  const autoMatch = useCallback(() => {
    const { tracks: matchedTracks, conflicts: detectedConflicts } = matchTracks();
    setTracks(matchedTracks);
    setConflicts(detectedConflicts);
    return { tracks: matchedTracks, conflicts: detectedConflicts };
  }, [matchTracks, setTracks, setConflicts]);

  const manualMatch = useCallback((trackId: string, fileId: string | null) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    const file = files.find(f => f.id === fileId);

    setTracks(
      tracks.map(t =>
        t.id === trackId
          ? {
              ...t,
              fileId: fileId || undefined,
              duration: file?.duration,
              status: fileId ? 'manual' : 'unmatched',
            }
          : t
      )
    );
  }, [tracks, files, setTracks]);

  return {
    matchTracks,
    autoMatch,
    manualMatch,
  };
}
