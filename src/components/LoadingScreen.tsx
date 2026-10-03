import { useEffect, useState } from 'react'

export function LoadingScreen() {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const slow = setTimeout(() => setStage(1), 8000)
    const verySlow = setTimeout(() => setStage(2), 20000)
    return () => {
      clearTimeout(slow)
      clearTimeout(verySlow)
    }
  }, [])
  const text =
    stage === 2
      ? "This is taking longer than usual — check your internet connection. We'll keep trying."
      : stage === 1
        ? 'Still connecting… please wait'
        : 'Loading…'
  return (
    <div className="screen center-screen" role="status">
      <div className="loader-spin" />
      <div className="loader-text" style={{ maxWidth: 360 }}>{text}</div>
    </div>
  )
}
