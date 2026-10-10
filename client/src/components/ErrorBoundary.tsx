import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-paper p-4">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-brick/10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-brick" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-heading text-ink mb-2">Something went wrong</h1>
            <p className="text-body text-ink-soft mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-moss hover:bg-moss-light text-white px-6 py-3 rounded-md font-medium"
            >
              Refresh Page
            </button>
            {this.state.error && (
              <details className="mt-6 text-left text-xs text-ink-soft bg-paper-2 p-3 rounded border border-hairline">
                <summary className="cursor-pointer font-medium mb-2">Error Details</summary>
                <pre className="overflow-auto max-h-40">{this.state.error.message}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}