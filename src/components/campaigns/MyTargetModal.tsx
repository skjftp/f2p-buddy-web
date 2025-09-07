import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

interface MyTargetModalProps {
  campaign: any;
  onClose: () => void;
}

interface UserTarget {
  skuCode: string;
  skuName: string;
  target: number;
  unit: string;
  achieved: number;
  percentage: number;
}

const MyTargetModal: React.FC<MyTargetModalProps> = ({ campaign, onClose }) => {
  const { user } = useAuth();
  const [userTargets, setUserTargets] = useState<UserTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalProgress, setTotalProgress] = useState(0);

  useEffect(() => {
    const loadUserTargets = async () => {
      try {
        console.log('📊 Loading targets for user:', user?.uid);
        
        // Find user's targets from campaign
        const userTarget = campaign.userTargets?.find((ut: any) => 
          ut.userId === user?.uid || ut.userId === user?.phoneNumber
        );
        
        if (!userTarget) {
          console.log('❌ No targets found for user');
          setLoading(false);
          return;
        }

        console.log('✅ Found user targets:', userTarget);

        // Load user's performance data
        const dbInstance = await getFirestoreInstance();
        const docId = `${userTarget.userId}_${campaign.id}`;
        const perfDoc = await getDoc(doc(dbInstance, 'userPerformances', docId));
        
        let userPerformance: Record<string, number> = {};
        if (perfDoc.exists()) {
          const perfData = perfDoc.data();
          userPerformance = perfData.consolidated || {};
          console.log('📈 Loaded user performance:', userPerformance);
        }

        // Combine target configs with user's specific targets and performance
        const targetData: UserTarget[] = campaign.targetConfigs?.map((config: any) => {
          const target = userTarget.targets[config.skuId] || 0;
          const achieved = userPerformance[config.skuId] || 0;
          const percentage = target > 0 ? Math.round((achieved / target) * 100) : 0;

          return {
            skuCode: config.skuCode,
            skuName: config.skuName,
            target,
            unit: config.unit,
            achieved,
            percentage
          };
        }) || [];

        setUserTargets(targetData);
        
        // Calculate overall progress
        const avgProgress = targetData.length > 0 
          ? Math.round(targetData.reduce((sum, t) => sum + t.percentage, 0) / targetData.length)
          : 0;
        setTotalProgress(avgProgress);

      } catch (error) {
        console.error('Error loading user targets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserTargets();
  }, [campaign, user]);

  return (
    <div className="my-target-modal">
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>🎯 My Targets: {campaign.name}</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          <div className="target-content">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading your targets...</p>
              </div>
            ) : (
              <>
                {/* Overall Progress */}
                <div className="overall-progress">
                  <h3>📊 Overall Progress</h3>
                  <div className="progress-circle">
                    <div className="circle-progress">
                      <span className="progress-percent">{totalProgress}%</span>
                    </div>
                  </div>
                  <p>Keep going! You're doing great!</p>
                </div>

                {/* SKU-wise Targets */}
                <div className="targets-breakdown">
                  <h3>🎯 Your Targets Breakdown</h3>
                  {userTargets.length === 0 ? (
                    <div className="no-targets">
                      <div className="empty-icon">🎯</div>
                      <h4>No Targets Assigned</h4>
                      <p>Targets will appear here when assigned by your administrator.</p>
                    </div>
                  ) : (
                    <div className="targets-grid">
                      {userTargets.map((target, index) => (
                        <div key={index} className="target-card">
                          <div className="target-header">
                            <div className="sku-info">
                              <span className="sku-code">{target.skuCode}</span>
                              <span className="sku-name">{target.skuName}</span>
                            </div>
                            <div className="target-percentage">
                              {target.percentage}%
                            </div>
                          </div>
                          
                          <div className="target-details">
                            <div className="target-numbers">
                              <div className="achieved">
                                <span className="label">Achieved</span>
                                <span className="value">{target.achieved.toLocaleString()} {target.unit}</span>
                              </div>
                              <div className="target-value">
                                <span className="label">Target</span>
                                <span className="value">{target.target.toLocaleString()} {target.unit}</span>
                              </div>
                            </div>
                            
                            <div className="progress-bar">
                              <div 
                                className="progress-fill"
                                style={{ width: `${Math.min(target.percentage, 100)}%` }}
                              />
                            </div>
                            
                            <div className="remaining">
                              <span className="remaining-label">Remaining:</span>
                              <span className="remaining-value">
                                {Math.max(0, target.target - target.achieved).toLocaleString()} {target.unit}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Motivational Section */}
                <div className="motivation-section">
                  <div className="motivation-card">
                    <h4>💪 Keep Pushing!</h4>
                    <p>
                      {totalProgress >= 100 ? 
                        "🎉 Congratulations! You've achieved your targets!" :
                        totalProgress >= 75 ?
                        "🔥 You're so close! Push for that final stretch!" :
                        totalProgress >= 50 ?
                        "⚡ Great progress! Keep the momentum going!" :
                        "🚀 Let's get started! Every step counts towards success!"
                      }
                    </p>
                  </div>
                </div>
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

export default MyTargetModal;