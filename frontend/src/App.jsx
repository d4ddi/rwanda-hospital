import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import axios from 'axios';

// Set base URL for axios
axios.defaults.baseURL = 'http://localhost:5000';

// Auth Context
const AuthContext = React.createContext();

// Auth Provider Component
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
      fetchNotifications();
    } else {
      setLoading(false);
    }

    // Add scroll event listener
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setUser(response.data);
      setLoading(false);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/api/notifications');
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markNotificationAsRead = async (id) => {
    try {
      await axios.put(`/api/notifications/${id}/read`);
      setNotifications(notifications.map(notif => 
        notif._id === id ? { ...notif, read: true } : notif
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      fetchNotifications();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post('/api/auth/register', userData);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Registration failed' };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put('/api/auth/profile', profileData);
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Update failed' };
    }
  };

  const uploadAvatar = async (file) => {
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const response = await axios.post('/api/upload/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Upload failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setNotifications([]);
  };

  const unreadNotifications = notifications.filter(n => !n.read).length;

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    notifications,
    unreadNotifications,
    markNotificationAsRead,
    fetchNotifications,
    updateProfile,
    uploadAvatar
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  return React.useContext(AuthContext);
};

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

// Reports Sidebar Component
const ReportsSidebar = ({ isOpen, onClose, onGenerateReport }) => {
  const [dailyReport, setDailyReport] = useState(null);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [loadingReports, setLoadingReports] = useState({});

  const fetchReport = async (type) => {
    setLoadingReports(prev => ({ ...prev, [type]: true }));
    try {
      const response = await axios.get(`/api/reports/${type}`);
      switch (type) {
        case 'daily':
          setDailyReport(response.data);
          break;
        case 'weekly':
          setWeeklyReport(response.data);
          break;
        case 'monthly':
          setMonthlyReport(response.data);
          break;
      }
    } catch (error) {
      console.error(`Error fetching ${type} report:`, error);
    } finally {
      setLoadingReports(prev => ({ ...prev, [type]: false }));
    }
  };

  const printReport = (report, title) => {
    const printWindow = window.open('', '_blank');
    const revenue = report.revenue && report.revenue.length > 0 ? report.revenue[0].total : 0;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} Report</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            color: #333;
          }
          .print-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #667eea;
            padding-bottom: 20px;
          }
          .print-header h1 {
            color: #667eea;
            font-size: 2rem;
            margin: 0 0 10px 0;
          }
          .print-header p {
            color: #6b7280;
            font-size: 1.1rem;
            margin: 0;
          }
          .print-section {
            margin-bottom: 30px;
          }
          .print-section h2 {
            color: #667eea;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .print-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
          .print-stat {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
          }
          .print-stat h3 {
            margin: 0 0 10px 0;
            color: #4b5563;
            font-size: 1.1rem;
          }
          .print-stat p {
            margin: 0;
            font-size: 1.8rem;
            font-weight: 700;
            color: #667eea;
          }
          .print-footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 0.9rem;
          }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>Rwanda Hospital Management System</h1>
          <p>${title} Report</p>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="print-section">
          <h2>Report Summary</h2>
          <div class="print-grid">
            <div class="print-stat">
              <h3>Total Patients</h3>
              <p>${report.totalPatients || 0}</p>
            </div>
            <div class="print-stat">
              <h3>Total Appointments</h3>
              <p>${report.totalAppointments || 0}</p>
            </div>
            <div class="print-stat">
              <h3>Completed Appointments</h3>
              <p>${report.completedAppointments || 0}</p>
            </div>
            <div class="print-stat">
              <h3>Total Revenue (RWF)</h3>
              <p>${revenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div class="print-footer">
          <p>Report generated by Rwanda Hospital Management System</p>
          <p>© ${new Date().getFullYear()} Rwanda Hospital. All rights reserved.</p>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 1000);
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const ReportCard = ({ title, report, type, onPrint }) => {
    if (!report) return null;
    
    const revenue = report.revenue && report.revenue.length > 0 ? report.revenue[0].total : 0;
    
    return (
      <div className="report-card">
        <h3>{title}</h3>
        <div className="report-stats">
          <div className="report-stat">
            <div className="report-stat-value">{report.totalPatients || 0}</div>
            <div className="report-stat-label">Patients</div>
          </div>
          <div className="report-stat">
            <div className="report-stat-value">{report.totalAppointments || 0}</div>
            <div className="report-stat-label">Appointments</div>
          </div>
          <div className="report-stat">
            <div className="report-stat-value">{report.completedAppointments || 0}</div>
            <div className="report-stat-label">Completed</div>
          </div>
          <div className="report-stat">
            <div className="report-stat-value">RWF {revenue.toLocaleString()}</div>
            <div className="report-stat-label">Revenue</div>
          </div>
        </div>
        <div className="report-actions">
          <button 
            className="btn btn-primary" 
            onClick={() => onPrint(report, title)}
          >
            <i className="fas fa-print"></i> Print
          </button>
          <button 
            className="btn btn-info" 
            onClick={() => onGenerateReport(type)}
          >
            <i className="fas fa-download"></i> Export
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <div 
          className="sidebar-toggle no-print"
          onClick={onClose}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '1099'
          }}
        >
          <i className="fas fa-times"></i>
        </div>
      )}
      
      <div className={`reports-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="reports-sidebar-header">
          <h2><i className="fas fa-chart-bar"></i> Reports</h2>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', marginBottom: '15px' }}
            onClick={() => fetchReport('daily')}
            disabled={loadingReports.daily}
          >
            {loadingReports.daily ? (
              <>
                <div className="spinner" style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', marginRight: '8px' }}></div>
                Loading Daily Report...
              </>
            ) : (
              <>
                <i className="fas fa-sync-alt"></i> Refresh Daily Report
              </>
            )}
          </button>
          
          <button 
            className="btn btn-success" 
            style={{ width: '100%', marginBottom: '15px' }}
            onClick={() => fetchReport('weekly')}
            disabled={loadingReports.weekly}
          >
            {loadingReports.weekly ? (
              <>
                <div className="spinner" style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', marginRight: '8px' }}></div>
                Loading Weekly Report...
              </>
            ) : (
              <>
                <i className="fas fa-sync-alt"></i> Refresh Weekly Report
              </>
            )}
          </button>
          
          <button 
            className="btn btn-warning" 
            style={{ width: '100%' }}
            onClick={() => fetchReport('monthly')}
            disabled={loadingReports.monthly}
          >
            {loadingReports.monthly ? (
              <>
                <div className="spinner" style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', marginRight: '8px' }}></div>
                Loading Monthly Report...
              </>
            ) : (
              <>
                <i className="fas fa-sync-alt"></i> Refresh Monthly Report
              </>
            )}
          </button>
        </div>
        
        <ReportCard 
          title="Daily Report" 
          report={dailyReport} 
          type="daily"
          onPrint={printReport}
        />
        
        <ReportCard 
          title="Weekly Report" 
          report={weeklyReport} 
          type="weekly"
          onPrint={printReport}
        />
        
        <ReportCard 
          title="Monthly Report" 
          report={monthlyReport} 
          type="monthly"
          onPrint={printReport}
        />
        
        <div className="card" style={{ marginTop: '20px' }}>
          <h3><i className="fas fa-info-circle"></i> Report Information</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            Reports are automatically generated based on system data. 
            Click "Refresh" to update report data or "Print" to generate a professional report.
          </p>
        </div>
      </div>
    </>
  );
};

// Profile Component with Avatar
const Profile = () => {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || ''
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showMessage('File size must be less than 5MB', 'error');
        return;
      }
      
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    
    setLoading(true);
    const result = await uploadAvatar(avatarFile);
    if (result.success) {
      showMessage('Avatar updated successfully!', 'success');
      setAvatarFile(null);
      setAvatarPreview(null);
    } else {
      showMessage(result.message, 'error');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await updateProfile(formData);
    if (result.success) {
      showMessage('Profile updated successfully!', 'success');
      setIsEditing(false);
    } else {
      showMessage(result.message, 'error');
    }
    setLoading(false);
  };

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  };

  const getAvatarUrl = () => {
    if (avatarPreview) return avatarPreview;
    if (user?.avatar) return `http://localhost:5000${user.avatar}`;
    return 'https://ui-avatars.com/api/?name=' + (user?.name || 'U').replace(/\s+/g, '+');
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#667eea' }}><i className="fas fa-user-circle"></i> My Profile</h1>
        <button 
          className="btn btn-primary" 
          onClick={() => setIsEditing(!isEditing)}
        >
          <i className={`fas fa-${isEditing ? 'times' : 'edit'}`}></i> {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {message && (
        <div className={`alert alert-${messageType}`}>
          <i className={`fas fa-${messageType === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i> {message}
        </div>
      )}

      <div className="profile-header">
        <div className="avatar-upload">
          <label className="avatar-upload-label">
            <img 
              src={getAvatarUrl()} 
              alt="Profile" 
              className="avatar-large"
            />
            <div className="avatar-overlay">
              <i className="fas fa-camera"></i>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleAvatarChange}
              ref={fileInputRef}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        
        <div>
          <h2 style={{ color: '#667eea', marginBottom: '10px' }}>{user.name}</h2>
          <p style={{ color: '#6b7280', marginBottom: '10px' }}>
            <i className="fas fa-envelope"></i> {user.email}
          </p>
          <p style={{ color: '#6b7280', marginBottom: '10px' }}>
            <i className="fas fa-user-tag"></i> {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </p>
          {user.phone && (
            <p style={{ color: '#6b7280' }}>
              <i className="fas fa-phone"></i> {user.phone}
            </p>
          )}
        </div>
      </div>

      {avatarFile && (
        <div className="card" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <button 
            className="btn btn-success" 
            onClick={handleAvatarUpload}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', marginRight: '10px' }}></div>
                Uploading...
              </>
            ) : (
              <>
                <i className="fas fa-upload"></i> Save Avatar
              </>
            )}
          </button>
        </div>
      )}

      {isEditing ? (
        <div className="card">
          <h3 style={{ color: '#667eea', marginBottom: '20px' }}><i className="fas fa-user-edit"></i> Edit Profile</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label><i className="fas fa-user"></i> Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label><i className="fas fa-phone"></i> Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', marginRight: '10px' }}></div>
                  Saving...
                </>
              ) : (
                <>
                  <i className="fas fa-save"></i> Save Changes
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="card">
          <h3 style={{ color: '#667eea', marginBottom: '20px' }}><i className="fas fa-info-circle"></i> Profile Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div>
              <h4 style={{ color: '#6b7280', marginBottom: '10px' }}>Personal Information</h4>
              <p><strong>Name:</strong> {user.name}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Phone:</strong> {user.phone || 'Not provided'}</p>
            </div>
            <div>
              <h4 style={{ color: '#6b7280', marginBottom: '10px' }}>Account Information</h4>
              <p><strong>Role:</strong> {user.role.charAt(0).toUpperCase() + user.role.slice(1)}</p>
              <p><strong>Member Since:</strong> {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Navigation Component with Scroll Effect
const Navigation = () => {
  const { user, logout, unreadNotifications } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showReports, setShowReports] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!user) return null;

  const getNavLinks = () => {
    switch (user.role) {
      case 'admin':
        return [
          { path: '/dashboard', label: 'Dashboard', icon: 'fas fa-home' },
          { path: '/patients', label: 'Patients', icon: 'fas fa-user-injured' },
          { path: '/doctors', label: 'Doctors', icon: 'fas fa-user-md' },
          { path: '/appointments', label: 'Appointments', icon: 'fas fa-calendar-check' },
          { path: '/medical-records', label: 'Medical Records', icon: 'fas fa-file-medical' },
          { path: '/billing', label: 'Billing', icon: 'fas fa-money-bill' },
          { path: '/departments', label: 'Departments', icon: 'fas fa-building' },
          { path: '/inventory', label: 'Inventory', icon: 'fas fa-boxes' }
        ];
      case 'doctor':
        return [
          { path: '/dashboard', label: 'Dashboard', icon: 'fas fa-home' },
          { path: '/patients', label: 'Patients', icon: 'fas fa-user-injured' },
          { path: '/appointments', label: 'My Appointments', icon: 'fas fa-calendar-check' },
          { path: '/medical-records', label: 'Medical Records', icon: 'fas fa-file-medical' }
        ];
      case 'nurse':
        return [
          { path: '/dashboard', label: 'Dashboard', icon: 'fas fa-home' },
          { path: '/patients', label: 'Patients', icon: 'fas fa-user-injured' },
          { path: '/appointments', label: 'Appointments', icon: 'fas fa-calendar-check' }
        ];
      default:
        return [
          { path: '/dashboard', label: 'Dashboard', icon: 'fas fa-home' },
          { path: '/appointments', label: 'My Appointments', icon: 'fas fa-calendar-check' },
          { path: '/medical-records', label: 'My Records', icon: 'fas fa-file-medical' }
        ];
    }
  };

  return (
    <>
      <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="container navbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h2 style={{ margin: 0, fontSize: isScrolled ? '1.2rem' : '1.5rem' }}>
              <i className="fas fa-hospital"></i> Rwanda Hospital
            </h2>
          </div>
          <nav className="nav-links">
            {getNavLinks().map((link) => (
              <Link key={link.path} to={link.path}>
                <i className={link.icon}></i> {link.label}
              </Link>
            ))}
            <Link to="/profile">
              <i className="fas fa-user-circle"></i> Profile
            </Link>
            <div className="notification-badge" style={{ position: 'relative' }}>
              <button 
                className="btn btn-info" 
                onClick={() => setShowNotifications(!showNotifications)}
                style={{ minWidth: 'auto', padding: '10px 15px' }}
              >
                <i className="fas fa-bell"></i>
                {unreadNotifications > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: '#ff416c',
                    color: 'white',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    fontSize: '0.7rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}>
                    {unreadNotifications}
                  </span>
                )}
              </button>
            </div>
            <button 
              className="btn btn-success" 
              onClick={() => setShowReports(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <i className="fas fa-chart-bar"></i> Reports
            </button>
            <button 
              className="btn btn-danger" 
              onClick={logout}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <i className="fas fa-sign-out-alt"></i> Logout
            </button>
          </nav>
        </div>
        
        {showNotifications && (
          <div className="card" style={{ 
            position: 'absolute', 
            right: '20px', 
            top: isScrolled ? '70px' : '90px', 
            width: '350px', 
            zIndex: 1000,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3><i className="fas fa-bell"></i> Notifications</h3>
              <button className="close-btn" onClick={() => setShowNotifications(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {unreadNotifications === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>
                  <i className="fas fa-check-circle" style={{ fontSize: '2rem', marginBottom: '10px', display: 'block' }}></i>
                  No new notifications
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {notifications.filter(n => !n.read).map(notification => (
                    <li key={notification._id} style={{ 
                      padding: '15px', 
                      borderBottom: '1px solid #eee', 
                      backgroundColor: notification.type === 'warning' ? '#fef3c7' : 
                                     notification.type === 'error' ? '#fee2e2' : 
                                     notification.type === 'success' ? '#d1fae5' : '#dbeafe'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem' }}>{notification.title}</h4>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>{notification.message}</p>
                          <small style={{ color: '#9ca3af' }}>
                            {new Date(notification.createdAt).toLocaleDateString()}
                          </small>
                        </div>
                        <button 
                          className="btn btn-success" 
                          onClick={() => useAuth().markNotificationAsRead(notification._id)}
                          style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                        >
                          <i className="fas fa-check"></i>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </header>

      <ReportsSidebar 
        isOpen={showReports}
        onClose={() => setShowReports(false)}
        onGenerateReport={(type) => {
          alert(`Export ${type} report functionality would be implemented here`);
        }}
      />
    </>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/dashboard/stats');
      setStats(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  const renderAdminDashboard = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#667eea' }}><i className="fas fa-chart-line"></i> Admin Dashboard</h1>
        <div className="btn btn-info">
          <i className="fas fa-sync-alt"></i> Refresh Data
        </div>
      </div>
      
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          <div className="dashboard-grid">
            <div className="stat-card">
              <i className="fas fa-user-injured" style={{ fontSize: '2.5rem', marginBottom: '15px', color: '#667eea' }}></i>
              <h3>{stats.totalPatients || 0}</h3>
              <p>Total Patients</p>
            </div>
            <div className="stat-card">
              <i className="fas fa-user-md" style={{ fontSize: '2.5rem', marginBottom: '15px', color: '#11998e' }}></i>
              <h3>{stats.totalDoctors || 0}</h3>
              <p>Total Doctors</p>
            </div>
            <div className="stat-card">
              <i className="fas fa-calendar-check" style={{ fontSize: '2.5rem', marginBottom: '15px', color: '#f09819' }}></i>
              <h3>{stats.totalAppointments || 0}</h3>
              <p>Total Appointments</p>
            </div>
            <div className="stat-card">
              <i className="fas fa-clock" style={{ fontSize: '2.5rem', marginBottom: '15px', color: '#ff416c' }}></i>
              <h3>{stats.pendingAppointments || 0}</h3>
              <p>Pending Appointments</p>
            </div>
            <div className="stat-card">
              <i className="fas fa-box" style={{ fontSize: '2.5rem', marginBottom: '15px', color: '#2193b0' }}></i>
              <h3>{stats.lowInventory || 0}</h3>
              <p>Low Stock Items</p>
            </div>
            <div className="stat-card">
              <i className="fas fa-exclamation-triangle" style={{ fontSize: '2.5rem', marginBottom: '15px', color: '#ff416c' }}></i>
              <h3>{stats.outOfStock || 0}</h3>
              <p>Out of Stock</p>
            </div>
          </div>
          
          <div className="chart-container">
            <h3 className="chart-title"><i className="fas fa-chart-pie"></i> Hospital Overview</h3>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '30px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '150px', height: '150px', borderRadius: '50%', background: 'conic-gradient(#667eea 0% 40%, #11998e 40% 70%, #f09819 70% 100%)', margin: '0 auto 20px' }}></div>
                <p>Appointments Distribution</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '150px', height: '150px', borderRadius: '50%', background: 'conic-gradient(#11998e 0% 60%, #ff416c 60% 85%, #2193b0 85% 100%)', margin: '0 auto 20px' }}></div>
                <p>Inventory Status</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderDoctorDashboard = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#667eea' }}><i className="fas fa-stethoscope"></i> Doctor Dashboard</h1>
        <div className="btn btn-info">
          <i className="fas fa-sync-alt"></i> Refresh Data
        </div>
      </div>
      
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          <div className="dashboard-grid">
            <div className="stat-card">
              <i className="fas fa-user-injured" style={{ fontSize: '2.5rem', marginBottom: '15px', color: '#667eea' }}></i>
              <h3>{stats.totalPatients || 0}</h3>
              <p>Your Patients</p>
            </div>
            <div className="stat-card">
              <i className="fas fa-calendar-check" style={{ fontSize: '2.5rem', marginBottom: '15px', color: '#11998e' }}></i>
              <h3>{stats.completedAppointments || 0}</h3>
              <p>Completed Today</p>
            </div>
            <div className="stat-card">
              <i className="fas fa-clock" style={{ fontSize: '2.5rem', marginBottom: '15px', color: '#f09819' }}></i>
              <h3>{stats.pendingAppointments || 0}</h3>
              <p>Pending Appointments</p>
            </div>
          </div>
          
          <div className="chart-container">
            <h3 className="chart-title"><i className="fas fa-calendar-alt"></i> Weekly Schedule</h3>
            <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '10px', padding: '20px' }}>
              {[65, 80, 45, 90, 70, 85, 60].map((height, index) => (
                <div key={index} style={{ 
                  height: `${height}%`, 
                  width: '40px', 
                  backgroundColor: '#667eea', 
                  borderRadius: '5px 5px 0 0',
                  position: 'relative',
                  animation: 'float 3s ease-in-out infinite',
                  animationDelay: `${index * 0.2}s`
                }}>
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '-25px', 
                    left: '50%', 
                    transform: 'translateX(-50%)',
                    fontSize: '0.8rem',
                    color: '#6b7280'
                  }}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderPatientDashboard = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#667eea' }}><i className="fas fa-user"></i> Patient Dashboard</h1>
      </div>
      
      <div className="dashboard-grid">
        <div className="card" style={{ textAlign: 'center' }}>
          <i className="fas fa-heartbeat" style={{ fontSize: '3rem', color: '#ff416c', marginBottom: '20px' }}></i>
          <h3 style={{ color: '#667eea', marginBottom: '15px' }}>Health Status</h3>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>Your health records are up to date</p>
          <div className="btn btn-success">
            <i className="fas fa-plus-circle"></i> Add Health Data
          </div>
        </div>
        
        <div className="card" style={{ textAlign: 'center' }}>
          <i className="fas fa-calendar-check" style={{ fontSize: '3rem', color: '#667eea', marginBottom: '20px' }}></i>
          <h3 style={{ color: '#667eea', marginBottom: '15px' }}>Next Appointment</h3>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>No upcoming appointments</p>
          <div className="btn btn-primary">
            <i className="fas fa-calendar-plus"></i> Book Appointment
          </div>
        </div>
        
        <div className="card" style={{ textAlign: 'center' }}>
          <i className="fas fa-file-medical" style={{ fontSize: '3rem', color: '#11998e', marginBottom: '20px' }}></i>
          <h3 style={{ color: '#667eea', marginBottom: '15px' }}>Medical Records</h3>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>5 records available</p>
          <div className="btn btn-info">
            <i className="fas fa-eye"></i> View Records
          </div>
        </div>
      </div>
      
      <div className="card">
        <h3 style={{ color: '#667eea', marginBottom: '20px' }}><i className="fas fa-bell"></i> Recent Notifications</h3>
        <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '10px' }}>
          <p style={{ margin: 0, color: '#6b7280' }}>
            <i className="fas fa-info-circle"></i> Welcome to Rwanda Hospital Management System! Your account has been successfully created.
          </p>
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => {
    switch (user?.role) {
      case 'admin':
        return renderAdminDashboard();
      case 'doctor':
        return renderDoctorDashboard();
      case 'nurse':
        return renderAdminDashboard();
      default:
        return renderPatientDashboard();
    }
  };

  return (
    <div className="container">
      {renderDashboard()}
    </div>
  );
};

// Departments Component
const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    headDoctor: '',
    staffCount: ''
  });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/departments');
      setDepartments(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDepartment) {
        await axios.put(`/api/departments/${editingDepartment._id}`, formData);
      } else {
        await axios.post('/api/departments', formData);
      }
      fetchDepartments();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving department:', error);
    }
  };

  const handleEdit = (department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name || '',
      description: department.description || '',
      headDoctor: department.headDoctor || '',
      staffCount: department.staffCount || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this department?')) {
      try {
        await axios.delete(`/api/departments/${id}`);
        fetchDepartments();
      } catch (error) {
        console.error('Error deleting department:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      headDoctor: '',
      staffCount: ''
    });
    setEditingDepartment(null);
  };

  const filteredDepartments = departments.filter(department =>
    department.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    department.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#667eea' }}><i className="fas fa-building"></i> Departments</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="fas fa-plus"></i> Add Department
        </button>
      </div>

      <div className="search-bar">
        <i className="fas fa-search"></i>
        <input
          type="text"
          placeholder="Search departments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Department Name</th>
                <th>Description</th>
                <th>Head Doctor</th>
                <th>Staff Count</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDepartments.map((department) => (
                <tr key={department._id}>
                  <td><strong>{department.name}</strong></td>
                  <td>{department.description}</td>
                  <td>{department.headDoctor}</td>
                  <td>{department.staffCount}</td>
                  <td>
                    <button
                      className="btn btn-warning"
                      onClick={() => handleEdit(department)}
                      style={{ marginRight: '10px' }}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(department._id)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingDepartment ? 'Edit Department' : 'Add New Department'}</h2>
              <button className="close-btn" onClick={() => { setShowModal(false); resetForm(); }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Department Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  required
                ></textarea>
              </div>
              <div className="form-group">
                <label>Head Doctor</label>
                <input
                  type="text"
                  name="headDoctor"
                  value={formData.headDoctor}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Staff Count</label>
                <input
                  type="number"
                  name="staffCount"
                  value={formData.staffCount}
                  onChange={handleInputChange}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingDepartment ? 'Update Department' : 'Add Department'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Inventory Component
const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    itemName: '',
    category: '',
    quantity: '',
    unitPrice: '',
    supplier: '',
    expiryDate: '',
    status: 'available'
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/inventory');
      setInventory(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await axios.put(`/api/inventory/${editingItem._id}`, formData);
      } else {
        await axios.post('/api/inventory', formData);
      }
      fetchInventory();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving inventory item:', error);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      itemName: item.itemName || '',
      category: item.category || '',
      quantity: item.quantity || '',
      unitPrice: item.unitPrice || '',
      supplier: item.supplier || '',
      expiryDate: item.expiryDate ? item.expiryDate.split('T')[0] : '',
      status: item.status || 'available'
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this inventory item?')) {
      try {
        await axios.delete(`/api/inventory/${id}`);
        fetchInventory();
      } catch (error) {
        console.error('Error deleting inventory item:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      itemName: '',
      category: '',
      quantity: '',
      unitPrice: '',
      supplier: '',
      expiryDate: '',
      status: 'available'
    });
    setEditingItem(null);
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      available: 'badge-available',
      low: 'badge-low',
      out: 'badge-out'
    };
    return (
      <span className={`badge ${statusClasses[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredInventory = inventory.filter(item =>
    item.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.unitPrice || 0), 0);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#667eea' }}><i className="fas fa-boxes"></i> Inventory Management</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="fas fa-plus"></i> Add Item
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <h3>RWF {totalValue.toLocaleString()}</h3>
          <p>Total Inventory Value</p>
        </div>
        <div className="stat-card">
          <h3>{inventory.filter(i => i.status === 'available').length}</h3>
          <p>Available Items</p>
        </div>
        <div className="stat-card">
          <h3>{inventory.filter(i => i.status === 'low').length}</h3>
          <p>Low Stock Items</p>
        </div>
        <div className="stat-card">
          <h3>{inventory.filter(i => i.status === 'out').length}</h3>
          <p>Out of Stock</p>
        </div>
      </div>

      <div className="search-bar">
        <i className="fas fa-search"></i>
        <input
          type="text"
          placeholder="Search inventory..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Supplier</th>
                <th>Expiry Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => (
                <tr key={item._id}>
                  <td><strong>{item.itemName}</strong></td>
                  <td>{item.category}</td>
                  <td>{item.quantity}</td>
                  <td>RWF {item.unitPrice?.toLocaleString()}</td>
                  <td>{item.supplier}</td>
                  <td>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}</td>
                  <td>{getStatusBadge(item.status)}</td>
                  <td>
                    <button
                      className="btn btn-warning"
                      onClick={() => handleEdit(item)}
                      style={{ marginRight: '10px' }}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(item._id)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}</h2>
              <button className="close-btn" onClick={() => { setShowModal(false); resetForm(); }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Item Name *</label>
                <input
                  type="text"
                  name="itemName"
                  value={formData.itemName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Category *</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Quantity *</label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Unit Price (RWF) *</label>
                <input
                  type="number"
                  name="unitPrice"
                  value={formData.unitPrice}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Supplier</label>
                <input
                  type="text"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Expiry Date</label>
                <input
                  type="date"
                  name="expiryDate"
                  value={formData.expiryDate}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="available">Available</option>
                  <option value="low">Low Stock</option>
                  <option value="out">Out of Stock</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingItem ? 'Update Item' : 'Add Item'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Patients Component (Updated)
const Patients = () => {
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    emergencyContact: '',
    medicalHistory: '',
    bloodType: '',
    allergies: ''
  });

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/patients');
      setPatients(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching patients:', error);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPatient) {
        await axios.put(`/api/patients/${editingPatient._id}`, formData);
      } else {
        await axios.post('/api/patients', formData);
      }
      fetchPatients();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving patient:', error);
    }
  };

  const handleEdit = (patient) => {
    setEditingPatient(patient);
    setFormData({
      firstName: patient.firstName || '',
      lastName: patient.lastName || '',
      dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.split('T')[0] : '',
      gender: patient.gender || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      emergencyContact: patient.emergencyContact || '',
      medicalHistory: patient.medicalHistory || '',
      bloodType: patient.bloodType || '',
      allergies: patient.allergies || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this patient?')) {
      try {
        await axios.delete(`/api/patients/${id}`);
        fetchPatients();
      } catch (error) {
        console.error('Error deleting patient:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: '',
      phone: '',
      email: '',
      address: '',
      emergencyContact: '',
      medicalHistory: '',
      bloodType: '',
      allergies: ''
    });
    setEditingPatient(null);
  };

  const filteredPatients = patients.filter(patient =>
    patient.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone?.includes(searchTerm)
  );

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#667eea' }}><i className="fas fa-user-injured"></i> Patients Management</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="fas fa-plus"></i> Add Patient
        </button>
      </div>

      <div className="search-bar">
        <i className="fas fa-search"></i>
        <input
          type="text"
          placeholder="Search patients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Gender</th>
                <th>Blood Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((patient) => (
                <tr key={patient._id}>
                  <td>{patient.firstName} {patient.lastName}</td>
                  <td>{patient.phone}</td>
                  <td>{patient.email}</td>
                  <td>{patient.gender}</td>
                  <td>{patient.bloodType || 'N/A'}</td>
                  <td>
                    <button
                      className="btn btn-warning"
                      onClick={() => handleEdit(patient)}
                      style={{ marginRight: '10px' }}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(patient._id)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingPatient ? 'Edit Patient' : 'Add New Patient'}</h2>
              <button className="close-btn" onClick={() => { setShowModal(false); resetForm(); }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select name="gender" value={formData.gender} onChange={handleInputChange}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows="3"
                ></textarea>
              </div>
              <div className="form-group">
                <label>Emergency Contact</label>
                <input
                  type="text"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Blood Type</label>
                <select name="bloodType" value={formData.bloodType} onChange={handleInputChange}>
                  <option value="">Select Blood Type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div className="form-group">
                <label>Allergies</label>
                <textarea
                  name="allergies"
                  value={formData.allergies}
                  onChange={handleInputChange}
                  rows="2"
                  placeholder="List any known allergies"
                ></textarea>
              </div>
              <div className="form-group">
                <label>Medical History</label>
                <textarea
                  name="medicalHistory"
                  value={formData.medicalHistory}
                  onChange={handleInputChange}
                  rows="3"
                ></textarea>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingPatient ? 'Update Patient' : 'Add Patient'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Doctors Component (Updated)
const Doctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    specialization: '',
    phone: '',
    email: '',
    licenseNumber: '',
    department: '',
    experience: '',
    avatar: ''
  });

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/doctors');
      setDoctors(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDoctor) {
        await axios.put(`/api/doctors/${editingDoctor._id}`, formData);
      } else {
        await axios.post('/api/doctors', formData);
      }
      fetchDoctors();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving doctor:', error);
    }
  };

  const handleEdit = (doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      firstName: doctor.firstName || '',
      lastName: doctor.lastName || '',
      specialization: doctor.specialization || '',
      phone: doctor.phone || '',
      email: doctor.email || '',
      licenseNumber: doctor.licenseNumber || '',
      department: doctor.department || '',
      experience: doctor.experience || '',
      avatar: doctor.avatar || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this doctor?')) {
      try {
        await axios.delete(`/api/doctors/${id}`);
        fetchDoctors();
      } catch (error) {
        console.error('Error deleting doctor:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      specialization: '',
      phone: '',
      email: '',
      licenseNumber: '',
      department: '',
      experience: '',
      avatar: ''
    });
    setEditingDoctor(null);
  };

  const filteredDoctors = doctors.filter(doctor =>
    doctor.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.specialization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#667eea' }}><i className="fas fa-user-md"></i> Doctors Management</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="fas fa-plus"></i> Add Doctor
        </button>
      </div>

      <div className="search-bar">
        <i className="fas fa-search"></i>
        <input
          type="text"
          placeholder="Search doctors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Specialization</th>
                <th>Department</th>
                <th>Experience (Years)</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctors.map((doctor) => (
                <tr key={doctor._id}>
                  <td><strong>Dr. {doctor.firstName} {doctor.lastName}</strong></td>
                  <td>{doctor.specialization}</td>
                  <td>{doctor.department || 'General'}</td>
                  <td>{doctor.experience || 'N/A'}</td>
                  <td>{doctor.phone}</td>
                  <td>{doctor.email}</td>
                  <td>
                    <button
                      className="btn btn-warning"
                      onClick={() => handleEdit(doctor)}
                      style={{ marginRight: '10px' }}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(doctor._id)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}</h2>
              <button className="close-btn" onClick={() => { setShowModal(false); resetForm(); }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Specialization *</label>
                <input
                  type="text"
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  placeholder="e.g., Cardiology, Pediatrics"
                />
              </div>
              <div className="form-group">
                <label>Years of Experience</label>
                <input
                  type="number"
                  name="experience"
                  value={formData.experience}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>License Number</label>
                <input
                  type="text"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Avatar URL (Optional)</label>
                <input
                  type="url"
                  name="avatar"
                  value={formData.avatar}
                  onChange={handleInputChange}
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingDoctor ? 'Update Doctor' : 'Add Doctor'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Appointments Component (Updated)
const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    appointmentDate: '',
    reason: '',
    status: 'pending',
    priority: 'medium'
  });

  useEffect(() => {
    fetchAppointments();
    fetchPatients();
    fetchDoctors();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/appointments');
      setAppointments(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await axios.get('/api/patients');
      setPatients(response.data);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await axios.get('/api/doctors');
      setDoctors(response.data);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingAppointment) {
        await axios.put(`/api/appointments/${editingAppointment._id}`, formData);
      } else {
        await axios.post('/api/appointments', formData);
      }
      fetchAppointments();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving appointment:', error);
    }
  };

  const handleEdit = (appointment) => {
    setEditingAppointment(appointment);
    setFormData({
      patientId: appointment.patientId?._id || appointment.patientId || '',
      doctorId: appointment.doctorId?._id || appointment.doctorId || '',
      appointmentDate: appointment.appointmentDate ? appointment.appointmentDate.split('T')[0] : '',
      reason: appointment.reason || '',
      status: appointment.status || 'pending',
      priority: appointment.priority || 'medium'
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this appointment?')) {
      try {
        await axios.delete(`/api/appointments/${id}`);
        fetchAppointments();
      } catch (error) {
        console.error('Error deleting appointment:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      patientId: '',
      doctorId: '',
      appointmentDate: '',
      reason: '',
      status: 'pending',
      priority: 'medium'
    });
    setEditingAppointment(null);
  };

  const filteredAppointments = appointments.filter(appointment =>
    (appointment.patientId?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     appointment.patientId?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     appointment.doctorId?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     appointment.doctorId?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     appointment.reason?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (status) => {
    const statusClasses = {
      pending: 'badge-pending',
      confirmed: 'badge-confirmed',
      completed: 'badge-completed',
      cancelled: 'badge-cancelled'
    };
    return (
      <span className={`badge ${statusClasses[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityClasses = {
      high: 'priority-high',
      medium: 'priority-medium',
      low: 'priority-low'
    };
    return (
      <span className={priorityClasses[priority]}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#667eea' }}><i className="fas fa-calendar-check"></i> Appointments Management</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="fas fa-plus"></i> Add Appointment
        </button>
      </div>

      <div className="search-bar">
        <i className="fas fa-search"></i>
        <input
          type="text"
          placeholder="Search appointments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Date & Time</th>
                <th>Reason</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((appointment) => (
                <tr key={appointment._id}>
                  <td>{appointment.patientId?.firstName} {appointment.patientId?.lastName}</td>
                  <td>Dr. {appointment.doctorId?.firstName} {appointment.doctorId?.lastName}</td>
                  <td>{new Date(appointment.appointmentDate).toLocaleString()}</td>
                  <td>{appointment.reason}</td>
                  <td>{getPriorityBadge(appointment.priority)}</td>
                  <td>{getStatusBadge(appointment.status)}</td>
                  <td>
                    <button
                      className="btn btn-warning"
                      onClick={() => handleEdit(appointment)}
                      style={{ marginRight: '10px' }}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(appointment._id)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingAppointment ? 'Edit Appointment' : 'Add New Appointment'}</h2>
              <button className="close-btn" onClick={() => { setShowModal(false); resetForm(); }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Patient *</label>
                <select
                  name="patientId"
                  value={formData.patientId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Patient</option>
                  {patients.map(patient => (
                    <option key={patient._id} value={patient._id}>
                      {patient.firstName} {patient.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Doctor *</label>
                <select
                  name="doctorId"
                  value={formData.doctorId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Doctor</option>
                  {doctors.map(doctor => (
                    <option key={doctor._id} value={doctor._id}>
                      Dr. {doctor.firstName} {doctor.lastName} - {doctor.specialization}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Appointment Date & Time *</label>
                <input
                  type="datetime-local"
                  name="appointmentDate"
                  value={formData.appointmentDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Reason *</label>
                <input
                  type="text"
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingAppointment ? 'Update Appointment' : 'Add Appointment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Medical Records Component (Updated)
const MedicalRecords = () => {
  const [records, setRecords] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    diagnosis: '',
    prescription: '',
    treatment: '',
    notes: '',
    followUpDate: '',
    attachments: []
  });

  useEffect(() => {
    fetchRecords();
    fetchPatients();
    fetchDoctors();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/medical-records');
      setRecords(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching medical records:', error);
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await axios.get('/api/patients');
      setPatients(response.data);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await axios.get('/api/doctors');
      setDoctors(response.data);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRecord) {
        await axios.put(`/api/medical-records/${editingRecord._id}`, formData);
      } else {
        await axios.post('/api/medical-records', formData);
      }
      fetchRecords();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving medical record:', error);
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setFormData({
      patientId: record.patientId?._id || record.patientId || '',
      doctorId: record.doctorId?._id || record.doctorId || '',
      diagnosis: record.diagnosis || '',
      prescription: record.prescription || '',
      treatment: record.treatment || '',
      notes: record.notes || '',
      followUpDate: record.followUpDate ? record.followUpDate.split('T')[0] : '',
      attachments: record.attachments || []
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this medical record?')) {
      try {
        await axios.delete(`/api/medical-records/${id}`);
        fetchRecords();
      } catch (error) {
        console.error('Error deleting medical record:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      patientId: '',
      doctorId: '',
      diagnosis: '',
      prescription: '',
      treatment: '',
      notes: '',
      followUpDate: '',
      attachments: []
    });
    setEditingRecord(null);
  };

  const filteredRecords = records.filter(record =>
    (record.patientId?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     record.patientId?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     record.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     record.treatment?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#667eea' }}><i className="fas fa-file-medical"></i> Medical Records</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="fas fa-plus"></i> Add Medical Record
        </button>
      </div>

      <div className="search-bar">
        <i className="fas fa-search"></i>
        <input
          type="text"
          placeholder="Search medical records..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Diagnosis</th>
                <th>Date</th>
                <th>Follow-up</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record._id}>
                  <td>{record.patientId?.firstName} {record.patientId?.lastName}</td>
                  <td>Dr. {record.doctorId?.firstName} {record.doctorId?.lastName}</td>
                  <td>{record.diagnosis}</td>
                  <td>{new Date(record.createdAt).toLocaleDateString()}</td>
                  <td>{record.followUpDate ? new Date(record.followUpDate).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <button
                      className="btn btn-warning"
                      onClick={() => handleEdit(record)}
                      style={{ marginRight: '10px' }}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(record._id)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingRecord ? 'Edit Medical Record' : 'Add New Medical Record'}</h2>
              <button className="close-btn" onClick={() => { setShowModal(false); resetForm(); }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Patient *</label>
                <select
                  name="patientId"
                  value={formData.patientId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Patient</option>
                  {patients.map(patient => (
                    <option key={patient._id} value={patient._id}>
                      {patient.firstName} {patient.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Doctor *</label>
                <select
                  name="doctorId"
                  value={formData.doctorId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Doctor</option>
                  {doctors.map(doctor => (
                    <option key={doctor._id} value={doctor._id}>
                      Dr. {doctor.firstName} {doctor.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Diagnosis *</label>
                <textarea
                  name="diagnosis"
                  value={formData.diagnosis}
                  onChange={handleInputChange}
                  rows="3"
                  required
                ></textarea>
              </div>
              <div className="form-group">
                <label>Prescription</label>
                <textarea
                  name="prescription"
                  value={formData.prescription}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Medication prescriptions"
                ></textarea>
              </div>
              <div className="form-group">
                <label>Treatment</label>
                <textarea
                  name="treatment"
                  value={formData.treatment}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Treatment plan and procedures"
                ></textarea>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                ></textarea>
              </div>
              <div className="form-group">
                <label>Follow-up Date</label>
                <input
                  type="date"
                  name="followUpDate"
                  value={formData.followUpDate}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Attachments (URLs, comma separated)</label>
                <textarea
                  name="attachments"
                  value={formData.attachments.join(', ')}
                  onChange={(e) => setFormData({
                    ...formData,
                    attachments: e.target.value.split(',').map(url => url.trim()).filter(url => url)
                  })}
                  rows="2"
                  placeholder="https://example.com/report1.pdf, https://example.com/xray.jpg"
                ></textarea>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingRecord ? 'Update Record' : 'Add Record'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Billing Component (Updated)
const Billing = () => {
  const [bills, setBills] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    patientId: '',
    amount: '',
    description: '',
    dueDate: '',
    status: 'pending',
    paymentMethod: '',
    invoiceNumber: ''
  });

  useEffect(() => {
    fetchBills();
    fetchPatients();
  }, []);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/billing');
      setBills(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching bills:', error);
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await axios.get('/api/patients');
      setPatients(response.data);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBill) {
        await axios.put(`/api/billing/${editingBill._id}`, formData);
      } else {
        await axios.post('/api/billing', formData);
      }
      fetchBills();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving bill:', error);
    }
  };

  const handleEdit = (bill) => {
    setEditingBill(bill);
    setFormData({
      patientId: bill.patientId?._id || bill.patientId || '',
      amount: bill.amount || '',
      description: bill.description || '',
      dueDate: bill.dueDate ? bill.dueDate.split('T')[0] : '',
      status: bill.status || 'pending',
      paymentMethod: bill.paymentMethod || '',
      invoiceNumber: bill.invoiceNumber || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this bill?')) {
      try {
        await axios.delete(`/api/billing/${id}`);
        fetchBills();
      } catch (error) {
        console.error('Error deleting bill:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      patientId: '',
      amount: '',
      description: '',
      dueDate: '',
      status: 'pending',
      paymentMethod: '',
      invoiceNumber: ''
    });
    setEditingBill(null);
  };

  const filteredBills = bills.filter(bill =>
    (bill.patientId?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     bill.patientId?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     bill.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     bill.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (status) => {
    const statusClasses = {
      pending: 'badge-pending',
      paid: 'badge-paid',
      overdue: 'badge-overdue'
    };
    return (
      <span className={`badge ${statusClasses[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const totalRevenue = bills
    .filter(bill => bill.status === 'paid')
    .reduce((sum, bill) => sum + (bill.amount || 0), 0);

  const pendingRevenue = bills
    .filter(bill => bill.status === 'pending')
    .reduce((sum, bill) => sum + (bill.amount || 0), 0);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#667eea' }}><i className="fas fa-money-bill"></i> Billing Management</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="fas fa-plus"></i> Add Bill
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <i className="fas fa-money-bill-wave" style={{ fontSize: '2.5rem', marginBottom: '15px', color: '#11998e' }}></i>
          <h3>RWF {totalRevenue.toLocaleString()}</h3>
          <p>Total Revenue</p>
        </div>
        <div className="stat-card">
          <i className="fas fa-clock" style={{ fontSize: '2.5rem', marginBottom: '15px', color: '#f09819' }}></i>
          <h3>RWF {pendingRevenue.toLocaleString()}</h3>
          <p>Pending Payments</p>
        </div>
        <div className="stat-card">
          <i className="fas fa-file-invoice" style={{ fontSize: '2.5rem', marginBottom: '15px', color: '#667eea' }}></i>
          <h3>{bills.filter(b => b.status === 'pending').length}</h3>
          <p>Pending Bills</p>
        </div>
        <div className="stat-card">
          <i className="fas fa-check-circle" style={{ fontSize: '2.5rem', marginBottom: '15px', color: '#11998e' }}></i>
          <h3>{bills.filter(b => b.status === 'paid').length}</h3>
          <p>Paid Bills</p>
        </div>
      </div>

      <div className="search-bar">
        <i className="fas fa-search"></i>
        <input
          type="text"
          placeholder="Search bills..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Patient</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill) => (
                <tr key={bill._id}>
                  <td><strong>{bill.invoiceNumber || `INV-${bill._id.substring(0,8)}`}</strong></td>
                  <td>{bill.patientId?.firstName} {bill.patientId?.lastName}</td>
                  <td>{bill.description}</td>
                  <td><strong>RWF {bill.amount?.toLocaleString()}</strong></td>
                  <td>{new Date(bill.dueDate).toLocaleDateString()}</td>
                  <td>{bill.paymentMethod || 'N/A'}</td>
                  <td>{getStatusBadge(bill.status)}</td>
                  <td>
                    <button
                      className="btn btn-warning"
                      onClick={() => handleEdit(bill)}
                      style={{ marginRight: '10px' }}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(bill._id)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingBill ? 'Edit Bill' : 'Add New Bill'}</h2>
              <button className="close-btn" onClick={() => { setShowModal(false); resetForm(); }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Patient *</label>
                <select
                  name="patientId"
                  value={formData.patientId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Patient</option>
                  {patients.map(patient => (
                    <option key={patient._id} value={patient._id}>
                      {patient.firstName} {patient.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Invoice Number</label>
                <input
                  type="text"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleInputChange}
                  placeholder="e.g., INV-2023-001"
                />
              </div>
              <div className="form-group">
                <label>Amount (RWF) *</label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description *</label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Due Date *</label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Payment Method</label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleInputChange}
                >
                  <option value="">Select Payment Method</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Insurance">Insurance</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingBill ? 'Update Bill' : 'Add Bill'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Login Component
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();

  useEffect(() => {
    if (user) {
      window.location.href = '/dashboard';
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    const result = await login(email, password);
    if (!result.success) {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div className="container" style={{ maxWidth: '450px', margin: '100px auto' }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🏥</div>
          <h2 style={{ color: '#667eea', marginBottom: '10px' }}>
            Rwanda Hospital Login
          </h2>
          <p style={{ color: '#6b7280' }}>Welcome back! Please sign in to continue</p>
        </div>
        
        {error && (
          <div className="alert alert-error">
            <i className="fas fa-exclamation-circle"></i> {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label><i className="fas fa-envelope"></i> Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label><i className="fas fa-lock"></i> Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', marginRight: '10px' }}></div>
                Signing in...
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt"></i> Login
              </>
            )}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '25px', color: '#6b7280' }}>
          Don't have an account? <Link to="/register" style={{ color: '#667eea', fontWeight: '600' }}>Register</Link>
        </p>
      </div>
    </div>
  );
};

// Register Component
const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'patient'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleChange = (e) => {
    if (e.target.name === 'role' && e.target.value === 'admin') {
      return;
    }
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    const result = await register(formData);
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="container" style={{ maxWidth: '450px', margin: '100px auto' }}>
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: '25px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '15px', color: '#11998e' }}>✅</div>
            <h2 style={{ color: '#11998e', marginBottom: '15px' }}>
              Registration Successful!
            </h2>
            <p style={{ color: '#6b7280' }}>
              Your account has been created successfully.
            </p>
          </div>
          <Link to="/login" className="btn btn-primary" style={{ width: '100%', textAlign: 'center' }}>
            <i className="fas fa-arrow-right"></i> Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '550px', margin: '50px auto' }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📝</div>
          <h2 style={{ color: '#667eea', marginBottom: '10px' }}>
            Register Account
          </h2>
          <p style={{ color: '#6b7280' }}>Create your account to get started</p>
        </div>
        
        {error && (
          <div className="alert alert-error">
            <i className="fas fa-exclamation-circle"></i> {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label><i className="fas fa-user"></i> Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label><i className="fas fa-envelope"></i> Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label><i className="fas fa-lock"></i> Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label><i className="fas fa-phone"></i> Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter your phone number"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label><i className="fas fa-user-tag"></i> Role</label>
            <select 
              name="role" 
              value={formData.role} 
              onChange={handleChange}
              disabled={loading}
            >
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
            </select>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '8px' }}>
              <i className="fas fa-info-circle"></i> Note: Admin accounts can only be created by system administrators.
            </p>
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', marginRight: '10px' }}></div>
                Creating Account...
              </>
            ) : (
              <>
                <i className="fas fa-user-plus"></i> Register
              </>
            )}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '25px', color: '#6b7280' }}>
          Already have an account? <Link to="/login" style={{ color: '#667eea', fontWeight: '600' }}>Login</Link>
        </p>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  return (
    <AuthProvider>
      <Router>
        <div style={{ minHeight: '100vh', backgroundColor: 'rgba(245, 247, 250, 0.8)' }}>
          <Navigation />
          <Routes>
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/patients" element={
              <ProtectedRoute allowedRoles={['admin', 'doctor', 'nurse']}>
                <Patients />
              </ProtectedRoute>
            } />
            <Route path="/doctors" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Doctors />
              </ProtectedRoute>
            } />
            <Route path="/appointments" element={
              <ProtectedRoute>
                <Appointments />
              </ProtectedRoute>
            } />
            <Route path="/medical-records" element={
              <ProtectedRoute>
                <MedicalRecords />
              </ProtectedRoute>
            } />
            <Route path="/billing" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Billing />
              </ProtectedRoute>
            } />
            <Route path="/departments" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Departments />
              </ProtectedRoute>
            } />
            <Route path="/inventory" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Inventory />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;