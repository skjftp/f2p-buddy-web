import React, { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { toast } from 'react-toastify';

interface PerformanceModalProps {
  campaign: any;
  onClose: () => void;
  onUpdate: () => void;
}

const PerformanceModal: React.FC<PerformanceModalProps> = ({ campaign, onClose, onUpdate }) => {
  const [activeMode, setActiveMode] = useState<'consolidated' | 'dateWise' | 'csvUpload'>('consolidated');
  const [performances, setPerformances] = useState<Record<string, Record<string, number>>>({});
  const [regionSummary, setRegionSummary] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const computeRegionSummary = useCallback((performanceData: Record<string, Record<string, number>>) => {
    const summary: Record<string, any> = {};
    
    campaign.userTargets?.forEach((user: any) => {
      if (!summary[user.regionName]) {
        summary[user.regionName] = { totalUsers: 0, skus: {} };
      }
      summary[user.regionName].totalUsers += 1;
      
      campaign.targetConfigs?.forEach((config: any) => {
        if (!summary[user.regionName].skus[config.skuCode]) {
          summary[user.regionName].skus[config.skuCode] = { target: 0, achieved: 0 };
        }
        summary[user.regionName].skus[config.skuCode].target += user.targets[config.skuId] || 0;
        summary[user.regionName].skus[config.skuCode].achieved += performanceData[user.userId]?.[config.skuId] || 0;
      });
    });
    
    setRegionSummary(summary);
  }, [campaign]);

  // Initialize performance data
  useEffect(() => {
    const initData: Record<string, Record<string, number>> = {};
    
    campaign.userTargets?.forEach((user: any) => {
      initData[user.userId] = {};
      campaign.targetConfigs?.forEach((config: any) => {
        initData[user.userId][config.skuId] = 0;
      });
    });
    
    setPerformances(initData);
    computeRegionSummary(initData);
  }, [campaign, computeRegionSummary]);

  const updatePerformance = (userId: string, skuId: string, value: number) => {
    const updated = {
      ...performances,
      [userId]: { ...performances[userId], [skuId]: value }
    };
    setPerformances(updated);
    computeRegionSummary(updated);
  };

  const savePerformance = async () => {
    setLoading(true);
    try {
      const dbInstance = await getFirestoreInstance();
      await updateDoc(doc(dbInstance, 'campaigns', campaign.id), {
        performanceData: { performances, regionSummary },
        updatedAt: serverTimestamp()
      });
      toast.success('Performance updated!');
      onUpdate();
    } catch (error) {
      toast.error('Save failed');
    } finally {
      setLoading(false);
    }
  };

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

          {/* Region Summary - Fixed at Top */}
          {Object.keys(regionSummary).length > 0 && (
            <div className="region-summary-fixed">
              <h4>🗺️ Region Performance Summary</h4>
              <div className="compact-summary-grid">
                {Object.entries(regionSummary).map(([regionName, data]: [string, any]) => (
                  <div key={regionName} className="compact-region-card">
                    <div className="region-header">
                      <span className="region-name">{regionName}</span>
                      <span className="user-count">({data.totalUsers} users)</span>
                    </div>
                    <div className="region-skus-compact">
                      {Object.entries(data.skus).map(([skuCode, skuData]: [string, any]) => {
                        const percentage = skuData.target > 0 ? Math.round((skuData.achieved / skuData.target) * 100) : 0;
                        return (
                          <div key={skuCode} className="sku-compact">
                            <span className="sku-label">{skuCode}:</span>
                            <span className="sku-percentage">{percentage}%</span>
                            <div className="compact-bar">
                              <div 
                                className="compact-fill"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="performance-content-scrollable">
            {activeMode === 'consolidated' && (
              <div className="performance-table-container">
                <div className="performance-table">
                  <div className="table-header">
                    <span className="user-col">User</span>
                    <span className="region-col">Region</span>
                    {campaign.targetConfigs?.map((config: any) => (
                      <span key={config.skuId} className="sku-col">
                        {config.skuCode}
                        <div className="unit-info">({config.unit})</div>
                      </span>
                    ))}
                    <span className="overall-col">Overall</span>
                  </div>
                  
                  <div className="table-body">
                    {campaign.userTargets?.map((user: any) => {
                      let totalPercentage = 0;
                      
                      return (
                        <div key={user.userId} className="table-row">
                          <div className="user-cell">
                            <div className="user-name">{user.userName}</div>
                            <div className="user-id">#{user.userId}</div>
                          </div>
                          <div className="region-cell">{user.regionName}</div>
                          
                          {campaign.targetConfigs?.map((config: any) => {
                            const target = user.targets[config.skuId] || 0;
                            const achieved = performances[user.userId]?.[config.skuId] || 0;
                            const percentage = target > 0 ? Math.round((achieved / target) * 100) : 0;
                            totalPercentage += percentage;
                            
                            return (
                              <div key={config.skuId} className="sku-cell">
                                <div className="target-display">Target: {target}</div>
                                <input
                                  type="number"
                                  className="performance-input-compact"
                                  value={achieved}
                                  onChange={(e) => updatePerformance(user.userId, config.skuId, parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  min="0"
                                />
                                <div className="percentage-display">{percentage}%</div>
                              </div>
                            );
                          })}
                          
                          <div className="overall-cell">
                            <div className="overall-percentage">
                              {campaign.targetConfigs?.length > 0 ? Math.round(totalPercentage / campaign.targetConfigs.length) : 0}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeMode === 'dateWise' && (
              <div className="date-wise-mode">
                <h4>📅 Date-wise Performance Entry</h4>
                <p>Daily performance tracking coming soon</p>
              </div>
            )}

            {activeMode === 'csvUpload' && (
              <div className="csv-upload-mode">
                <h4>📄 CSV Bulk Upload</h4>
                <p>Bulk performance upload coming soon</p>
              </div>
            )}
          </div>

          <div className="modal-actions-compact">
            <button className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button 
              className="btn-save"
              onClick={savePerformance}
              disabled={loading}
            >
              {loading ? 'Saving...' : '💾 Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceModal;