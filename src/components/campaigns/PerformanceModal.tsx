import React, { useState, useEffect } from 'react';

interface PerformanceModalProps {
  campaign: any;
  onClose: () => void;
  onUpdate: () => void;
}

const PerformanceModal: React.FC<PerformanceModalProps> = ({ campaign, onClose, onUpdate }) => {
  const [activeMode, setActiveMode] = useState<'consolidated' | 'dateWise'>('consolidated');
  const [performances, setPerformances] = useState<Record<string, Record<string, number>>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Initialize performance data from campaign
  useEffect(() => {
    const initPerformances: Record<string, Record<string, number>> = {};
    
    if (campaign.userTargets && campaign.targetConfigs) {
      campaign.userTargets.forEach((user: any) => {
        initPerformances[user.userId] = {};
        campaign.targetConfigs.forEach((config: any) => {
          initPerformances[user.userId][config.skuId] = 0; // Default achieved = 0
        });
      });
    }
    
    setPerformances(initPerformances);
  }, [campaign]);

  const updatePerformance = (userId: string, skuId: string, value: number) => {
    setPerformances(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [skuId]: value
      }
    }));
  };

  const renderConsolidated = () => (
    <div className="performance-content">
      {campaign.userTargets?.map((user: any) => (
        <div key={user.userId} className="user-performance-card">
          <div className="user-header">
            <h4>{user.userName}</h4>
            <span className="user-region">{user.regionName}</span>
          </div>
          
          <div className="sku-performances">
            {campaign.targetConfigs?.map((config: any) => {
              const target = user.targets[config.skuId] || 0;
              const achieved = performances[user.userId]?.[config.skuId] || 0;
              const percentage = target > 0 ? Math.round((achieved / target) * 100) : 0;
              
              return (
                <div key={config.skuId} className="sku-performance">
                  <div className="sku-info">
                    <span className="sku-code">{config.skuCode}</span>
                    <span className="target-info">Target: {target} {config.unit}</span>
                  </div>
                  <div className="performance-input">
                    <input
                      type="number"
                      value={achieved}
                      onChange={(e) => updatePerformance(user.userId, config.skuId, parseFloat(e.target.value) || 0)}
                      placeholder="Achieved"
                      min="0"
                    />
                    <span className="unit">{config.unit}</span>
                  </div>
                  <div className="progress-info">
                    <span className="percentage">{percentage}%</span>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="performance-modal">
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>📈 Update Performance: {campaign.name}</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          {/* Mode Selection */}
          <div className="performance-modes">
            <button 
              className={`mode-btn ${activeMode === 'consolidated' ? 'active' : ''}`}
              onClick={() => setActiveMode('consolidated')}
            >
              📊 Consolidated
            </button>
            <button 
              className={`mode-btn ${activeMode === 'dateWise' ? 'active' : ''}`}
              onClick={() => setActiveMode('dateWise')}
            >
              📅 Date-wise
            </button>
          </div>

          <div className="performance-content">
            {activeMode === 'consolidated' ? renderConsolidated() : (
              <div className="date-wise-content">
                <div className="date-selector">
                  <label>Select Date:</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                <p>Date-wise performance entry coming soon for {selectedDate}</p>
              </div>
            )}
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