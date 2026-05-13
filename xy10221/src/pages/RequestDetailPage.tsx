import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { storageService } from '../services/storage';
import { validationService, type ValidationContext } from '../services/validation';
import { StatusBadge } from '../components/StatusBadge';
import { ValidationCheckDisplay } from '../components/ValidationCheckDisplay';
import type { ExchangeRequest, ExchangeStatus } from '../types';
import { ArrowLeft, RefreshCw, Play, CheckCircle, XCircle, History } from 'lucide-react';

const statusFlow: ExchangeStatus[] = [
  'pending_validation',
  'validation_passed',
  'inventory_checking',
  'inventory_available',
  'processing',
  'shipped',
  'completed',
];

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<ExchangeRequest | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = () => {
    if (!id) return;
    const req = storageService.getExchangeRequestById(id);
    setRequest(req || null);
  };

  const handleValidate = () => {
    if (!request) return;

    const context: ValidationContext = { operator: '当前用户' };
    const result = validationService.validateRequest(request, context);
    const history = validationService.createValidationHistory(result, context);

    const updatedRequest: ExchangeRequest = {
      ...request,
      currentValidationResult: result,
      validationHistory: [...request.validationHistory, history],
      status: result.overallStatus === 'passed' ? 'validation_passed' : 
              result.overallStatus === 'retry' ? 'pending_validation' : 'validation_failed',
      retryCount: result.overallStatus !== 'passed' ? request.retryCount + 1 : request.retryCount,
    };

    storageService.updateExchangeRequest(updatedRequest);
    setRequest(updatedRequest);
  };

  const needsInventoryLock = (status: ExchangeStatus) => {
    return ['inventory_available', 'processing', 'shipped'].includes(status);
  };

  const handleAdvanceStatus = () => {
    if (!request) return;

    const currentIndex = statusFlow.indexOf(request.status);
    if (currentIndex >= 0 && currentIndex < statusFlow.length - 1) {
      const nextStatus = statusFlow[currentIndex + 1];
      
      if (nextStatus === 'inventory_checking') {
        const available = storageService.getAvailableInventory(
          request.uniformType,
          request.requestedSize
        );
        const inventory = storageService.getInventoryItem(
          request.uniformType,
          request.requestedSize
        );
        
        if (available <= 0) {
          const updatedRequest: ExchangeRequest = {
            ...request,
            status: 'inventory_unavailable',
          };
          storageService.updateExchangeRequest(updatedRequest);
          setRequest(updatedRequest);
          alert(`库存不足！总库存: ${inventory?.quantity || 0}, 已锁定: ${inventory?.lockedQuantity || 0}, 可用: ${available}`);
          return;
        }
      }

      if (nextStatus === 'inventory_available') {
        const locked = storageService.lockInventory(
          request.uniformType,
          request.requestedSize,
          1
        );
        if (!locked) {
          alert('锁定库存失败，可能库存已被其他申请占用');
          return;
        }
      }

      if (nextStatus === 'completed') {
        const deducted = storageService.deductInventory(
          request.uniformType,
          request.requestedSize,
          1
        );
        if (!deducted) {
          alert('扣减库存失败，请检查库存状态');
          return;
        }
        storageService.returnInventory(
          request.uniformType,
          request.originalSize,
          1
        );
      }

      const updatedRequest: ExchangeRequest = {
        ...request,
        status: nextStatus,
      };
      storageService.updateExchangeRequest(updatedRequest);
      setRequest(updatedRequest);
    }
  };

  const handleCancel = () => {
    if (!request) return;
    if (window.confirm('确定要取消此申请吗？')) {
      if (needsInventoryLock(request.status)) {
        storageService.unlockInventory(
          request.uniformType,
          request.requestedSize,
          1
        );
      }
      
      const updatedRequest: ExchangeRequest = {
        ...request,
        status: 'cancelled',
      };
      storageService.updateExchangeRequest(updatedRequest);
      setRequest(updatedRequest);
    }
  };

  if (!request) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/requests')}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500">未找到该申请记录</p>
        </div>
      </div>
    );
  }

  const student = storageService.getStudentById(request.studentId);
  const classInfo = storageService.getClassById(request.classId);
  const distribution = storageService.getDistributionById(request.relatedDistributionId);
  const inventory = storageService.getInventoryItem(request.uniformType, request.requestedSize);

  const canAdvance = 
    statusFlow.includes(request.status) && 
    statusFlow.indexOf(request.status) < statusFlow.length - 1 &&
    request.status !== 'pending_validation' &&
    request.status !== 'validation_failed' &&
    request.status !== 'inventory_unavailable';

  const canValidate = 
    request.status === 'pending_validation' || 
    (request.currentValidationResult?.overallStatus === 'retry' && request.retryCount < 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/requests')}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
        <div className="flex gap-3">
          {canValidate && (
            <button
              onClick={handleValidate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              {request.currentValidationResult ? '重新验证' : '开始验证'}
            </button>
          )}
          {canAdvance && (
            <button
              onClick={handleAdvanceStatus}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Play className="w-4 h-4" />
              推进状态
            </button>
          )}
          {request.status !== 'completed' && request.status !== 'cancelled' && (
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              <XCircle className="w-4 h-4" />
              取消申请
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">申请信息</h3>
            </div>
            <div className="p-6 grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500">申请编号</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{request.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">创建时间</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{request.createdAt}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">创建人</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{request.createdBy}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">当前状态</p>
                <div className="mt-1"><StatusBadge status={request.status} type="exchange" /></div>
              </div>
              <div>
                <p className="text-sm text-gray-500">服装类型</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{request.uniformType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">尺码变化</p>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {request.originalSize} → {request.requestedSize}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">换领原因</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{request.reason}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">验证结果</h3>
              {request.currentValidationResult && (
                <StatusBadge 
                  status={request.currentValidationResult.overallStatus} 
                  type="validation" 
                />
              )}
            </div>
            <div className="p-6">
              {request.currentValidationResult ? (
                <ValidationCheckDisplay result={request.currentValidationResult} />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>尚未进行验证</p>
                  <p className="text-sm mt-1">点击上方"开始验证"按钮进行验证</p>
                </div>
              )}
            </div>
          </div>

          {request.validationHistory.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div 
                className="px-6 py-4 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setShowHistory(!showHistory)}
              >
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-gray-500" />
                  <h3 className="text-lg font-medium text-gray-900">验证历史</h3>
                  <span className="text-sm text-gray-500">({request.validationHistory.length} 次)</span>
                </div>
                <span className="text-sm text-gray-500">{showHistory ? '收起' : '展开'}</span>
              </div>
              {showHistory && (
                <div className="divide-y divide-gray-200">
                  {request.validationHistory.slice().reverse().map((history, index) => (
                    <div key={history.id} className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            第 {request.validationHistory.length - index} 次验证
                          </p>
                          <p className="text-xs text-gray-500">
                            {history.timestamp} · {history.operator}
                          </p>
                        </div>
                        <StatusBadge status={history.result} type="validation" />
                      </div>
                      <div className="space-y-2">
                        {history.checks.map((check, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded text-sm ${
                              check.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {check.name}: {check.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">学生信息</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">姓名</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{student?.name || '未知'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">学号</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{student?.studentNo || '未知'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">班级</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{classInfo?.name || '未知'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">尺码是否生效</p>
                <p className="text-sm font-medium mt-1">
                  {student?.isSizeActive ? (
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      已生效
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <XCircle className="w-4 h-4" />
                      未生效
                    </span>
                  )}
                </p>
              </div>
              {student && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500 mb-2">登记尺码</p>
                  <div className="space-y-1">
                    {Object.entries(student.registeredSize).map(([type, size]) => (
                      <div key={type} className="flex justify-between text-sm">
                        <span className="text-gray-500">{type}</span>
                        <span className="font-medium text-gray-900">{size}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {distribution && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">关联发放记录</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-500">发放日期</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{distribution.distributionDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">发放人</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{distribution.distributor}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">发放尺码</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{distribution.distributedSize}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">接收签字</p>
                  <p className="text-sm font-medium mt-1">
                    {distribution.recipientSignature ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        已签字
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <XCircle className="w-4 h-4" />
                        未签字
                      </span>
                    )}
                  </p>
                </div>
                {distribution.notes && (
                  <div>
                    <p className="text-sm text-gray-500">备注</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">{distribution.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {inventory && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">目标库存</h3>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between">
                  <p className="text-sm text-gray-500">总库存</p>
                  <p className="text-sm font-medium text-gray-900">{inventory.quantity} 件</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-sm text-gray-500">已锁定</p>
                  <p className="text-sm font-medium text-yellow-600">{inventory.lockedQuantity} 件</p>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <p className="text-sm text-gray-500">可用库存</p>
                  <p className={`text-sm font-medium ${inventory.quantity - inventory.lockedQuantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {inventory.quantity - inventory.lockedQuantity} 件
                  </p>
                </div>
                <div className="pt-2">
                  <p className="text-sm text-gray-500">存放位置</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{inventory.location}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">状态流程</h3>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {statusFlow.map((status, index) => {
                  const currentIndex = statusFlow.indexOf(request.status);
                  const isCurrent = status === request.status;
                  const isPast = statusFlow.indexOf(status) < currentIndex;
                  const isFuture = statusFlow.indexOf(status) > currentIndex;
                  
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        isCurrent ? 'bg-blue-600' : 
                        isPast ? 'bg-green-600' : 'bg-gray-300'
                      }`} />
                      <span className={`text-sm ${
                        isCurrent ? 'text-blue-600 font-medium' : 
                        isPast ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {(() => {
                          const badge = <StatusBadge status={status} type="exchange" />;
                          return badge.props.children;
                        })()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
