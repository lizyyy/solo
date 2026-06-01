import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });
    console.error('应用错误:', error, errorInfo);
  }

  handleReset = (): void => {
    localStorage.clear();
    window.location.reload();
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
              应用发生错误
            </h2>

            <p className="text-center text-gray-600 mb-6">
              抱歉，应用运行时遇到了问题。您可以尝试以下操作：
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-700 font-mono break-all">
                {this.state.error?.message || '未知错误'}
              </p>
              {this.state.errorInfo && (
                <details className="mt-2">
                  <summary className="text-xs text-red-500 cursor-pointer">
                    查看详细错误信息
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-40">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                <RefreshCw className="w-5 h-5" />
                刷新页面
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                <Home className="w-5 h-5" />
                重置所有数据
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 mt-4">
              如果问题持续存在，请联系技术支持
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
