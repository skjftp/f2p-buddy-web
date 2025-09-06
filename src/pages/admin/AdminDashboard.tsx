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
  const { organization, logout } = useAuth();
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
    const setupCampaignListener = async (): Promise<(() => void) | undefined> => {
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
        return undefined;
      }
    };
    
    let unsubscribe: (() => void) | null = null;
    setupCampaignListener().then(unsub => {
      if (unsub) {
        unsubscribe = unsub;
      }
    });
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [organization?.id]);

  const tabContent = {
    overview: (
      <div className="overview-content animate-fade-in">
        <div className="stats-grid stagger-animation">
          <div className="stat-card hover-lift glow-animation">
            <div className="stat-icon" style={{background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'}}>
              👥
            </div>
            <div className="stat-content">
              <div className="stat-value">{organizationStats.totalEmployees}</div>
              <div className="stat-title">Total Employees</div>
            </div>
          </div>
          
          <div className="stat-card hover-lift glow-animation">
            <div className="stat-icon" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
              🎯
            </div>
            <div className="stat-content">
              <div className="stat-value">{organizationStats.activeCampaigns}</div>
              <div className="stat-title">Active Campaigns</div>
            </div>
          </div>
          
          <div className="stat-card hover-lift glow-animation">
            <div className="stat-icon" style={{background: 'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)'}}>
              🏆
            </div>
            <div className="stat-content">
              <div className="stat-value">{organizationStats.totalAchievements}</div>
              <div className="stat-title">Total Achievements</div>
            </div>
          </div>
          
          <div className="stat-card hover-lift glow-animation">
            <div className="stat-icon" style={{background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'}}>
              📈
            </div>
            <div className="stat-content">
              <div className="stat-value">{organizationStats.completionRate.toFixed(1)}%</div>
              <div className="stat-title">Completion Rate</div>
            </div>
          </div>
        </div>

        <div className="recent-activities">
          <div className="section-header">
            <h3>Campaigns</h3>
            <button 
              className="btn-icon hover-glow"
              onClick={() => setShowCampaignWizard(true)}
              title="Create Campaign"
            >
              +
            </button>
          </div>
          
          <div className="campaigns-grid stagger-animation">
            {campaigns.slice(0, 4).map((campaign, index) => (
              <div key={campaign.id} style={{animationDelay: `${index * 0.1}s`}}>
                <CampaignCard
                  campaign={campaign}
                  userRole="admin"
                  onEdit={() => {/* Handle edit */}}
                  onView={() => {/* Handle view */}}
                />
              </div>
            ))}
          </div>
          
          {campaigns.length === 0 && (
            <div className="empty-state glass-effect animate-fade-in">
              <div className="empty-icon float-animation">🎯</div>
              <h3>No Campaigns</h3>
              <button 
                className="btn-icon hover-glow"
                onClick={() => setShowCampaignWizard(true)}
                title="Create Campaign"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    ),
    
    campaigns: (
      <div className="campaigns-content animate-fade-in">
        <div className="content-header">
          <h2>Campaigns</h2>
          <button 
            className="btn-icon hover-glow"
            onClick={() => setShowCampaignWizard(true)}
            title="Create Campaign"
          >
            +
          </button>
        </div>
        
        <div className="campaign-filters">
          <div className="filter-tabs glass-effect">
            <button className="filter-tab active">All Campaigns</button>
            <button className="filter-tab">🟢 Active</button>
            <button className="filter-tab">📝 Draft</button>
            <button className="filter-tab">✅ Completed</button>
          </div>
        </div>
        
        <div className="campaigns-grid stagger-animation">
          {campaigns.map((campaign, index) => (
            <div key={campaign.id} style={{animationDelay: `${index * 0.1}s`}} className="hover-lift">
              <CampaignCard
                campaign={campaign}
                userRole="admin"
                onEdit={() => {/* Handle edit */}}
                onView={() => {/* Handle view */}}
              />
            </div>
          ))}
        </div>
        
        {campaigns.length === 0 && (
          <div className="empty-state glass-effect animate-fade-in">
            <div className="empty-icon float-animation">🎯</div>
            <h3>No Campaigns</h3>
            <button 
              className="btn-icon hover-glow"
              onClick={() => setShowCampaignWizard(true)}
              title="Create Campaign"
            >
              +
            </button>
          </div>
        )}
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
      <header className="dashboard-header glass-effect">
        <div className="header-content">
          <div className="header-left">
            <div className="org-logo hover-scale">
              {organization?.logo ? (
                <img src={organization.logo} alt={organization.name} />
              ) : (
                <div className="logo-placeholder glow-animation">
                  {organization?.name?.charAt(0) || 'O'}
                </div>
              )}
            </div>
            <div className="header-text">
              <h1>{organization?.name || 'Organization'}</h1>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-icon hover-glow" title="Settings">
              ⚙️
            </button>
            <button className="btn-icon hover-glow" title="Notifications">
              🔔
            </button>
            <button className="btn-icon hover-glow" onClick={logout} title="Sign Out">
              🚪
            </button>
          </div>
        </div>
      </header>

      <nav className="dashboard-nav glass-effect">
        <div className="nav-tabs">
          <button 
            className={`nav-tab hover-glow ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            title="Overview"
          >
            📊
          </button>
          <button 
            className={`nav-tab hover-glow ${activeTab === 'campaigns' ? 'active' : ''}`}
            onClick={() => setActiveTab('campaigns')}
            title="Campaigns"
          >
            🎯
          </button>
          <button 
            className={`nav-tab hover-glow ${activeTab === 'employees' ? 'active' : ''}`}
            onClick={() => setActiveTab('employees')}
            title="Employees"
          >
            👥
          </button>
          <button 
            className={`nav-tab hover-glow ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
            title="Analytics"
          >
            📈
          </button>
        </div>
      </nav>

      <main className="dashboard-main">
        {tabContent[activeTab]}
      </main>

      {showCampaignWizard && (
        <div className="modal-overlay">
          <div className="modal-content glass-effect">
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