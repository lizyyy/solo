import { useState } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';
import { useAuditStore } from '../store/auditStore';

interface RerunCommandButtonProps {
  command: string;
  size?: 'sm' | 'md';
}

export function RerunCommandButton({ command, size = 'md' }: RerunCommandButtonProps) {
  const { copyCommand } = useAuditStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyCommand(command);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5';

  return (
    <div className="flex items-center gap-2">
      <code className={`font-mono bg-gray-100 text-gray-700 ${sizeClasses} border border-gray-300 overflow-hidden text-ellipsis`}>
        <Terminal className="w-3.5 h-3.5 inline mr-1.5 text-gray-500" />
        {command}
      </code>
      <button
        onClick={handleCopy}
        className="p-1.5 hover:bg-gray-200 transition-colors border border-gray-300 bg-white"
        title="复制可重跑命令"
      >
        {copied ? (
          <Check className="w-4 h-4 text-success-500" />
        ) : (
          <Copy className="w-4 h-4 text-gray-500" />
        )}
      </button>
    </div>
  );
}
