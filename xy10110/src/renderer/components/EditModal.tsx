import React, { useState, useRef } from 'react';
import { ArchiveItem, FileType } from '../../shared/types';
import { api, getFileAccept } from '../api';

interface Props {
  item: ArchiveItem;
  onClose: () => void;
  onSave: (id: string, updates: Partial<ArchiveItem>) => Promise<boolean>;
}

const EditModal: React.FC<Props> = ({ item, onClose, onSave }) => {
  const [name, setName] = useState(item.name);
  const [version, setVersion] = useState(item.version);
  const [clientName, setClientName] = useState(item.clientName);
  const [notes, setNotes] = useState(item.notes);
  const [videoPath, setVideoPath] = useState(item.videoPath || '');
  const [subtitlePath, setSubtitlePath] = useState(item.subtitlePath || '');
  const [archivePath, setArchivePath] = useState(item.archivePath || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (fileType: FileType, inputRef: React.RefObject<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const input = inputRef.current;
    if (!input || !input.files || input.files.length === 0) return;

    const file = input.files[0];
    setUploading(true);
    
    try {
      const result = await api.uploadFile(file);
      setter(result.path);
    } catch (e) {
      alert('文件上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    await onSave(item.id, {
      name: name.trim(),
      version: version.trim(),
      clientName: clientName.trim(),
      notes: notes.trim(),
      videoPath: videoPath || null,
      subtitlePath: subtitlePath || null,
      archivePath: archivePath || null
    });
    
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✏️ 编辑项目</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>项目名称 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>版本号 *</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>客户名称 *</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>视频文件</label>
              <div className="file-selector">
                <input
                  type="text"
                  value={videoPath}
                  readOnly
                  placeholder="未选择"
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept={getFileAccept('video')}
                  onChange={() => handleFileSelect('video', videoInputRef, setVideoPath)}
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
                  value={subtitlePath}
                  readOnly
                  placeholder="未选择"
                />
                <input
                  ref={subtitleInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept={getFileAccept('subtitle')}
                  onChange={() => handleFileSelect('subtitle', subtitleInputRef, setSubtitlePath)}
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
                  value={archivePath}
                  readOnly
                  placeholder="未选择"
                />
                <input
                  ref={archiveInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept={getFileAccept('archive')}
                  onChange={() => handleFileSelect('archive', archiveInputRef, setArchivePath)}
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
              />
            </div>

            <div style={{ fontSize: 12, color: '#999', marginTop: 16 }}>
              <div>创建时间: {new Date(item.createdAt).toLocaleString('zh-CN')}</div>
              <div>当前状态: {item.status}</div>
              {item.deliveredAt && (
                <div>交付时间: {new Date(item.deliveredAt).toLocaleString('zh-CN')}</div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || uploading}
            >
              {saving ? '保存中...' : '保存修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditModal;
