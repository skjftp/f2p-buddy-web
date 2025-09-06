import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { Campaign } from '../../store/slices/campaignSlice';
import NewCampaignWizard from '../../components/campaigns/CampaignWizard/NewCampaignWizard';
import CampaignEditWizard from '../../components/campaigns/CampaignEditWizard';
import CampaignCard from '../../components/campaigns/CampaignCard';
import AnalyticsDashboard from '../../components/analytics/AnalyticsDashboard';
import EmployeeManagement from '../../components/admin/EmployeeManagement';
import OrganizationSettings from '../../components/admin/OrganizationSettings';

type TabType = 'overview' | 'campaigns' | 'employees' | 'analytics' | 'settings';

const AdminDashboard: React.FC = () => {
  const { organization, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCampaignWizard, setShowCampaignWizard] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [organizationStats, setOrganizationStats] = useState({
    totalEmployees: 2,
    activeCampaigns: 0,
    totalAchievements: 1,
    completionRate: 0
  });

  useEffect(() => {
    if (!organization?.id) return;

    const setupCampaignListener = async (): Promise<(() => void) | undefined> => {
      try {
        if (!organization?.id) return undefined;
        
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

  const handleEditCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowEditModal(true);
  };

  const handleCloseEdit = () => {
    setShowEditModal(false);
    setSelectedCampaign(null);
  };

  const handleCampaignUpdate = () => {
    // Campaigns will update via real-time listener
    console.log('Campaign updated - real-time listener will refresh data');
  };

  const renderOverview = () => (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-value">{organizationStats.totalEmployees}</div>
          <div className="stat-title">Employees</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-value">{organizationStats.activeCampaigns}</div>
          <div className="stat-title">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-value">{organizationStats.totalAchievements}</div>
          <div className="stat-title">Achievements</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-value">{organizationStats.completionRate.toFixed(0)}%</div>
          <div className="stat-title">Complete</div>
        </div>
      </div>
      
      <div className="dashboard-section" style={{marginTop: '16px'}}>
        <div className="section-header">
          <h2>Recent Campaigns</h2>
          <button className="btn-icon" onClick={() => setShowCampaignWizard(true)} title="Create Campaign">
            +
          </button>
        </div>
        <div className="campaigns-grid">
          {campaigns.slice(0, 4).map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              userRole="admin"
              onEdit={() => handleEditCampaign(campaign)}
              onView={() => {}}
            />
          ))}
        </div>
        {campaigns.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h3>No Campaigns</h3>
            <button className="btn-icon" onClick={() => setShowCampaignWizard(true)}>+</button>
          </div>
        )}
      </div>
    </div>
  );

  const renderCampaigns = () => (
    <div>
      <div className="content-header">
        <h2>Campaigns</h2>
        <button className="btn-icon" onClick={() => setShowCampaignWizard(true)} title="Create">+</button>
      </div>
      <div className="filter-tabs">
        <button className="filter-tab active">All</button>
        <button className="filter-tab">Active</button>
        <button className="filter-tab">Draft</button>
      </div>
      <div className="campaigns-grid" style={{marginTop: '16px'}}>
        {campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            userRole="admin"
            onEdit={() => handleEditCampaign(campaign)}
            onView={() => {}}
          />
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="loading-container">
        <div style={{textAlign: 'center'}}>
          <h2>No Organization</h2>
          <button className="btn" onClick={logout} style={{marginTop: '16px', maxWidth: '200px'}}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-center">
            {organization?.logo ? (
              <img src={organization.logo} alt={organization.name} className="org-logo-image" />
            ) : (
              <div className="org-logo-text">
                <div className="logo-placeholder">
                  {organization?.name?.charAt(0) || 'O'}
                </div>
                <h1>{organization?.name || 'Organization'}</h1>
              </div>
            )}
          </div>
          <div className="header-actions">
            <button className="btn-icon" title="Notifications">🔔</button>
            <button className="btn-icon" onClick={logout} title="Sign Out">🚪</button>
          </div>
        </div>
      </header>


      <main className="dashboard-main">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'campaigns' && renderCampaigns()}
        {activeTab === 'employees' && <EmployeeManagement organizationId={organization?.id || ''} />}
        {activeTab === 'analytics' && <AnalyticsDashboard organizationId={organization?.id || ''} />}
        {activeTab === 'settings' && <OrganizationSettings />}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="bottom-nav-tabs">
          <button 
            className={`bottom-nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <div className="tab-icon">📊</div>
            <span>Overview</span>
          </button>
          <button 
            className={`bottom-nav-tab ${activeTab === 'campaigns' ? 'active' : ''}`}
            onClick={() => setActiveTab('campaigns')}
          >
            <div className="tab-icon">🎯</div>
            <span>Campaigns</span>
          </button>
          <button 
            className={`bottom-nav-tab ${activeTab === 'employees' ? 'active' : ''}`}
            onClick={() => setActiveTab('employees')}
          >
            <div className="tab-icon">👥</div>
            <span>Team</span>
          </button>
          <button 
            className={`bottom-nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <div className="tab-icon">📈</div>
            <span>Analytics</span>
          </button>
          
          <button 
            className={`bottom-nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <div className="tab-icon">⚙️</div>
            <span>Settings</span>
          </button>
        </div>
      </nav>

      {showCampaignWizard && (
        <div className="modal-overlay">
          <div className="modal-content">
            <NewCampaignWizard
              onClose={() => setShowCampaignWizard(false)}
              onComplete={() => setShowCampaignWizard(false)}
            />
          </div>
        </div>
      )}

      {showEditModal && selectedCampaign && (
        <div className="modal-overlay">
          <div className="modal-content">
            <CampaignEditWizard
              campaign={selectedCampaign}
              onClose={handleCloseEdit}
              onUpdate={handleCampaignUpdate}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;