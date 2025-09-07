import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';

interface Campaign {
  id: string;
  name: string;
  targetConfigs: any[];
  userTargets: any[];
  selectedRegions: string[];
}

interface LeaderboardModalProps {
  campaign: Campaign;
  onClose: () => void;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  regionName: string;
  regionHierarchy: Record<string, string>;
  totalScore: number;
  skuPerformances: Record<string, {
    target: number;
    achieved: number;
    percentage: number;
  }>;
  averagePerformance: number;
}

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ campaign, onClose }) => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<'panIndia' | 'region' | 'subRegion'>('panIndia');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [hierarchyLevels, setHierarchyLevels] = useState<any[]>([]);

  // Load organization hierarchy for filtering
  useEffect(() => {
    const loadHierarchy = async () => {
      try {
        const dbInstance = await getFirestoreInstance();
        
        // Get organization data to load hierarchy
        const campaignDoc = await getDoc(doc(dbInstance, 'campaigns', campaign.id));
        if (campaignDoc.exists()) {
          const campaignData = campaignDoc.data();
          
          const orgDoc = await getDoc(doc(dbInstance, 'organizations', campaignData.orgId));
          if (orgDoc.exists() && orgDoc.data().hierarchyLevels) {
            setHierarchyLevels(orgDoc.data().hierarchyLevels);
          }
        }
      } catch (error) {
        console.error('Error loading hierarchy:', error);
      }
    };

    loadHierarchy();
  }, [campaign.id]);

  // Load and compute leaderboard
  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);
      try {
        console.log('🏆 Loading leaderboard data...');
        const dbInstance = await getFirestoreInstance();
        
        const leaderboardEntries: LeaderboardEntry[] = [];
        
        // Load performance data for each user and get complete user data
        const loadPromises = campaign.userTargets?.map(async (user: any) => {
          const docId = `${user.userId}_${campaign.id}`;
          const perfDoc = await getDoc(doc(dbInstance, 'userPerformances', docId));
          
          // Load complete user data to get regionHierarchy
          let completeUserData = user;
          try {
            const userDoc = await getDoc(doc(dbInstance, 'users', user.userId));
            if (userDoc.exists()) {
              completeUserData = { ...user, ...userDoc.data() };
              console.log(`👤 Loaded complete user data for ${user.userName}:`, {
                regionHierarchy: completeUserData.regionHierarchy,
                regionName: completeUserData.finalRegionName || completeUserData.regionName
              });
            } else {
              console.log(`⚠️ No user document found for ${user.userId}, using campaign data`);
            }
          } catch (userError) {
            console.error(`❌ Error loading user ${user.userId}:`, userError);
          }
          
          let skuPerformances: Record<string, any> = {};
          let totalScore = 0;
          let totalPercentage = 0;
          let skuCount = 0;
          
          // Calculate weighted performance for each SKU
          let weightedScore = 0;
          const hasWeightage = campaign.targetConfigs?.some((c: any) => c.weightage && c.weightage > 0);
          
          campaign.targetConfigs?.forEach((config: any) => {
            const target = user.targets[config.skuId] || 0;
            let achieved = 0;
            
            if (perfDoc.exists()) {
              const perfData = perfDoc.data();
              achieved = perfData.consolidated?.[config.skuId] || 0;
            }
            
            const percentage = target > 0 ? Math.round((achieved / target) * 100) : 0;
            
            skuPerformances[config.skuId] = {
              target,
              achieved,
              percentage
            };
            
            // Calculate weighted score for ranking
            if (hasWeightage && config.weightage) {
              weightedScore += (percentage * config.weightage) / 100;
            } else {
              // If no weightage defined, use equal weighting
              totalPercentage += percentage;
              skuCount++;
            }
            
            totalScore += achieved;
          });
          
          const finalRankingScore = hasWeightage 
            ? Math.round(weightedScore)
            : (skuCount > 0 ? Math.round(totalPercentage / skuCount) : 0);
          
          const entry: LeaderboardEntry = {
            userId: completeUserData.userId || user.userId,
            userName: completeUserData.displayName || completeUserData.name || user.userName,
            regionName: completeUserData.finalRegionName || completeUserData.regionName || user.regionName,
            regionHierarchy: completeUserData.regionHierarchy || {},
            totalScore,
            skuPerformances,
            averagePerformance: finalRankingScore
          };
          
          console.log(`✅ Final leaderboard entry for ${entry.userName}:`, entry);
          leaderboardEntries.push(entry);
        }) || [];
        
        await Promise.all(loadPromises);
        
        // Sort by average performance descending
        leaderboardEntries.sort((a, b) => b.averagePerformance - a.averagePerformance);
        
        console.log('🏆 Leaderboard computed:', leaderboardEntries);
        setLeaderboardData(leaderboardEntries);
        
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [campaign]);

  // Simple filtering with debugging
  const getFilteredLeaderboard = () => {
    if (filterLevel === 'panIndia') {
      return leaderboardData;
    }
    
    if (selectedRegion) {
      console.log('🔍 Filtering by region:', selectedRegion);
      console.log('📊 Total users before filtering:', leaderboardData.length);
      
      const filtered = leaderboardData.filter(entry => {
        const userRegionIds = Object.values(entry.regionHierarchy || {});
        const directMatch = userRegionIds.includes(selectedRegion);
        const nameMatch = entry.regionName === selectedRegion;
        const matches = directMatch || nameMatch;
        
        console.log(`👤 ${entry.userName}:`, {
          userRegionIds,
          userRegionName: entry.regionName,
          selectedRegion,
          directMatch,
          nameMatch,
          matches
        });
        
        return matches;
      });
      
      console.log('✅ Filtered users:', filtered.length);
      return filtered;
    }
    
    return leaderboardData;
  };

  const filteredData = getFilteredLeaderboard();
  const topThree = filteredData.slice(0, 3);
  const restOfList = filteredData.slice(3);


  return (
    <div className="leaderboard-modal">
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>🏆 Campaign Leaderboard: {campaign.name}</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          {/* Filter Controls */}
          <div className="leaderboard-filters">
            <div className="filter-tabs">
              <button 
                className={`filter-tab ${filterLevel === 'panIndia' ? 'active' : ''}`}
                onClick={() => {
                  setFilterLevel('panIndia');
                  setSelectedRegion('');
                }}
              >
                🇮🇳 Pan India
              </button>
              <button 
                className={`filter-tab ${filterLevel === 'region' ? 'active' : ''}`}
                onClick={() => setFilterLevel('region')}
              >
                🗺️ Regional
              </button>
              <button 
                className={`filter-tab ${filterLevel === 'subRegion' ? 'active' : ''}`}
                onClick={() => setFilterLevel('subRegion')}
              >
                📍 Sub-Regional
              </button>
            </div>

            {/* Region Selector */}
            {filterLevel !== 'panIndia' && (
              <div className="region-selector">
                <label>Select Region:</label>
                <select 
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="region-dropdown"
                >
                  <option value="">All Regions</option>
                  {hierarchyLevels.map(level => 
                    level.items.map((item: any) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({level.name})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
          </div>

          <div className="leaderboard-content">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Computing leaderboard rankings...</p>
              </div>
            ) : (
              <>
                {/* Podium for Top 3 */}
                {topThree.length > 0 && (
                  <div className="podium-section">
                    <h3>🏆 Top Performers</h3>
                    <div className="podium">
                      {/* Second Place */}
                      {topThree[1] && (
                        <div className="podium-position second">
                          <div className="podium-rank">2</div>
                          <div className="podium-medal">🥈</div>
                          <div className="podium-user">
                            <div className="user-name">{topThree[1].userName}</div>
                            <div className="user-region">{topThree[1].regionName}</div>
                            <div className="user-score">{topThree[1].averagePerformance}%</div>
                          </div>
                          <div className="podium-details">
                            {Object.entries(topThree[1].skuPerformances).map(([skuId, perf]: [string, any]) => {
                              const config = campaign.targetConfigs?.find(c => c.skuId === skuId);
                              return (
                                <div key={skuId} className="sku-detail">
                                  {config?.skuCode}: {perf.percentage}%
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* First Place */}
                      {topThree[0] && (
                        <div className="podium-position first">
                          <div className="podium-rank">1</div>
                          <div className="podium-medal">🥇</div>
                          <div className="podium-user">
                            <div className="user-name">{topThree[0].userName}</div>
                            <div className="user-region">{topThree[0].regionName}</div>
                            <div className="user-score">{topThree[0].averagePerformance}%</div>
                          </div>
                          <div className="podium-details">
                            {Object.entries(topThree[0].skuPerformances).map(([skuId, perf]: [string, any]) => {
                              const config = campaign.targetConfigs?.find(c => c.skuId === skuId);
                              return (
                                <div key={skuId} className="sku-detail">
                                  {config?.skuCode}: {perf.percentage}%
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Third Place */}
                      {topThree[2] && (
                        <div className="podium-position third">
                          <div className="podium-rank">3</div>
                          <div className="podium-medal">🥉</div>
                          <div className="podium-user">
                            <div className="user-name">{topThree[2].userName}</div>
                            <div className="user-region">{topThree[2].regionName}</div>
                            <div className="user-score">{topThree[2].averagePerformance}%</div>
                          </div>
                          <div className="podium-details">
                            {Object.entries(topThree[2].skuPerformances).map(([skuId, perf]: [string, any]) => {
                              const config = campaign.targetConfigs?.find(c => c.skuId === skuId);
                              return (
                                <div key={skuId} className="sku-detail">
                                  {config?.skuCode}: {perf.percentage}%
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rest of the Rankings */}
                {restOfList.length > 0 && (
                  <div className="rankings-section">
                    <h3>📋 Complete Rankings</h3>
                    <div className="rankings-list">
                      {restOfList.map((entry, index) => (
                        <div key={entry.userId} className="ranking-item">
                          <div className="ranking-position">#{index + 4}</div>
                          <div className="ranking-user">
                            <div className="user-info">
                              <div className="user-name">{entry.userName}</div>
                              <div className="user-region">{entry.regionName}</div>
                            </div>
                            <div className="performance-summary">
                              {Object.entries(entry.skuPerformances).map(([skuId, perf]: [string, any]) => {
                                const config = campaign.targetConfigs?.find(c => c.skuId === skuId);
                                return (
                                  <div key={skuId} className="sku-performance-summary">
                                    <span className="sku-code">{config?.skuCode}</span>
                                    <span className="sku-percentage">{perf.percentage}%</span>
                                    <div className="sku-progress">
                                      <div 
                                        className="sku-progress-fill"
                                        style={{ width: `${Math.min(perf.percentage, 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="overall-score">{entry.averagePerformance}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {filteredData.length === 0 && !loading && (
                  <div className="empty-leaderboard">
                    <div className="empty-icon">🏆</div>
                    <h3>No Performance Data</h3>
                    <p>No performance data available for the selected filter.</p>
                    <p>Performance data will appear here after users update their achievements.</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="modal-actions-simple">
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardModal;