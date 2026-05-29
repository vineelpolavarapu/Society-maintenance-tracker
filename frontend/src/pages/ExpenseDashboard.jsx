import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExpensesDashboard } from '../api/dashboard'
import { reverseTransaction } from '../api/transactions'
import { useAuth } from '../contexts/AuthContext'
import { useCycle } from '../hooks/useCycle'
import CalendarPicker from '../components/CalendarPicker'
import TransactionModal from '../components/TransactionModal'

function fmt(v) {
  return '₹' + parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export default function ExpenseDashboard() {
  const { user } = useAuth()
  const isTreasurer = user?.role === 'treasurer'
  const { cycle, setCycle } = useCycle()
  const [showModal, setShowModal] = useState(false)
  const [reversing, setReversing] = useState(null)
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['expenses-dashboard', cycle],
    queryFn: () => getExpensesDashboard(cycle).then(r => r.data),
  })

  const reverseMut = useMutation({
    mutationFn: ({ id, correction }) => reverseTransaction(id, correction),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses-dashboard'] })
      setReversing(null)
    },
  })

  const txns = data?.transactions ?? []

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Expense Dashboard</h1>
          <p>Complete transaction ledger — every rupee in and out. Balance is always derived from active entries.</p>
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
          <button className="btn primary" onClick={() => setShowModal(true)}>＋ Record transaction</button>
        </div>
      )}
      {!isTreasurer && (
        <div className="ro-banner">
          <span>🔒</span>
          <span>You can see every record in full. Only the Treasurer can add or change entries.</span>
        </div>
      )}

      {isLoading ? (
        <p style={{color:'var(--ink-faint)'}}>Loading…</p>
      ) : error ? (
        <p style={{color:'var(--neg)'}}>Failed to load data.</p>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <div className="label">Opening Balance</div>
              <div className="val">{fmt(data.open_balance)}</div>
              <div className="sub">Start of cycle</div>
            </div>
            <div className="stat">
              <div className="label">Collected</div>
              <div className="val pos">{fmt(data.collected)}</div>
              <div className="sub">maintenance received</div>
            </div>
            <div className="stat">
              <div className="label">Spent</div>
              <div className="val neg">{fmt(data.spent)}</div>
              <div className="sub">{txns.filter(t => t.direction === 'out' && t.status === 'active').length} entries</div>
            </div>
            <div className="stat">
              <div className="label">Current Balance</div>
              <div className="val">{fmt(data.close_balance)}</div>
              <div className="derived">∑ derived from ledger</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Transaction ledger</h2>
              <span className="hint">Append-only · corrections shown as reversal + correction</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th style={{textAlign:'right'}}>Amount</th>
                  <th>Recorded by</th>
                  {isTreasurer && <th></th>}
                </tr>
              </thead>
              <tbody>
                {txns.length === 0 ? (
                  <tr><td colSpan={isTreasurer ? 6 : 5} style={{color:'var(--ink-faint)',textAlign:'center',padding:'32px'}}>No transactions for this cycle.</td></tr>
                ) : txns.map(t => (
                  <tr key={t.id} className={t.status === 'reversed' ? 'row-reversed' : ''}>
                    <td className="mono">{new Date(t.txn_date).toLocaleDateString('en-IN', {day:'2-digit',month:'short'})}</td>
                    <td>
                      <span className={t.status === 'reversed' ? 'strike' : ''}>{t.description}</span>
                      {t.reverses_transaction_id && (
                        <span className="corr-note"> (correction)</span>
                      )}
                    </td>
                    <td>
                      {t.status === 'reversed'
                        ? <span className="chip reversed">↺ Reversed</span>
                        : t.direction === 'in'
                        ? <span className="chip in">▲ In</span>
                        : <span className="chip out">▼ Out</span>}
                    </td>
                    <td className={`num ${t.direction === 'in' ? 'amt-in' : 'amt-out'}`}>
                      {t.direction === 'in' ? '+' : '−'}{parseFloat(t.amount).toLocaleString('en-IN', {minimumFractionDigits:2})}
                    </td>
                    <td>{t.recorded_by_name ?? '—'}</td>
                    {isTreasurer && (
                      <td>
                        {t.status === 'active' && !t.reverses_transaction_id && (
                          <button className="btn ghost" style={{fontSize:11,padding:'4px 9px'}}
                            onClick={() => setReversing(t)}>↺ Reverse</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{padding:'12px 18px'}}>
              <div className="legend">
                <span><span className="dot" style={{background:'var(--pos)'}}></span> Money in</span>
                <span><span className="dot" style={{background:'var(--neg)'}}></span> Money out</span>
                <span><span className="dot" style={{background:'var(--reversed)'}}></span> Reversed</span>
              </div>
            </div>
          </div>
        </>
      )}

      {showModal && <TransactionModal onClose={() => setShowModal(false)} />}

      {reversing && (
        <ReverseModal txn={reversing} onClose={() => setReversing(null)}
          onConfirm={(correction) => reverseMut.mutate({ id: reversing.id, correction })} />
      )}
    </section>
  )
}

function ReverseModal({ txn, onClose, onConfirm }) {
  const [form, setForm] = useState({
    direction: txn.direction,
    amount: txn.amount,
    txn_date: new Date().toISOString().slice(0, 10),
    description: `${txn.description} (corrected)`,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Reverse & Correct Entry</h2>
        <p style={{fontSize:13,color:'var(--ink-soft)',marginBottom:20}}>
          The original entry will be reversed. Enter the corrected values below.
        </p>
        <div className="field">
          <label>Corrected Direction</label>
          <select value={form.direction} onChange={e => set('direction', e.target.value)}>
            <option value="in">▲ Money In</option>
            <option value="out">▼ Money Out</option>
          </select>
        </div>
        <div className="field">
          <label>Corrected Amount (₹)</label>
          <input type="number" min="0.01" step="0.01" value={form.amount}
            onChange={e => set('amount', e.target.value)} />
        </div>
        <div className="field">
          <label>Corrected Description</label>
          <input value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={form.txn_date} onChange={e => set('txn_date', e.target.value)} />
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn danger" onClick={() => onConfirm({
            ...form,
            txn_date: new Date(form.txn_date).toISOString(),
          })}>Post Reversal</button>
        </div>
      </div>
    </div>
  )
}
