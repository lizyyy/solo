import { FileType, FileItem } from '@/types';
import { generateId } from './storage';

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic'];
const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.xml'];
const TRACKLIST_INDICATORS = ['曲目', '曲目表', 'tracklist', 'setlist', '歌单', '曲目清单'];

export function detectFileType(filename: string, mimeType?: string): FileType {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  
  if (mimeType) {
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('text/')) return 'text';
  }
  
  if (TEXT_EXTENSIONS.includes(ext)) return 'text';
  
  const lowerName = filename.toLowerCase();
  if (TRACKLIST_INDICATORS.some(indicator => lowerName.includes(indicator))) {
    return 'tracklist';
  }
  
  return 'unknown';
}

export function isTracklistFile(filename: string, content?: string): boolean {
  const lowerName = filename.toLowerCase();
  if (TRACKLIST_INDICATORS.some(indicator => lowerName.includes(indicator))) {
    return true;
  }
  
  if (content) {
    const lines = content.split('\n').filter(l => l.trim());
    const trackPatterns = [
      /^\d+[.\、\s]+/,
      /^曲目\s*\d+/,
      /^Track\s*\d+/i,
    ];
    
    const matchCount = lines.filter(line => 
      trackPatterns.some(pattern => pattern.test(line.trim()))
    ).length;
    
    if (lines.length >= 2 && matchCount >= lines.length * 0.5) {
      return true;
    }
  }
  
  return false;
}

export function validateFile(file: File): { valid: boolean; error?: string; warning?: string } {
  if (file.size === 0) {
    return { valid: false, error: '文件是空的，无法读取' };
  }
  
  const maxSize = 500 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: '文件太大（超过500MB），请处理后再上传' };
  }
  
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  const supportedTypes = [...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS, ...TEXT_EXTENSIONS];
  
  if (!supportedTypes.includes(ext) && !file.type.startsWith('text/')) {
    return { 
      valid: true, 
      warning: '这个格式不常见，试试看能不能读，不行就手动标一下' 
    };
  }
  
  return { valid: true };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

export function parseTracklist(content: string): Array<{
  trackNo: number;
  name: string;
  composer?: string;
  duration?: number;
}> {
  const lines = content.split('\n').filter(l => l.trim());
  const tracks: Array<{
    trackNo: number;
    name: string;
    composer?: string;
    duration?: number;
  }> = [];
  
  let currentNo = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    const numberMatch = trimmed.match(/^(\d+)[.\、\s\-]+(.+)$/);
    if (numberMatch) {
      currentNo = parseInt(numberMatch[1], 10);
      const rest = numberMatch[2];
      
      const parts = rest.split(/[—\-–|]/).map(p => p.trim());
      
      let name = parts[0] || rest;
      let composer: string | undefined;
      let duration: number | undefined;
      
      if (parts.length >= 2) {
        const durationMatch = parts[parts.length - 1].match(/^(\d+):(\d{2})$/);
        if (durationMatch) {
          duration = parseInt(durationMatch[1], 10) * 60 + parseInt(durationMatch[2], 10);
          if (parts.length >= 3) {
            composer = parts[1];
          }
          name = parts.slice(0, durationMatch ? -1 : undefined).join(' - ');
        } else {
          composer = parts[1];
        }
      }
      
      const inlineDurationMatch = name.match(/\s*[—\-–|]\s*(\d+):(\d{2})\s*$/);
      if (inlineDurationMatch && !duration) {
        duration = parseInt(inlineDurationMatch[1], 10) * 60 + parseInt(inlineDurationMatch[2], 10);
        name = name.replace(inlineDurationMatch[0], '').trim();
      }
      
      tracks.push({
        trackNo: currentNo,
        name: name.trim(),
        composer,
        duration,
      });
    }
  }
  
  return tracks;
}

