// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Boom({ message }: { message: string }): never {
  throw new Error(message)
}

let shouldThrow = true
function Flaky(): React.ReactNode {
  if (shouldThrow) throw new Error('flaky render')
  return <p>recovered content</p>
}

describe('ErrorBoundary (retry UX)', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>healthy</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('healthy')).toBeDefined()
  })

  it('catches a render error and shows the fallback with a retry action', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary>
        <Boom message="RTDB unavailable" />
      </ErrorBoundary>,
    )
    expect(screen.queryByText('healthy')).toBeNull()
    expect(screen.getByText('RTDB unavailable')).toBeDefined()
    expect(screen.getByRole('button', { name: /try again/i })).toBeDefined()
    expect(screen.getByText(/something went wrong/i)).toBeDefined()
  })

  it('retry remounts children so a recovered tree renders again', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    shouldThrow = true
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('button', { name: /try again/i })).toBeDefined()
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByText('recovered content')).toBeDefined()
  })

  it('shows a retry action even for errors thrown by nested subtrees', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary>
        <div>
          <div>
            <Boom message="deep failure" />
          </div>
        </div>
      </ErrorBoundary>,
    )
    expect(screen.getByRole('button', { name: /try again/i })).toBeDefined()
  })
})
