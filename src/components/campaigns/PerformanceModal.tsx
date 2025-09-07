import React, { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
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
  
  // Date-wise performance data: {userId: {date: {skuId: value}}}
  const [dateWisePerformances, setDateWisePerformances] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

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

  const updateDateWisePerformance = (userId: string, skuId: string, value: number) => {
    setDateWisePerformances(prev => {
      const updated = {
        ...prev,
        [userId]: {
          ...prev[userId],
          [selectedDate]: {
            ...prev[userId]?.[selectedDate],
            [skuId]: value
          }
        }
      };
      
      // Recalculate consolidated performance from all date entries
      const consolidatedPerformances: Record<string, Record<string, number>> = {};
      
      Object.entries(updated).forEach(([uId, userDates]) => {
        consolidatedPerformances[uId] = {};
        campaign.targetConfigs?.forEach((config: any) => {
          let totalAchieved = 0;
          Object.values(userDates).forEach((dateData: any) => {
            totalAchieved += dateData[config.skuId] || 0;
          });
          consolidatedPerformances[uId][config.skuId] = totalAchieved;
        });
      });
      
      setPerformances(consolidatedPerformances);
      computeRegionSummary(consolidatedPerformances);
      
      return updated;
    });
  };

  const getDateWiseValue = (userId: string, skuId: string) => {
    return dateWisePerformances[userId]?.[selectedDate]?.[skuId] || 0;
  };

  const savePerformance = async () => {
    setLoading(true);
    try {
      console.log('💾 Saving performance data to userPerformances collection...');
      const dbInstance = await getFirestoreInstance();
      
      // Save to userPerformances collection for each user
      const savePromises = campaign.userTargets?.map(async (user: any) => {
        const userPerformanceData = {
          campaignId: campaign.id,
          campaignName: campaign.name,
          consolidated: performances[user.userId] || {},
          dateWise: dateWisePerformances[user.userId] || {},
          lastUpdated: serverTimestamp(),
          updateMode: activeMode,
          selectedDate: activeMode === 'dateWise' ? selectedDate : null
        };
        
        console.log(`📊 Saving for user ${user.userName}:`, userPerformanceData);
        
        // Save to userPerformances/{userId}_{campaignId} (flat structure)
        const docId = `${user.userId}_${campaign.id}`;
        await setDoc(
          doc(dbInstance, 'userPerformances', docId),
          userPerformanceData,
          { merge: true } // Merge with existing data
        );
        
        console.log(`✅ Saved performance for ${user.userName}`);
      });
      
      await Promise.all(savePromises || []);
      
      const message = activeMode === 'dateWise' 
        ? `Performance saved for ${selectedDate}!` 
        : 'Performance data updated!';
      
      toast.success(message);
      onUpdate();
    } catch (error) {
      console.error('Error saving performance:', error);
      console.log('🔍 Error details:', error);
      toast.error('Failed to save performance data');
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
              <div className="date-wise-container">
                <div className="date-selector-header">
                  <h4>📅 Date-wise Performance Entry</h4>
                  <div className="date-input-group">
                    <label>Performance Date:</label>
                    <input
                      type="date"
                      className="date-input"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="performance-table-container">
                  <div className="performance-table">
                    <div className="table-header">
                      <span className="user-col">User</span>
                      <span className="region-col">Region</span>
                      {campaign.targetConfigs?.map((config: any) => (
                        <span key={config.skuId} className="sku-col">
                          {config.skuCode}
                          <div className="unit-info">Daily ({config.unit})</div>
                        </span>
                      ))}
                      <span className="overall-col">Daily Total</span>
                    </div>
                    
                    <div className="table-body">
                      {campaign.userTargets?.map((user: any) => {
                        let dailyTotal = 0;
                        
                        return (
                          <div key={user.userId} className="table-row">
                            <div className="user-cell">
                              <div className="user-name">{user.userName}</div>
                              <div className="user-id">#{user.userId}</div>
                            </div>
                            <div className="region-cell">{user.regionName}</div>
                            
                            {campaign.targetConfigs?.map((config: any) => {
                              const dailyValue = getDateWiseValue(user.userId, config.skuId);
                              const cumulativeTotal = performances[user.userId]?.[config.skuId] || 0;
                              dailyTotal += dailyValue;
                              
                              return (
                                <div key={config.skuId} className="sku-cell">
                                  <div className="cumulative-display">
                                    Cumulative: {cumulativeTotal}
                                  </div>
                                  <input
                                    type="number"
                                    className="performance-input-compact"
                                    value={dailyValue}
                                    onChange={(e) => updateDateWisePerformance(user.userId, config.skuId, parseFloat(e.target.value) || 0)}
                                    placeholder={`Daily for ${selectedDate}`}
                                    min="0"
                                  />
                                  <div className="date-note">
                                    For {selectedDate}
                                  </div>
                                </div>
                              );
                            })}
                            
                            <div className="overall-cell">
                              <div className="daily-total">
                                {dailyTotal}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                <div className="date-wise-info">
                  <div className="info-card">
                    <h5>📊 How Date-wise Tracking Works:</h5>
                    <ul>
                      <li><strong>Select Date:</strong> Choose performance date (e.g., Sept 10)</li>
                      <li><strong>Enter Daily Values:</strong> Input daily achievements</li>
                      <li><strong>Save:</strong> Date-wise data saved to database</li>
                      <li><strong>Cumulative:</strong> All dates automatically sum up</li>
                      <li><strong>Add More Dates:</strong> Select new date and add more performance</li>
                    </ul>
                  </div>
                </div>
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