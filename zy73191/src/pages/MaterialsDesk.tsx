import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionHeading } from "@/components/SectionHeading";
import { MaterialCard } from "@/components/MaterialCard";
import { typeMeta } from "@/lib/materialMeta";
import { useReviewStore } from "@/store/useReviewStore";
import { contentHash } from "@/lib/hash";
import { shortHash } from "@/lib/utils";
import type { MaterialType } from "@/lib/types";
import { Check, Copy, RotateCcw, Sparkles } from "lucide-react";

const TYPES: MaterialType[] = ["历史答案", "后补备注", "口头备注"];

export default function MaterialsDesk() {
  const navigate = useNavigate();
  const materials = useReviewStore((s) => s.materials);
  const lastIngest = useReviewStore((s) => s.lastIngest);
  const ingest = useReviewStore((s) => s.ingestMaterial);
  const submitDup = useReviewStore((s) => s.submitDuplicateNote);
  const runReview = useReviewStore((s) => s.runReview);
  const seedDemo = useReviewStore((s) => s.seedDemo);
  const refreshAll = useReviewStore((s) => s.refreshAll);
  const loading = useReviewStore((s) => s.loading);

  const [type, setType] = useState<MaterialType>("后补备注");
  const [version, setVersion] = useState("v2");
  const [source, setSource] = useState("小岑 · 后补");
  const [content, setContent] = useState("更正：边界 a_1 应为 2。");
  const [quote, setQuote] = useState("");
  const [primary, setPrimary] = useState<"old" | "fixed">("old");

  const previewHash = contentHash(type, version, content);

  useEffect(() => {
    refreshAll();
  }, []);

  return (
    <div>
      <SectionHeading
        index="01"
        title="材料台"
        kicker="录入 · 去重判定 · 一键复核入口"
      />

      <div className="mb-6 flex items-start gap-3 rounded-sm border border-indigoInk/30 bg-indigoInk/5 px-4 py-3 text-sm text-inkSoft">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigoInk" />
        <p>
          <span className="font-semibold text-ink">材料在这里：</span>
          左侧录入、右侧清单；重复提交同一后补备注会自动去重（不会算成两份）；选好复核版本后点底部【一键复核】即可，不必问材料放哪。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-sm border border-rule bg-paper p-5 shadow-dossier">
          <h3 className="font-serif text-base font-bold text-ink">录入面板</h3>

          <div className="mt-4 space-y-3">
            <div>
              <span className="text-[11px] text-inkMute">材料类型</span>
              <div className="mt-1 flex gap-1.5">
                {TYPES.map((t) => {
                  const m = typeMeta[t];
                  const active = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs transition ${
                        active
                          ? "border-ink bg-ink text-paper"
                          : `${m.chip} hover:opacity-80`
                      }`}
                    >
                      <span className="font-serif font-bold">{m.char}</span>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] text-inkMute">版本</span>
                <input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-rule bg-paperDeep/40 px-3 py-2 font-mono text-sm text-ink outline-none focus:border-vermilion"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-inkMute">来源</span>
                <input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-rule bg-paperDeep/40 px-3 py-2 text-sm text-ink outline-none focus:border-vermilion"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[11px] text-inkMute">内容</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-sm border border-rule bg-paperDeep/40 px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-vermilion"
              />
            </label>

            <label className="block">
              <span className="text-[11px] text-inkMute">
                原始说法（可选，用于溯源）
              </span>
              <input
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="如：a_1 应为 2"
                className="mt-1 w-full rounded-sm border border-rule bg-paperDeep/40 px-3 py-2 text-sm text-ink outline-none focus:border-vermilion"
              />
            </label>

            <div className="flex items-center justify-between border-t border-rule pt-3">
              <span className="font-mono text-[11px] text-inkMute">
                指纹预览 {shortHash(previewHash)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => submitDup()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-rule px-3 py-2 text-xs text-inkSoft transition hover:bg-paperDeep disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  测试幂等（重提后补备注）
                </button>
                <button
                  type="button"
                  onClick={() => ingest({ type, version, source, content, quote: quote || undefined })}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-4 py-2 text-xs font-medium text-paper transition hover:bg-inkSoft disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  录入并去重判定
                </button>
              </div>
            </div>

            {lastIngest && (
              <div
                className={`rounded-sm border px-3 py-2 text-xs ${
                  lastIngest.duplicated
                    ? "border-amberInk/40 bg-amberInk/10 text-amberInk"
                    : "border-moss/40 bg-moss/10 text-moss"
                }`}
              >
                {lastIngest.duplicated
                  ? `已存在，未重复计入 → 指向原条目 ${lastIngest.refId}`
                  : `已新增条目 ${lastIngest.submittedId}`}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-serif text-base font-bold text-ink">
              材料清单
              <span className="ml-2 font-mono text-xs text-inkMute">
                {materials.length} 份
              </span>
            </h3>
            <button
              type="button"
              onClick={seedDemo}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-sm border border-rule px-2.5 py-1 text-[11px] text-inkSoft transition hover:bg-paperDeep disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              重置为演示数据
            </button>
          </div>
          <div className="space-y-3">
            {materials.map((m) => (
              <MaterialCard key={m.id} material={m} />
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 flex flex-col items-center justify-between gap-3 rounded-sm border-2 border-ink bg-paper px-5 py-4 sm:flex-row">
        <div className="text-sm">
          <span className="text-[11px] text-inkMute">复核版本：</span>
          <div className="mt-1 inline-flex rounded-sm border border-rule">
            <button
              type="button"
              onClick={() => setPrimary("old")}
              className={`px-3 py-1.5 text-xs ${
                primary === "old"
                  ? "bg-vermilion text-paper"
                  : "text-inkSoft hover:bg-paperDeep"
              }`}
            >
              旧版（a₁=3）
            </button>
            <button
              type="button"
              onClick={() => setPrimary("fixed")}
              className={`px-3 py-1.5 text-xs ${
                primary === "fixed"
                  ? "bg-moss text-paper"
                  : "text-inkSoft hover:bg-paperDeep"
              }`}
            >
              修正（a₁=2）
            </button>
          </div>
          <span className="ml-3 text-[11px] text-inkMute">
            报告会同时展示两版推演以分清谁影响了结论。
          </span>
        </div>
        <button
          type="button"
          onClick={async () => {
            await runReview(primary);
            navigate("/report");
          }}
          disabled={loading}
          className="w-full rounded-sm bg-vermilion px-6 py-2.5 text-sm font-bold text-paper transition hover:bg-vermilion-deep sm:w-auto disabled:opacity-50"
        >
          一键复核 →
        </button>
      </section>
    </div>
  );
}
