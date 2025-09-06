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
    <div className="campaign-card glass-effect hover-lift">
      {campaign.banner ? (
        <div className="campaign-banner">
          <img src={campaign.banner} alt={campaign.name} />
        </div>
      ) : (
        <div className="campaign-banner">
          <div className="campaign-banner-gradient"></div>
        </div>
      )}
      
      <div className="campaign-content">
        <div className="campaign-header">
          <h3 className="campaign-title gradient-text">{campaign.name}</h3>
          <span className={`campaign-status ${campaign.status} hover-glow`}>
            {campaign.status === 'active' && '🟢'} 
            {campaign.status === 'completed' && '✅'} 
            {campaign.status === 'draft' && '📝'} 
            {campaign.status}
          </span>
        </div>
        
        <p className="campaign-description">{campaign.description}</p>
        
        <div className="date-range glass-effect">
          📅 {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
        </div>
        
        <div className="campaign-metrics">
          <div className="metrics-grid">
            {campaign.type.map((type, index) => (
              <div key={type} className="metric-card hover-scale" style={{animationDelay: `${index * 0.1}s`}}>
                <div className="metric-icon">
                  {type === 'sales' && '💰'}
                  {type === 'calls' && '📞'}
                  {type === 'meetings' && '🤝'}
                  {type === 'referrals' && '👥'}
                </div>
                <div className="metric-value">
                  {campaign.metrics[type] ? campaign.metrics[type]!.achieved : 0}
                </div>
                <div className="metric-target">
                  / {campaign.metrics[type] ? campaign.metrics[type]!.target : 0} {type}
                </div>
                {campaign.metrics[type] && (
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
            ))}
          </div>
        </div>
        
        <div className="participants-count glass-effect">
          👥 {campaign.participants.length} Active Participants
        </div>
        
        <div className="campaign-actions">
          {userRole === 'admin' ? (
            <>
              <button className="btn-secondary hover-scale" onClick={onEdit}>
                ✏️ Edit Campaign
              </button>
              <button className="btn hover-scale" onClick={onView}>
                📊 View Analytics
              </button>
            </>
          ) : (
            <button className="btn hover-scale" onClick={onView}>
              🎯 Join Campaign
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignCard;