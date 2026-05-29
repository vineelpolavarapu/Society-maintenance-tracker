import { Link, useNavigate } from 'react-router-dom'

export default function Home() {
  const nav = useNavigate()

  return (
    <div className="home-page">
      <header className="home-nav">
        <div className="home-brand">
          <div className="home-brand-glyph">A</div>
          <div className="home-brand-text">
            <h1>Arihant Card Master Enclave</h1>
            <small>Members&apos; Portal</small>
          </div>
        </div>
        <nav className="home-nav-links">
          <a href="#features">The Portal</a>
          <a href="#community">Our Enclave</a>
          <a href="#contact">Contact</a>
          <button className="btn ghost home-nav-signin" onClick={() => nav('/login-user')}>Sign in</button>
          <button className="btn primary" onClick={() => nav('/register')}>Register</button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="hero-pill">Established 2008 &mdash; A Private Residential Community</span>
            <h2>
              The Residences of <span className="hero-accent">Arihant Card Master Enclave</span>
            </h2>
            <p className="hero-lede">
              A discreet members&apos; portal for our community of villas, bungalows, apartments and individual homes.
              View your maintenance, follow the ledger, and stay in touch with the committee &mdash; with the quiet polish our enclave is known for.
            </p>
            <div className="hero-actions">
              <button className="btn primary hero-cta" onClick={() => nav('/register')}>
                Register as a Resident
              </button>
              <button className="btn gold hero-cta" onClick={() => nav('/login-user')}>
                Member Sign In
              </button>
            </div>
            <div className="hero-stats">
              <div><b>120+</b><span>Households</span></div>
              <div><b>4</b><span>Home Types</span></div>
              <div><b>18 yrs</b><span>Established</span></div>
            </div>
            <p className="hero-staff">
              Committee member? <Link to="/login">Staff &amp; Committee Entrance &rarr;</Link>
            </p>
          </div>

        </div>
      </section>

      <section id="features" className="home-features">
        <p className="section-eyebrow">The Member Experience</p>
        <h3>One discreet portal for the whole community</h3>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">&#x20B9;</div>
            <h4>Maintenance Tracking</h4>
            <p>Monthly dues for villas, bungalows, apartments and houses &mdash; raised, paid and reconciled with discretion.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#10003;</div>
            <h4>Transparent Ledger</h4>
            <p>Every inflow and outflow is recorded with an append-only audit trail. Verifiable by any member.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#9733;</div>
            <h4>Committee Workflow</h4>
            <p>Secretary approves new residents, Treasurer oversees books, President provides governance.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#x1F511;</div>
            <h4>Private Portals</h4>
            <p>Separate, secure entrances for Admin, Secretary, President and Residents.</p>
          </div>
        </div>
      </section>

      <section id="community" className="home-community">
        <p className="section-eyebrow">Our Enclave</p>
        <h3>A community of distinguished residences</h3>
        <div className="community-grid">
          <div className="community-card"><span>&#10070;</span><b>Villas</b><small>Two-storey homes</small></div>
          <div className="community-card"><span>&#10070;</span><b>Bungalows</b><small>Single-storey houses</small></div>
          <div className="community-card"><span>&#10070;</span><b>Apartments</b><small>Block residences</small></div>
          <div className="community-card"><span>&#10070;</span><b>Individual Houses</b><small>Plot-based homes</small></div>
        </div>
      </section>

      <footer className="home-foot">
        <div>
          <b>Arihant Card Master Enclave</b>
          <small>Residents&apos; Welfare Association &middot; Maintenance &amp; Expense Tracker</small>
        </div>
        <div className="home-foot-links">
          <Link to="/login">Committee Login</Link>
          <Link to="/login-user">Resident Sign in</Link>
          <Link to="/register">Register</Link>
        </div>
      </footer>
    </div>
  )
}
