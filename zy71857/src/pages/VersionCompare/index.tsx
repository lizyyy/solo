import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, GitCompare, ChevronDown } from 'lucide-react';
import { useClassroomStore } from '@/store/useClassroomStore';
import { DiffViewer } from '@/components/DiffViewer';
import type { ScoreSheetVersion } from '@/types';

export const VersionCompare: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getClassroom, getScoreSheet } = useClassroomStore();

  const sheetId = searchParams.get('sheetId');
  const classroom = id ? getClassroom(id) : undefined;
  const scoreSheet = sheetId ? getScoreSheet(sheetId) : undefined;

  const [oldVersionIndex, setOldVersionIndex] = useState(0);
  const [newVersionIndex, setNewVersionIndex] = useState(
    scoreSheet?.versions.length ? scoreSheet.versions.length - 1 : 0
  );

  const versions = scoreSheet?.versions || [];

  const hasDiff = versions.length >= 2 && oldVersionIndex !== newVersionIndex;

  if (!classroom || !scoreSheet) {
    return (
      <div className="min-h-screen bg-lab-bg p-8 flex items-center justify-center">
        <div className="text-center text-lab-text-muted">
          <p className="font-mono">课堂或评分表不存在</p>
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

  return (
    <div className="min-h-screen bg-lab-bg">
      <div className="border-b-2 border-lab-border bg-lab-card">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/classroom/${id}`)}
                className="p-2 border-2 border-lab-border hover:border-lab-accent transition-colors"
              >
                <ArrowLeft size={16} className="text-lab-text" />
              </button>
              <div>
                <h1 className="text-lg font-mono text-lab-text flex items-center gap-2">
                  <GitCompare size={18} className="text-lab-accent" />
                  版本对比
                </h1>
                <p className="text-xs text-lab-text-muted font-mono">
                  {classroom.name} · {scoreSheet.name}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {versions.length < 2 ? (
          <div className="text-center py-16 text-lab-text-muted">
            <p className="font-mono">该评分表只有一个版本，无法对比</p>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 border-2 border-lab-border bg-lab-card">
              <h3 className="text-sm font-mono text-lab-text-muted mb-4">选择对比版本</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-lab-text-muted mb-2 font-mono">旧版本</label>
                  <VersionSelector
                    versions={versions}
                    selectedIndex={oldVersionIndex}
                    onChange={setOldVersionIndex}
                    excludeIndex={newVersionIndex}
                  />
                </div>
                <div>
                  <label className="block text-xs text-lab-text-muted mb-2 font-mono">新版本</label>
                  <VersionSelector
                    versions={versions}
                    selectedIndex={newVersionIndex}
                    onChange={setNewVersionIndex}
                    excludeIndex={oldVersionIndex}
                  />
                </div>
              </div>
            </div>

            {hasDiff && (
              <DiffViewer
                oldVersion={versions[oldVersionIndex]}
                newVersion={versions[newVersionIndex]}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface VersionSelectorProps {
  versions: ScoreSheetVersion[];
  selectedIndex: number;
  onChange: (index: number) => void;
  excludeIndex: number;
}

const VersionSelector: React.FC<VersionSelectorProps> = ({
  versions,
  selectedIndex,
  onChange,
  excludeIndex,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 bg-lab-bg border-2 border-lab-border text-left flex items-center justify-between hover:border-lab-accent transition-colors"
      >
        <div>
          <div className="text-sm font-mono text-lab-text">
            v{versions[selectedIndex].version}
          </div>
          <div className="text-xs text-lab-text-muted">
            {versions[selectedIndex].uploader}
          </div>
        </div>
        <ChevronDown size={16} className={`text-lab-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 border-2 border-lab-border bg-lab-card max-h-48 overflow-auto">
          {versions.map((ver, idx) => (
            <button
              key={ver.id}
              onClick={() => {
                if (idx !== excludeIndex) {
                  onChange(idx);
                  setIsOpen(false);
                }
              }}
              disabled={idx === excludeIndex}
              className={`w-full p-3 text-left border-b border-lab-border last:border-b-0 transition-colors ${
                idx === selectedIndex
                  ? 'bg-lab-accent/10'
                  : idx === excludeIndex
                  ? 'opacity-30 cursor-not-allowed'
                  : 'hover:bg-lab-border/20'
              }`}
            >
              <div className="text-sm font-mono text-lab-text">v{ver.version}</div>
              <div className="text-xs text-lab-text-muted">{ver.uploader}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
