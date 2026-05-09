import React, { useState, useRef } from 'react';
import { ArchiveItem, FileType } from '../../shared/types';
import { api, getFileAccept } from '../api';

interface Props {
  onSubmit: (data: Omit<ArchiveItem, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'deliveredAt'>) => Promise<boolean>;
}

const ItemForm: React.FC<Props> = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0');
  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [videoFile, setVideoFile] = useState<{ name: string; path: string } | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<{ name: string; path: string } | null>(null);
  const [archiveFile, setArchiveFile] = useState<{ name: string; path: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (fileType: FileType, inputRef: React.RefObject<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<{ name: string; path: string } | null>>) => {
    const input = inputRef.current;
    if (!input || !input.files || input.files.length === 0) return;

    const file = input.files[0];
    setUploading(true);
    
    try {
      const result = await api.uploadFile(file);
      setter({ name: file.name, path: result.path });
    } catch (e) {
      alert('文件上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('请输入项目名称');
      return;
    }
    if (!version.trim()) {
      alert('请输入版本号');
      return;
    }
    if (!clientName.trim()) {
      alert('请输入客户名称');
      return;
    }

    const success = await onSubmit({
      name: name.trim(),
      version: version.trim(),
      clientName: clientName.trim(),
      notes: notes.trim(),
      videoPath: videoFile?.path || null,
      subtitlePath: subtitleFile?.path || null,
      archivePath: archiveFile?.path || null
    });

    if (success) {
      setName('');
      setVersion('1.0');
      setClientName('');
      setNotes('');
      setVideoFile(null);
      setSubtitleFile(null);
      setArchiveFile(null);
      if (videoInputRef.current) videoInputRef.current.value = '';
      if (subtitleInputRef.current) subtitleInputRef.current.value = '';
      if (archiveInputRef.current) archiveInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>➕ 添加新项目</h2>
      
      <div className="form-group">
        <label>项目名称 *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：产品演示视频"
        />
      </div>

      <div className="form-group">
        <label>版本号 *</label>
        <input
          type="text"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="例如：1.0、1.1、final"
        />
      </div>

      <div className="form-group">
        <label>客户名称 *</label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="例如：张三、XX公司"
        />
      </div>

      <div className="form-group">
        <label>视频文件</label>
        <div className="file-selector">
          <input
        type="text"
        value={videoFile?.name || ''}
        readOnly
        placeholder="未选择"
      />
          <input
            ref={videoInputRef}
            type="file"
            style={{ display: 'none' }}
            accept={getFileAccept('video')}
            onChange={() => handleFileSelect('video', videoInputRef, setVideoFile)}
          />
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => videoInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '上传中...' : '选择'}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>字幕文件</label>
        <div className="file-selector">
          <input
        type="text"
        value={subtitleFile?.name || ''}
        readOnly
        placeholder="未选择"
      />
          <input
            ref={subtitleInputRef}
            type="file"
            style={{ display: 'none' }}
            accept={getFileAccept('subtitle')}
            onChange={() => handleFileSelect('subtitle', subtitleInputRef, setSubtitleFile)}
          />
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => subtitleInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '上传中...' : '选择'}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>压缩包</label>
        <div className="file-selector">
          <input
        type="text"
        value={archiveFile?.name || ''}
        readOnly
        placeholder="未选择"
      />
          <input
            ref={archiveInputRef}
            type="file"
            style={{ display: 'none' }}
            accept={getFileAccept('archive')}
            onChange={() => handleFileSelect('archive', archiveInputRef, setArchiveFile)}
          />
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => archiveInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '上传中...' : '选择'}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>备注</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="可选的备注信息"
        />
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={uploading}>
        添加项目
      </button>
    </form>
  );
};

export default ItemForm;
