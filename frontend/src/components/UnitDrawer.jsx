import { useQuery } from '@tanstack/react-query'
import { getUnitHistory } from '../api/units'

const MONTHS = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May']

function PayGrid({ history }) {
  const rows = []
  for (let r = 0; r < Math.ceil(history.length / 12); r++) {
    rows.push(history.slice(r * 12, r * 12 + 12))
  }
  const now = new Date()
  const startYr = now.getFullYear() - Math.floor(history.length / 12) + (now.getMonth() >= 5 ? 1 : 0)

  return (
    <>
      <div className="pay-grid">
        {rows.map((rowData, ri) => {
          const baseYr = startYr + ri - 1
          const label = `${baseYr}-${String(baseYr + 1).slice(2)}`
          return (
            <div key={ri} className="pay-row">
              <div className="pay-yr">{label}</div>
              <div className="pay-months-wrap">
                {rowData.map((item, mi) => (
                  <div key={mi} className={`pay-cell st-${item.status}`}>
                    <div className="pay-tip">{MONTHS[mi]} · {item.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div className="pay-axis">
        <div className="pay-axis-sp" />
        <div className="pay-axis-months">
          {MONTHS.map(m => <div key={m} className="pay-axis-m">{m}</div>)}
        </div>
      </div>
      <div className="pay-legend">
        <div className="pay-leg-item"><div className="pay-leg-dot" style={{background:'#2da44e'}} />Paid</div>
        <div className="pay-leg-item"><div className="pay-leg-dot" style={{background:'#f0b429'}} />Partial</div>
        <div className="pay-leg-item"><div className="pay-leg-dot" style={{background:'#eef0f3',border:'1px solid #d2d7e0'}} />Unpaid</div>
        <div className="pay-leg-item"><div className="pay-leg-dot" style={{background:'#f4f5f7',border:'1px dashed #d2d7e0'}} />Future</div>
      </div>
    </>
  )
}

export default function UnitDrawer({ unitId, unitIdentifier, onClose }) {
  const isOpen = !!unitId
  const { data, isLoading } = useQuery({
    queryKey: ['unit-history', unitId],
    queryFn: () => getUnitHistory(unitId).then(r => r.data),
    enabled: !!unitId,
  })

  const paidCount = data?.paid_count ?? 0
  const pending = data?.pending_dues ?? '0'
  const initials = unitIdentifier ? unitIdentifier.slice(0, 2).toUpperCase() : '??'

  return (
    <>
      <div className={`drw-overlay${isOpen ? ' open' : ''}`} onClick={onClose} />
      <div className={`drw${isOpen ? ' open' : ''}`}>
        <div className="drw-head">
          <div className="avatar-lg">{initials}</div>
          <div style={{flex:1}}>
            <div className="drw-name">{unitIdentifier ?? '—'}</div>
            <div className="drw-unit-label">{data?.unit_type ?? '—'}</div>
          </div>
          <button className="drw-close" onClick={onClose}>✕</button>
        </div>
        <div className="drw-body">
          {isLoading ? (
            <p style={{color:'var(--ink-faint)'}}>Loading…</p>
          ) : data ? (
            <>
              <div className="ds-row">
                <div className="ds-card">
                  <div className="ds-lbl">Months paid</div>
                  <div className="ds-val pos">{paidCount}</div>
                  <div className="ds-sub">of last 24</div>
                </div>
                <div className="ds-card">
                  <div className="ds-lbl">Pending dues</div>
                  <div className={`ds-val${parseFloat(pending) > 0 ? ' neg' : ''}`}>
                    ₹{parseFloat(pending).toLocaleString('en-IN')}
                  </div>
                  <div className="ds-sub">{parseFloat(pending) > 0 ? 'outstanding' : 'all clear'}</div>
                </div>
                <div className="ds-card">
                  <div className="ds-lbl">Rate</div>
                  <div className="ds-val" style={{fontSize:'16px'}}>
                    ₹{parseFloat(data.history.find(h=>h.charge_amount)?.charge_amount ?? 0).toLocaleString('en-IN')}
                  </div>
                  <div className="ds-sub">per cycle</div>
                </div>
              </div>
              <div className="grid-head">Payment history — 24 months</div>
              <PayGrid history={data.history} />
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
