import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordPayment } from '../api/payments'

export default function PaymentModal({ charges, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    charge_id: charges?.[0]?.id ?? '',
    amount: '',
    method: 'Cash',
    reference: '',
    txn_date: new Date().toISOString().slice(0, 10),
  })
  const [err, setErr] = useState('')

  const mut = useMutation({
    mutationFn: () => recordPayment({
      ...form,
      charge_id: parseInt(form.charge_id),
      txn_date: new Date(form.txn_date).toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-dashboard'] })
      qc.invalidateQueries({ queryKey: ['expenses-dashboard'] })
      onClose()
    },
    onError: (e) => setErr(e.response?.data?.detail ?? 'Error recording payment'),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Record Payment</h2>
        {err && <div className="err-msg">{err}</div>}
        <div className="field">
          <label>Charge</label>
          <select value={form.charge_id} onChange={e => set('charge_id', e.target.value)}>
            {(charges ?? []).map(c => (
              <option key={c.id} value={c.id}>
                {c.unit_identifier} — {c.cycle} (₹{parseFloat(c.amount).toLocaleString('en-IN')})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Amount (₹)</label>
          <input type="number" min="0.01" step="0.01" value={form.amount}
            onChange={e => set('amount', e.target.value)} />
        </div>
        <div className="field">
          <label>Method</label>
          <select value={form.method} onChange={e => set('method', e.target.value)}>
            <option>Cash</option>
            <option>UPI</option>
            <option>Cheque</option>
            <option>NEFT</option>
            <option>Other</option>
          </select>
        </div>
        <div className="field">
          <label>Reference (optional)</label>
          <input value={form.reference} onChange={e => set('reference', e.target.value)}
            placeholder="UPI ref / cheque no." />
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={form.txn_date} onChange={e => set('txn_date', e.target.value)} />
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
