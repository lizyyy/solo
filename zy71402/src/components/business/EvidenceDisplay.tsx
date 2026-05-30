import React, { useState } from 'react';
import { FileText, MapPin, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import type { EvidenceRef } from '@/types';

interface EvidenceDisplayProps {
  evidence: EvidenceRef | EvidenceRef[];
  title?: string;
  compact?: boolean;
}

export const EvidenceDisplay: React.FC<EvidenceDisplayProps> = ({
  evidence,
  title = '证据来源',
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const evidenceArray = Array.isArray(evidence) ? evidence : [evidence];

  if (compact) {
    return (
      <div className="inline-flex items-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs text-gray-500 hover:text-primary-600"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Link2 className="w-3 h-3 mr-1" />
          证据链
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 ml-1" />
          ) : (
            <ChevronRight className="w-3 h-3 ml-1" />
          )}
        </Button>
        {isExpanded && (
          <div className="mt-2 ml-4 pl-4 border-l-2 border-primary-200 space-y-2">
            {evidenceArray.map((ev, idx) => (
              <EvidenceItem key={idx} evidence={ev} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900 flex items-center">
            <FileText className="w-4 h-4 mr-2 text-primary-500" />
            {title}
          </h4>
          <Badge variant="neutral" size="sm">
            {evidenceArray.length} 份来源
          </Badge>
        </div>
        <div className="space-y-3">
          {evidenceArray.map((ev, idx) => (
            <EvidenceItem key={idx} evidence={ev} showDivider={idx < evidenceArray.length - 1} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
EvidenceDisplay.displayName = 'EvidenceDisplay';

interface EvidenceItemProps {
  evidence: EvidenceRef;
  showDivider?: boolean;
}

const EvidenceItem: React.FC<EvidenceItemProps> = ({ evidence, showDivider }) => {
  return (
    <div className={showDivider ? 'pb-3 border-b border-gray-100' : ''}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
          <FileText className="w-4 h-4 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">
              {evidence.filename}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="inline-flex items-center">
              <MapPin className="w-3 h-3 mr-1" />
              {evidence.location}
            </span>
          </div>
          <div className="mt-2 p-2 bg-gray-50 rounded font-mono text-xs text-gray-700">
            提取值: <span className="text-primary-700 font-medium">{evidence.value}</span>
          </div>
          <div className="mt-1 text-xs text-gray-400">
            材料ID: {evidence.materialId}
          </div>
        </div>
      </div>
    </div>
  );
};
