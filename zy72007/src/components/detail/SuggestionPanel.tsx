import { Lightbulb, Edit2, Save, X } from 'lucide-react';
import { useState } from 'react';

interface SuggestionPanelProps {
  suggestion: string;
  onEdit?: (newSuggestion: string) => void;
  editable?: boolean;
}

export default function SuggestionPanel({ suggestion, onEdit, editable = false }: SuggestionPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(suggestion);

  const handleSave = () => {
    onEdit?.(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(suggestion);
    setIsEditing(false);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Lightbulb className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900">处理建议</h3>
        </div>
        {editable && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            <span>修改建议</span>
          </button>
        )}
      </div>
      {isEditing ? (
        <div>
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full p-3 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={6}
          />
          <div className="flex justify-end space-x-2 mt-3">
            <button
              onClick={handleCancel}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              <span>取消</span>
            </button>
            <button
              onClick={handleSave}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>保存</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed">
          {suggestion}
        </div>
      )}
    </div>
  );
}
