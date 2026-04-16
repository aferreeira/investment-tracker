import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/axiosConfig';
import './NavBar.css';

function NavBar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = async () => {
    try {
      await api.post('http://localhost:9100/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear storage regardless of API response
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  // Don't show navbar on login page
  if (location.pathname === '/login') {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-title">Investment Tracker</div>
        
        <div className="navbar-sections">
          <div className="nav-links">
            <a 
              href="#/brazil" 
              className={`nav-link ${location.pathname === '/brazil' ? 'active' : ''}`}
              onClick={() => navigate('/brazil')}
            >
              Brazil
            </a>
            <a 
              href="#/canada"
              className={`nav-link ${location.pathname === '/canada' ? 'active' : ''}`}
              onClick={() => navigate('/canada')}
            >
              Canada
            </a>
            <a 
              href="#/bulk-assets"
              className={`nav-link ${location.pathname === '/bulk-assets' ? 'active' : ''}`}
              onClick={() => navigate('/bulk-assets')}
            >
              Bulk Import
            </a>
          </div>

          <div className="navbar-user">
            <div className="user-email">{user.email || 'User'}</div>
            <div className="profile-icon-wrapper">
              <button
                className="profile-icon"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                title="User Profile"
              >
                👤
              </button>
              {showProfileMenu && (
                <div className="profile-menu">
                  <button 
                    className="menu-item"
                    onClick={() => {
                      handleProfileClick();
                      setShowProfileMenu(false);
                    }}
                  >
                    📋 Profile Settings
                  </button>
                  <button 
                    className="menu-item logout"
                    onClick={() => {
                      handleLogout();
                      setShowProfileMenu(false);
                    }}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default NavBar;
