import React from 'react'
import { Link, useLocation } from 'react-router-dom'

const Layout = ({ children }) => {
  const location = useLocation()

  const navLinks = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/create', label: 'New Request', icon: '➕' }
  ]

  return (
    <div className="min-vh-100">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container">
          <Link className="navbar-brand" to="/">
            <span className="me-2">🔬</span>
            API Playground History
          </Link>
          <div className="collapse navbar-collapse">
            <ul className="navbar-nav me-auto">
              {navLinks.map(link => (
                <li className="nav-item" key={link.path}>
                  <Link 
                    className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
                    to={link.path}
                  >
                    <span className="me-1">{link.icon}</span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>
      
      <main className="py-4">
        <div className="container">
          {children}
        </div>
      </main>

      <footer className="footer mt-auto py-3 bg-light border-top">
        <div className="container text-center text-muted">
          <small>API Playground History - Secure Request Management</small>
        </div>
      </footer>
    </div>
  )
}

export default Layout
