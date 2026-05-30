import { useDrumStore } from '../store/useDrumStore';
import { getDeviationExplanation } from '../utils/calculator';
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { useState } from 'react';

export default function DeviationPanel() {
  const { result, params } = useDrumStore();
  const [expanded, setExpanded] = useState(true);

  if (!result) return null;

  const explanations = getDeviationExplanation(
    result.deviation,
    result.centsDiff,
    params.material,
    result.errors
  );

  return (
    <div className="bg-drum-card rounded-xl border border-drum-border animate-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 text-drum-copper font-semibold"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          偏差解释与建议
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="px-5 pb-4 space-y-2">
          {explanations.map((text, i) => (
            <div key={i} className="flex gap-2 text-sm text-drum-textMuted">
              <span className="text-drum-copper mt-0.5 shrink-0">•</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
