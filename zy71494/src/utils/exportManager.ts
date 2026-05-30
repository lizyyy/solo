import { saveAs } from 'file-saver';
import { getDB } from './db';
import type { ExportData, Track, Beat, Segment, BPMHistory, TransitionScore, OperationLog } from '@/types';

const getOperator = (): string => {
  return localStorage.getItem('dj-operator') || 'DJ';
};

export const exportToJSON = async (trackId: string): Promise<void> => {
  const db = await getDB();
  
  const track = await db.get('tracks', trackId);
  if (!track) throw new Error('歌曲不存在');

  const beats = await db.getAllFromIndex('beats', 'trackId', trackId);
  const segments = await db.getAllFromIndex('segments', 'trackId', trackId);
  const bpmHistory = await db.getAllFromIndex('bpmHistory', 'trackId', trackId);
  const transitionScores = await db.getAllFromIndex('transitionScores', 'trackId', trackId);
  const operationLogs = await db.getAllFromIndex('operationLogs', 'trackId', trackId);

  const exportData: ExportData = {
    track,
    beats,
    segments,
    bpmHistory,
    transitionScores,
    operationLogs,
    exportedAt: new Date(),
    exportedBy: getOperator(),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  saveAs(blob, `${track.name}_transition_data.json`);
};

export const exportToCSV = async (trackId: string): Promise<void> => {
  const db = await getDB();
  
  const track = await db.get('tracks', trackId);
  if (!track) throw new Error('歌曲不存在');

  const beats = await db.getAllFromIndex('beats', 'trackId', trackId);
  const segments = await db.getAllFromIndex('segments', 'trackId', trackId);

  beats.sort((a, b) => a.time - b.time);
  segments.sort((a, b) => a.startTime - b.startTime);

  let csv = '\ufeff';
  csv += 'DJ过渡拍点助手 - 数据导出\n';
  csv += `歌曲名称,${track.name}\n`;
  csv += `文件名,${track.fileName}\n`;
  csv += `时长,${formatDuration(track.duration)}\n`;
  csv += `当前BPM,${track.currentBPM}\n`;
  csv += `BPM可信度,${track.bpmConfidence}\n`;
  csv += `最佳入点,${track.bestInPoint ? formatTime(track.bestInPoint) : '未设置'}\n`;
  csv += `最佳出点,${track.bestOutPoint ? formatTime(track.bestOutPoint) : '未设置'}\n\n`;

  csv += '=== 拍点列表 ===\n';
  csv += '序号,时间(秒),时间格式,可信度,手动标记,漂移备注\n';
  beats.forEach((beat, index) => {
    csv += `${index + 1},${beat.time.toFixed(2)},${formatTime(beat.time)},${beat.confidence},${beat.isManual ? '是' : '否'},${beat.driftNote || ''}\n`;
  });
  csv += '\n';

  csv += '=== 段落标注 ===\n';
  csv += '序号,类型,开始时间,结束时间,标签,版本\n';
  segments.forEach((segment, index) => {
    csv += `${index + 1},${segment.type},${formatTime(segment.startTime)},${formatTime(segment.endTime)},${segment.label || ''},v${segment.version}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `${track.name}_transition_data.csv`);
};

export const exportAllToJSON = async (): Promise<void> => {
  const db = await getDB();
  const tracks = await db.getAll('tracks');
  
  const allData: { exportedAt: Date; exportedBy: string; tracks: ExportData[] } = {
    exportedAt: new Date(),
    exportedBy: getOperator(),
    tracks: [],
  };

  for (const track of tracks) {
    const beats = await db.getAllFromIndex('beats', 'trackId', track.id);
    const segments = await db.getAllFromIndex('segments', 'trackId', track.id);
    const bpmHistory = await db.getAllFromIndex('bpmHistory', 'trackId', track.id);
    const transitionScores = await db.getAllFromIndex('transitionScores', 'trackId', track.id);
    const operationLogs = await db.getAllFromIndex('operationLogs', 'trackId', track.id);

    allData.tracks.push({
      track,
      beats,
      segments,
      bpmHistory,
      transitionScores,
      operationLogs,
      exportedAt: new Date(),
      exportedBy: getOperator(),
    });
  }

  const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
  saveAs(blob, `all_transition_data_${new Date().toISOString().split('T')[0]}.json`);
};

export const importFromJSON = async (file: File): Promise<Track[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const db = await getDB();
        const importedTracks: Track[] = [];

        const tracksToImport = data.tracks || [data];

        for (const item of tracksToImport) {
          const trackData = item.track || item;
          
          const newTrack: Track = {
            ...trackData,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await db.add('tracks', newTrack);
          importedTracks.push(newTrack);

          if (item.beats) {
            for (const beat of item.beats as Beat[]) {
              await db.add('beats', {
                ...beat,
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                trackId: newTrack.id,
                createdAt: new Date(),
              });
            }
          }

          if (item.segments) {
            for (const segment of item.segments as Segment[]) {
              await db.add('segments', {
                ...segment,
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                trackId: newTrack.id,
                createdAt: new Date(),
              });
            }
          }
        }

        resolve(importedTracks);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}分${secs}秒`;
};
