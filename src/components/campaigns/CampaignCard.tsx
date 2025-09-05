import React from 'react';
import { Campaign } from '../../store/slices/campaignSlice';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { colors } = useTheme();
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#28a745';
      case 'completed': return '#6c757d';
      case 'draft': return '#ffc107';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  };

  // const calculateProgress = () => {
  //   const total = campaign.metrics.sales?.target || 0;
  //   const achieved = campaign.metrics.sales?.achieved || 0;
  //   return total > 0 ? (achieved / total) * 100 : 0;
  // };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="campaign-card">
      {campaign.banner && (
        <div className="campaign-banner">
          <img src={campaign.banner} alt={campaign.name} />
        </div>
      )}
      
      <div className="campaign-content">
        <div className="campaign-header">
          <h3 className="campaign-title">{campaign.name}</h3>
          <span 
            className="campaign-status"
            style={{ backgroundColor: getStatusColor(campaign.status) }}
          >
            {campaign.status}
          </span>
        </div>
        
        <p className="campaign-description">{campaign.description}</p>
        
        <div className="campaign-dates">
          <span className="date-range">
            📅 {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
          </span>
        </div>
        
        <div className="campaign-metrics">
          {campaign.type.map((type) => (
            <div key={type} className="metric-item">
              <span className="metric-label">
                {type === 'sales' && '💰'}
                {type === 'calls' && '📞'}
                {type === 'meetings' && '🤝'}
                {type === 'referrals' && '👥'}
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </span>
              {campaign.metrics[type] && (
                <div className="metric-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ 
                        width: `${(campaign.metrics[type]!.achieved / campaign.metrics[type]!.target) * 100}%`,
                        backgroundColor: colors.primary
                      }}
                    />
                  </div>
                  <span className="progress-text">
                    {campaign.metrics[type]!.achieved} / {campaign.metrics[type]!.target}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="campaign-participants">
          <span className="participants-count">
            👥 {campaign.participants.length} participants
          </span>
        </div>
        
        <div className="campaign-actions">
          {userRole === 'admin' ? (
            <>
              <button className="btn-secondary" onClick={onEdit}>
                ✏️ Edit
              </button>
              <button className="btn" onClick={onView}>
                📊 View Details
              </button>
            </>
          ) : (
            <button className="btn" onClick={onView}>
              🎯 View Campaign
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignCard;