import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Could hook to analytics service here
    console.warn('ErrorBoundary caught error:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onReset === 'function') this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#111827] to-[#1f2937] text-gray-200 px-6 py-10">
          <div className="card-glow p-8 w-full max-w-md rounded-2xl border border-white/10 bg-black/40 text-center">
            <h1 className="text-2xl font-semibold mb-3 bg-gradient-to-r from-red-400 to-pink-500 bg-clip-text text-transparent">Something went wrong</h1>
            <p className="text-sm text-gray-400 mb-6">An unexpected error occurred while rendering this view. You can try reloading or resetting the session.</p>
            <div className="space-x-3">
              <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-md bg-white/10 border border-white/20 hover:border-red-400/60 hover:bg-red-500/10 transition text-sm">Reload</button>
              <button onClick={this.handleReset} className="px-4 py-2 rounded-md bg-white/10 border border-white/20 hover:border-cyan-400/60 hover:bg-cyan-500/10 transition text-sm">Reset</button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mt-6 text-xs text-left max-h-56 overflow-auto bg-black/30 p-3 rounded-lg border border-white/10">
                {String(this.state.error?.message || this.state.error)}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