export function parseChatAnnotations(content: string): Array<{
  author: string;
  content: string;
  timestamp?: string;
}> {
  const lines = content.split('\n').filter(l => l.trim());
  const annotations: Array<{
    author: string;
    content: string;
    timestamp?: string;
  }> = [];
  
  const chatPattern = /^(.+?)[：:]\s*(.+)$/;
  
  for (const line of lines) {
    const match = line.trim().match(chatPattern);
    if (match) {
      const author = match[1].trim();
      const message = match[2].trim();
      
      if (author.length < 20 && message.length > 0) {
        annotations.push({
          author,
          content: message,
        });
      }
    }
  }
  
  return annotations;
}

export async function processFile(
  file: File,
  recordId: string,
  onProgress?: (progress: number) => void
): Promise<FileItem> {
  const fileId = generateId();
  const type = detectFileType(file.name, file.type);
  const validation = validateFile(file);
  
  const baseItem: FileItem = {
    id: fileId,
    recordId,
    name: file.name,
    type,
    size: file.size,
    status: validation.valid ? 'processing' : 'error',
    errorReason: validation.error,
    uploadTime: new Date().toISOString(),
    metadata: {
      lastModified: file.lastModified,
      mimeType: file.type,
    },
  };
  
  if (!validation.valid) {
    return baseItem;
  }
  
  try {
    onProgress?.(30);
    
    if (type === 'image') {
      const previewUrl = await readFileAsDataURL(file);
      onProgress?.(100);
      return {
        ...baseItem,
        status: validation.warning ? 'warning' : 'success',
        warningReason: validation.warning,
        previewUrl,
      };
    }
    
    if (type === 'text' || type === 'tracklist' || type === 'unknown') {
      try {
        const content = await readFileAsText(file);
        onProgress?.(80);
        
        const isTracklist = isTracklistFile(file.name, content);
        const detectedType = isTracklist ? 'tracklist' : (type === 'unknown' ? 'text' : type);
        
        let parsedData: any = {};
        if (isTracklist) {
          parsedData.tracks = parseTracklist(content);
        } else if (file.name.toLowerCase().includes('群聊') || file.name.toLowerCase().includes('chat')) {
          parsedData.annotations = parseChatAnnotations(content);
        }
        
        onProgress?.(100);
        return {
          ...baseItem,
          type: detectedType,
          status: validation.warning ? 'warning' : 'success',
          warningReason: validation.warning,
          metadata: {
            ...baseItem.metadata,
            content,
            ...parsedData,
          },
        };
      } catch (e) {
        onProgress?.(100);
        return {
          ...baseItem,
          status: 'warning',
          warningReason: '内容读不太懂，不过文件还在，你可以手动标一下',
        };
      }
    }
    
    onProgress?.(100);
    return {
      ...baseItem,
      status: validation.warning ? 'warning' : 'success',
      warningReason: validation.warning,
    };
    
  } catch (error) {
    return {
      ...baseItem,
      status: 'error',
      errorReason: error instanceof Error ? error.message : '处理失败了，可能文件坏了',
    };
  }
}

export async function processFilesBatch(
  files: File[],
  recordId: string,
  onFileProcessed?: (file: FileItem, index: number, total: number) => void
): Promise<{ files: FileItem[]; originalFiles: Map<string, File>; success: number; warning: number; error: number }> {
  const results: FileItem[] = [];
  const originalFiles = new Map<string, File>();
  let success = 0;
  let warning = 0;
  let error = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      const result = await processFile(file, recordId, () => {});
      results.push(result);
      originalFiles.set(result.id, file);
      
      if (result.status === 'success') success++;
      else if (result.status === 'warning') warning++;
      else if (result.status === 'error') error++;
      
      onFileProcessed?.(result, i + 1, files.length);
    } catch (e) {
      const errorItem: FileItem = {
        id: generateId(),
        recordId,
        name: file.name,
        type: 'unknown',
        size: file.size,
        status: 'error',
        errorReason: '完全读不了，这个文件可能已经损坏了',
        uploadTime: new Date().toISOString(),
        metadata: {},
      };
      results.push(errorItem);
      originalFiles.set(errorItem.id, file);
      error++;
      onFileProcessed?.(errorItem, i + 1, files.length);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return { files: results, originalFiles, success, warning, error };
}
