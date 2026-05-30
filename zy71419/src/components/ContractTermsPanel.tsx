import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { useStore } from "@/store/useStore";

interface ContractTermsPanelProps {
  eventId: string;
}

export default function ContractTermsPanel({ eventId }: ContractTermsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const allTerms = useStore((s) => s.contractTerms);
  const terms = useMemo(() => allTerms.filter((c) => c.eventId === eventId), [allTerms, eventId]);

  return (
    <div className="bg-[#1a1f36] border border-[#2a3050] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#222845] transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#e8a838]" />
          <span className="text-[#f0ece4] font-medium text-sm">合约条款</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[#6b7894]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#6b7894]" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {terms.length === 0 && (
            <p className="text-[#6b7894] text-xs">暂无合约条款</p>
          )}
          {terms.map((term) => (
            <div key={term.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[#6b7894] text-xs">{term.source}</span>
                <span className="bg-[#2a3050] text-[#e8a838] text-xs px-1.5 py-0.5 rounded font-mono">
                  V{term.version}
                </span>
              </div>

              <pre className="text-[#f0ece4] text-xs whitespace-pre-wrap font-mono bg-[#0f1225] rounded p-3 border border-[#2a3050] leading-relaxed">
                {term.content}
              </pre>

              <div className="border border-[#2a3050] rounded overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    {Object.entries(term.parsedTerms).map(([key, value]) => (
                      <tr key={key} className="border-b border-[#2a3050] last:border-b-0">
                        <td className="px-3 py-1.5 text-[#6b7894] bg-[#0f1225] w-32 whitespace-nowrap">
                          {key}
                        </td>
                        <td className="px-3 py-1.5 text-[#f0ece4] font-mono">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
