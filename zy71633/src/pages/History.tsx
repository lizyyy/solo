import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RecordList } from '../components/History/RecordList';

export function HistoryPage() {
  return (
    <div className="relative">
      <div className="absolute top-4 left-4 z-10">
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2 bg-space-800/90 backdrop-blur-md rounded-lg border border-cyber-500/30 hover:border-cyber-500 transition-all duration-200 text-white font-jetbrains text-sm"
        >
          <ArrowLeft size={16} className="text-cyber-500" />
          返回演示台
        </Link>
      </div>
      <RecordList />
    </div>
  );
}
