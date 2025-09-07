import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { Campaign } from '../../store/slices/campaignSlice';
import CampaignCard from '../../components/campaigns/CampaignCard';
import MyTargetModal from '../../components/campaigns/MyTargetModal';
import LeaderboardModal from '../../components/campaigns/LeaderboardModal';

const EmployeeDashboard: React.FC = () => {
  const { organization, logout } = useAuth();
  const [activeCampaigns, setActiveCampaigns] = useState<Campaign[]>([]);
  const [pastCampaigns, setPastCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMyTargetModal, setShowMyTargetModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Load campaigns
  useEffect(() => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }

    const setupCampaignListener = async () => {
      try {
        const dbInstance = await getFirestoreInstance();
        const campaignsQuery = query(
          collection(dbInstance, 'campaigns'),
          where('orgId', '==', organization.id)
        );

        const unsubscribe = onSnapshot(campaignsQuery, (snapshot) => {
          const campaignList: Campaign[] = [];
          snapshot.forEach((doc) => {
            campaignList.push({ id: doc.id, ...doc.data() } as Campaign);
          });
          
          const activeList = campaignList.filter(c => c.status === 'active');
          const pastList = campaignList.filter(c => c.status === 'completed');
          
          setActiveCampaigns(activeList);
          setPastCampaigns(pastList);
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

  // Modal handlers
  const handleMyTarget = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowMyTargetModal(true);
  };

  const handleLeaderboard = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowLeaderboardModal(true);
  };

  const handleCloseModals = () => {
    setShowMyTargetModal(false);
    setShowLeaderboardModal(false);
    setSelectedCampaign(null);
  };

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
      {/* Header - Exact Copy from Admin Dashboard */}
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

      {/* Main Content - Single Page, No Bottom Navigation */}
      <main className="dashboard-main">
        {/* Active Campaigns Section */}
        <section className="campaigns-section">
          <div className="section-header">
            <h2>🎯 Active Campaigns</h2>
            <div className="section-badge">{activeCampaigns.length}</div>
          </div>
          
          {activeCampaigns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⏰</div>
              <h3>No Active Campaigns</h3>
              <p>New campaigns will appear here when available.</p>
            </div>
          ) : (
            <div className="campaigns-grid">
              {activeCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  userRole="employee"
                  onPerformanceUpdate={() => handleMyTarget(campaign)}
                  onLeaderboard={() => handleLeaderboard(campaign)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Past Campaigns Section */}
        <section className="campaigns-section">
          <div className="section-header">
            <h2>📋 Past Campaigns</h2>
            <div className="section-badge">{pastCampaigns.length}</div>
          </div>
          
          {pastCampaigns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No Past Campaigns</h3>
              <p>Completed campaigns will appear here.</p>
            </div>
          ) : (
            <div className="campaigns-grid">
              {pastCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  userRole="employee"
                  onPerformanceUpdate={() => handleMyTarget(campaign)}
                  onLeaderboard={() => handleLeaderboard(campaign)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modals */}
      {showMyTargetModal && selectedCampaign && (
        <MyTargetModal
          campaign={selectedCampaign as any}
          onClose={handleCloseModals}
        />
      )}

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