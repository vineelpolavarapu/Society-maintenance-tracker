import { useState, useEffect, useRef } from 'react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MIN_YR = 2024
const MAX_YR = new Date().getFullYear()

export default function CalendarPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [yr, setYr] = useState(() => parseInt(value?.split('-')[0] ?? MAX_YR))
  const ref = useRef(null)

  const selMo = value ? parseInt(value.split('-')[1]) - 1 : -1
  const selYr = value ? parseInt(value.split('-')[0]) : -1

  useEffect(() => {
    function outside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  const pick = (mo) => {
    onChange(`${yr}-${String(mo + 1).padStart(2, '0')}`)
    setOpen(false)
  }

  const label = value
    ? `${MONTHS[parseInt(value.split('-')[1]) - 1]} ${value.split('-')[0]}`
    : 'Select month'

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn" onClick={() => setOpen(o => !o)}>
        ▣ <span>{label}</span> ▾
      </button>
      {open && (
        <div className="cal-picker" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300 }}>
          <div className="cal-yr-row">
            <button className="cal-yr-btn" disabled={yr <= MIN_YR} onClick={() => setYr(y => y - 1)}>‹</button>
            <span className="cal-yr-label">{yr}</span>
            <button className="cal-yr-btn" disabled={yr >= MAX_YR} onClick={() => setYr(y => y + 1)}>›</button>
          </div>
          <div className="cal-months-grid">
            {MONTHS.map((m, i) => {
              const isSel = yr === selYr && i === selMo
              const isFuture = yr > MAX_YR || (yr === MAX_YR && i > new Date().getMonth())
              return (
                <button
                  key={m}
                  className={`cal-m${isSel ? ' active' : ''}`}
                  disabled={isFuture}
                  onClick={() => pick(i)}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
