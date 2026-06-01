import React from 'react';
import { AlertTriangle, RotateCcw, Download } from 'lucide-react';
import { generateCsvContent, copyToClipboard } from '../services/exportService';
import type { GameState } from '../types';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  gameState?: GameState | null;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.reload();
  };

  handleExportEmergency = async (): Promise<void> => {
    if (this.props.gameState) {
      try {
        const content = generateCsvContent(this.props.gameState);
        await copyToClipboard(content);
        alert('数据已复制到剪贴板！请粘贴保存后再刷新页面。');
      } catch (err) {
        alert('复制失败，请手动复制下方数据:\n\n' + JSON.stringify(this.props.gameState?.records || []));
      }
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-800 border-2 border-red-700 rounded-xl p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-red-400">出现了问题</h2>
                <p className="text-gray-400 text-sm">程序遇到了意外错误</p>
              </div>
            </div>

            <div className="bg-slate-900 rounded-lg p-4 mb-6 font-mono text-sm overflow-auto max-h-40">
              <div className="text-red-400 font-bold mb-2">错误信息:</div>
              <div className="text-gray-300">{this.state.error?.message || '未知错误'}</div>
              {this.state.errorInfo && (
                <div className="mt-4 text-gray-500 text-xs">
                  <div className="font-bold mb-1">组件栈:</div>
                  <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                </div>
              )}
            </div>

            <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4 mb-6">
              <div className="text-amber-400 font-bold mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                重要提示
              </div>
              <p className="text-amber-200 text-sm">
                为了避免数据丢失，建议先导出当前游戏数据，再刷新页面。
              </p>
            </div>

            <div className="flex gap-3">
              {this.props.gameState && this.props.gameState.records.length > 0 && (
                <button
                  onClick={this.handleExportEmergency}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-colors"
                >
                  <Download className="w-5 h-5" />
                  导出数据
                </button>
              )}
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                重置游戏
              </button>
            </div>

            <div className="mt-6 text-center text-gray-500 text-sm">
              如果问题持续出现，请联系技术支持并提供上方的错误信息。
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
