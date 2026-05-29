import { useState } from 'react'

function currentCycle() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function useCycle() {
  const [cycle, setCycle] = useState(currentCycle)
  return { cycle, setCycle }
}
