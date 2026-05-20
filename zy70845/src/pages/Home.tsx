import React, { useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { importData } from '../services/api';
import { ImportResponse } from '../../shared/types';
import ResultCard from '../components/ResultCard';

export default function Home() {
  const [batchId, setBatchId] = useState(`BATCH-${Date.now()}`);
  const [storeId, setStoreId] = useState('STORE-001');
  const [inventoryFile, setInventoryFile] = useState<File | null>(null);
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [replenishmentFile, setReplenishmentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await importData(
        batchId,
        storeId,
        inventoryFile,
        salesFile,
        replenishmentFile
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange =
    (setter: React.Dispatch<React.SetStateAction<File | null>>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        setter(e.target.files[0]);
      }
    };

  const resetForm = () => {
    setBatchId(`BATCH-${Date.now()}`);
    setInventoryFile(null);
    setSalesFile(null);
    setReplenishmentFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-800">
            便利店运营数据统一处理平台
          </h1>
          <p className="text-gray-500 mt-1">
            货架盘点、销售数据、补货单统一校验，标准化导入
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!result ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">
              数据导入
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    批次编号
                  </label>
                  <input
                    type="text"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="输入批次编号"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    重复提交相同批次号将返回历史结果
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    点位编号
                  </label>
                  <input
                    type="text"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="输入门店编号"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    盘点数据 (CSV)
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange(setInventoryFile)}
                      className="hidden"
                      id="inventory-file"
                    />
                    <label
                      htmlFor="inventory-file"
                      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                        inventoryFile
                          ? 'border-green-400 bg-green-50'
                          : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      <Upload
                        className={`w-8 h-8 mb-2 ${
                          inventoryFile ? 'text-green-500' : 'text-gray-400'
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          inventoryFile ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        {inventoryFile ? inventoryFile.name : '点击上传CSV'}
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    销售数据 (JSON)
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileChange(setSalesFile)}
                      className="hidden"
                      id="sales-file"
                    />
                    <label
                      htmlFor="sales-file"
                      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                        salesFile
                          ? 'border-green-400 bg-green-50'
                          : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      <FileText
                        className={`w-8 h-8 mb-2 ${
                          salesFile ? 'text-green-500' : 'text-gray-400'
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          salesFile ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        {salesFile ? salesFile.name : '点击上传JSON'}
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    补货单 (CSV/JSON)
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={handleFileChange(setReplenishmentFile)}
                      className="hidden"
                      id="replenishment-file"
                    />
                    <label
                      htmlFor="replenishment-file"
                      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                        replenishmentFile
                          ? 'border-green-400 bg-green-50'
                          : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      <Upload
                        className={`w-8 h-8 mb-2 ${
                          replenishmentFile ? 'text-green-500' : 'text-gray-400'
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          replenishmentFile ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        {replenishmentFile
                          ? replenishmentFile.name
                          : '点击上传补货单'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={
                    loading ||
                    (!inventoryFile && !salesFile && !replenishmentFile)
                  }
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {loading ? '处理中...' : '开始处理'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  处理结果
                </h2>
                <p className="text-sm text-gray-500">
                  批次: {result.batchId} | 门店: {result.storeId} | 处理时间:{' '}
                  {new Date(result.processedAt).toLocaleString('zh-CN')}
                </p>
              </div>
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                继续上传
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <ResultCard result={result} />
            </div>
          </div>
        )}

        <div className="mt-8 bg-blue-50 rounded-xl p-6">
          <h3 className="font-semibold text-blue-800 mb-3">业务规则说明</h3>
          <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
              <div>
                <span className="font-medium">少补校验:</span>{' '}
                补货量低于预期销量30%时标记为待确认
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
              <div>
                <span className="font-medium">多补校验:</span>{' '}
                补货量超出预期销量3倍时标记为待确认
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
              <div>
                <span className="font-medium">临期品校验:</span>{' '}
                距过期日期小于30天时标记为待确认
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
              <div>
                <span className="font-medium">SKU别名映射:</span>{' '}
                自动识别商品别名并标准化为统一SKU
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
