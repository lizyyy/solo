import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { BriefingPreview } from './BriefingPreview';

export const ExportButton: React.FC = () => {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowPreview(true)}
        className="btn-secondary flex items-center gap-2"
      >
        <FileText className="w-4 h-4" />
        <span>任务简报</span>
      </button>
      <BriefingPreview show={showPreview} onClose={() => setShowPreview(false)} />
    </>
  );
};
