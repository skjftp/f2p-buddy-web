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

const EmployeeDashboard: React.FC = () => {
  const { user, organization, logout } = useAuth();
  // const { colors } = useTheme();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState({
    totalAchievements: 0,
    currentRank: 0,
    totalPoints: 0,
    activeCampaignsCount: 0
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
          where('status', 'in', ['active', 'completed'])
        );

        const unsubscribe = onSnapshot(campaignsQuery, (snapshot) => {
      const campaignList: Campaign[] = [];
      snapshot.forEach((doc) => {
        campaignList.push({ id: doc.id, ...doc.data() } as Campaign);
      });
      
          setCampaigns(campaignList);
          setActiveCampaigns(campaignList.filter(c => c.status === 'active'));
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
          {/* Stats Overview */}
          <section className="dashboard-section glass-effect hover-lift animate-fade-in">
            <div className="section-header">
              <h2>Performance</h2>
              <div className="section-badge">⚡</div>
            </div>
            <StatsOverview stats={userStats} />
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
    </div>
  );
};

export default EmployeeDashboard;