import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMaintenanceDashboard } from '../api/dashboard'
import { raiseBulkCharges } from '../api/charges'
import { getCharges } from '../api/charges'
import { useAuth } from '../contexts/AuthContext'
import { useCycle } from '../hooks/useCycle'
import CalendarPicker from '../components/CalendarPicker'
import PaymentModal from '../components/PaymentModal'
import UnitDrawer from '../components/UnitDrawer'

function fmt(v) {
  return '₹' + parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export default function MaintenanceDashboard() {
  const { user } = useAuth()
  const isTreasurer = user?.role === 'treasurer'
  const { cycle, setCycle } = useCycle()
  const [showPayment, setShowPayment] = useState(false)
  const [drawerUnit, setDrawerUnit] = useState(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance-dashboard', cycle],
    queryFn: () => getMaintenanceDashboard(cycle).then(r => r.data),
  })

  const { data: chargesData } = useQuery({
    queryKey: ['charges', cycle],
    queryFn: () => getCharges({ cycle }).then(r => r.data),
    enabled: isTreasurer,
  })

  const raiseMut = useMutation({
    mutationFn: () => raiseBulkCharges({ cycle }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance-dashboard'] }),
  })

  const units = data?.units ?? []
  const monthLabel = cycle
    ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(cycle.split('-')[1]) - 1]} ${cycle.split('-')[0]}`
    : ''

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Maintenance Dashboard</h1>
          <p>Monthly dues — who has paid, who is outstanding, and the collected total.</p>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:10}}>
          <span className={`readonly-pill${isTreasurer ? ' write' : ''}`}>
            {isTreasurer ? '✎ Treasurer — entry enabled' : '🔒 Read-only view'}
          </span>
          <CalendarPicker value={cycle} onChange={setCycle} />
        </div>
      </div>

      {isTreasurer && (
        <div className="write-controls" style={{marginBottom:20}}>
          <button className="btn primary" disabled={raiseMut.isPending} onClick={() => raiseMut.mutate()}>
            ＋ Raise charges ({cycle})
          </button>
          <button className="btn" onClick={() => setShowPayment(true)}>＋ Record payment</button>
        </div>
      )}
      {!isTreasurer && (
        <div className="ro-banner">
          <span>🔒</span>
          <span>You can see every record in full. Only the Treasurer can add or change entries.</span>
        </div>
      )}

      {raiseMut.data && (
        <div className="ok-msg" style={{marginBottom:16}}>
          Raised {raiseMut.data.data.created} charges. {raiseMut.data.data.skipped} already existed.
        </div>
      )}

      {isLoading ? (
        <p style={{color:'var(--ink-faint)'}}>Loading…</p>
      ) : data ? (
        <>
          <div className="stat-row" style={{gridTemplateColumns:'1fr 2fr 1fr'}}>
            <div className="stat">
              <div className="label">Units paid</div>
              <div className="val">{data.units_paid} / {data.total_units}</div>
              <div className="sub">{data.total_units - data.units_paid} pending</div>
            </div>
            <div className="stat split-card">
              <div className="split-card-label">{monthLabel} — Activity</div>
              <div className="split-card-body">
                <div className="split-half">
                  <div className="label">▲ Collected</div>
                  <div className="val pos">{fmt(data.collected)}</div>
                  <div className="sub">{data.units_paid} of {data.total_units} units</div>
                </div>
                <div className="split-divider" />
                <div className="split-half">
                  <div className="label">Outstanding dues</div>
                  <div className="val neg">{fmt(data.outstanding)}</div>
                  <div className="sub">{data.total_units - data.units_paid} units unpaid/partial</div>
                </div>
              </div>
            </div>
            <div className="stat">
              <div className="label">Rate / unit</div>
              <div className="val" style={{fontSize:18}}>{fmt(data.rate_per_unit)}</div>
              <div className="sub">flat rate · per cycle</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Who has paid — {monthLabel}</h2>
              <span className="hint">Status derived from payments · click a unit to see full history</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Type</th>
                  <th style={{textAlign:'right'}}>Charge</th>
                  <th style={{textAlign:'right'}}>Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {units.length === 0 ? (
                  <tr><td colSpan={5} style={{color:'var(--ink-faint)',textAlign:'center',padding:'32px'}}>
                    No units found. Raise charges first.
                  </td></tr>
                ) : units.map(u => (
                  <tr key={u.unit_id}>
                    <td>
                      <button className="unit-pill" onClick={() => setDrawerUnit(u)}>
                        ⌂ {u.unit_identifier}
                      </button>
                    </td>
                    <td>{u.unit_type.replace('_', ' ')}</td>
                    <td className="num">{parseFloat(u.charge_amount).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    <td className="num">{parseFloat(u.paid_amount).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    <td>
                      {u.status === 'paid' && <span className="chip paid">● Paid</span>}
                      {u.status === 'partial' && <span className="chip partial">◐ Partial</span>}
                      {u.status === 'unpaid' && <span className="chip unpaid">○ Unpaid</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {showPayment && (
        <PaymentModal
          charges={chargesData?.filter(c => c.status !== 'paid') ?? []}
          onClose={() => setShowPayment(false)}
        />
      )}

      {drawerUnit && (
        <UnitDrawer
          unitId={drawerUnit.unit_id}
          unitIdentifier={drawerUnit.unit_identifier}
          onClose={() => setDrawerUnit(null)}
        />
      )}
    </section>
  )
}
