import React, { useState } from 'react';
import { FileText, MapPin, Clock, User, ZoomIn, X, Edit3 } from 'lucide-react';
import type { NoteEvidence } from '@/types';

interface NoteEvidenceCardProps {
  evidence: NoteEvidence;
  isConflict?: boolean;
  showReviewButton?: boolean;
  onReview?: () => void;
}

export const NoteEvidenceCard: React.FC<NoteEvidenceCardProps> = ({ evidence, isConflict = false, showReviewButton = false, onReview }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div
        className={`bg-white border rounded-xl overflow-hidden transition-all hover:shadow-lg ${
          isConflict ? 'border-warning-300 bg-warning-50' : 'border-neutral-200'
        }`}
      >
        <div className={`px-4 py-3 border-b ${isConflict ? 'bg-warning-50 border-warning-200' : 'bg-success-50 border-success-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className={`w-4 h-4 ${isConflict ? 'text-warning-600' : 'text-success-600'}`} />
              <span className={`text-sm font-semibold ${isConflict ? 'text-warning-700' : 'text-success-700'}`}>
                手写巡检备注
              </span>
              <span className="font-mono text-xs text-neutral-500">{evidence.id}</span>
            </div>
            {isConflict && (
              <span className="px-2 py-0.5 bg-warning-100 text-warning-700 text-xs font-medium rounded">
                存在冲突
              </span>
            )}
            {showReviewButton && onReview && (
              <button
                onClick={onReview}
                className="flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded hover:bg-primary-200 transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                审阅
              </button>
            )}
          </div>
        </div>

        <div className="p-4">
          <div
            className="relative aspect-video bg-neutral-100 rounded-lg overflow-hidden cursor-pointer group mb-4"
            onClick={() => setShowModal(true)}
          >
            <img
              src={evidence.handwrittenImageUrl}
              alt="手写巡检备注"
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
              <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="mb-4 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
            <div className="text-xs text-neutral-500 mb-1">转录文本</div>
            <p className="text-sm text-neutral-800 leading-relaxed">{evidence.transcribedText}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-neutral-500">记录数值：</span>
              <span className="font-mono font-bold text-neutral-900">
                {evidence.notedValue}{evidence.notedUnit}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-neutral-400" />
              <span className="text-neutral-500">记录人：</span>
              <span className="text-neutral-700">{evidence.inspectorName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-neutral-400" />
              <span className="text-neutral-500">记录位置：</span>
              <span className="text-neutral-700">{evidence.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-neutral-400" />
              <span className="text-neutral-500">记录时间：</span>
              <span className="text-neutral-700">{evidence.noteTime}</span>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8" onClick={() => setShowModal(false)}>
          <div className="relative max-w-4xl w-full max-h-full overflow-auto" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={evidence.handwrittenImageUrl}
              alt="手写巡检备注大图"
              className="w-full h-auto rounded-lg"
            />
            <div className="mt-4 bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg">手写巡检备注详情</h3>
                  <p className="text-sm text-neutral-500">{evidence.id}</p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-bold text-success-600">
                    {evidence.notedValue}
                    <span className="text-lg text-neutral-500">{evidence.notedUnit}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg">
                <div className="text-xs text-neutral-500 mb-1">转录文本</div>
                <p className="text-sm text-neutral-800">{evidence.transcribedText}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface NoteReviewFormProps {
  recordId: string;
  onSubmit: (evidence: Omit<NoteEvidence, 'id'>) => void;
}

export const NoteReviewForm: React.FC<NoteReviewFormProps> = ({ recordId, onSubmit }) => {
  const [handwrittenImageUrl, setHandwrittenImageUrl] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  const [notedValue, setNotedValue] = useState('');
  const [notedUnit, setNotedUnit] = useState('με');
  const [inspectorName, setInspectorName] = useState('林老师');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handwrittenImageUrl || !transcribedText || !notedValue) return;

    onSubmit({
      recordId,
      handwrittenImageUrl,
      transcribedText,
      notedValue: parseFloat(notedValue),
      notedUnit,
      inspectorName,
      noteTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      location: '材料力学实验室A区',
    });

    setHandwrittenImageUrl('');
    setTranscribedText('');
    setNotedValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-6">
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
        <Edit3 className="w-5 h-5 text-primary-600" />
        林老师审阅巡检备注
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">备注照片URL</label>
          <input
            type="text"
            value={handwrittenImageUrl}
            onChange={e => setHandwrittenImageUrl(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="输入手写备注照片链接"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">转录文本</label>
          <textarea
            value={transcribedText}
            onChange={e => setTranscribedText(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[100px]"
            placeholder="请输入手写备注的转录文本内容..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">记录数值</label>
            <input
              type="number"
              value={notedValue}
              onChange={e => setNotedValue(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="1250"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">单位</label>
            <select
              value={notedUnit}
              onChange={e => setNotedUnit(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="με">微应变 (με)</option>
              <option value="mm/mm">应变 (mm/mm)</option>
              <option value="%">百分比 (%)</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">审阅人</label>
          <input
            type="text"
            value={inspectorName}
            onChange={e => setInspectorName(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button
          type="submit"
          disabled={!handwrittenImageUrl || !transcribedText || !notedValue}
          className="w-full py-2 bg-success-500 text-white font-medium rounded-lg hover:bg-success-600 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
        >
          确认审阅并添加备注
        </button>
      </div>
    </form>
  );
};
