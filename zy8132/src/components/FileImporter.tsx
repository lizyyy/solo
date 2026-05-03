import React, { useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { parseSRT } from '../parsers/srtParser';
import { parseAudioMarkersCSV } from '../parsers/csvParser';
import { parseProgramSegmentsJSON } from '../parsers/jsonParser';
import { sampleAudioMarkersCSV, sampleSubtitlesSRT, sampleProgramSegmentsJSON } from '../data/sampleData';
import './FileImporter.css';

interface FileImporterProps {
  onLoadSample: () => void;
}

export function FileImporter({ onLoadSample }: FileImporterProps) {
  const { state, dispatch } = useAppContext();
  const srtInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleSRTFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const subtitles = parseSRT(content);
      dispatch({ type: 'SET_SUBTITLES', payload: subtitles });
      dispatch({ type: 'VALIDATE' });
    };
    reader.readAsText(file);
  };

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const markers = parseAudioMarkersCSV(content);
      dispatch({ type: 'SET_AUDIO_MARKERS', payload: markers });
      dispatch({ type: 'VALIDATE' });
    };
    reader.readAsText(file);
  };

  const handleJSONFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const segments = parseProgramSegmentsJSON(content);
      dispatch({ type: 'SET_PROGRAM_SEGMENTS', payload: segments });
      dispatch({ type: 'VALIDATE' });
    };
    reader.readAsText(file);
  };

  const loadSampleData = () => {
    const subtitles = parseSRT(sampleSubtitlesSRT);
    const markers = parseAudioMarkersCSV(sampleAudioMarkersCSV);
    const segments = parseProgramSegmentsJSON(sampleProgramSegmentsJSON);

    dispatch({ type: 'SET_SUBTITLES', payload: subtitles });
    dispatch({ type: 'SET_AUDIO_MARKERS', payload: markers });
    dispatch({ type: 'SET_PROGRAM_SEGMENTS', payload: segments });
    dispatch({ type: 'VALIDATE' });
    
    onLoadSample();
  };

  return (
    <div className="file-importer">
      <h2>导入文件</h2>
      
      <div className="import-grid">
        <div className={`import-card ${state.filesLoaded.subtitles ? 'loaded' : ''}`}>
          <div className="card-icon">📝</div>
          <h3>字幕文件</h3>
          <p className="file-type">.srt</p>
          <p className="file-desc">导入字幕文件进行对齐复核</p>
          <input
            ref={srtInputRef}
            type="file"
            accept=".srt"
            onChange={handleSRTFile}
            className="hidden-input"
          />
          <button
            onClick={() => srtInputRef.current?.click()}
            className="import-btn"
          >
            选择 SRT 文件
          </button>
          {state.filesLoaded.subtitles && (
            <p className="loaded-text">
              ✅ 已加载 {state.subtitles.length} 条字幕
            </p>
          )}
        </div>

        <div className={`import-card ${state.filesLoaded.audioMarkers ? 'loaded' : ''}`}>
          <div className="card-icon">🎵</div>
          <h3>音频标记</h3>
          <p className="file-type">.csv</p>
          <p className="file-desc">包含静音/说话区间的标记</p>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVFile}
            className="hidden-input"
          />
          <button
            onClick={() => csvInputRef.current?.click()}
            className="import-btn"
          >
            选择 CSV 文件
          </button>
          {state.filesLoaded.audioMarkers && (
            <p className="loaded-text">
              ✅ 已加载 {state.audioMarkers.length} 个标记
            </p>
          )}
        </div>

        <div className={`import-card ${state.filesLoaded.programSegments ? 'loaded' : ''}`}>
          <div className="card-icon">📊</div>
          <h3>节目段落</h3>
          <p className="file-type">.json</p>
          <p className="file-desc">节目结构段落划分（可选）</p>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            onChange={handleJSONFile}
            className="hidden-input"
          />
          <button
            onClick={() => jsonInputRef.current?.click()}
            className="import-btn secondary"
          >
            选择 JSON 文件
          </button>
          {state.filesLoaded.programSegments && (
            <p className="loaded-text">
              ✅ 已加载 {state.programSegments.length} 个段落
            </p>
          )}
        </div>
      </div>

      <div className="sample-section">
        <p>或使用示例数据快速体验：</p>
        <button onClick={loadSampleData} className="sample-btn">
          加载示例数据
        </button>
      </div>
    </div>
  );
}
