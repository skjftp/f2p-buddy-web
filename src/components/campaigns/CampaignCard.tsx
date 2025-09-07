import React from 'react';
import { Campaign } from '../../store/slices/campaignSlice';
import QuickActions from './QuickActions';

interface CampaignCardProps {
  campaign: Campaign;
  userRole: 'admin' | 'employee';
  onEdit?: () => void;
  onView?: () => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({ 
  campaign, 
  userRole, 
  onEdit, 
  onView 
}) => {
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
        
        <div className="campaign-metrics">
          <div className="metrics-grid">
            {/* Handle new campaign structure with targetConfigs */}
            {campaign.targetConfigs ? (
              campaign.targetConfigs.map((config: any) => (
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
            campaign.type ? (
              campaign.type.map((type: string) => (
                <div key={type} className="metric-card">
                  <div className="metric-icon">
                    {type === 'sales' && '💰'}
                    {type === 'calls' && '📞'}
                    {type === 'meetings' && '🤝'}
                    {type === 'referrals' && '👥'}
                  </div>
                  <div className="metric-value">
                    {campaign.metrics && campaign.metrics[type] ? campaign.metrics[type]!.achieved : 0}
                  </div>
                  <div className="metric-target">
                    / {campaign.metrics && campaign.metrics[type] ? campaign.metrics[type]!.target : 0}
                  </div>
                  {campaign.metrics && campaign.metrics[type] && (
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${(campaign.metrics[type]!.achieved / campaign.metrics[type]!.target) * 100}%`
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
        
        <div className="participants-count">
          👥 {campaign.userTargets?.length || campaign.participants?.length || 0} participants
        </div>
        
        <div className="campaign-actions">
          {userRole === 'admin' ? (
            <>
              <QuickActions campaign={campaign} />
              <button className="btn-icon" onClick={onEdit} title="Edit">✏️</button>
              <button className="btn-icon" onClick={onView} title="Analytics">📊</button>
            </>
          ) : (
            <button className="btn-icon" onClick={onView} title="View">→</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignCard;