import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Check,
  Camera,
  Printer,
  Clock,
  User,
  Phone,
  Gem,
  Scale,
  DollarSign,
  Calendar
} from 'lucide-react';
import { useRepairStore } from '../store';
import { RepairStatus, statusLabels } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { Modal } from '../components/Modal';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders, updateStatus, confirmQuote, pickupOrder, calculateOverdueFee, exportOrderForSignature, currentUser, addPhoto } = useRepairStore();
  const order = orders.find(o => o.id === id);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<RepairStatus>(RepairStatus.REGISTERED);
  const [statusNote, setStatusNote] = useState('');
  const [quotePrice, setQuotePrice] = useState(0);
  const [pickupData, setPickupData] = useState({
    pickerName: '',
    pickerPhone: '',
    pickerIdCard: '',
    paidAmount: 0
  });

  if (!order) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">订单不存在</p>
        <button
          onClick={() => navigate('/orders')}
          className="mt-4 text-blue-600 hover:underline"
        >
          返回列表
        </button>
      </div>
    );
  }

  const overdueFee = calculateOverdueFee(order);
  const totalAmount = (order.finalPrice || order.estimatedPrice || 0) + overdueFee - (order.deposit || 0);

  const handleUpdateStatus = () => {
    updateStatus(order.id, selectedStatus, statusNote);
    setStatusModalOpen(false);
    setStatusNote('');
  };

  const handleConfirmQuote = () => {
    confirmQuote(order.id, { finalPrice: quotePrice, confirmedBy: currentUser });
    setQuoteModalOpen(false);
  };

  const handlePickup = () => {
    pickupOrder(order.id, pickupData);
    setPickupModalOpen(false);
  };

  const handleExportSignature = () => {
    const content = exportOrderForSignature(order);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${order.orderNo}_取件确认单.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddPhoto = () => {
    const photoUrl = prompt('请输入照片URL（演示用）');
    if (photoUrl) {
      addPhoto(order.id, photoUrl, '首饰照片');
    }
  };

  const canEdit = order.status !== RepairStatus.PICKED_UP && order.status !== RepairStatus.CANCELLED;
  const canQuote = canEdit && !order.quoteConfirmedAt;
  const canPickup = order.status === RepairStatus.COMPLETED;

  const availableStatuses = [
    RepairStatus.ESTIMATING,
    RepairStatus.QUOTED,
    RepairStatus.REPAIRING,
    RepairStatus.COMPLETED,
    RepairStatus.CANCELLED
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/orders')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{order.orderNo}</h1>
            <p className="text-sm text-gray-500">
              登记于 {format(new Date(order.registeredAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })} · {order.registeredBy}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StatusBadge status={order.status} />
          {canEdit && (
            <>
              <button
                onClick={() => setStatusModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                更新状态
              </button>
              {canQuote && (
                <button
                  onClick={() => {
                    setQuotePrice(order.estimatedPrice || 0);
                    setQuoteModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  确认报价
                </button>
              )}
              {canPickup && (
                <button
                  onClick={() => {
                    setPickupData(prev => ({
                      ...prev,
                      pickerName: order.customerName,
                      pickerPhone: order.customerPhone,
                      paidAmount: Math.max(0, totalAmount)
                    }));
                    setPickupModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  办理取件
                </button>
              )}
            </>
          )}
          <button
            onClick={handleExportSignature}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-4 h-4" />
            导出确认单
          </button>
        </div>
      </div>

      {order.status === RepairStatus.PICKED_UP && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-green-800">
            <strong>已取件</strong> · {order.pickerName} · {order.pickerPhone} · 
            {order.pickedUpAt && format(new Date(order.pickedUpAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
          </p>
        </div>
      )}

      {overdueFee > 0 && order.status !== RepairStatus.PICKED_UP && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-800">
            <strong>⚠️ 逾期提醒</strong> · 已产生逾期保管费 ¥{overdueFee}
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">客户信息</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">客户姓名</p>
                  <p className="font-medium text-gray-800">{order.customerName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">联系电话</p>
                  <p className="font-medium text-gray-800">{order.customerPhone}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800">首饰信息</h2>
              <button
                onClick={handleAddPhoto}
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <Camera className="w-4 h-4" />
                添加照片
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="flex items-start gap-3">
                <Gem className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">首饰名称</p>
                  <p className="font-medium text-gray-800">{order.jewelryName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Gem className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">材质</p>
                  <p className="font-medium text-gray-800">{order.jewelryMaterial || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Gem className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">钻石数量</p>
                  <p className="font-medium text-gray-800">{order.diamondCount || 0} 颗</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Scale className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">重量</p>
                  <p className="font-medium text-gray-800">{order.weight || '-'} g</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-2">详细描述</p>
              <p className="text-gray-800">{order.jewelryDescription}</p>
            </div>
            {order.photos.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-4">首饰照片</p>
                <div className="grid grid-cols-4 gap-4">
                  {order.photos.map(photo => (
                    <div key={photo.id} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img src={photo.url} alt={photo.description} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">状态历史</h2>
            <Timeline history={order.statusHistory} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">费用信息</h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">预估费用</span>
                <span className="font-medium">¥{order.estimatedPrice || '-'}</span>
              </div>
              {order.quoteConfirmedAt && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">确认维修费</span>
                    <span className="font-medium text-green-600">¥{order.finalPrice}</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    确认于 {format(new Date(order.quoteConfirmedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })} · {order.quoteConfirmedBy}
                  </p>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">押金</span>
                <span className="font-medium">¥{order.deposit || 0}</span>
              </div>
              {overdueFee > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>逾期保管费</span>
                  <span className="font-medium">¥{overdueFee}</span>
                </div>
              )}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-800">应收金额</span>
                  <span className="text-xl font-bold text-gray-800">¥{Math.max(0, totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">取件信息</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">预计取件日期</p>
                  <p className="font-medium text-gray-800">
                    {order.estimatedPickupDate
                      ? format(new Date(order.estimatedPickupDate), 'yyyy年MM月dd日', { locale: zhCN })
                      : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {order.note && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">备注</h2>
              <p className="text-gray-600">{order.note}</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={statusModalOpen} onClose={() => setStatusModalOpen(false)} title="更新订单状态">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">选择状态</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as RepairStatus)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableStatuses.map(status => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">备注（可选）</label>
            <textarea
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button
              onClick={() => setStatusModalOpen(false)}
              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleUpdateStatus}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              确认更新
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={quoteModalOpen} onClose={() => setQuoteModalOpen(false)} title="确认报价">
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>重要提示：</strong>报价确认后，客户将按此价格支付。确认后将无法修改，请确保金额正确。
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">最终维修费用（元）</label>
            <input
              type="number"
              value={quotePrice}
              onChange={(e) => setQuotePrice(parseFloat(e.target.value) || 0)}
              min="0"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button
              onClick={() => setQuoteModalOpen(false)}
              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirmQuote}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              确认报价
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={pickupModalOpen} onClose={() => setPickupModalOpen(false)} title="办理取件">
        <div className="space-y-4">
          {totalAmount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>应收金额：¥{Math.max(0, totalAmount)}</strong>
              </p>
              {overdueFee > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  含逾期保管费 ¥{overdueFee}
                </p>
              )}
            </div>
          )}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>重要提示：</strong>取件前请与客户核对首饰外观、钻石数量，确认无误后再办理取件。
              建议客户签字确认。
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">取件人姓名 *</label>
            <input
              type="text"
              value={pickupData.pickerName}
              onChange={(e) => setPickupData(prev => ({ ...prev, pickerName: e.target.value }))}
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">取件人电话 *</label>
            <input
              type="tel"
              value={pickupData.pickerPhone}
              onChange={(e) => setPickupData(prev => ({ ...prev, pickerPhone: e.target.value }))}
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">取件人身份证号</label>
            <input
              type="text"
              value={pickupData.pickerIdCard}
              onChange={(e) => setPickupData(prev => ({ ...prev, pickerIdCard: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">实付金额（元）*</label>
            <input
              type="number"
              value={pickupData.paidAmount}
              onChange={(e) => setPickupData(prev => ({ ...prev, paidAmount: parseFloat(e.target.value) || 0 }))}
              min="0"
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button
              onClick={() => setPickupModalOpen(false)}
              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handlePickup}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              确认取件
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
