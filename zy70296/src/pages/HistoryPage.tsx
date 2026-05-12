import { StoreType } from '../store/useStore';
import { History, Film, RefreshCw, AlertTriangle, Download, Printer, FileText } from 'lucide-react';

interface HistoryPageProps {
  store: StoreType;
}

const HistoryPage = ({ store }: HistoryPageProps) => {
  const { state } = store;

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      pickup: FileText,
      print: Printer,
      reprint_request: RefreshCw,
      reprint_review: RefreshCw,
      abnormal: AlertTriangle,
      export: Download
    };
    return icons[type] || History;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pickup: '取片',
      print: '打印',
      reprint_request: '补打申请',
      reprint_review: '补打审核',
      abnormal: '异常',
      export: '导出'
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      pickup: 'bg-blue-100 text-blue-600',
      print: 'bg-green-100 text-green-600',
      reprint_request: 'bg-yellow-100 text-yellow-600',
      reprint_review: 'bg-purple-100 text-purple-600',
      abnormal: 'bg-red-100 text-red-600',
      export: 'bg-gray-100 text-gray-600'
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
  };

  const formatDetails = (details: Record<string, any>) => {
    const entries = Object.entries(details).filter(([key]) => !key.startsWith('_'));
    if (entries.length === 0) return '无详细信息';
    return entries.map(([key, value]) => {
      const keyLabel = {
        examNo: '检查号',
        patientName: '患者姓名',
        pickupCode: '取片码',
        reason: '原因',
        filmCount: '胶片数量',
        printer: '打印机',
        type: '类型',
        description: '描述',
        resolution: '处理方案',
        comment: '审核意见',
        recordCount: '记录数'
      }[key] || key;
      
      return `${keyLabel}: ${value}`;
    }).join(' | ');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-orange-100 p-2 rounded-lg">
            <History className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">历史记录</h2>
            <p className="text-sm text-gray-500">查看所有操作历史和变更追踪</p>
          </div>
        </div>

        {state.history.length > 0 ? (
          <div className="space-y-4">
            {state.history.map((entry, index) => {
              const Icon = getTypeIcon(entry.type);
              const isFirst = index === 0;
              
              return (
                <div key={entry.id} className="flex">
                  <div className="flex flex-col items-center mr-4">
                    <div className={`p-2 rounded-full ${getTypeColor(entry.type)}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {!isFirst && (
                      <div className="w-0.5 h-full bg-gray-200 mt-2" />
                    )}
                  </div>
                  
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(entry.type)}`}>
                            {getTypeLabel(entry.type)}
                          </span>
                          <h3 className="font-medium text-gray-900">{entry.action}</h3>
                        </div>
                        <p className="text-sm text-gray-600">
                          {formatDetails(entry.details)}
                        </p>
                        {entry.operatorName && (
                          <p className="text-xs text-gray-500 mt-1">
                            操作人：{entry.operatorName}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 whitespace-nowrap ml-4">
                        {new Date(entry.timestamp).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">暂无操作历史记录</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Printer className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">打印记录</p>
              <p className="text-xl font-bold text-gray-900">{state.printRecords.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <RefreshCw className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">补打申请</p>
              <p className="text-xl font-bold text-gray-900">{state.reprintRequests.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-red-100 p-2 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">异常记录</p>
              <p className="text-xl font-bold text-gray-900">{state.abnormalRecords.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
