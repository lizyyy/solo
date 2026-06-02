import { useState, useCallback } from 'react';
import { FileItem, Annotation, Track } from '@/types';
import { processFilesBatch, parseChatAnnotations } from '@/utils/fileUtils';
import { analyzeAudioFile } from '@/utils/audioUtils';
import { useAppStore } from '@/store/useAppStore';
import { nowISO } from '@/utils/dateUtils';
import { generateId } from '@/utils/storage';
import { similarityScore } from '@/utils/stringUtils';

interface ImportProgress {
  current: number;
  total: number;
  currentFile: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  results?: {
    success: number;
    warning: number;
    error: number;
  };
}

export function useFileImport() {
  const { currentRecordId, addFiles, setAnnotations, addAnnotation } = useAppStore();
  const [progress, setProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    currentFile: '',
    status: 'idle',
  });

  const importFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (!currentRecordId) {
        throw new Error('请先选择或创建一个周记录');
      }

      const files = Array.isArray(fileList) ? fileList : Array.from(fileList);
      if (files.length === 0) return;

      setProgress({
        current: 0,
        total: files.length,
        currentFile: '',
        status: 'processing',
      });

      const result = await processFilesBatch(
        files,
        currentRecordId,
        (file, index, total) => {
          setProgress({
            current: index,
            total,
            currentFile: file.name,
            status: 'processing',
          });
        }
      );

      const audioFiles = result.files.filter(
        f => f.type === 'audio' && f.status === 'success'
      );
      
      for (let i = 0; i < audioFiles.length; i++) {
        const fileItem = audioFiles[i];
        const originalFile = result.originalFiles.get(fileItem.id);
        try {
          if (originalFile) {
            const audioInfo = await analyzeAudioFile(originalFile);
            if (audioInfo) {
              fileItem.duration = audioInfo.duration;
              fileItem.metadata.sampleRate = audioInfo.sampleRate;
              fileItem.metadata.channels = audioInfo.channels;
            }
          }
        } catch (e) {
        }
      }

      addFiles(result.files);

      const chatAnnotations: Array<{
        author: string;
        content: string;
        trackId?: string;
      }> = [];

      result.files.forEach(file => {
        if (file.metadata?.annotations) {
          chatAnnotations.push(...file.metadata.annotations);
        } else if (
          file.type === 'text' &&
          file.metadata?.content &&
          (file.name.toLowerCase().includes('群聊') ||
            file.name.toLowerCase().includes('聊天') ||
            file.name.toLowerCase().includes('chat'))
        ) {
          const parsed = parseChatAnnotations(file.metadata.content);
          chatAnnotations.push(...parsed);
        }
      });

      if (chatAnnotations.length > 0) {
        const existingAnnotations = useAppStore.getState().annotations;
        const existingForRecord = existingAnnotations.filter(
          a => a.recordId === currentRecordId
        );

        const newAnnotations: Annotation[] = chatAnnotations.map(ca => {
          return {
            id: generateId(),
            recordId: currentRecordId,
            trackId: ca.trackId,
            source: 'chat',
            content: ca.content,
            author: ca.author,
            timestamp: nowISO(),
          };
        });

        const annotationsToAdd = newAnnotations.filter(
          na =>
            !existingForRecord.some(
              ea =>
                ea.author === na.author &&
                ea.content === na.content &&
                ea.source === na.source
            )
        );

        annotationsToAdd.forEach(a => addAnnotation(a));
      }

      setProgress({
        current: files.length,
        total: files.length,
        currentFile: '',
        status: 'completed',
        results: {
          success: result.success,
          warning: result.warning,
          error: result.error,
        },
      });

      return result;
    },
    [currentRecordId, addFiles, addAnnotation]
  );

  const resetProgress = useCallback(() => {
    setProgress({
      current: 0,
      total: 0,
      currentFile: '',
      status: 'idle',
    });
  }, []);

  const processAudioFileWithDuration = useCallback(
    async (file: File, fileItem: FileItem): Promise<FileItem> => {
      try {
        const audioInfo = await analyzeAudioFile(file);
        return {
          ...fileItem,
          duration: audioInfo.duration,
          metadata: {
            ...fileItem.metadata,
            sampleRate: audioInfo.sampleRate,
            channels: audioInfo.channels,
          },
        };
      } catch (e) {
        return {
          ...fileItem,
          status: 'warning',
          warningReason: e instanceof Error ? e.message : '音频解码失败，时长未知',
        };
      }
    },
    []
  );

  return {
    progress,
    importFiles,
    resetProgress,
    processAudioFileWithDuration,
  };
}
