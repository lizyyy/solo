import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, FileSpreadsheet, CheckCircle, X } from "lucide-react";
import useImportStore from "@/stores/importStore";

export default function Import() {
  const { importHistory, currentImport, loading, error, fetchHistory, uploadFile } =
    useImportStore();

  const [batchLabel, setBatchLabel] = useState("");
  const [operator, setOperator] = useState("何工");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFileSelect = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "xlsx", "xls"].includes(ext)) return;
    setSelectedFile(file);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    []
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedFile || !batchLabel.trim()) return;
    try {
      await uploadFile(selectedFile, batchLabel.trim(), operator);
      setSelectedFile(null);
      setBatchLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchHistory();
    } catch {
      /* ignore upload errors */
    }
  }, [selectedFile, batchLabel, operator, uploadFile, fetchHistory]);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">数据导入</h1>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              批次标签
            </label>
            <input
              type="text"
              value={batchLabel}
              onChange={(e) => setBatchLabel(e.target.value)}
              placeholder="请输入批次标签"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm transition focus:border-[#1B2A4A] focus:outline-none focus:ring-1 focus:ring-[#1B2A4A]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              操作人
            </label>
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm transition focus:border-[#1B2A4A] focus:outline-none focus:ring-1 focus:ring-[#1B2A4A]"
            />
          </div>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition ${
            isDragging
              ? "border-[#1B2A4A] bg-blue-50"
              : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
          }`}
        >
          {selectedFile ? (
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={32} className="text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="ml-2 rounded-full p-1 text-gray-400 transition hover:bg-gray-200 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <Upload size={36} className="mb-3 text-gray-400" />
              <p className="text-sm font-medium text-gray-600">
                拖拽或点击上传 CSV/Excel 文件
              </p>
              <p className="mt-1 text-xs text-gray-400">
                支持 .csv, .xlsx, .xls 格式
              </p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleInputChange}
          className="hidden"
        />

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={handleSubmit}
            disabled={!selectedFile || !batchLabel.trim() || loading}
            className="flex items-center gap-2 rounded-lg bg-[#1B2A4A] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#24365e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Upload size={16} />
            )}
            {loading ? "上传中..." : "开始上传"}
          </button>

          {currentImport && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              <CheckCircle size={16} />
              <span>
                导入成功：总行数 {currentImport.totalRows}
                {currentImport.duplicateRows > 0 &&
                  `，重复行 ${currentImport.duplicateRows}`}
                {currentImport.anomalies > 0 &&
                  `，异常 ${currentImport.anomalies}`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">导入历史</h2>
        </div>
        {loading && importHistory.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            加载中...
          </div>
        ) : importHistory.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            暂无导入记录
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="px-5 py-3 text-left font-medium">
                    批次标签
                  </th>
                  <th className="px-5 py-3 text-left font-medium">文件名</th>
                  <th className="px-5 py-3 text-left font-medium">总行数</th>
                  <th className="px-5 py-3 text-left font-medium">
                    重复行数
                  </th>
                  <th className="px-5 py-3 text-left font-medium">异常数</th>
                  <th className="px-5 py-3 text-left font-medium">操作人</th>
                  <th className="px-5 py-3 text-left font-medium">
                    导入时间
                  </th>
                  <th className="px-5 py-3 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-50 transition hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {item.batch_label}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {item.file_name}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {item.total_rows}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {item.duplicate_rows ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          item.anomaly_count > 0
                            ? "font-medium text-red-600"
                            : "text-gray-600"
                        }
                      >
                        {item.anomaly_count}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {item.operator}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {item.created_at}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-3">
                        <Link
                          to={`/review?importId=${item.id}`}
                          className="text-sm text-[#1B2A4A] hover:underline"
                        >
                          查看复盘
                        </Link>
                        <Link
                          to={`/selfcheck?importId=${item.id}`}
                          className="text-sm text-[#1B2A4A] hover:underline"
                        >
                          自检
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
