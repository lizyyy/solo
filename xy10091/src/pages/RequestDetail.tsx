import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, BookOpen, CreditCard, MapPin, AlertTriangle, CheckCircle, XCircle, Clock, Check, Truck, History, MessageSquare } from 'lucide-react';
import dayjs from 'dayjs';
import { requestsApi } from '../api';
import { actionMap, type ReviewHistory } from '../types';
import StatusBadge from '../components/StatusBadge';
import ReviewModal from '../components/ReviewModal';

function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [showReviewModal, setShowReviewModal] = useState<'approve' | 'reject' | 'abnormal' | 'ship' | null>(null);

  const { data: request, isLoading, error, refetch } = useQuery({
    queryKey: ['request', id],
    queryFn: () => requestsApi.getById(id!).then(res => res.data),
    enabled: !!id,
  });

  const { data: history } = useQuery({
    queryKey: ['request-history', id],
    queryFn: () => requestsApi.getHistory(id!).then(res => res.data),
    enabled: !!id,
  });

  const handleSuccess = () => {
    setShowReviewModal(null);
    queryClient.invalidateQueries({ queryKey: ['request', id] });
    queryClient.invalidateQueries({ queryKey: ['requests'] });
    queryClient.invalidateQueries({ queryKey: ['request-history', id] });
    queryClient.invalidateQueries({ queryKey: ['report'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">加载申请详情失败</p>
          <button onClick={() => refetch()} className="btn-primary">
            重试
          </button>
        </div>
      </div>
    );
  }

  const canReview = request.reviewStatus === 'pending' || request.reviewStatus === 'abnormal';
  const canShip = request.reviewStatus === 'approved' && !request.trackingNumber;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/requests')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-gray-900">
              申请详情 <span className="font-mono text-primary-600">{request.requestNo}</span>
            </h2>
            <StatusBadge status={request.reviewStatus} />
          </div>
          <p className="text-gray-500 text-sm mt-1">
            申请时间：{dayjs(request.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {canReview && (
            <>
              <button
                onClick={() => setShowReviewModal('abnormal')}
                className="btn-warning flex items-center space-x-2"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>标记异常</span>
              </button>
              <button
                onClick={() => setShowReviewModal('reject')}
                className="btn-danger flex items-center space-x-2"
              >
                <XCircle className="w-4 h-4" />
                <span>拒绝</span>
              </button>
              <button
                onClick={() => setShowReviewModal('approve')}
                className="btn-success flex items-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>通过</span>
              </button>
            </>
          )}
          {canShip && (
            <button
              onClick={() => setShowReviewModal('ship')}
              className="btn-primary flex items-center space-x-2"
            >
              <Truck className="w-4 h-4" />
              <span>录入快递</span>
            </button>
          )}
        </div>
      </div>

      {request.abnormalReason && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-orange-800">异常信息</h4>
            <p className="text-sm text-orange-700 mt-1">{request.abnormalReason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header flex items-center space-x-2">
              <User className="w-5 h-5 text-primary-600" />
              <span>学员信息</span>
            </div>
            <div className="card-body grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">姓名</label>
                <p className="font-medium">{request.student.name}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">手机号</label>
                <p className="font-medium">{request.student.phone}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">身份证号</label>
                <p className="font-medium font-mono">{request.student.idCard}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">邮箱</label>
                <p className="font-medium">{request.student.email || '-'}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-primary-600" />
              <span>完课记录核对</span>
            </div>
            <div className="card-body">
              {request.courseRecord ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">课程名称</label>
                      <p className="font-medium">{request.courseRecord.courseName}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">课程代码</label>
                      <p className="font-medium font-mono">{request.courseRecord.courseCode}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">入学时间</label>
                      <p className="font-medium">{dayjs(request.courseRecord.enrollmentDate).format('YYYY-MM-DD')}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">完成时间</label>
                      <p className="font-medium">
                        {request.courseRecord.completionDate
                          ? dayjs(request.courseRecord.completionDate).format('YYYY-MM-DD')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">课程成绩</label>
                      <p className="font-medium">{request.courseRecord.score ?? '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">证书已发放</label>
                      <p className="font-medium">
                        {request.courseRecord.certificateIssued ? (
                          <span className="text-green-600">✓ 已发放</span>
                        ) : (
                          <span className="text-red-600">✗ 未发放</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {request.courseRecord.completionStatus === 'completed' ? (
                      <span className="badge bg-green-100 text-green-800">
                        <Check className="w-3 h-3 mr-1" /> 已完成
                      </span>
                    ) : (
                      <span className="badge bg-yellow-100 text-yellow-800">
                        <Clock className="w-3 h-3 mr-1" /> 未完成
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>未找到完课记录</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-primary-600" />
              <span>缴费记录核对</span>
            </div>
            <div className="card-body">
              {request.paymentRecord ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">课程费用</label>
                      <p className="font-medium">¥{request.paymentRecord.amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">支付方式</label>
                      <p className="font-medium">{request.paymentRecord.paymentMethod || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">支付时间</label>
                      <p className="font-medium">
                        {request.paymentRecord.paymentDate
                          ? dayjs(request.paymentRecord.paymentDate).format('YYYY-MM-DD')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">交易流水号</label>
                      <p className="font-medium font-mono">{request.paymentRecord.transactionId || '-'}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <label className="text-sm text-gray-500">补发费用（¥{request.paymentRecord.reissueFee.toFixed(2)}）</label>
                    <div className="flex items-center space-x-2 mt-1">
                      {request.paymentRecord.reissueFeePaid ? (
                        <span className="badge bg-green-100 text-green-800">
                          <Check className="w-3 h-3 mr-1" /> 已支付
                        </span>
                      ) : (
                        <span className="badge bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3 mr-1" /> 未支付
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>未找到缴费记录</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-primary-600" />
              <span>邮寄地址核对</span>
            </div>
            <div className="card-body">
              {request.mailingAddress ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">收件人</label>
                      <p className="font-medium">{request.mailingAddress.name}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">联系电话</label>
                      <p className="font-medium">{request.mailingAddress.phone}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">收件地址</label>
                    <p className="font-medium">
                      {request.mailingAddress.province}
                      {request.mailingAddress.city}
                      {request.mailingAddress.district}
                      {request.mailingAddress.address}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">邮政编码</label>
                    <p className="font-medium">{request.mailingAddress.postalCode || '-'}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>未找到邮寄地址</p>
                </div>
              )}
            </div>
          </div>

          {request.trackingNumber && (
            <div className="card">
              <div className="card-header flex items-center space-x-2">
                <Truck className="w-5 h-5 text-primary-600" />
                <span>物流信息</span>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">快递单号</label>
                    <p className="font-medium font-mono">{request.trackingNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">发货时间</label>
                    <p className="font-medium">
                      {request.shippedAt ? dayjs(request.shippedAt).format('YYYY-MM-DD HH:mm') : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-primary-600" />
              <span>补发原因</span>
            </div>
            <div className="card-body">
              <p className="text-gray-700">{request.reason}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {request.reviewedAt && (
            <div className="card">
              <div className="card-header flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-primary-600" />
                <span>审核信息</span>
              </div>
              <div className="card-body space-y-3">
                <div>
                  <label className="text-sm text-gray-500">审核状态</label>
                  <div className="mt-1">
                    <StatusBadge status={request.reviewStatus} />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">审核人</label>
                  <p className="font-medium">{request.reviewerName || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">审核时间</label>
                  <p className="font-medium">{dayjs(request.reviewedAt).format('YYYY-MM-DD HH:mm')}</p>
                </div>
                {request.reviewComment && (
                  <div>
                    <label className="text-sm text-gray-500">审核意见</label>
                    <p className="font-medium">{request.reviewComment}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header flex items-center space-x-2">
              <History className="w-5 h-5 text-primary-600" />
              <span>操作历史</span>
            </div>
            <div className="card-body">
              {history && history.length > 0 ? (
                <div className="relative">
                  {history.map((item, index) => (
                    <HistoryItem key={item.id} item={item} isLast={index === history.length - 1} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  暂无操作记录
                </div>
              )}
            </div>
          </div>

          <div className="card bg-blue-50 border-blue-200">
            <div className="card-header text-blue-800 border-blue-200">
              审核要点
            </div>
            <div className="card-body text-sm text-blue-700 space-y-2">
              <p>• 确认学员完课记录是否完整</p>
              <p>• 确认缴费是否完成</p>
              <p>• 确认补发费用是否支付</p>
              <p>• 确认邮寄地址是否完整</p>
              <p>• 如有异常请标记并说明原因</p>
            </div>
          </div>
        </div>
      </div>

      {showReviewModal && (
        <ReviewModal
          type={showReviewModal}
          requestId={id!}
          onClose={() => setShowReviewModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

function HistoryItem({ item, isLast }: { item: ReviewHistory; isLast: boolean }) {
  return (
    <div className="flex items-start space-x-3 pb-4">
      <div className="relative">
        <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${
          item.action === 'approved' ? 'bg-green-500' :
          item.action === 'rejected' ? 'bg-red-500' :
          item.action === 'abnormal' ? 'bg-orange-500' :
          item.action === 'shipped' ? 'bg-blue-500' :
          'bg-gray-400'
        }`} />
        {!isLast && (
          <div className="absolute left-1.5 top-4 bottom-0 w-px bg-gray-200" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-sm text-gray-900">
            {actionMap[item.action] || item.action}
          </span>
          {item.operatorName && (
            <span className="text-xs text-gray-500">
              操作人：{item.operatorName}
            </span>
          )}
        </div>
        {item.comment && (
          <p className="text-sm text-gray-600 mt-0.5">{item.comment}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">
          {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss')}
        </p>
      </div>
    </div>
  );
}

export default RequestDetail;
