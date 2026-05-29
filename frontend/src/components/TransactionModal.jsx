import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTransaction } from '../api/transactions'

export default function TransactionModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    direction: 'out',
    amount: '',
    txn_date: new Date().toISOString().slice(0, 10),
    description: '',
    category: '',
  })
  const [err, setErr] = useState('')

  const mut = useMutation({
    mutationFn: () => createTransaction({
      ...form,
      txn_date: new Date(form.txn_date).toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses-dashboard'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      onClose()
    },
    onError: (e) => setErr(e.response?.data?.detail ?? 'Error recording transaction'),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Record Transaction</h2>
        {err && <div className="err-msg">{err}</div>}
        <div className="field">
          <label>Direction</label>
          <select value={form.direction} onChange={e => set('direction', e.target.value)}>
            <option value="in">▲ Money In</option>
            <option value="out">▼ Money Out</option>
          </select>
        </div>
        <div className="field">
          <label>Amount (₹)</label>
          <input type="number" min="0.01" step="0.01" value={form.amount}
            onChange={e => set('amount', e.target.value)} placeholder="0.00" />
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={form.txn_date} onChange={e => set('txn_date', e.target.value)} />
        </div>
        <div className="field">
          <label>Description *</label>
          <input value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="e.g. Lift AMC — quarterly" />
        </div>
        <div className="field">
          <label>Category (optional)</label>
          <input value={form.category} onChange={e => set('category', e.target.value)}
            placeholder="e.g. maintenance, utilities" />
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Saving…' : 'Record'}
          </button>
        </div>
      </div>
    </div>
  )
}
