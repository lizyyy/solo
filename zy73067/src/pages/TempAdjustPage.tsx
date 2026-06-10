import TempAdjustList from "@/components/temp-adjust/TempAdjustList";

export default function TempAdjustPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-industrial-800 mb-1">
          阈值临时调高 · 独立处理
        </h2>
        <p className="text-sm text-gray-500">
          复核人最头疼阈值临时调高被揉进正常结果 — 这类记录单独拎出来集中处理
        </p>
      </div>
      <TempAdjustList />
    </div>
  );
}
