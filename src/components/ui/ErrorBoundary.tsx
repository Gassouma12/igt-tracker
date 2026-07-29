import { Component, type ReactNode } from 'react'
import { Button } from './primitives'

// Top-level render guard: without this, one uncaught error in any component
// unmounts the whole React tree and the user is left on a blank page mid-work.
// Class component because React has no hook/native equivalent for error catching.
type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[app] render error', error, info)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="card max-w-md p-8 text-center">
          <h1 className="font-display text-xl font-bold text-ink">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-mute">
            The page hit an unexpected error. Your saved data is safe — reloading usually fixes it.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-surface-2 p-3 text-left text-xs text-danger">
              {error.message}
            </pre>
          )}
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Reload the app
          </Button>
        </div>
      </div>
    )
  }
}
