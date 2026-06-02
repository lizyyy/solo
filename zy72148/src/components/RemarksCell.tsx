import { useState, useRef, useEffect } from 'react';
import { Check, Edit3, Loader2 } from 'lucide-react';

interface RemarksCellProps {
  value: string;
  onSave: (value: string) => void;
}

export const RemarksCell = ({ value, onSave }: RemarksCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setTimeout(() => {
      onSave(editValue);
      setIsSaving(false);
      setIsEditing(false);
      setShowCheck(true);
      setTimeout(() => setShowCheck(false), 600);
    }, 200);
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="relative w-full">
        <textarea
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 text-sm border border-primary-400 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none min-h-[60px]"
          placeholder="点击添加备注..."
        />
        {isSaving && (
          <div className="absolute right-2 top-2">
            <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="group flex items-start gap-2 min-h-[40px] py-1 cursor-pointer hover:bg-gray-50 rounded px-2 -mx-2"
      onClick={() => setIsEditing(true)}
    >
      <span className={`flex-1 text-sm ${value ? 'text-gray-700' : 'text-gray-400 italic'}`}>
        {value || '点击添加备注...'}
      </span>
      {showCheck ? (
        <Check className="w-4 h-4 text-green-500 flex-shrink-0 animate-check" />
      ) : (
        <Edit3 className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
      )}
    </div>
  );
};
