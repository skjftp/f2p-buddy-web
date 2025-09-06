import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <div className="landing-content">
        <div className="landing-header">
          <h1 className="landing-title">F2P Buddy</h1>
          <p className="landing-subtitle">Sales Incentive Management Platform</p>
        </div>
        
        <div className="login-options">
          <button 
            className="login-option admin-option"
            onClick={() => navigate('/login?role=admin')}
          >
            <div className="option-icon">👨‍💼</div>
            <div className="option-content">
              <h3>Login as Admin</h3>
              <p>Manage campaigns, track performance, and oversee your sales team</p>
            </div>
            <div className="option-arrow">→</div>
          </button>
          
          <button 
            className="login-option employee-option"
            onClick={() => navigate('/login?role=employee')}
          >
            <div className="option-icon">👥</div>
            <div className="option-content">
              <h3>Login as Employee</h3>
              <p>Track your achievements, view leaderboards, and earn rewards</p>
            </div>
            <div className="option-arrow">→</div>
          </button>
        </div>
        
        <div className="landing-features">
          <div className="feature-item">
            <span className="feature-icon">🎯</span>
            <span>Campaign Management</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📊</span>
            <span>Real-time Analytics</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🏆</span>
            <span>Achievement Tracking</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">💰</span>
            <span>Reward Management</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;