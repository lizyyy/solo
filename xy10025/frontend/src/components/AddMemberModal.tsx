import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../store/appStore';

interface Props {
  groupId: string;
  onClose: () => void;
}

export default function AddMemberModal({ groupId, onClose }: Props) {
  const [username, setUsername] = useState('');
  const { addMember, loadGroups, selectedGroup, selectGroup } = useAppStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await addMember(groupId, username);
      await loadGroups();
      if (selectedGroup) {
        const updatedGroup = (await useAppStore.getState().groups).find(
          (g) => g.id === selectedGroup.id,
        );
        if (updatedGroup) {
          await selectGroup(updatedGroup);
        }
      }
      onClose();
    } catch (err) {
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">添加成员</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              用户名
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="输入要添加的用户的用户名"
            />
            <p className="text-xs text-gray-500 mt-1">
              该用户需要先注册账户
            </p>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              添加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
