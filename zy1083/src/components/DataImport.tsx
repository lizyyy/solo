import React, { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { parseHouseJson, parseVisitNotesCsv, generateCsvTemplate } from '../utils/parser';
import { validateAllData, formatValidationErrors } from '../utils/validator';
import { exampleHouses, exampleVisitNotes } from '../data/exampleData';
import { ValidationError } from '../types';

const DataImport: React.FC = () => {
  const { dispatch } = useApp();
  const [houseFile, setHouseFile] = useState<File | null>(null);
  const [visitFile, setVisitFile] = useState<File | null>(null);
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ houses: ValidationError[]; visitNotes: ValidationError[] }>({
    houses: [],
    visitNotes: [],
  });
  const [warnings, setWarnings] = useState<{ houses: ValidationError[]; visitNotes: ValidationError[] }>({
    houses: [],
    visitNotes: [],
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleHouseFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setHouseFile(file);
    setErrors((prev) => ({ ...prev, houses: [] }));
    setWarnings((prev) => ({ ...prev, houses: [] }));
  }, []);

  const handleVisitFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setVisitFile(file);
    setErrors((prev) => ({ ...prev, visitNotes: [] }));
    setWarnings((prev) => ({ ...prev, visitNotes: [] }));
  }, []);

  const handleProjectFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setProjectFile(file);
  }, []);

  const importHouseData = useCallback(async () => {
    if (!houseFile) return;

    setIsLoading(true);
    setSuccessMessage('');
    setErrors((prev) => ({ ...prev, houses: [] }));
    setWarnings((prev) => ({ ...prev, houses: [] }));

    try {
      const content = await readFileContent(houseFile);
      const result = parseHouseJson(content);

      if (!result.success || !result.data) {
        setErrors((prev) => ({ ...prev, houses: result.errors }));
        setWarnings((prev) => ({ ...prev, houses: result.warnings }));
        return;
      }

      dispatch({ type: 'SET_HOUSES', payload: result.data });
      setSuccessMessage(`成功导入 ${result.data.length} 套房源数据`);
      setWarnings((prev) => ({ ...prev, houses: result.warnings }));
      setHouseFile(null);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        houses: [
          {
            row: 1,
            column: '全部',
            field: 'file',
            message: '文件读取失败',
            value: '',
          },
        ],
      }));
    } finally {
      setIsLoading(false);
    }
  }, [houseFile, dispatch]);

  const importVisitNotes = useCallback(async () => {
    if (!visitFile) return;

    setIsLoading(true);
    setSuccessMessage('');
    setErrors((prev) => ({ ...prev, visitNotes: [] }));
    setWarnings((prev) => ({ ...prev, visitNotes: [] }));

    try {
      const content = await readFileContent(visitFile);
      const result = parseVisitNotesCsv(content);

      if (!result.success || !result.data) {
        setErrors((prev) => ({ ...prev, visitNotes: result.errors }));
        setWarnings((prev) => ({ ...prev, visitNotes: result.warnings }));
        return;
      }

      dispatch({ type: 'SET_VISIT_NOTES', payload: result.data });
      setSuccessMessage(`成功导入 ${result.data.length} 条看房记录`);
      setWarnings((prev) => ({ ...prev, visitNotes: result.warnings }));
      setVisitFile(null);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        visitNotes: [
          {
            row: 1,
            column: '全部',
            field: 'file',
            message: '文件读取失败',
            value: '',
          },
        ],
      }));
    } finally {
      setIsLoading(false);
    }
  }, [visitFile, dispatch]);

  const importProject = useCallback(async () => {
    if (!projectFile) return;

    setIsLoading(true);
    setSuccessMessage('');
    setErrors((prev) => ({ ...prev, houses: [], visitNotes: [] }));
    setWarnings((prev) => ({ ...prev, houses: [], visitNotes: [] }));

    try {
      const content = await readFileContent(projectFile);
      const projectData = JSON.parse(content);

      dispatch({ type: 'LOAD_PROJECT', payload: projectData });
      setSuccessMessage('项目数据导入成功');
      setProjectFile(null);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        houses: [
          {
            row: 1,
            column: '全部',
            field: 'file',
            message: '项目文件解析失败，请确保是有效的 JSON 格式',
            value: '',
          },
        ],
      }));
    } finally {
      setIsLoading(false);
    }
  }, [projectFile, dispatch]);

  const loadExampleData = useCallback(() => {
    dispatch({
      type: 'LOAD_EXAMPLE_DATA',
      payload: { houses: exampleHouses, visitNotes: exampleVisitNotes },
    });
    setSuccessMessage('示例数据加载成功！您可以查看功能演示。');
  }, [dispatch]);

  const downloadCsvTemplate = useCallback(() => {
    const template = generateCsvTemplate();
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'visit-notes-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="space-y-8">
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">数据导入</h1>
        <p className="text-gray-600">导入您的房源信息和看房记录，开始系统性地对比分析</p>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-green-800">{successMessage}</span>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">快速开始</h2>
        <p className="text-gray-600 mb-4">
          如果您是第一次使用，可以先加载示例数据来体验功能。示例数据包含5套不同类型的房源和对应的看房记录。
        </p>
        <button
          onClick={loadExampleData}
          disabled={isLoading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          加载示例数据
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">导入房源数据</h3>
          <p className="text-sm text-gray-500 mb-4">
            支持导入 <code className="bg-gray-100 px-1 rounded">houses.json</code> 文件，包含房源的基本信息、租金、押金、通勤时间等。
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择 JSON 文件
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleHouseFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {houseFile && (
                <p className="mt-2 text-sm text-gray-600">
                  已选择: <span className="font-medium">{houseFile.name}</span>
                </p>
              )}
            </div>

            <button
              onClick={importHouseData}
              disabled={!houseFile || isLoading}
              className="w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '导入中...' : '导入房源数据'}
            </button>

            {errors.houses.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-red-800 mb-2">错误 ({errors.houses.length})</h4>
                <pre className="text-xs text-red-600 whitespace-pre-wrap overflow-auto max-h-40">
                  {formatValidationErrors(errors.houses)}
                </pre>
              </div>
            )}

            {warnings.houses.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-yellow-800 mb-2">警告 ({warnings.houses.length})</h4>
                <pre className="text-xs text-yellow-600 whitespace-pre-wrap overflow-auto max-h-40">
                  {formatValidationErrors(warnings.houses)}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">导入看房记录</h3>
          <p className="text-sm text-gray-500 mb-4">
            支持导入 <code className="bg-gray-100 px-1 rounded">visit-notes.csv</code> 文件，包含每套房的采光、噪音、漏水、维修项等看房细节。
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择 CSV 文件
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleVisitFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {visitFile && (
                <p className="mt-2 text-sm text-gray-600">
                  已选择: <span className="font-medium">{visitFile.name}</span>
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={importVisitNotes}
                disabled={!visitFile || isLoading}
                className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '导入中...' : '导入看房记录'}
              </button>
              <button
                onClick={downloadCsvTemplate}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                下载模板
              </button>
            </div>

            {errors.visitNotes.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-red-800 mb-2">错误 ({errors.visitNotes.length})</h4>
                <pre className="text-xs text-red-600 whitespace-pre-wrap overflow-auto max-h-40">
                  {formatValidationErrors(errors.visitNotes)}
                </pre>
              </div>
            )}

            {warnings.visitNotes.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-yellow-800 mb-2">警告 ({warnings.visitNotes.length})</h4>
                <pre className="text-xs text-yellow-600 whitespace-pre-wrap overflow-auto max-h-40">
                  {formatValidationErrors(warnings.visitNotes)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">导入完整项目</h3>
        <p className="text-sm text-gray-500 mb-4">
          可以导入之前导出的完整项目 JSON 文件，恢复所有数据（包括房源、看房记录、短名单、评分配置等）。
        </p>
        
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择项目文件
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleProjectFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {projectFile && (
              <p className="mt-2 text-sm text-gray-600">
                已选择: <span className="font-medium">{projectFile.name}</span>
              </p>
            )}
          </div>
          <button
            onClick={importProject}
            disabled={!projectFile || isLoading}
            className="px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            导入项目
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">数据格式说明</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">houses.json 格式</h4>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-64">
{`[
  {
    "id": "house_001",
    "name": "阳光花园两居室",
    "address": "朝阳区建国路88号",
    "monthlyRent": 6500,
    "deposit": 13000,
    "depositType": "押二付一",
    "area": 78,
    "floor": "12/28层",
    "orientation": "南北通透",
    "commuteTime": 35,
    "commuteType": "地铁",
    "contractTerm": 12,
    "agencyFee": 3250,
    "additionalFees": [
      {
        "name": "物业费",
        "amount": 150,
        "period": "月付"
      }
    ],
    "landlordPromises": [
      "签约后配全新洗衣机",
      "允许养宠物"
    ],
    "visitDate": "2026-04-29",
    "contactPerson": "王经理",
    "contactPhone": "13800138001",
    "notes": "小区环境不错"
  }
]`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-2">visit-notes.csv 格式</h4>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-64">
{`id,houseId,visitDate,lighting,noise,waterLeak,waterLeakDescription,odor,odorDescription,repairItems,applianceStatus,surroundingSafety,generalNotes,pendingQuestions,photos
visit_001,house_001,2026-04-29,5,4,否,,否,,[{"item":"厨房水龙头","severity":"轻微","needsLandlordRepair":true}],[{"name":"空调","status":"正常","notes":""}],5,整体感觉不错,[{"question":"物业费包含什么？","status":"待确认","answer":""}],

说明：
- lighting: 采光评分 1-5
- noise: 噪音评分 1-5
- waterLeak/odor: 是/否
- repairItems: JSON数组
- applianceStatus: JSON数组
- surroundingSafety: 安全评分 1-5
- pendingQuestions: JSON数组`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataImport;
