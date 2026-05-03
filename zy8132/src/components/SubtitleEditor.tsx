import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Subtitle } from '../types';
import { formatTimeDisplay, timeToSeconds } from '../utils/timeUtils';
import './SubtitleEditor.css';

interface SubtitleEditorProps {
  subtitle: Subtitle | null;
}

export function SubtitleEditor({ subtitle }: SubtitleEditorProps) {
  const { state, dispatch } = useAppContext();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [text, setText] = useState('');
  const [frameRate, setFrameRate] = useState(25);

  useEffect(() => {
    if (subtitle) {
      setStartTime(formatTimeDisplay(subtitle.startTime));
      setEndTime(formatTimeDisplay(subtitle.endTime));
      setText(subtitle.text);
    }
  }, [subtitle]);

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
  };

  const handleTextChange = (value: string) => {
    setText(value);
  };

  const applyChanges = () => {
    if (!subtitle) return;

    const startSeconds = timeToSeconds(startTime, frameRate);
    const endSeconds = timeToSeconds(endTime, frameRate);

    dispatch({
      type: 'UPDATE_SUBTITLE',
      payload: {
        id: subtitle.id,
        updates: {
          startTime: startSeconds,
          endTime: endSeconds,
          text,
        },
      },
    });
    
    dispatch({ type: 'VALIDATE' });
  };

  const handleAutoFix = () => {
    if (!subtitle) return;
    dispatch({ type: 'AUTO_FIX_SUBTITLE', payload: subtitle.id });
  };

  const resetToOriginal = () => {
    if (!subtitle) return;
    dispatch({
      type: 'UPDATE_SUBTITLE',
      payload: {
        id: subtitle.id,
        updates: {
          startTime: subtitle.originalStartTime,
          endTime: subtitle.originalEndTime,
        },
      },
    });
    dispatch({ type: 'VALIDATE' });
  };

  if (!subtitle) {
    return (
      <div className="subtitle-editor-empty">
        <p>请选择一条字幕进行编辑</p>
      </div>
    );
  }

  const issues = state.validationIssues.filter((i) => i.subtitleId === subtitle.id);

  return (
    <div className="subtitle-editor-container">
      <div className="editor-header">
        <h3>编辑字幕 #{subtitle.index}</h3>
        {subtitle.isModified && (
          <span className="modified-badge">✏️ 已修改</span>
        )}
      </div>

      {subtitle.isModified && subtitle.originalStartTime !== undefined && subtitle.originalEndTime !== undefined && (
        <div className="original-info">
          <p className="original-label">原始时间:</p>
          <span className="original-time">
            {formatTimeDisplay(subtitle.originalStartTime)} - {formatTimeDisplay(subtitle.originalEndTime)}
          </span>
          <button onClick={resetToOriginal} className="reset-btn">
            恢复原始
          </button>
        </div>
      )}

      {issues.length > 0 && (
        <div className="issues-panel">
          <h4>检测到的问题</h4>
          {issues.map((issue) => (
            <div key={issue.id} className={`issue-card ${issue.severity}`}>
              <span className="issue-type">{issue.severity === 'error' ? '🔴 错误' : issue.severity === 'warning' ? '🟡 警告' : '🔵 提示'}</span>
              <p className="issue-msg">{issue.message}</p>
              {issue.suggestion && (
                <p className="issue-suggestion">💡 {issue.suggestion}</p>
              )}
            </div>
          ))}
          <button onClick={handleAutoFix} className="auto-fix-all-btn">
            🔧 自动修正此字幕
          </button>
        </div>
      )}

      <div className="form-group">
        <label>开始时间</label>
        <div className="time-input-group">
          <input
            type="text"
            value={startTime}
            onChange={(e) => handleStartTimeChange(e.target.value)}
            onBlur={applyChanges}
            className="time-input"
            placeholder="00:00:00.000"
          />
        </div>
        <p className="input-hint">支持格式: 00:00:00.000 或秒数</p>
      </div>

      <div className="form-group">
        <label>结束时间</label>
        <div className="time-input-group">
          <input
            type="text"
            value={endTime}
            onChange={(e) => handleEndTimeChange(e.target.value)}
            onBlur={applyChanges}
            className="time-input"
            placeholder="00:00:00.000"
          />
        </div>
        <p className="input-hint">支持格式: 00:00:00.000 或秒数</p>
      </div>

      <div className="form-group">
        <label>字幕内容</label>
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={applyChanges}
          className="text-input"
          rows={3}
        />
      </div>

      <div className="form-group">
        <label>帧率设置</label>
        <select
          value={frameRate}
          onChange={(e) => setFrameRate(Number(e.target.value))}
          className="select-input"
        >
          <option value={23.976}>23.976 fps</option>
          <option value={24}>24 fps</option>
          <option value={25}>25 fps</option>
          <option value={29.97}>29.97 fps</option>
          <option value={30}>30 fps</option>
          <option value={50}>50 fps</option>
          <option value={60}>60 fps</option>
        </select>
        <p className="input-hint">用于解析时间码格式如 00:00:00;00</p>
      </div>

      <div className="editor-actions">
        <button onClick={applyChanges} className="apply-btn">
          ✅ 应用更改
        </button>
      </div>
    </div>
  );
}
