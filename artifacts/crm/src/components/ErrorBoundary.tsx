import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production wire this to Sentry / Datadog
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          An unexpected error occurred. Try refreshing the page.
        </p>
        <p className="text-xs text-muted-foreground font-mono bg-muted rounded px-3 py-2 max-w-sm truncate">
          {error.message}
        </p>
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-6 text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }
}
