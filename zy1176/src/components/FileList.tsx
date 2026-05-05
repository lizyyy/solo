import React from 'react';
import { FileEntry } from '../types';
import { formatFileSize } from '../utils/format';

interface FileListProps {
  files: FileEntry[];
  selectedFile: FileEntry | null;
  onSelectFile: (file: FileEntry) => void;
}

const FileList: React.FC<FileListProps> = ({ 
  files, 
  selectedFile, 
  onSelectFile 
}) => {
  const getFileIcon = (fileType: FileEntry['fileType']) => {
    const icons: Record<string, string> = {
      text: '📄',
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      pdf: '📕',
      other: '📎',
    };
    return icons[fileType] || '📎';
  };

  return (
    <div className="file-list">
      {files.map(file => {
        const isSelected = selectedFile?.id === file.id;
        
        return (
          <div
            key={file.id}
            className={`file-item ${isSelected ? 'active' : ''}`}
            onClick={() => onSelectFile(file)}
          >
            <div className="file-header">
              <span className="file-icon">{getFileIcon(file.fileType)}</span>
              <span className="file-name">{file.fileName}</span>
              <span className={`file-status-badge status-${file.status}`}>
                {file.status}
              </span>
            </div>
            <div className="file-info">
              <span>{formatFileSize(file.fileSize)}</span>
              <span>{file.mimeType || file.fileType}</span>
            </div>
            {file.sensitiveCount > 0 && (
              <div className="file-sensitive">
                <span className="sensitive-tag tag-pending">
                  检测到 {file.sensitiveCount} 项
                </span>
                {file.confirmedCount > 0 && (
                  <span className="sensitive-tag tag-confirmed">
                    确认 {file.confirmedCount} 项
                  </span>
                )}
                {file.ignoredCount > 0 && (
                  <span className="sensitive-tag tag-ignored">
                    忽略 {file.ignoredCount} 项
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
      
      {files.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <div className="empty-title">暂无文件</div>
          <div className="empty-desc">此项目尚未扫描任何文件</div>
        </div>
      )}
    </div>
  );
};

export default FileList;
