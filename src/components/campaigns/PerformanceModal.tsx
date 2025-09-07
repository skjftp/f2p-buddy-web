import React from 'react';

interface PerformanceModalProps {
  campaign: any;
  onClose: () => void;
  onUpdate: () => void;
}

const PerformanceModal: React.FC<PerformanceModalProps> = ({ campaign, onClose, onUpdate }) => {
  return (
    <div className="performance-modal">
      <div className="modal-overlay" onClick={onClose} />
      
      <div className="modal-content">
        <div className="modal-header">
          <h2>📈 Update Performance: {campaign.name}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="performance-content">
          <div className="coming-soon-performance">
            <div className="empty-icon">📈</div>
            <h3>Performance Update System</h3>
            <p>Comprehensive performance tracking system coming soon!</p>
            
            <div className="planned-features">
              <h4>Planned Features:</h4>
              <ul>
                <li>📊 Consolidated performance tracking</li>
                <li>📅 Date-wise performance entry</li>
                <li>📄 CSV bulk upload functionality</li>
                <li>🗺️ Real-time region-wise summaries</li>
                <li>📈 Performance analytics and insights</li>
              </ul>
            </div>
            
            <div className="campaign-info">
              <h4>Campaign Details:</h4>
              <p><strong>Participants:</strong> {campaign.userTargets?.length || 0}</p>
              <p><strong>SKUs:</strong> {campaign.targetConfigs?.length || 0}</p>
              <p><strong>Regions:</strong> {campaign.selectedRegions?.length || 0}</p>
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
  );
};

export default PerformanceModal;