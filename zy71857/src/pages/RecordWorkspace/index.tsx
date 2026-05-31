import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Tag, FileSpreadsheet, Download, MessageSquare, GitCompare } from 'lucide-react';
import { useClassroomStore } from '@/store/useClassroomStore';
import { Timeline } from '@/components/Timeline';
import { AnnotationForm } from '@/components/AnnotationForm';
import { RecordForm } from '@/components/RecordForm';
import type { Record, AnomalyType, ScoreSheet } from '@/types';
import { formatTimestamp } from '@/utils/storage';

export const RecordWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getClassroom,
    getClassroomRecords,
    getClassroomScoreSheets,
    addRecord,
    addAnnotation,
  } = useClassroomStore();

  const [activeRecord, setActiveRecord] = useState<Record | null>(null);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [selectedScoreSheet, setSelectedScoreSheet] = useState<ScoreSheet | null>(null);

  const classroom = id ? getClassroom(id) : undefined;
  const records = id ? getClassroomRecords(id) : [];
  const scoreSheets = id ? getClassroomScoreSheets(id) : [];

  if (!classroom) {
    return (
      <div className="min-h-screen bg-lab-bg p-8 flex items-center justify-center">
        <div className="text-center text-lab-text-muted">
          <p className="font-mono">课堂不存在</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 border-2 border-lab-border text-sm font-mono hover:bg-lab-border/20"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const handleAddRecord = (data: {
    type: any;
    content: string;
    materialType: any;
    operator: string;
  }) => {
    addRecord({
      classroomId: classroom.id,
      ...data,
    });
    setShowRecordForm(false);
  };

  const handleAddAnnotation = (data: {
    anomalyType: AnomalyType;
    explanation: string;
    annotator: string;
  }) => {
    if (activeRecord) {
      addAnnotation(activeRecord.id, data);
      setShowAnnotationForm(false);
      setActiveRecord(null);
    }
  };

  const handleRecordClick = (record: Record) => {
    setActiveRecord(record);
    setShowAnnotationForm(!record.annotation);
  };

  return (
    <div className="min-h-screen bg-lab-bg">
      <div className="border-b-2 border-lab-border bg-lab-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 border-2 border-lab-border hover:border-lab-accent transition-colors"
              >
                <ArrowLeft size={16} className="text-lab-text" />
              </button>
              <div>
                <h1 className="text-lg font-mono text-lab-text">{classroom.name}</h1>
                <p className="text-xs text-lab-text-muted font-mono">
                  创建于 {formatTimestamp(classroom.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/classroom/${classroom.id}/export`}
                className="px-3 py-2 border-2 border-lab-border text-lab-text text-xs font-mono flex items-center gap-2 hover:border-lab-accent transition-colors"
              >
                <Download size={14} />
                导出
              </Link>
              <button
                onClick={() => setShowRecordForm(true)}
                className="px-3 py-2 bg-lab-accent text-lab-bg text-xs font-mono flex items-center gap-2 hover:bg-lab-accent/90 transition-colors"
              >
                <Plus size={14} />
                添加记录
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-mono text-lab-text-muted flex items-center gap-2">
                <Tag size={14} />
                时序记录 ({records.length})
              </h2>
            </div>

            {showRecordForm && (
              <div className="mb-4">
                <RecordForm onSubmit={handleAddRecord} onCancel={() => setShowRecordForm(false)} />
              </div>
            )}

            <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
              <Timeline
                records={records}
                onRecordClick={handleRecordClick}
                activeRecordId={activeRecord?.id}
              />
            </div>
          </div>

          <div className="space-y-4">
            {activeRecord && (
              <div className="border-2 border-lab-accent bg-lab-card p-4">
                <h3 className="text-sm font-mono text-lab-accent mb-3">记录详情</h3>
                <div className="space-y-3 text-xs font-mono">
                  <div>
                    <span className="text-lab-text-muted">时间:</span>
                    <span className="text-lab-text ml-2">{formatTimestamp(activeRecord.timestamp)}</span>
                  </div>
                  <div>
                    <span className="text-lab-text-muted">操作人:</span>
                    <span className="text-lab-text ml-2">{activeRecord.operator}</span>
                  </div>
                  <div>
                    <span className="text-lab-text-muted">类型:</span>
                    <span className="text-lab-text ml-2">{activeRecord.type}</span>
                  </div>
                  <div className="text-lab-text mt-2 p-2 bg-lab-bg border border-lab-border">
                    {activeRecord.content}
                  </div>

                  {activeRecord.annotation ? (
                    <div className="mt-4 p-3 border-l-4 border-lab-anomaly bg-lab-anomaly/5">
                      <div className="text-lab-anomaly font-bold mb-1">
                        异常标注: {activeRecord.annotation.anomalyType}
                      </div>
                      <div className="text-lab-text mb-1">{activeRecord.annotation.explanation}</div>
                      <div className="text-lab-text-muted text-[10px]">
                        标注人: {activeRecord.annotation.annotator} · {formatTimestamp(activeRecord.annotation.annotatedAt)}
                      </div>
                    </div>
                  ) : showAnnotationForm ? (
                    <AnnotationForm
                      recordId={activeRecord.id}
                      onSubmit={handleAddAnnotation}
                      onCancel={() => setShowAnnotationForm(false)}
                    />
                  ) : (
                    <button
                      onClick={() => setShowAnnotationForm(true)}
                      className="w-full mt-2 py-2 border-2 border-lab-border text-lab-text-muted text-xs font-mono flex items-center justify-center gap-2 hover:border-lab-anomaly hover:text-lab-anomaly transition-colors"
                    >
                      <MessageSquare size={14} />
                      添加异常标注
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="border-2 border-lab-border bg-lab-card p-4">
              <h3 className="text-sm font-mono text-lab-text-muted mb-3 flex items-center gap-2">
                <FileSpreadsheet size={14} />
                评分表 ({scoreSheets.length})
              </h3>

              {scoreSheets.length === 0 ? (
                <p className="text-xs text-lab-text-muted font-mono py-4 text-center">暂无评分表</p>
              ) : (
                <div className="space-y-2">
                  {scoreSheets.map((sheet) => (
                    <div
                      key={sheet.id}
                      className={`p-3 border-2 cursor-pointer transition-all ${
                        selectedScoreSheet?.id === sheet.id
                          ? 'border-lab-accent bg-lab-accent/5'
                          : 'border-lab-border hover:border-lab-text-muted'
                      }`}
                      onClick={() => setSelectedScoreSheet(selectedScoreSheet?.id === sheet.id ? null : sheet)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-lab-text">{sheet.name}</span>
                        <span className="text-[10px] font-mono text-lab-text-muted">
                          v{sheet.versions.length}
                        </span>
                      </div>

                      {selectedScoreSheet?.id === sheet.id && (
                        <div className="mt-3 pt-3 border-t border-lab-border space-y-2 animate-slide-in">
                          {sheet.versions.map((ver, idx) => (
                            <div key={ver.id} className="text-xs">
                              <div className="flex items-center justify-between text-lab-text-muted mb-1">
                                <span>v{ver.version} · {ver.uploader}</span>
                                {idx === sheet.versions.length - 1 && (
                                  <span className="text-lab-accent">最新</span>
                                )}
                              </div>
                              <pre className="p-2 bg-lab-bg border border-lab-border text-[10px] font-mono text-lab-text whitespace-pre-wrap max-h-32 overflow-auto">
                                {ver.content}
                              </pre>
                            </div>
                          ))}

                          {sheet.versions.length >= 2 && (
                            <Link
                              to={`/classroom/${classroom.id}/compare?sheetId=${sheet.id}`}
                              className="w-full py-2 mt-2 border-2 border-lab-border text-lab-text text-xs font-mono flex items-center justify-center gap-2 hover:border-lab-accent transition-colors"
                            >
                              <GitCompare size={14} />
                              版本对比
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
