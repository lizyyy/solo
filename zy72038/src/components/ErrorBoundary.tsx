import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 border border-slate-700 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                出现了一些问题
              </h2>
              <p className="text-slate-400 mb-6">
                应用遇到了意外错误，但您的数据是安全的。
              </p>
            </div>

            {this.state.error && (
              <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                <p className="text-red-400 text-sm font-mono mb-2">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-400">
                      查看详细错误信息
                    </summary>
                    <pre className="mt-2 text-xs text-slate-500 overflow-auto max-h-32">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                重试操作
              </button>
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors"
              >
                <Home className="w-5 h-5" />
                刷新页面
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <p className="text-slate-500 text-xs text-center">
                如果问题持续存在，请联系技术支持或检查配置数据格式
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
