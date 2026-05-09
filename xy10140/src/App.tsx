import { useState, useEffect, useMemo, useCallback } from 'react';
import { TableState, ReplayCommand, ValidationError, TableRow } from './types';
import { getStateFromURL, setStateToURL, clearURLState, getDefaultState, statesEqual } from './utils/urlState';
import { executeCommand } from './utils/idempotent';
import { MOCK_DATA } from './data/mockData';
import { applyTableState } from './utils/tableFilter';
import FilterPanel from './components/FilterPanel';
import DataTable from './components/DataTable';
import ActionBar from './components/ActionBar';

export default function App() {
  const [initialLoad, setInitialLoad] = useState(true);
  const [urlErrors, setUrlErrors] = useState<ValidationError[]>([]);
  const [state, setState] = useState<TableState>(getDefaultState());
  const [lastCommandResult, setLastCommandResult] = useState<ReplayCommand['result']>();
  const [data] = useState<TableRow[]>(MOCK_DATA);

  useEffect(() => {
    if (initialLoad) {
      const { state: loadedState, errors } = getStateFromURL();
      setUrlErrors(errors);
      setState(loadedState);
      setInitialLoad(false);
    }
  }, [initialLoad]);

  useEffect(() => {
    if (!initialLoad && !statesEqual(state, getDefaultState())) {
      setStateToURL(state);
    }
  }, [state, initialLoad]);

  const filterResult = useMemo(() => {
    return applyTableState(data, state);
  }, [data, state]);

  const handleStateChange = useCallback((newState: TableState) => {
    setState(newState);
  }, []);

  const handleSort = useCallback((field: string) => {
    setState(prev => {
      let sort = prev.sort;
      if (sort?.field === field) {
        if (sort.direction === 'asc') {
          sort = { field, direction: 'desc' };
        } else {
          sort = null;
        }
      } else {
        sort = { field, direction: 'asc' };
      }
      return { ...prev, sort };
    });
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setState(prev => {
      const selected = prev.selectedIds.includes(id)
        ? prev.selectedIds.filter(x => x !== id)
        : [...prev.selectedIds, id];
      return { ...prev, selectedIds: selected };
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setState(prev => {
      const pageIds = filterResult.rows.map(r => r.id);
      const allSelected = pageIds.length > 0 && pageIds.every(id => prev.selectedIds.includes(id));
      
      let newSelected: string[];
      if (allSelected) {
        newSelected = prev.selectedIds.filter(id => !pageIds.includes(id));
      } else {
        newSelected = Array.from(new Set([...prev.selectedIds, ...pageIds]));
      }
      return { ...prev, selectedIds: newSelected };
    });
  }, [filterResult.rows]);

  const handlePageChange = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, page },
    }));
  }, []);

  const handleRestoreState = useCallback((s: TableState) => {
    setState(s);
    setUrlErrors([]);
  }, []);

  const handleExecuteCommand = useCallback(async (cmd: ReplayCommand) => {
    const executor = async (s: TableState) => {
      const result = applyTableState(data, s);
      return {
        rows: result.rows,
        errors: result.errors,
      };
    };

    const { command, rows } = await executeCommand(cmd, executor);
    setLastCommandResult(command.result);
    
    if (!statesEqual(command.state, state)) {
      setState(command.state);
    }
    
    if (rows.length > 0) {
      console.log('执行返回数据:', rows.length, '条');
    }
  }, [data, state]);

  const handleReset = useCallback(() => {
    setState(getDefaultState());
    setLastCommandResult(undefined);
    setUrlErrors([]);
    clearURLState();
  }, []);

  const totalCount = useMemo(() => {
    const stateWithoutPagination = {
      ...state,
      pagination: { page: 1, pageSize: Infinity },
    };
    return applyTableState(data, stateWithoutPagination).rows.length;
  }, [data, state]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-800">表格筛选状态回放</h1>
          <p className="text-sm text-gray-500 mt-1">
            支持 URL 持久化、历史记录、可复验命令、报告导出，坏数据不静默跳过，重复执行幂等
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <ActionBar
          state={state}
          totalCount={totalCount}
          filteredData={filterResult.rows}
          urlErrors={urlErrors}
          onRestoreState={handleRestoreState}
          onExecuteCommand={handleExecuteCommand}
          onReset={handleReset}
          lastCommandResult={lastCommandResult}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <FilterPanel
              state={state}
              onChange={handleStateChange}
            />
          </div>

          <div className="lg:col-span-3">
            <DataTable
              rows={filterResult.rows}
              state={state}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              onSort={handleSort}
              totalCount={totalCount}
              onPageChange={handlePageChange}
              groupedData={filterResult.groupedData}
            />
          </div>
        </div>

        {state.selectedIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800">
              已选择 <strong>{state.selectedIds.length}</strong> 条记录。
              这些 ID 也会保存到 URL 和历史记录中，刷新或分享链接后可恢复。
            </p>
            <p className="text-sm text-blue-600 mt-1">
              示例: {state.selectedIds.slice(0, 5).join(', ')}
              {state.selectedIds.length > 5 && ' ...'}
            </p>
          </div>
        )}

        {filterResult.errors.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="font-medium text-yellow-800 mb-2">筛选执行警告（未静默跳过）：</p>
            <ul className="list-disc list-inside text-sm text-yellow-700">
              {filterResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-medium text-gray-800 mb-3">功能说明</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-700">状态持久化</h3>
              <ul className="list-disc list-inside mt-1">
                <li>点击「复制链接」生成包含所有筛选状态的 URL</li>
                <li>刷新页面或打开链接会自动恢复状态</li>
                <li>选中项、排序、分组、筛选条件全部包含</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-700">历史记录</h3>
              <ul className="list-disc list-inside mt-1">
                <li>「保存历史」可保存当前状态到本地</li>
                <li>重复状态自动去重，更新时间戳</li>
                <li>最多保留 50 条历史</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-700">可复验命令（幂等）</h3>
              <ul className="list-disc list-inside mt-1">
                <li>「保存命令」创建可复验的筛选命令</li>
                <li>重复执行相同状态会命中缓存，结果一致</li>
                <li>命令可复制 JSON 分享给他人</li>
                <li>执行失败会重试（非永久错误）</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-700">错误处理与导出</h3>
              <ul className="list-disc list-inside mt-1">
                <li>坏数据不静默跳过，错误信息会显示</li>
                <li>支持导出 JSON 报告、CSV 数据、ZIP 包</li>
                <li>ZIP 包包含说明文档便于追溯</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
