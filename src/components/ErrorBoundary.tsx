/**
 * App-level error boundary with retry UX (v1.1 follow-up).
 *
 * Catches render/lifecycle errors anywhere under it, shows a friendly
 * fallback, and lets the host or participant retry without a hard reload:
 * reset bumps a key so the failed subtree fully remounts.
 */
import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  attempt: number
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private retry = (): void => {
    this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))
  }

  render(): ReactNode {
    const { error, attempt } = this.state
    if (error === null) {
      return <Fragment key={attempt}>{this.props.children}</Fragment>
    }
    return (
      <div className="screen center-screen">
        <h2 className="phase-title">Something went wrong</h2>
        <p className="phase-prompt">The room hit an unexpected error. Your session may still be safe — try again.</p>
        <p className="loader-text">{error.message}</p>
        <div className="wishing-footer">
          <button type="button" className="btn2 orange" onClick={this.retry}>
            Try again
          </button>
        </div>
      </div>
    )
  }
}
