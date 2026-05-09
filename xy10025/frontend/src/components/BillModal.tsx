import { useState, FormEvent, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../store/appStore';
import { Bill, User } from '../types';

interface Props {
  groupId: string;
  members: User[];
  currentUserId: string;
  editingBill: Bill | null;
  onClose: () => void;
}

interface Share {
  userId: string;
  amount: number;
}

export default function BillModal({
  groupId,
  members,
  currentUserId,
  editingBill,
  onClose,
}: Props) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidByUserId, setPaidByUserId] = useState(currentUserId);
  const [shares, setShares] = useState<Share[]>([]);
  const [changeDescription, setChangeDescription] = useState('');

  const { createBill, updateBill, deleteBill, selectedGroup, loadBills } = useAppStore();

  useEffect(() => {
    if (editingBill) {
      setTitle(editingBill.title);
      setAmount(String(editingBill.amount));
      setDescription(editingBill.description || '');
      setDate(new Date(editingBill.date).toISOString().split('T')[0]);
      setPaidByUserId(editingBill.paidByUserId);
      setShares(
        editingBill.shares.map((s) => ({
          userId: s.userId,
          amount: Number(s.amount),
        })),
      );
    } else if (members.length > 0) {
      const shareAmount = 0;
      setShares(members.map((m) => ({ userId: m.id, amount: shareAmount })));
    }
  }, [editingBill, members, currentUserId]);

  const shareTotal = shares.reduce((sum, s) => sum + s.amount, 0);
  const amountNum = parseFloat(amount) || 0;
  const isBalanced = Math.abs(shareTotal - amountNum) < 0.01;

  const handleShareAmountChange = (userId: string, value: string) => {
    const newAmount = parseFloat(value) || 0;
    setShares(shares.map((s) => (s.userId === userId ? { ...s, amount: newAmount } : s)));
  };

  const handleSplitEvenly = () => {
    if (amountNum > 0 && shares.length > 0) {
      const shareAmount = amountNum / shares.length;
      const roundedShare = Math.round(shareAmount * 100) / 100;
      const remainder = Math.round((amountNum - roundedShare * shares.length) * 100);

      setShares(
        shares.map((s, index) => ({
          ...s,
          amount: roundedShare + (index < remainder ? 0.01 : 0),
        })),
      );
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!isBalanced) {
      alert('分摊金额总和必须等于账单总金额');
      return;
    }

    try {
      const requestId = uuidv4();
      const data = {
        title,
        amount: amountNum,
        description: description || undefined,
        date: new Date(date),
        groupId,
        paidByUserId,
        shares: shares.map((s) => ({
          userId: s.userId,
          amount: s.amount,
          percentage: amountNum > 0 ? (s.amount / amountNum) * 100 : 0,
        })),
        requestId,
      };

      if (editingBill) {
        await updateBill(editingBill.id, {
          ...data,
          changeDescription: changeDescription || undefined,
          expectedVersion: editingBill.version,
        });
      } else {
        await createBill(data);
      }

      if (selectedGroup) {
        await loadBills(selectedGroup.id);
      }
      onClose();
    } catch (err: any) {
      const message = err.response?.data?.message || '操作失败';
      alert(message);
    }
  };

  const handleDelete = async () => {
    if (editingBill && confirm('确定要删除这个账单吗？')) {
      try {
        await deleteBill(editingBill.id);
        onClose();
      } catch (err) {
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-medium text-gray-900">
            {editingBill ? '编辑账单' : '新建账单'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                账单标题 *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="如：晚餐、打车、电费"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  金额 *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日期 *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                描述
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="可选的详细描述..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                付款人 *
              </label>
              <select
                value={paidByUserId}
                onChange={(e) => setPaidByUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName || member.username}
                  </option>
                ))}
              </select>
            </div>

            {editingBill && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  修改说明
                </label>
                <input
                  type="text"
                  value={changeDescription}
                  onChange={(e) => setChangeDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="描述这次修改的原因..."
                />
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  分摊明细 *
                </label>
                <button
                  type="button"
                  onClick={handleSplitEvenly}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  平均分摊
                </button>
              </div>
              <div
                className={`p-4 rounded-lg border ${
                  isBalanced ? 'border-gray-200' : 'border-red-300 bg-red-50'
                }`}
              >
                <div className="space-y-3">
                  {shares.map((share) => {
                    const member = members.find((m) => m.id === share.userId);
                    return (
                      <div key={share.userId} className="flex items-center space-x-3">
                        <span className="w-24 text-sm text-gray-700 truncate">
                          {member?.displayName || member?.username}
                        </span>
                        <div className="flex-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={share.amount || ''}
                            onChange={(e) =>
                              handleShareAmountChange(share.userId, e.target.value)
                            }
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0.00"
                          />
                        </div>
                        {amountNum > 0 && (
                          <span className="text-xs text-gray-500 w-16 text-right">
                            {((share.amount / amountNum) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t">
                  <span className="text-sm text-gray-600">
                    分摊合计: ¥{shareTotal.toFixed(2)}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      isBalanced ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {isBalanced
                      ? '✓ 已平衡'
                      : `差额: ¥${(shareTotal - amountNum).toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-6">
            <div>
              {editingBill && editingBill.status !== 'settled' && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md flex items-center"
                >
                  <Trash2 size={16} className="mr-1" />
                  删除
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!isBalanced}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingBill ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
