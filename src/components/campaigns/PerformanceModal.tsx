import React from 'react';

interface PerformanceModalProps {
  campaign: any;
  onClose: () => void;
  onUpdate: () => void;
}

const PerformanceModal: React.FC<PerformanceModalProps> = ({ campaign, onClose, onUpdate }) => {
  return (
    <div className="performance-modal">
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>📈 Update Performance: {campaign.name}</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          <div className="performance-content">
            <div className="performance-placeholder">
              <div className="empty-icon">📈</div>
              <h3>Performance Update System</h3>
              <p>Modal is working! Performance tracking system coming soon.</p>
              
              <div className="campaign-summary">
                <h4>Campaign: {campaign.name}</h4>
                <div className="summary-stats">
                  <div className="stat">
                    <span className="label">Participants:</span>
                    <span className="value">{campaign.userTargets?.length || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="label">SKUs:</span>
                    <span className="value">{campaign.targetConfigs?.length || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Regions:</span>
                    <span className="value">{campaign.selectedRegions?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceModal;