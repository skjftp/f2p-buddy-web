import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { Campaign } from '../../store/slices/campaignSlice';
// import { useTheme } from '../../contexts/ThemeContext';
import CampaignCard from '../../components/campaigns/CampaignCard';
import LeaderboardWidget from '../../components/dashboard/LeaderboardWidget';
import AchievementTracker from '../../components/achievements/AchievementTracker';
import StatsOverview from '../../components/dashboard/StatsOverview';
import PerformanceModal from '../../components/campaigns/PerformanceModal';
import LeaderboardModal from '../../components/campaigns/LeaderboardModal';

const EmployeeDashboard: React.FC = () => {
  const { user, organization, logout } = useAuth();
  // const { colors } = useTheme();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [userStats, setUserStats] = useState({
    totalAchievements: 0,
    currentRank: 0,
    totalPoints: 0,
    activeCampaignsCount: 0
  });

  useEffect(() => {
    console.log('🔍 EmployeeDashboard useEffect - checking organization:', {
      organizationId: organization?.id,
      organizationExists: !!organization,
      userRole: user?.role,
      userId: user?.uid
    });
    
    if (!organization?.id) {
      console.log('❌ No organization ID, stopping campaign loading');
      setLoading(false);
      return;
    }

    console.log('🔄 Setting up campaign listener for org:', organization.id);

    // Immediate fallback - load dashboard even if campaigns fail
    const immediateLoadTimeout = setTimeout(() => {
      console.log('🚀 Loading dashboard immediately to prevent infinite loading');
      setLoading(false);
    }, 3000); // Show dashboard after 3 seconds regardless

    // Listen to campaigns in real-time
    const setupCampaignListener = async (): Promise<(() => void) | undefined> => {
      try {
        const dbInstance = await getFirestoreInstance();
        console.log('📊 Firestore instance ready, creating query...');
        
        // Simplified query to avoid potential issues with 'in' operator
        const campaignsQuery = query(
          collection(dbInstance, 'campaigns'),
          where('orgId', '==', organization.id)
        );

        console.log('👂 Setting up campaigns listener...');
        const unsubscribe = onSnapshot(
          campaignsQuery, 
          (snapshot) => {
            console.log('📥 Received campaigns snapshot with', snapshot.size, 'documents');
            clearTimeout(immediateLoadTimeout); // Clear immediate timeout since we got data
            
            const campaignList: Campaign[] = [];
            
            snapshot.forEach((doc) => {
              const campaignData = { id: doc.id, ...doc.data() } as Campaign;
              campaignList.push(campaignData);
            });
            
            console.log('📋 Total campaigns:', campaignList.length);
            console.log('🎯 Active campaigns:', campaignList.filter(c => c.status === 'active').length);
            
            setCampaigns(campaignList);
            const activeList = campaignList.filter(c => c.status === 'active');
            setActiveCampaigns(activeList);
            setLoading(false);
            
            console.log('✅ Employee dashboard data loaded successfully');
            console.log('🎯 Active campaigns:', activeList.length);
          },
          (error) => {
            console.error('❌ Firestore listener error:', error);
            clearTimeout(immediateLoadTimeout);
            setLoading(false);
          }
        );
        
        return unsubscribe;
      } catch (error) {
        console.error('❌ Failed to setup campaign listener:', error);
        setLoading(false);
        return undefined;
      }
    };

    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.log('⏰ Loading timeout reached, stopping loading state');
      setLoading(false);
    }, 5000); // 5 second timeout - shorter for better UX
    
    let unsubscribe: (() => void) | null = null;
    setupCampaignListener().then(unsub => {
      clearTimeout(loadingTimeout);
      clearTimeout(immediateLoadTimeout);
      if (unsub) {
        unsubscribe = unsub;
        console.log('✅ Campaign listener setup complete');
      } else {
        console.log('❌ Failed to setup campaign listener');
        setLoading(false);
      }
    }).catch(error => {
      console.error('❌ Setup campaign listener failed:', error);
      clearTimeout(loadingTimeout);
      clearTimeout(immediateLoadTimeout);
      setLoading(false);
    });
    
    return () => {
      clearTimeout(loadingTimeout);
      clearTimeout(immediateLoadTimeout);
      if (unsubscribe) {
        console.log('🛑 Cleaning up campaign listener');
        unsubscribe();
      }
    };
  }, [organization?.id, organization, user?.role, user?.uid]);

  useEffect(() => {
    // Calculate user stats
    const calculateStats = async () => {
      if (!user || !organization) return;
      
      // This would typically come from aggregated data
      setUserStats({
        totalAchievements: 0,
        currentRank: 0,
        totalPoints: 0,
        activeCampaignsCount: activeCampaigns.length
      });
    };

    calculateStats();
  }, [user, organization, activeCampaigns]);

  const handlePerformanceUpdate = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowPerformanceModal(true);
  };

  const handleLeaderboard = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowLeaderboardModal(true);
  };

  const handleCloseModals = () => {
    setShowPerformanceModal(false);
    setShowLeaderboardModal(false);
    setSelectedCampaign(null);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="dashboard-container">
        <div className="no-organization">
          <h2>No Organization</h2>
          <p>You need to be part of an organization to access the dashboard.</p>
          <button className="btn" onClick={logout}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <div className="org-logo">
              {organization.logo ? (
                <img src={organization.logo} alt={organization.name} />
              ) : (
                <div className="logo-placeholder">
                  {organization.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="header-text">
              <h1>Welcome back!</h1>
              <p>{organization.name}</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-icon" title="Notifications">
              🔔
            </button>
            <button className="btn-icon" onClick={logout} title="Sign Out">
              🚪
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-grid">
          {/* Employee Performance Focus */}
          <section className="dashboard-section glass-effect hover-lift animate-fade-in">
            <div className="section-header">
              <h2>📊 My Performance</h2>
              <div className="section-badge">⚡</div>
            </div>
            
            {activeCampaigns.length > 0 ? (
              <div className="employee-performance-focus">
                <div className="performance-summary">
                  <div className="focus-card">
                    <h3>🎯 Current Targets</h3>
                    <div className="target-display">
                      {activeCampaigns.map(campaign => (
                        <div key={campaign.id} className="campaign-target">
                          <div className="campaign-name">{campaign.name}</div>
                          <div className="target-details">
                            {(campaign as any).targetConfigs?.map((config: any) => (
                              <div key={config.skuId} className="sku-target">
                                <span className="sku-code">{config.skuCode}</span>
                                <span className="target-value">
                                  {(campaign as any).userTargets?.find((ut: any) => ut.userId === user?.uid)?.targets[config.skuId] || 0} {config.unit}
                                </span>
                              </div>
                            )) || (
                              <div className="legacy-target">
                                Campaign targets available
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="focus-card">
                    <h3>🏆 My Ranking</h3>
                    <div className="rank-display">
                      <div className="rank-number">#?</div>
                      <div className="rank-info">
                        <p>Click leaderboard to see your current rank</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="quick-actions">
                  {activeCampaigns.map(campaign => (
                    <div key={campaign.id} className="campaign-actions">
                      <div className="campaign-quick-info">
                        <h4>{campaign.name}</h4>
                        <div className="quick-stats">
                          <span className="participants">👥 {(campaign as any).userTargets?.length || 0}</span>
                          <span className="skus">📦 {(campaign as any).targetConfigs?.length || 0}</span>
                        </div>
                      </div>
                      <div className="action-buttons">
                        <button 
                          className="btn-action"
                          onClick={() => handlePerformanceUpdate(campaign)}
                        >
                          📈 Update Performance
                        </button>
                        <button 
                          className="btn-action" 
                          onClick={() => handleLeaderboard(campaign)}
                        >
                          🏆 View Leaderboard
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <StatsOverview stats={userStats} />
            )}
          </section>

          {/* Active Campaigns */}
          <section className="dashboard-section glass-effect hover-lift animate-fade-in">
            <div className="section-header">
              <h2>Active Campaigns</h2>
              <div className="section-badge">{activeCampaigns.length}</div>
            </div>
            
            {activeCampaigns.length === 0 ? (
              <div className="empty-state glass-effect">
                <div className="empty-icon float-animation">⏰</div>
                <h3>No Active Campaigns</h3>
                <p>New exciting campaigns are coming soon! Stay tuned for opportunities to earn rewards.</p>
              </div>
            ) : (
              <div className="campaigns-grid stagger-animation">
                {activeCampaigns.map((campaign, index) => (
                  <div key={campaign.id} style={{animationDelay: `${index * 0.15}s`}} className="hover-lift">
                    <CampaignCard
                      campaign={campaign}
                      userRole="employee"
                      onPerformanceUpdate={() => handlePerformanceUpdate(campaign)}
                      onLeaderboard={() => handleLeaderboard(campaign)}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Leaderboard */}
          <section className="dashboard-section glass-effect hover-lift animate-fade-in">
            <div className="section-header">
              <h2>🏆 Leaderboard</h2>
              <button className="btn-icon" title="View All">📋</button>
            </div>
            <LeaderboardWidget organizationId={organization.id} />
          </section>

          {/* Recent Achievements */}
          <section className="dashboard-section glass-effect hover-lift animate-fade-in">
            <div className="section-header">
              <h2>Achievements</h2>
              <button className="btn-icon" title="View All">📋</button>
            </div>
            <AchievementTracker userId={user?.uid} />
          </section>

          {/* All Campaigns History */}
          <section className="dashboard-section full-width glass-effect animate-fade-in">
            <div className="section-header">
              <h2>History</h2>
              <div className="filter-tabs glass-effect">
                <button className="filter-tab active">All</button>
                <button className="filter-tab">✅</button>
                <button className="filter-tab">🏃</button>
              </div>
            </div>
            
            <div className="campaigns-list stagger-animation">
              {campaigns.map((campaign, index) => (
                <div key={campaign.id} 
                     className="campaign-list-item hover-lift" 
                     style={{animationDelay: `${index * 0.1}s`}}>
                  <div className="campaign-info">
                    <h4>{campaign.name}</h4>
                    <div className="date-range">
                      📅 {new Date(campaign.startDate).toLocaleDateString()} - 
                      {new Date(campaign.endDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="campaign-status">
                    <span className={`status-badge ${campaign.status} hover-glow`}>
                      {campaign.status === 'active' && '🟢'} 
                      {campaign.status === 'completed' && '✅'} 
                      {campaign.status === 'draft' && '📝'} 
                      {campaign.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {campaigns.length === 0 && (
              <div className="empty-state glass-effect">
                <div className="empty-icon float-animation">📈</div>
                <h3>Campaign History Empty</h3>
                <p>Your campaign participation history will appear here as you join campaigns.</p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Performance Modal */}
      {showPerformanceModal && selectedCampaign && (
        <PerformanceModal
          campaign={selectedCampaign as any}
          onClose={handleCloseModals}
          onUpdate={() => {}}
        />
      )}

      {/* Leaderboard Modal */}
      {showLeaderboardModal && selectedCampaign && (
        <LeaderboardModal
          campaign={selectedCampaign as any}
          onClose={handleCloseModals}
        />
      )}
    </div>
  );
};

export default EmployeeDashboard;