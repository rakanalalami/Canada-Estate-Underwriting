import React from 'react'

/**
 * Last line of defence for corrupt saved state.
 *
 * Everything this app knows lives in one browser's localStorage, so a record
 * the current build cannot read has no server copy to fall back on. Without a
 * boundary the result is a blank page with no way out — and no way to reach the
 * reset button, because the reset button is part of the page that just died.
 * This keeps a recovery path visible, and offers the data as a JSON download
 * before anything is cleared.
 */
interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

const STORAGE_KEY = 'ottawa-underwriting-v1'

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Underwriting app crashed', error, info)
  }

  private download = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? '{}'
      const blob = new Blob([raw], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ottawa-underwriting-backup.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      /* storage unreadable — nothing to hand back */
    }
  }

  private reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* private mode — the reload below still clears in-memory state */
    }
    window.location.hash = ''
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
        <div className="card w-full max-w-lg p-6">
          <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The app could not render with the data currently saved in this browser. This is almost
            always a saved deal written by an older version.
          </p>

          <pre className="mono mt-4 max-h-32 overflow-auto rounded-md border border-line bg-raised p-3 text-2xs text-muted">
            {this.state.error.message}
          </pre>

          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn" onClick={() => window.location.reload()}>
              Reload the page
            </button>
            <button className="btn" onClick={this.download}>
              Download a backup first
            </button>
            <button className="btn-danger" onClick={this.reset}>
              Clear saved data and start fresh
            </button>
          </div>

          <p className="mt-4 text-2xs leading-relaxed text-subtle">
            Clearing removes every saved deal, the simulator setup and your investor profile from
            this browser. Nothing is stored anywhere else, so this cannot be undone — take the backup
            first if any of it matters.
          </p>
        </div>
      </div>
    )
  }
}
