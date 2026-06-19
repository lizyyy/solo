import { StickyNote } from "lucide-react";
import { PageHead } from "./ChartAnomaly";
import { NotesList } from "@/components/notes/NotesList";
import { BoundarySamples } from "@/components/notes/BoundarySamples";
import { MaterialDropZone } from "@/components/notes/MaterialDropZone";
import { useExplanationStore } from "@/store/useExplanationStore";

export default function NotesMaterials() {
  const noteCount = useExplanationStore((s) => s.notes.length);
  const influenceCount = useExplanationStore(
    (s) => s.notes.filter((n) => n.influencesConclusion).length,
  );

  return (
    <div className="space-y-6">
      <PageHead
        icon={<StickyNote className="h-5 w-5" />}
        title="评分备注与材料"
        desc="按来源分类（旧版/正常/口头），标记谁影响了结论；边界样本少时凭感觉的关系也留在这里。"
        meta={`备注 ${noteCount} · 影响结论 ${influenceCount}`}
      />

      <NotesList />

      <div className="grid gap-4 lg:grid-cols-2">
        <BoundarySamples />
        <MaterialDropZone />
      </div>
    </div>
  );
}
