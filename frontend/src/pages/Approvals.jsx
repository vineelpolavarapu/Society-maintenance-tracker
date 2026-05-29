import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { getRegistrations, approveRegistration, rejectRegistration } from '../api/registrations'

export default function Approvals() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [detailsReg, setDetailsReg] = useState(null)

  const { data: regs, isLoading } = useQuery({
    queryKey: ['registrations'],
    queryFn: () => getRegistrations().then(r => r.data),
    enabled: !!user?.can_approve,
  })

  if (!user?.can_approve) {
    return (
      <section>
        <div className="page-head">
          <div><h1>Registration Approvals</h1></div>
        </div>
        <div className="panel">
          <div style={{padding:'34px',textAlign:'center',color:'var(--ink-soft)'}}>
            <div style={{fontSize:30,marginBottom:10}}>🔒</div>
            <b style={{color:'var(--ink)'}}>Approvals are restricted to the Secretary</b>
            <p style={{marginTop:6,fontSize:12.5}}>
              The approve/reject actions are authorised server-side for users with the <code>can_approve</code> flag only.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Registration Approvals</h1>
          <p>New residents can register, but gain no access until you review and approve here.</p>
        </div>
        <span className="readonly-pill write">✓ Secretary action</span>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Pending registrations</h2>
          <span className="hint">Click <b>Details</b> to view the applicant and decide</span>
        </div>
        {isLoading ? (
          <div style={{padding:24,color:'var(--ink-faint)'}}>Loading…</div>
        ) : (regs?.length === 0) ? (
          <div style={{padding:34,textAlign:'center',color:'var(--ink-faint)'}}>
            No pending registrations.
          </div>
        ) : regs?.map(reg => {
          const initials = reg.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
          return (
            <div key={reg.id} className="approval">
              <span className="avatar">{initials}</span>
              <div className="info">
                <b>{reg.name}</b>
                <div className="sub">
                  {reg.unit_identifier ? `Claims: ${reg.unit_identifier} · ` : ''}
                  {reg.contact} · requested {new Date(reg.created_at).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}
                </div>
              </div>
              <div className="acts">
                <button className="btn primary" onClick={() => setDetailsReg(reg)}>👁 Details</button>
              </div>
            </div>
          )
        })}
      </div>

      {detailsReg && (
        <RegistrationDetailsModal
          reg={detailsReg}
          onClose={() => setDetailsReg(null)}
          onDone={() => {
            setDetailsReg(null)
            qc.invalidateQueries({ queryKey: ['registrations'] })
          }}
        />
      )}
    </section>
  )
}

function RegistrationDetailsModal({ reg, onClose, onDone }) {
  const [role, setRole] = useState('resident')
  const [canApprove, setCanApprove] = useState(false)
  const [err, setErr] = useState('')
  const [working, setWorking] = useState(null) // 'approve' | 'reject' | null

  async function approve() {
    setErr(''); setWorking('approve')
    try {
      await approveRegistration(reg.id, role, canApprove)
      onDone()
    } catch (e) {
      setErr(e.response?.data?.detail ?? 'Failed to approve')
    } finally {
      setWorking(null)
    }
  }

  async function reject() {
    setErr(''); setWorking('reject')
    try {
      await rejectRegistration(reg.id)
      onDone()
    } catch (e) {
      setErr(e.response?.data?.detail ?? 'Failed to reject')
    } finally {
      setWorking(null)
    }
  }

  const requestedOn = new Date(reg.created_at).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-details" onClick={e => e.stopPropagation()}>
        <h2 style={{marginBottom:6}}>Registration Details</h2>
        <p style={{fontSize:12.5,color:'var(--ink-soft)',marginBottom:18}}>
          Review the applicant&apos;s details below, then approve or reject.
        </p>

        {err && <div className="err-msg">{err}</div>}

        <div className="details-grid">
          <div className="details-row">
            <span className="details-lbl">Full name</span>
            <span className="details-val">{reg.name}</span>
          </div>
          <div className="details-row">
            <span className="details-lbl">Email</span>
            <span className="details-val">{reg.email || <em>(not provided)</em>}</span>
          </div>
          <div className="details-row">
            <span className="details-lbl">Phone</span>
            <span className="details-val">{reg.phone || <em>(not provided)</em>}</span>
          </div>
          <div className="details-row">
            <span className="details-lbl">Door / Flat no.</span>
            <span className="details-val">{reg.flat_no || <em>(not provided)</em>}</span>
          </div>
          <div className="details-row">
            <span className="details-lbl">Building / Block</span>
            <span className="details-val">{reg.building_name || <em>(not provided)</em>}</span>
          </div>
          <div className="details-row">
            <span className="details-lbl">Claimed unit</span>
            <span className="details-val">{reg.unit_identifier || <em>(none — assign during approval)</em>}</span>
          </div>
          <div className="details-row">
            <span className="details-lbl">Requested on</span>
            <span className="details-val">{requestedOn}</span>
          </div>
        </div>

        <div className="details-divider" />

        <div className="field">
          <label>Assign role on approval</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="resident">Resident</option>
            <option value="secretary">Secretary</option>
            <option value="committee">Committee</option>
            <option value="treasurer">Treasurer</option>
            <option value="president">President</option>
          </select>
        </div>
        <div className="field" style={{display:'flex',alignItems:'center',gap:10}}>
          <input type="checkbox" id="can_approve" checked={canApprove}
            onChange={e => setCanApprove(e.target.checked)} style={{width:'auto'}} />
          <label htmlFor="can_approve" style={{margin:0}}>
            Grant approval permission (can approve other registrations)
          </label>
        </div>

        <p className="details-note">
          The password set by the applicant during registration will be used. No temporary password is needed.
        </p>

        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose} disabled={!!working}>Close</button>
          <button className="btn danger" onClick={reject} disabled={!!working}>
            {working === 'reject' ? 'Rejecting…' : '✕ Reject'}
          </button>
          <button className="btn ok" onClick={approve} disabled={!!working}>
            {working === 'approve' ? 'Approving…' : '✓ Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}
