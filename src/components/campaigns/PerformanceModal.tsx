import React, { useState, useEffect } from 'react';

interface PerformanceModalProps {
  campaign: any;
  onClose: () => void;
  onUpdate: () => void;
}

const PerformanceModal: React.FC<PerformanceModalProps> = ({ campaign, onClose, onUpdate }) => {
  const [activeMode, setActiveMode] = useState<'consolidated' | 'dateWise' | 'csvUpload'>('consolidated');
  const [performances, setPerformances] = useState<Record<string, Record<string, number>>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [regionSummary, setRegionSummary] = useState<Record<string, any>>({});

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
    computeRegionSummary(initPerformances);
  }, [campaign]);

  const updatePerformance = (userId: string, skuId: string, value: number) => {
    setPerformances(prev => {
      const updated = {
        ...prev,
        [userId]: {
          ...prev[userId],
          [skuId]: value
        }
      };
      
      // Trigger region summary update
      setTimeout(() => computeRegionSummary(updated), 100);
      
      return updated;
    });
  };

  // Compute region-wise summary
  const computeRegionSummary = (performanceData: Record<string, Record<string, number>>) => {
    const summary: Record<string, any> = {};
    
    campaign.userTargets?.forEach((user: any) => {
      const regionName = user.regionName;
      
      if (!summary[regionName]) {
        summary[regionName] = {
          regionName,
          totalUsers: 0,
          skuData: {}
        };
        
        campaign.targetConfigs?.forEach((config: any) => {
          summary[regionName].skuData[config.skuId] = {
            skuCode: config.skuCode,
            unit: config.unit,
            totalTarget: 0,
            totalAchieved: 0,
            percentage: 0
          };
        });
      }
      
      summary[regionName].totalUsers += 1;
      
      campaign.targetConfigs?.forEach((config: any) => {
        const target = user.targets[config.skuId] || 0;
        const achieved = performanceData[user.userId]?.[config.skuId] || 0;
        
        summary[regionName].skuData[config.skuId].totalTarget += target;
        summary[regionName].skuData[config.skuId].totalAchieved += achieved;
      });
    });
    
    // Calculate percentages
    Object.values(summary).forEach((region: any) => {
      Object.values(region.skuData).forEach((sku: any) => {
        sku.percentage = sku.totalTarget > 0 ? Math.round((sku.totalAchieved / sku.totalTarget) * 100) : 0;
      });
    });
    
    setRegionSummary(summary);
  };

  const renderConsolidated = () => (
    <div className="performance-content">
      <div className="performance-table-container">
        <div className="performance-table">
          <div className="table-header">
            <span className="user-col">User</span>
            <span className="region-col">Region</span>
            {campaign.targetConfigs?.map((config: any) => (
              <span key={config.skuId} className="sku-col">
                {config.skuCode}
                <div className="unit-label">({config.unit})</div>
              </span>
            ))}
            <span className="overall-col">Overall %</span>
          </div>
          
          <div className="table-body">
            {campaign.userTargets?.map((user: any, index: number) => {
              let totalPercentage = 0;
              let skuCount = 0;
              
              return (
                <div key={user.userId} className="table-row">
                  <div className="user-col">
                    <div className="user-info">
                      <span className="user-name">{user.userName}</span>
                      <span className="user-id">#{user.userId}</span>
                    </div>
                  </div>
                  <span className="region-col">{user.regionName}</span>
                  
                  {campaign.targetConfigs?.map((config: any) => {
                    const target = user.targets[config.skuId] || 0;
                    const achieved = performances[user.userId]?.[config.skuId] || 0;
                    const percentage = target > 0 ? Math.round((achieved / target) * 100) : 0;
                    
                    totalPercentage += percentage;
                    skuCount++;
                    
                    return (
                      <div key={config.skuId} className="sku-col">
                        <div className="sku-performance-cell">
                          <div className="target-display">
                            <span className="target-value">Target: {target}</span>
                          </div>
                          <div className="input-row">
                            <input
                              type="number"
                              className="performance-input"
                              value={achieved}
                              onChange={(e) => updatePerformance(user.userId, config.skuId, parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              min="0"
                            />
                          </div>
                          <div className="progress-display">
                            <span className="percentage-text">{percentage}%</span>
                            <div className="mini-progress-bar">
                              <div 
                                className="mini-progress-fill"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="overall-col">
                    <div className="overall-performance">
                      <span className="overall-percentage">
                        {skuCount > 0 ? Math.round(totalPercentage / skuCount) : 0}%
                      </span>
                      <div className="overall-progress-bar">
                        <div 
                          className="overall-progress-fill"
                          style={{ width: `${Math.min(skuCount > 0 ? totalPercentage / skuCount : 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {campaign.userTargets?.length > 10 && (
          <div className="table-pagination">
            <p>Showing all {campaign.userTargets.length} participants</p>
          </div>
        )}
      </div>
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
            <button 
              className={`mode-btn ${activeMode === 'csvUpload' ? 'active' : ''}`}
              onClick={() => setActiveMode('csvUpload')}
            >
              📄 CSV Upload
            </button>
          </div>

          <div className="performance-content">
            {activeMode === 'consolidated' && renderConsolidated()}
            {activeMode === 'dateWise' && (
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
            {activeMode === 'csvUpload' && (
              <div className="csv-upload-content">
                <div className="csv-info">
                  <h4>📄 CSV Bulk Upload</h4>
                  <p>Upload performance data for multiple users at once</p>
                </div>
                <div className="csv-format">
                  <strong>Expected Format:</strong>
                  <code>
                    user_id,user_name,{campaign.targetConfigs?.map((c: any) => c.skuCode).join(',')}<br/>
                    +919955100649,Sumit Jha,{campaign.targetConfigs?.map(() => '500').join(',')}
                  </code>
                </div>
              </div>
            )}
          </div>

          {/* Region-wise Summary */}
          {Object.keys(regionSummary).length > 0 && (
            <div className="region-summary">
              <h4>🗺️ Region-wise Performance Summary</h4>
              <div className="summary-cards">
                {Object.values(regionSummary).map((region: any) => (
                  <div key={region.regionName} className="region-card">
                    <h5>{region.regionName}</h5>
                    <div className="region-users">{region.totalUsers} users</div>
                    <div className="region-skus">
                      {Object.values(region.skuData).map((sku: any) => (
                        <div key={sku.skuCode} className="sku-summary">
                          <div className="sku-summary-header">
                            <span className="sku-code">{sku.skuCode}</span>
                            <span className="summary-percentage">{sku.percentage}%</span>
                          </div>
                          <div className="summary-values">
                            {sku.totalAchieved}/{sku.totalTarget} {sku.unit}
                          </div>
                          <div className="summary-progress">
                            <div 
                              className="summary-fill"
                              style={{ width: `${Math.min(sku.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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