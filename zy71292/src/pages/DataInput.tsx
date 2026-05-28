import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  FileJson,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Users,
  GitBranch,
  Tag,
  Ban,
  SlidersHorizontal,
  Database,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { SAMPLE_PACKAGE } from "@/utils/sample-data";
import type { SamplePackage, GraphNode, GraphEdge, SourceType } from "@/types";

export default function DataInput() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSamplePackage = useAppStore((s) => s.loadSamplePackage);
  const setCapacityConfig = useAppStore((s) => s.setCapacityConfig);
  const capacityConfig = useAppStore((s) => s.capacityConfig);
  const nodes = useAppStore((s) => s.nodes);
  const edges = useAppStore((s) => s.edges);
  const blacklist = useAppStore((s) => s.blacklist);
  const projectLabels = useAppStore((s) => s.projectLabels);
  const dataLoaded = useAppStore((s) => s.dataLoaded);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: string;
    data: SamplePackage;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    nodes: true,
    edges: true,
    projectLabels: true,
    blacklist: true,
    capacity: true,
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const validatePackage = (data: unknown): data is SamplePackage => {
    if (!data || typeof data !== "object") return false;
    const pkg = data as Record<string, unknown>;
    return (
      Array.isArray(pkg.nodes) &&
      Array.isArray(pkg.edges) &&
      typeof pkg.projectLabels === "object" &&
      pkg.projectLabels !== null &&
      Array.isArray(pkg.blacklist) &&
      typeof pkg.capacityConfig === "object" &&
      pkg.capacityConfig !== null
    );
  };

  const handleFileUpload = useCallback(
    (file: File) => {
      setUploadError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (!validatePackage(data)) {
            setUploadError("JSON 格式不正确，请检查数据包结构");
            return;
          }
          setUploadedFile({
            name: file.name,
            size: formatFileSize(file.size),
            data,
          });
          loadSamplePackage(data);
        } catch {
          setUploadError("JSON 解析失败，请确保文件格式正确");
        }
      };
      reader.readAsText(file);
    },
    [loadSamplePackage]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".json")) {
        handleFileUpload(file);
      } else {
        setUploadError("请上传 JSON 格式的数据包文件");
      }
    },
    [handleFileUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const removeFile = () => {
    setUploadedFile(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const loadSampleData = () => {
    setUploadedFile({
      name: "sample-package.json",
      size: "2.4 KB",
      data: SAMPLE_PACKAGE,
    });
    loadSamplePackage(SAMPLE_PACKAGE);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleMinSizeChange = (value: number) => {
    const newMin = Math.max(1, Math.min(value, capacityConfig.maxSize - 1));
    setCapacityConfig({
      ...capacityConfig,
      minSize: newMin,
    });
  };

  const handleMaxSizeChange = (value: number) => {
    const newMax = Math.max(capacityConfig.minSize + 1, Math.min(value, 100));
    setCapacityConfig({
      ...capacityConfig,
      maxSize: newMax,
    });
  };

  const getCapacityStatus = () => {
    const { minSize, maxSize } = capacityConfig;
    const diff = maxSize - minSize;
    if (diff >= 5 && minSize >= 2 && maxSize <= 20) {
      return { color: "bg-green-500", label: "配置合理", textColor: "text-green-400" };
    } else if (diff >= 3 && minSize >= 1) {
      return { color: "bg-yellow-500", label: "配置一般", textColor: "text-yellow-400" };
    } else {
      return { color: "bg-red-500", label: "配置不合理", textColor: "text-red-400" };
    }
  };

  const capacityStatus = getCapacityStatus();

  const SourceTag = ({ sourceType }: { sourceType: SourceType }) => (
    <span
      className={cn(
        "px-2 py-0.5 text-xs font-medium rounded-full",
        sourceType === "raw"
          ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 border-dashed"
      )}
    >
      {sourceType === "raw" ? "原始" : "结果"}
    </span>
  );

  const DataCard = ({
    children,
    sourceType,
    className,
  }: {
    children: React.ReactNode;
    sourceType: SourceType;
    className?: string;
  }) => (
    <div
      className={cn(
        "p-3 rounded-lg transition-all",
        sourceType === "raw"
          ? "bg-slate-800/50 border border-slate-600"
          : "bg-slate-800/30 border border-slate-600/50 border-dashed",
        className
      )}
    >
      {children}
    </div>
  );

  const SummaryCard = ({
    icon: Icon,
    label,
    value,
    color,
  }: {
    icon: React.ElementType;
    label: string;
    value: number | string;
    color: string;
  }) => (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
      <div className={cn("p-2.5 rounded-lg", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
      </div>
    </div>
  );

  const CollapsibleSection = ({
    title,
    icon: Icon,
    sectionKey,
    count,
    children,
  }: {
    title: string;
    icon: React.ElementType;
    sectionKey: keyof typeof expandedSections;
    count?: number;
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSections[sectionKey];
    return (
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-blue-400" />
            <span className="font-medium text-white">{title}</span>
            {count !== undefined && (
              <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded-full">
                {count}
              </span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">数据输入</h1>
          <p className="text-slate-400 text-sm">
            上传或加载示例数据，配置分组参数后前往工作台
          </p>
        </div>

        <div className="mb-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200",
              isDragging
                ? "border-blue-400 bg-blue-500/10 scale-[1.01]"
                : "border-slate-600 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-700/50 flex items-center justify-center">
              <Upload
                className={cn(
                  "w-8 h-8 transition-colors",
                  isDragging ? "text-blue-400" : "text-slate-400"
                )}
              />
            </div>
            <p className="text-lg font-medium text-white mb-1">
              拖拽 JSON 数据包到此处
            </p>
            <p className="text-sm text-slate-400">
              或点击选择文件，支持 .json 格式
            </p>
          </div>

          {uploadError && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {uploadError}
            </div>
          )}

          {uploadedFile && (
            <div className="mt-4 bg-slate-800/50 border border-slate-700 rounded-xl p-4 animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <FileJson className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {uploadedFile.name}
                  </p>
                  <p className="text-xs text-slate-400">{uploadedFile.size}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                    <Check className="w-3 h-3" />
                    上传成功
                  </span>
                  <button
                    onClick={removeFile}
                    className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-400 hover:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mb-6">
          <button
            onClick={loadSampleData}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-full text-sm font-medium transition-colors"
          >
            <Database className="w-4 h-4" />
            加载示例数据
          </button>
          <button
            onClick={() => navigate("/workspace")}
            disabled={!dataLoaded}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all",
              dataLoaded
                ? "bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/25"
                : "bg-slate-700/50 text-slate-500 cursor-not-allowed"
            )}
          >
            前往工作台
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {dataLoaded && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                icon={Users}
                label="节点数量"
                value={nodes.length}
                color="bg-blue-500/20"
              />
              <SummaryCard
                icon={GitBranch}
                label="边数量"
                value={edges.length}
                color="bg-emerald-500/20"
              />
              <SummaryCard
                icon={Tag}
                label="项目标签"
                value={Object.keys(projectLabels).length}
                color="bg-purple-500/20"
              />
              <SummaryCard
                icon={Ban}
                label="黑名单条目"
                value={blacklist.length}
                color="bg-red-500/20"
              />
            </div>

            <CollapsibleSection
              title="节点列表"
              icon={Users}
              sectionKey="nodes"
              count={nodes.length}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">
                        ID
                      </th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">
                        名称
                      </th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">
                        项目标签
                      </th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">
                        来源
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map((node: GraphNode) => (
                      <tr
                        key={node.id}
                        className="border-b border-slate-700/50 hover:bg-slate-700/20"
                      >
                        <td className="py-2 px-3 text-slate-300 font-mono text-xs">
                          {node.id}
                        </td>
                        <td className="py-2 px-3 text-white">{node.name}</td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {node.projectLabels.length > 0 ? (
                              node.projectLabels.map((label) => (
                                <span
                                  key={label}
                                  className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded"
                                >
                                  {label}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 text-xs">无</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <SourceTag sourceType={node.sourceType} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="边列表"
              icon={GitBranch}
              sectionKey="edges"
              count={edges.length}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">
                        ID
                      </th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">
                        源节点
                      </th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">
                        目标节点
                      </th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">
                        权重
                      </th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">
                        来源
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {edges.map((edge: GraphEdge) => (
                      <tr
                        key={edge.id}
                        className="border-b border-slate-700/50 hover:bg-slate-700/20"
                      >
                        <td className="py-2 px-3 text-slate-300 font-mono text-xs">
                          {edge.id}
                        </td>
                        <td className="py-2 px-3 text-white font-mono text-xs">
                          {edge.source}
                        </td>
                        <td className="py-2 px-3 text-white font-mono text-xs">
                          {edge.target}
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {edge.weight.toFixed(2)}
                        </td>
                        <td className="py-2 px-3">
                          <SourceTag sourceType={edge.sourceType} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="项目标签"
              icon={Tag}
              sectionKey="projectLabels"
              count={Object.keys(projectLabels).length}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(projectLabels).map(([label, memberIds]) => (
                  <DataCard key={label} sourceType="raw">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-sm font-medium rounded">
                          {label}
                        </span>
                        <SourceTag sourceType="raw" />
                      </div>
                      <span className="text-xs text-slate-400">
                        {memberIds.length} 人
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {memberIds.map((id) => (
                        <span
                          key={id}
                          className="px-1.5 py-0.5 bg-slate-700 text-slate-300 text-xs rounded font-mono"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  </DataCard>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="黑名单"
              icon={Ban}
              sectionKey="blacklist"
              count={blacklist.length}
            >
              {blacklist.length > 0 ? (
                <div className="space-y-2">
                  {blacklist.map((entry, index) => (
                    <DataCard key={index} sourceType="raw">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-slate-700 text-white text-sm rounded font-mono">
                            {entry.nodeA}
                          </span>
                          <Ban className="w-4 h-4 text-red-400" />
                          <span className="px-2 py-1 bg-slate-700 text-white text-sm rounded font-mono">
                            {entry.nodeB}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 ml-auto">
                          {entry.reason}
                        </span>
                        <SourceTag sourceType="raw" />
                      </div>
                    </DataCard>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm text-center py-4">
                  暂无黑名单记录
                </p>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="容量配置"
              icon={SlidersHorizontal}
              sectionKey="capacity"
            >
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full",
                        capacityStatus.color
                      )}
                    />
                    <span className={cn("text-sm font-medium", capacityStatus.textColor)}>
                      {capacityStatus.label}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    建议：最小容量 ≥ 2，最大容量 ≤ 20，容量差 ≥ 5
                  </span>
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-slate-300">最小容量</label>
                      <input
                        type="number"
                        min={1}
                        max={capacityConfig.maxSize - 1}
                        value={capacityConfig.minSize}
                        onChange={(e) =>
                          handleMinSizeChange(parseInt(e.target.value) || 1)
                        }
                        className="w-20 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-center text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={capacityConfig.maxSize - 1}
                      value={capacityConfig.minSize}
                      onChange={(e) =>
                        handleMinSizeChange(parseInt(e.target.value))
                      }
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>1</span>
                      <span>{capacityConfig.maxSize - 1}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-slate-300">最大容量</label>
                      <input
                        type="number"
                        min={capacityConfig.minSize + 1}
                        max={100}
                        value={capacityConfig.maxSize}
                        onChange={(e) =>
                          handleMaxSizeChange(parseInt(e.target.value) || 100)
                        }
                        className="w-20 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-center text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <input
                      type="range"
                      min={capacityConfig.minSize + 1}
                      max={100}
                      value={capacityConfig.maxSize}
                      onChange={(e) =>
                        handleMaxSizeChange(parseInt(e.target.value))
                      }
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>{capacityConfig.minSize + 1}</span>
                      <span>100</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4 pt-2">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-400">
                        {capacityConfig.minSize}
                      </p>
                      <p className="text-xs text-slate-400">最小</p>
                    </div>
                    <div className="text-slate-600">—</div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-emerald-400">
                        {capacityConfig.maxSize}
                      </p>
                      <p className="text-xs text-slate-400">最大</p>
                    </div>
                    <div className="text-slate-600">—</div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-purple-400">
                        {capacityConfig.maxSize - capacityConfig.minSize}
                      </p>
                      <p className="text-xs text-slate-400">容量差</p>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          </div>
        )}
      </div>
    </div>
  );
}
