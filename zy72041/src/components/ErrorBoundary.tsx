import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          onRefresh={this.handleRefresh}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

const ErrorFallback: React.FC<{
  error: Error | null;
  onRefresh: () => void;
  onGoHome: () => void;
}> = ({ error, onRefresh, onGoHome }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 animate-fade-in">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-danger-100 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-danger-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2 font-serif">
            出现了一些问题
          </h2>
          <p className="text-gray-600">
            地铁客流解谜局遇到了意外错误，请尝试以下操作：
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">错误描述：</h3>
          <p className="text-sm text-danger-600 font-mono break-all">
            {error?.message || '未知错误'}
          </p>
        </div>

        <div className="space-y-3">
          <div className="bg-warning-50 border-l-4 border-warning-500 p-4 rounded-r-lg">
            <h4 className="text-sm font-semibold text-warning-800 mb-1">可能的原因：</h4>
            <ul className="text-sm text-warning-700 space-y-1 list-disc list-inside">
              <li>浏览器存储数据损坏</li>
              <li>网络连接异常</li>
              <li>页面脚本加载失败</li>
            </ul>
          </div>

          <div className="bg-subway-50 border-l-4 border-subway-500 p-4 rounded-r-lg">
            <h4 className="text-sm font-semibold text-subway-800 mb-1">建议操作：</h4>
            <ul className="text-sm text-subway-700 space-y-1 list-disc list-inside">
              <li>点击刷新按钮重新加载页面</li>
              <li>清除浏览器缓存后重试</li>
              <li>返回首页重新开始</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onRefresh}
            className="flex-1 flex items-center justify-center gap-2 bg-subway-600 hover:bg-subway-700 text-white py-3 px-4 rounded-lg transition-all duration-200 hover:shadow-lg"
          >
            <RefreshCw className="w-5 h-5" />
            刷新页面
          </button>
          <button
            onClick={onGoHome}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-lg transition-all duration-200"
          >
            <Home className="w-5 h-5" />
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorBoundary;
