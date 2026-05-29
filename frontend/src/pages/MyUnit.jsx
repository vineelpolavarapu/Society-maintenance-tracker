import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { getUnitDues } from '../api/units'

function fmt(v) {
  return '₹' + parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export default function MyUnit() {
  const { user } = useAuth()
  const unitId = user?.unit_id

  const { data, isLoading } = useQuery({
    queryKey: ['unit-dues', unitId],
    queryFn: () => getUnitDues(unitId).then(r => r.data),
    enabled: !!unitId,
  })

  if (!unitId) {
    return (
      <section>
        <div className="page-head">
          <div><h1>My Unit</h1></div>
        </div>
        <div className="ro-banner">
          <span>ℹ</span>
          <span>No unit is linked to your account. Contact the Treasurer or Secretary.</span>
        </div>
      </section>
    )
  }

  const history = data?.history ?? []
  const currentCycle = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()
  const current = history.find(h => h.cycle === currentCycle)
  const outstanding = history.reduce((acc, h) => {
    if (h.status === 'unpaid' || h.status === 'partial') {
      acc += parseFloat(h.charge_amount) - parseFloat(h.paid_amount)
    }
    return acc
  }, 0)

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>My Unit — {data?.unit_identifier ?? '—'}</h1>
          <p>Your own charges and payment history. Payments are recorded by the Treasurer.</p>
        </div>
        <span className="readonly-pill">🔒 Read-only</span>
      </div>

      {isLoading ? (
        <p style={{color:'var(--ink-faint)'}}>Loading…</p>
      ) : (
        <>
          <div className="stat-row" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
            <div className="stat">
              <div className="label">This cycle</div>
              {current ? (
                <>
                  <div className={`val${current.status === 'paid' ? ' pos' : current.status === 'partial' ? '' : ' neg'}`}>
                    {current.status === 'paid' ? 'Paid' : current.status === 'partial' ? 'Partial' : 'Unpaid'}
                  </div>
                  <div className="sub">{fmt(current.paid_amount)} paid of {fmt(current.charge_amount)}</div>
                </>
              ) : (
                <>
                  <div className="val" style={{fontSize:16,color:'var(--ink-faint)'}}>No charge</div>
                  <div className="sub">Not raised yet</div>
                </>
              )}
            </div>
            <div className="stat">
              <div className="label">Outstanding</div>
              <div className={`val${outstanding > 0 ? ' neg' : ''}`}>{fmt(outstanding)}</div>
              <div className="sub">{outstanding > 0 ? 'total dues pending' : 'no dues pending'}</div>
            </div>
            <div className="stat">
              <div className="label">Total cycles</div>
              <div className="val" style={{fontSize:18}}>{history.length}</div>
              <div className="sub">in history</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Charges &amp; payments</h2>
              <span className="hint">{data?.unit_identifier}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th style={{textAlign:'right'}}>Charge</th>
                  <th style={{textAlign:'right'}}>Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={4} style={{color:'var(--ink-faint)',textAlign:'center',padding:'32px'}}>No charges found.</td></tr>
                ) : history.map(h => (
                  <tr key={h.cycle}>
                    <td className="mono">{h.cycle}</td>
                    <td className="num">{parseFloat(h.charge_amount).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    <td className="num">{parseFloat(h.paid_amount).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    <td>
                      {h.status === 'paid' && <span className="chip paid">● Settled</span>}
                      {h.status === 'partial' && <span className="chip partial">◐ Partial</span>}
                      {h.status === 'unpaid' && <span className="chip unpaid">○ Unpaid</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="footnote">
            In Phase 1 residents cannot record or confirm their own payments — this view reflects exactly what the Treasurer has entered.
          </div>
        </>
      )}
    </section>
  )
}
