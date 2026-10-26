import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Rafeeqi:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl border border-rose-100 dark:border-rose-900 text-center">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              حدث خطأ غير متوقع
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              نعتذر عن هذا الخطأ. بياناتك وأدويتك محفوظة بأمان في جهازك.
            </p>
            {this.state.error?.message && (
              <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-3 text-xs text-rose-600 dark:text-rose-400 font-mono mb-6 text-start overflow-x-auto">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full h-12 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow-md"
            >
              <RefreshCw className="w-5 h-5" />
              إعادة تشغيل التطبيق
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
