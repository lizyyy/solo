import { useState } from 'react';
import TimelineView from './components/TimelineView';
import WrongNoteAnalysis from './components/WrongNoteAnalysis';
import RehearsalSummary from './components/RehearsalSummary';
import { mockTimelineRecords, mockWrongNoteRecords } from './data/mockData';
import type { TimelineRecord, WrongNoteRecord } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'timeline' | 'wrongNote' | 'summary'>('timeline');
  const [timelineRecords] = useState<TimelineRecord[]>(mockTimelineRecords);
  const [wrongNoteRecords] = useState<WrongNoteRecord[]>(mockWrongNoteRecords);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>排练管理系统</h1>
        <p>整合排练录音、声部长备注和节拍器记录，统一时间线查看与错音分析</p>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          时间线视图
        </button>
        <button
          className={`tab-btn ${activeTab === 'wrongNote' ? 'active' : ''}`}
          onClick={() => setActiveTab('wrongNote')}
        >
          钢琴陪练错音
        </button>
        <button
          className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          排练小结
        </button>
      </nav>

      {activeTab === 'timeline' && <TimelineView records={timelineRecords} />}
      {activeTab === 'wrongNote' && <WrongNoteAnalysis records={wrongNoteRecords} />}
      {activeTab === 'summary' && (
        <RehearsalSummary timelineRecords={timelineRecords} wrongNoteRecords={wrongNoteRecords} />
      )}
    </div>
  );
}
