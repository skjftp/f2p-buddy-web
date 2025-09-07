import React from 'react';
import { Campaign } from '../../store/slices/campaignSlice';
import QuickActions from './QuickActions';

interface CampaignCardProps {
  campaign: Campaign;
  userRole: 'admin' | 'employee';
  onEdit?: () => void;
  onView?: () => void;
  onPerformanceUpdate?: () => void;
  onLeaderboard?: () => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({ 
  campaign, 
  userRole, 
  onEdit, 
  onView,
  onPerformanceUpdate,
  onLeaderboard
}) => {
  // Safety check for campaign data
  if (!campaign) {
    return <div className="campaign-card error">Campaign data not available</div>;
  }
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="campaign-card">
      {campaign.banner ? (
        <div className="campaign-banner">
          <img src={campaign.banner} alt={campaign.name} />
        </div>
      ) : (
        <div className="campaign-banner"></div>
      )}
      
      <div className="campaign-content">
        <div className="campaign-header">
          <h3 className="campaign-title">{campaign.name}</h3>
          <span className={`campaign-status ${campaign.status}`}>
            {campaign.status}
          </span>
        </div>
        
        <p className="campaign-description">{campaign.description}</p>
        
        <div className="date-range">
          📅 {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
        </div>
        
        {/* Campaign metrics - only show if data exists */}
        {((campaign as any).targetConfigs || (campaign as any).type) && (
          <div className="campaign-metrics">
            <div className="metrics-grid">
            {/* Handle new campaign structure with targetConfigs */}
            {((campaign as any).targetConfigs && Array.isArray((campaign as any).targetConfigs)) ? (
              (campaign as any).targetConfigs.map((config: any) => (
                <div key={config.skuId} className="metric-card">
                  <div className="metric-icon">📦</div>
                  <div className="metric-title">{config.skuCode}</div>
                  <div className="metric-value">
                    {config.target} {config.unit}
                  </div>
                  <div className="metric-type">{config.targetType}</div>
                </div>
              ))
            ) : /* Handle legacy campaign structure with type array */ 
            ((campaign as any).type && Array.isArray((campaign as any).type)) ? (
              (campaign as any).type.map((type: string) => (
                <div key={type} className="metric-card">
                  <div className="metric-icon">
                    {type === 'sales' && '💰'}
                    {type === 'calls' && '📞'}
                    {type === 'meetings' && '🤝'}
                    {type === 'referrals' && '👥'}
                  </div>
                  <div className="metric-value">
                    {(campaign as any).metrics && (campaign as any).metrics[type] ? (campaign as any).metrics[type].achieved : 0}
                  </div>
                  <div className="metric-target">
                    / {(campaign as any).metrics && (campaign as any).metrics[type] ? (campaign as any).metrics[type].target : 0}
                  </div>
                  {(campaign as any).metrics && (campaign as any).metrics[type] && (
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${((campaign as any).metrics[type].achieved / (campaign as any).metrics[type].target) * 100}%`
                        }}
                      />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="no-metrics">No metrics available</div>
            )}
            </div>
          </div>
        )}
        
        <div className="participants-count">
          👥 {(campaign as any).userTargets?.length || (campaign as any).participants?.length || 0} participants
        </div>
        
        <div className="campaign-actions">
          {userRole === 'admin' ? (
            <>
              <QuickActions campaign={campaign} />
              <button className="btn-icon" onClick={onEdit} title="Edit Campaign">✏️</button>
              <button className="btn-icon" onClick={onPerformanceUpdate} title="Update Performance">📈</button>
              <button className="btn-icon" onClick={onLeaderboard} title="Campaign Leaderboard">🏆</button>
            </>
          ) : (
            <>
              <button className="btn-icon" onClick={onPerformanceUpdate} title="Update Performance">📈</button>
              <button className="btn-icon" onClick={onLeaderboard} title="View Leaderboard">🏆</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignCard;