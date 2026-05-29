import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUnits, createUnit } from '../api/units'
import { useAuth } from '../contexts/AuthContext'

export default function Units() {
  const { user } = useAuth()
  const isTreasurer = user?.role === 'treasurer'
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: units, isLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => getUnits().then(r => r.data),
  })

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Units</h1>
          <p>All registered units in the society. Charge rates are set per unit.</p>
        </div>
        {isTreasurer && (
          <button className="btn primary" onClick={() => setShowModal(true)}>＋ Add unit</button>
        )}
      </div>

      <div className="panel">
        <div className="panel-head"><h2>All units</h2></div>
        <table>
          <thead>
            <tr><th>Identifier</th><th>Type</th><th style={{textAlign:'right'}}>Charge Rate</th><th>Added</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} style={{color:'var(--ink-faint)',padding:24}}>Loading…</td></tr>
            ) : units?.map(u => (
              <tr key={u.id}>
                <td><strong>{u.identifier}</strong></td>
                <td>{u.type.replace('_', ' ')}</td>
                <td className="num">₹{parseFloat(u.charge_rate).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                <td className="mono" style={{fontSize:12,color:'var(--ink-faint)'}}>
                  {new Date(u.created_at).toLocaleDateString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AddUnitModal
          onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); qc.invalidateQueries({ queryKey: ['units'] }) }}
        />
      )}
    </section>
  )
}

function AddUnitModal({ onClose, onDone }) {
  const [form, setForm] = useState({ identifier: '', type: 'apartment', charge_rate: '' })
  const [err, setErr] = useState('')

  const mut = useMutation({
    mutationFn: () => createUnit(form),
    onSuccess: onDone,
    onError: (e) => setErr(e.response?.data?.detail ?? 'Failed to create unit'),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Add Unit</h2>
        {err && <div className="err-msg">{err}</div>}
        <div className="field">
          <label>Identifier</label>
          <input value={form.identifier} onChange={e => set('identifier', e.target.value)}
            placeholder="e.g. Villa 12, Flat A-304" />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="villa">Villa</option>
            <option value="bungalow">Bungalow</option>
            <option value="apartment">Apartment</option>
            <option value="individual_house">Individual House</option>
          </select>
        </div>
        <div className="field">
          <label>Charge Rate (₹/cycle)</label>
          <input type="number" min="1" value={form.charge_rate}
            onChange={e => set('charge_rate', e.target.value)} placeholder="3000" />
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Adding…' : 'Add Unit'}
          </button>
        </div>
      </div>
    </div>
  )
}
