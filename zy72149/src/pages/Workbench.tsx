import FilterBar from '../components/workbench/FilterBar';
import MaterialTable from '../components/workbench/MaterialTable';
import ExceptionPanel from '../components/workbench/ExceptionPanel';
import EditModal from '../components/workbench/EditModal';

const Workbench = () => {
  return (
    <div className="flex h-[calc(100vh-64px)]">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-full">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800">复核工作台</h1>
            <p className="text-sm text-slate-500 mt-1">
              在这里审核音频素材的情绪标签，处理异常情况，所有修改自动保存
            </p>
          </div>

          <FilterBar />
          <MaterialTable />
        </div>
      </div>

      <ExceptionPanel />
      <EditModal />
    </div>
  );
};

export default Workbench;
