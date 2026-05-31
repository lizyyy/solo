import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg max-h-[80vh] bg-space-900 border border-tech-cyan/30 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-tech-cyan/20">
          <h3 className="font-orbitron text-lg text-tech-cyan tracking-wider">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-space-800 rounded transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
