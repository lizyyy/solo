import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  showSettings?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}

export default function Header({
  title,
  showBack = false,
  showSettings = false,
  onBack,
  rightContent,
}: HeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center">
          {showBack && (
            <button
              onClick={handleBack}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors mr-2"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}
          <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
        </div>
        
        {rightContent || (
          showSettings && (
            <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          )
        )}
      </div>
    </header>
  );
}
