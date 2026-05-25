import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, LogOut, FileDown, HeartPulse } from 'lucide-react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';

const API_BASE = '/api/admin';

// ─── Authentication Context/Hook (Simple approach for MVP) ─────────────────
function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  
  const login = (password) => {
    // Basic auth check approach: attempt an API call
    localStorage.setItem('admin_token', password);
    setToken(password);
  };
  
  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  return { token, login, logout };
}

// ─── API Setup ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_BASE
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`; // We use password as token for simple auth
  }
  return config;
});

// ─── Pages ──────────────────────────────────────────────────────────────────

function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Test the token against the API
      await axios.get(`${API_BASE}/appointments`, {
        headers: { Authorization: `Bearer ${password}` }
      });
      onLogin(password);
      navigate('/');
    } catch (err) {
      setError('Invalid admin password');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <HeartPulse size={48} color="var(--primary-color)" style={{ margin: '0 auto 16px' }} />
        <h2>Parkside Admin</h2>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Admin Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter secret key..."
              required
            />
          </div>
          {error && <span className="error-text">{error}</span>}
          <button type="submit" className="btn btn-primary login-btn">Login</button>
        </form>
      </div>
    </div>
  );
}

function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const { data } = await api.get('/appointments');
      // Sort newest first based on timestamp (if available)
      const sorted = [...data].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
      setAppointments(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Date', 'Time', 'Patient Name', 'Age', 'Gender', 'Phone', 'Doctor', 'Complaint', 'Status'];
    const rows = appointments.map(a => [
      a.date, a.time, a.patientName, a.age, a.gender, escape(a.phone), a.doctor, escape(a.complaint), a.status
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `appointments_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Appointments</h1>
        <button className="btn btn-primary" onClick={exportCSV}>
          <FileDown size={18} /> Export CSV
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading appointments...</p>
        ) : appointments.length === 0 ? (
          <p>No appointments found.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Requested Date</th>
                  <th>Time</th>
                  <th>Patient Name</th>
                  <th>Contact</th>
                  <th>Doctor</th>
                  <th>Complaint</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt, i) => (
                  <tr key={i}>
                    <td>{appt.date}</td>
                    <td>{appt.time}</td>
                    <td>
                      <div style={{fontWeight: 500}}>{appt.patientName}</div>
                      <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{appt.age} yrs • {appt.gender}</div>
                    </td>
                    <td>{appt.phone}</td>
                    <td>{appt.doctor}</td>
                    <td style={{maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                      {appt.complaint}
                    </td>
                    <td>
                      <span className={`badge ${appt.status.toLowerCase().includes('pending') ? 'pending' : 'confirmed'}`}>
                        {appt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Layout({ children, onLogout }) {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <HeartPulse size={24} />
          Parkside Admin
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard size={20} />
            Appointments
          </NavLink>
        </nav>
        <div style={{padding: '20px'}}>
          <button className="btn btn-secondary" style={{width: '100%', justifyContent: 'center'}} onClick={onLogout}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const { token, login, logout } = useAuth();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          token ? <Navigate to="/" /> : <Login onLogin={login} />
        } />
        
        <Route path="/" element={
          token ? (
            <Layout onLogout={logout}>
              <Appointments />
            </Layout>
          ) : <Navigate to="/login" />
        } />
      </Routes>
    </Router>
  );
}
