import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-[#1e1e1e] text-white">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-bold mb-4 text-red-400">Something went wrong</h2>
            <p className="text-gray-300 mb-4">
              An error occurred while rendering this component. Please try refreshing the page.
            </p>

            {this.state.error && (
              <details className="mt-4 p-4 bg-[#2d2d30] rounded border border-gray-600">
                <summary className="cursor-pointer text-sm text-gray-400 mb-2">
                  Error Details
                </summary>
                <pre className="text-xs text-red-300 whitespace-pre-wrap overflow-auto max-h-32">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  this.setState({
                    hasError: false,
                    error: undefined,
                    errorInfo: undefined,
                    retryCount: this.state.retryCount + 1
                  });
                }}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Try Again {this.state.retryCount > 0 && `(${this.state.retryCount})`}
              </button>

              {this.state.retryCount >= 2 && (
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  Reload Page
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
