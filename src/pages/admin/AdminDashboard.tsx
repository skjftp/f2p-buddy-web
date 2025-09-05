import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { Campaign } from '../../store/slices/campaignSlice';
import CampaignWizard from '../../components/campaigns/CampaignWizard/CampaignWizard';
import CampaignCard from '../../components/campaigns/CampaignCard';
import AnalyticsDashboard from '../../components/analytics/AnalyticsDashboard';
import EmployeeManagement from '../../components/admin/EmployeeManagement';

type TabType = 'overview' | 'campaigns' | 'employees' | 'analytics';

const AdminDashboard: React.FC = () => {
  const { user, organization, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCampaignWizard, setShowCampaignWizard] = useState(false);
  const [organizationStats, setOrganizationStats] = useState({
    totalEmployees: 0,
    activeCampaigns: 0,
    totalAchievements: 0,
    completionRate: 0
  });

  useEffect(() => {
    if (!organization?.id) return;

    // Listen to campaigns in real-time
    const setupCampaignListener = async () => {
      try {
        const dbInstance = await getFirestoreInstance();
        const campaignsQuery = query(
          collection(dbInstance, 'campaigns'),
          where('orgId', '==', organization.id),
          orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(campaignsQuery, (snapshot) => {
      const campaignList: Campaign[] = [];
      snapshot.forEach((doc) => {
        campaignList.push({ id: doc.id, ...doc.data() } as Campaign);
      });
      
      setCampaigns(campaignList);
      
      // Update stats
          setOrganizationStats(prev => ({
            ...prev,
            activeCampaigns: campaignList.filter(c => c.status === 'active').length
          }));
          
          setLoading(false);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('Failed to setup campaign listener:', error);
        setLoading(false);
      }
    };
    
    let unsubscribe: (() => void) | null = null;
    setupCampaignListener().then(unsub => {
      unsubscribe = unsub;
    });
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [organization?.id]);

  const tabContent = {
    overview: (
      <div className="overview-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <h3>{organizationStats.totalEmployees}</h3>
              <p>Total Employees</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-info">
              <h3>{organizationStats.activeCampaigns}</h3>
              <p>Active Campaigns</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-info">
              <h3>{organizationStats.totalAchievements}</h3>
              <p>Total Achievements</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-info">
              <h3>{organizationStats.completionRate}%</h3>
              <p>Completion Rate</p>
            </div>
          </div>
        </div>

        <div className="recent-activities">
          <h3>Recent Campaigns</h3>
          <div className="campaigns-grid">
            {campaigns.slice(0, 4).map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                userRole="admin"
                onEdit={() => {/* Handle edit */}}
                onView={() => {/* Handle view */}}
              />
            ))}
          </div>
          
          {campaigns.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🎯</div>
              <h3>No Campaigns Yet</h3>
              <p>Create your first campaign to get started.</p>
              <button 
                className="btn"
                onClick={() => setShowCampaignWizard(true)}
              >
                Create Campaign
              </button>
            </div>
          )}
        </div>
      </div>
    ),
    
    campaigns: (
      <div className="campaigns-content">
        <div className="content-header">
          <h2>Campaign Management</h2>
          <button 
            className="btn"
            onClick={() => setShowCampaignWizard(true)}
          >
            + Create Campaign
          </button>
        </div>
        
        <div className="campaign-filters">
          <div className="filter-tabs">
            <button className="filter-tab active">All</button>
            <button className="filter-tab">Active</button>
            <button className="filter-tab">Draft</button>
            <button className="filter-tab">Completed</button>
          </div>
        </div>
        
        <div className="campaigns-grid">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              userRole="admin"
              onEdit={() => {/* Handle edit */}}
              onView={() => {/* Handle view */}}
            />
          ))}
        </div>
      </div>
    ),
    
    employees: (
      <EmployeeManagement organizationId={organization?.id || ''} />
    ),
    
    analytics: (
      <AnalyticsDashboard organizationId={organization?.id || ''} />
    )
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <div className="org-logo">
              {organization?.logo ? (
                <img src={organization.logo} alt={organization.name} />
              ) : (
                <div className="logo-placeholder">
                  {organization?.name?.charAt(0) || 'O'}
                </div>
              )}
            </div>
            <div className="header-text">
              <h1>{organization?.name} Dashboard</h1>
              <p>Admin Panel</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-icon" title="Settings">
              ⚙️
            </button>
            <button className="btn-icon" title="Notifications">
              🔔
            </button>
            <button className="btn-icon" onClick={logout} title="Sign Out">
              🚪
            </button>
          </div>
        </div>
      </header>

      <nav className="dashboard-nav">
        <div className="nav-tabs">
          <button 
            className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button 
            className={`nav-tab ${activeTab === 'campaigns' ? 'active' : ''}`}
            onClick={() => setActiveTab('campaigns')}
          >
            🎯 Campaigns
          </button>
          <button 
            className={`nav-tab ${activeTab === 'employees' ? 'active' : ''}`}
            onClick={() => setActiveTab('employees')}
          >
            👥 Employees
          </button>
          <button 
            className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            📈 Analytics
          </button>
        </div>
      </nav>

      <main className="dashboard-main">
        {tabContent[activeTab]}
      </main>

      {showCampaignWizard && (
        <div className="modal-overlay">
          <div className="modal-content">
            <CampaignWizard
              onClose={() => setShowCampaignWizard(false)}
              onComplete={() => {
                setShowCampaignWizard(false);
                // Refresh campaigns will happen via real-time listener
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;