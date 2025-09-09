import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { Campaign } from '../../store/slices/campaignSlice';
import NewCampaignWizard from '../../components/campaigns/CampaignWizard/NewCampaignWizard';
import CampaignEditWizard from '../../components/campaigns/CampaignEditWizard';
import PerformanceModal from '../../components/campaigns/PerformanceModal';
import LeaderboardModal from '../../components/campaigns/LeaderboardModal';
import CampaignCard from '../../components/campaigns/CampaignCard';
import AnalyticsDashboard from '../../components/analytics/AnalyticsDashboard';
import EmployeeManagement from '../../components/admin/EmployeeManagement';
import OrganizationSettings from '../../components/admin/OrganizationSettings';

type TabType = 'overview' | 'campaigns' | 'employees' | 'analytics' | 'settings';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, organization, loading: authLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCampaignWizard, setShowCampaignWizard] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [organizationStats, setOrganizationStats] = useState({
    totalEmployees: 0,
    activeCampaigns: 0,
    totalAchievements: 0,
    completionRate: 0
  });

  // Function to load real organization statistics
  const loadOrganizationStats = useCallback(async () => {
    if (!organization?.id) return;
    
    try {
      const dbInstance = await getFirestoreInstance();
      
      // Get total employees count
      const usersQuery = query(
        collection(dbInstance, 'users'),
        where('organizationId', '==', organization.id)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const totalEmployees = usersSnapshot.size;
      
      // Get total achievements count
      const achievementsQuery = query(
        collection(dbInstance, 'userPerformances'),
        where('organizationId', '==', organization.id)
      );
      const achievementsSnapshot = await getDocs(achievementsQuery);
      
      // Calculate total achievements and completion rate
      let totalAchievements = 0;
      let totalTargets = 0;
      let totalAchieved = 0;
      
      achievementsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.skuPerformances) {
          Object.values(data.skuPerformances).forEach((perf: any) => {
            if (perf.target && perf.achieved !== undefined) {
              totalTargets += perf.target;
              totalAchieved += perf.achieved;
              if (perf.achieved >= perf.target) {
                totalAchievements++;
              }
            }
          });
        }
      });
      
      const completionRate = totalTargets > 0 ? (totalAchieved / totalTargets) * 100 : 0;
      
      console.log('📊 Calculated organization stats:', {
        totalEmployees,
        totalAchievements,
        completionRate: completionRate.toFixed(1)
      });
      
      setOrganizationStats(prev => ({
        ...prev,
        totalEmployees,
        totalAchievements,
        completionRate
      }));
      
    } catch (error) {
      console.error('Error loading organization stats:', error);
    }
  }, [organization?.id]);

  useEffect(() => {
    if (!organization?.id) return;

    // Load organization stats
    loadOrganizationStats();

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
  }, [organization?.id, loadOrganizationStats]);

  const handleEditCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowEditModal(true);
  };

  const handlePerformanceUpdate = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowPerformanceModal(true);
  };

  const handleLeaderboard = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowLeaderboardModal(true);
  };

  const handleCloseEdit = () => {
    setShowEditModal(false);
    setSelectedCampaign(null);
  };

  const handleClosePerformance = () => {
    setShowPerformanceModal(false);
    setSelectedCampaign(null);
  };

  const handleCloseLeaderboard = () => {
    setShowLeaderboardModal(false);
    setSelectedCampaign(null);
  };

  const handleCampaignUpdate = () => {
    // Campaigns will update via real-time listener
    console.log('Campaign updated - real-time listener will refresh data');
  };

  const renderOverview = () => {
    // First-time admin experience - no campaigns yet
    if (campaigns.length === 0) {
      return (
        <div className="welcome-container">
          <div className="welcome-hero">
            <div className="welcome-icon">🚀</div>
            <h1>Welcome to F2P Buddy</h1>
            <p className="welcome-subtitle">Incentive Program Management System</p>
            <p className="welcome-description">
              Transform your sales team performance with our comprehensive campaign management platform. 
              Create targeted incentive campaigns, track performance, and boost team motivation.
            </p>
            <div className="welcome-cta">
              <h3>🎯 Kick start your first campaign!</h3>
              <p>Let's set up your organization and create your first sales incentive campaign.</p>
            </div>
          </div>

          <div className="onboarding-steps">
            <h2>🚀 Get Started in 3 Simple Steps</h2>
            
            <div className="steps-grid">
              <div className="onboarding-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>⚙️ Configure Your Organization</h3>
                  <p>Set up your company hierarchy, designations, and SKU catalog for targeted campaigns.</p>
                  <button 
                    className="btn-step" 
                    onClick={() => setActiveTab('settings')}
                  >
                    Configure Organization
                  </button>
                </div>
              </div>

              <div className="onboarding-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>👥 Add Your Team</h3>
                  <p>Add team members with regional assignments and designations for campaign targeting.</p>
                  <button 
                    className="btn-step" 
                    onClick={() => setActiveTab('employees')}
                  >
                    Manage Team
                  </button>
                </div>
              </div>

              <div className="onboarding-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>🎯 Create First Campaign</h3>
                  <p>Launch your first sales incentive campaign with targets, prizes, and performance tracking.</p>
                  <button 
                    className="btn-step primary" 
                    onClick={() => setShowCampaignWizard(true)}
                  >
                    Create Campaign
                  </button>
                </div>
              </div>
            </div>

            <div className="welcome-footer">
              <div className="feature-highlights">
                <div className="feature">
                  <span className="feature-icon">📊</span>
                  <span>Real-time Performance Tracking</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">🏆</span>
                  <span>Professional Leaderboards</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">📱</span>
                  <span>Mobile-Optimized Interface</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">🎯</span>
                  <span>Advanced Campaign Targeting</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Regular admin dashboard with campaigns
    return (
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
                onPerformanceUpdate={() => handlePerformanceUpdate(campaign)}
                onLeaderboard={() => handleLeaderboard(campaign)}
                onView={() => {}}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

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
            onPerformanceUpdate={() => handlePerformanceUpdate(campaign)}
            onLeaderboard={() => handleLeaderboard(campaign)}
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

  // Debug logging for dashboard state
  console.log('📊 AdminDashboard render state:', {
    authLoading,
    hasUser: !!user,
    hasOrganization: !!organization,
    organizationId: user?.organizationId,
    loading
  });

  // Show loading while auth is still loading
  if (authLoading) {
    console.log('🔄 Dashboard showing auth loading spinner');
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  // If user is authenticated but no organization, redirect to setup
  if (user && !organization && !authLoading) {
    console.log('👤 Admin user without organization, redirecting to setup');
    navigate('/admin/setup');
    return (
      <div className="loading-container">
        <div className="spinner"></div>
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

      {showPerformanceModal && selectedCampaign && (
        <PerformanceModal
          campaign={selectedCampaign as any}
          onClose={handleClosePerformance}
          onUpdate={handleCampaignUpdate}
        />
      )}

      {showLeaderboardModal && selectedCampaign && (
        <LeaderboardModal
          campaign={selectedCampaign as any}
          onClose={handleCloseLeaderboard}
        />
      )}
    </div>
  );
};

export default AdminDashboard;