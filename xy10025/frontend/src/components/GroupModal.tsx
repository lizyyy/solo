import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../store/appStore';

interface Props {
  onClose: () => void;
}

export default function GroupModal({ onClose }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { createGroup } = useAppStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createGroup(name, description || undefined);
      onClose();
    } catch (err) {
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">创建分组</h3>
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
                分组名称
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="如：室友、同事、旅行"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                描述（可选）
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="描述这个分组的用途..."
              />
            </div>
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
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
