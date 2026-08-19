import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4 text-2xl">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h1 className="text-xl font-extrabold mb-2 text-slate-100">Terjadi Kesalahan Aplikasi</h1>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            Aplikasi mengalami kesalahan saat memproses data. Anda dapat memuat ulang halaman untuk melanjutkan.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold rounded-xl text-sm transition shadow-lg shadow-yellow-400/20 cursor-pointer flex items-center gap-2"
            >
              <i className="fa-solid fa-rotate-right"></i>
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
