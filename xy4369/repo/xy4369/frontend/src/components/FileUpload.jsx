import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';

const FileUpload = ({
  onUpload,
  accept = '.csv,.json,.txt',
  label = '上传文件',
  description = '支持 CSV 或 JSON 格式',
  disabled = false,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled || isUploading) return;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = async (file) => {
    if (!file) return;
    
    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInputChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileSelect(file);
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={className}>
      <div
        className={`upload-area ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="file-input"
          disabled={disabled || isUploading}
        />
        
        <div className="upload-icon">
          {isUploading ? (
            <div className="spinner" style={{ margin: '0 auto' }} />
          ) : (
            <Upload size={48} />
          )}
        </div>
        
        <h4>{isUploading ? '正在上传...' : label}</h4>
        <p>{description}</p>
      </div>
    </div>
  );
};

export default FileUpload;
