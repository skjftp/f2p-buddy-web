import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';

interface Campaign {
  id: string;
  name: string;
  targetConfigs: any[];
  userTargets: any[];
  regionalDistribution: any;
  selectedRegions: string[];
}

interface PerformanceModalProps {
  campaign: Campaign;
  onClose: () => void;
  onUpdate: () => void;
}

interface UserPerformance {
  userId: string;
  userName: string;
  regionName: string;
  performances: Record<string, {
    achieved: number;
    target: number;
    percentage: number;
    lastUpdated: string;
  }>;
  dateWisePerformances?: Record<string, Record<string, number>>; // date -> skuId -> value
}

const PerformanceModal: React.FC<PerformanceModalProps> = ({ campaign, onClose, onUpdate }) => {
  const [activeMode, setActiveMode] = useState<'consolidated' | 'dateWise' | 'csvUpload'>('consolidated');
  const [loading, setLoading] = useState(false);
  const [userPerformances, setUserPerformances] = useState<UserPerformance[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [regionSummary, setRegionSummary] = useState<Record<string, any>>({});
  
  // CSV Upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvError, setCsvError] = useState<string>('');

  // Load existing performance data
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (!campaign.userTargets) return;
      
      try {
        const dbInstance = await getFirestoreInstance();
        
        // Initialize user performances from campaign targets
        const performances: UserPerformance[] = campaign.userTargets.map(userTarget => ({
          userId: userTarget.userId,
          userName: userTarget.userName,
          regionName: userTarget.regionName,
          performances: campaign.targetConfigs.reduce((acc, config) => {
            acc[config.skuId] = {
              achieved: 0,
              target: userTarget.targets[config.skuId] || 0,
              percentage: 0,
              lastUpdated: new Date().toISOString()
            };
            return acc;
          }, {}),
          dateWisePerformances: {}
        }));
        
        setUserPerformances(performances);
        computeRegionSummary(performances);
      } catch (error) {
        console.error('Error loading performance data:', error);
      }
    };

    loadPerformanceData();
  }, [campaign]);

  // Compute region-wise summary
  const computeRegionSummary = (performances: UserPerformance[]) => {
    const summary: Record<string, any> = {};
    
    performances.forEach(userPerf => {
      if (!summary[userPerf.regionName]) {
        summary[userPerf.regionName] = {
          regionName: userPerf.regionName,
          totalUsers: 0,
          skuSummaries: {}
        };
      }
      
      summary[userPerf.regionName].totalUsers += 1;
      
      Object.entries(userPerf.performances).forEach(([skuId, perf]) => {
        if (!summary[userPerf.regionName].skuSummaries[skuId]) {
          summary[userPerf.regionName].skuSummaries[skuId] = {
            totalTarget: 0,
            totalAchieved: 0,
            percentage: 0
          };
        }
        
        summary[userPerf.regionName].skuSummaries[skuId].totalTarget += perf.target;
        summary[userPerf.regionName].skuSummaries[skuId].totalAchieved += perf.achieved;
      });
    });

    // Calculate percentages
    Object.values(summary).forEach((region: any) => {
      Object.values(region.skuSummaries).forEach((sku: any) => {
        sku.percentage = sku.totalTarget > 0 ? Math.round((sku.totalAchieved / sku.totalTarget) * 100) : 0;
      });
    });
    
    setRegionSummary(summary);
  };

  // Update individual performance
  const updateUserPerformance = (userId: string, skuId: string, achieved: number) => {
    setUserPerformances(prev => {
      const updated = prev.map(userPerf => {
        if (userPerf.userId === userId) {
          const target = userPerf.performances[skuId]?.target || 0;
          return {
            ...userPerf,
            performances: {
              ...userPerf.performances,
              [skuId]: {
                ...userPerf.performances[skuId],
                achieved,
                percentage: target > 0 ? Math.round((achieved / target) * 100) : 0,
                lastUpdated: new Date().toISOString()
              }
            }
          };
        }
        return userPerf;
      });
      
      computeRegionSummary(updated);
      return updated;
    });
  };

  // Update date-wise performance
  const updateDateWisePerformance = (userId: string, date: string, skuId: string, value: number) => {
    setUserPerformances(prev => {
      const updated = prev.map(userPerf => {
        if (userPerf.userId === userId) {
          return {
            ...userPerf,
            dateWisePerformances: {
              ...userPerf.dateWisePerformances,
              [date]: {
                ...userPerf.dateWisePerformances?.[date],
                [skuId]: value
              }
            }
          };
        }
        return userPerf;
      });
      
      // Recalculate consolidated from date-wise data
      const finalUpdated = updated.map(userPerf => {
        const consolidated = { ...userPerf.performances };
        
        Object.entries(userPerf.dateWisePerformances || {}).forEach(([_, dateData]) => {
          Object.entries(dateData).forEach(([skuId, value]) => {
            if (consolidated[skuId]) {
              consolidated[skuId].achieved = (consolidated[skuId].achieved || 0) + (value as number);
              const target = consolidated[skuId].target;
              consolidated[skuId].percentage = target > 0 ? Math.round((consolidated[skuId].achieved / target) * 100) : 0;
            }
          });
        });
        
        return { ...userPerf, performances: consolidated };
      });
      
      computeRegionSummary(finalUpdated);
      return finalUpdated;
    });
  };

  // CSV upload handling
  const handleCsvUpload = (file: File) => {
    setCsvFile(file);
    setCsvError('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');
        
        // Validate headers
        const expectedHeaders = ['user_id', 'user_name', 'date', ...campaign.targetConfigs.map(c => c.skuCode)];
        const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
          setCsvError(`Missing required columns: ${missingHeaders.join(', ')}`);
          return;
        }

        // Parse data
        const data = lines.slice(1).map((line, index) => {
          const values = line.split(',');
          const row: any = { lineNumber: index + 2 };
          
          headers.forEach((header, i) => {
            row[header] = values[i]?.trim() || '';
          });
          
          return row;
        });

        setCsvData(data);
        
        // Apply CSV data to user performances
        data.forEach(row => {
          const date = row.date || selectedDate;
          campaign.targetConfigs.forEach(config => {
            const value = parseFloat(row[config.skuCode]) || 0;
            if (value > 0) {
              updateDateWisePerformance(row.user_id, date, config.skuId, value);
            }
          });
        });
        
      } catch (error) {
        setCsvError('Invalid CSV format. Please check your file.');
      }
    };
    
    reader.readAsText(file);
  };

  const onCsvDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      handleCsvUpload(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onCsvDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
    maxSize: 5 * 1024 * 1024,
  });

  // Save performance data
  const handleSave = async () => {
    setLoading(true);
    try {
      const dbInstance = await getFirestoreInstance();
      
      // Create or update performance collection
      // This would typically save to a performances collection
      // For now, we'll update the campaign with performance data
      
      const performanceData = {
        userPerformances,
        regionSummary,
        lastUpdated: serverTimestamp()
      };
      
      await updateDoc(doc(dbInstance, 'campaigns', campaign.id), {
        performanceData,
        updatedAt: serverTimestamp()
      });
      
      toast.success('Performance data updated successfully!');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving performance:', error);
      toast.error('Failed to save performance data');
    } finally {
      setLoading(false);
    }
  };

  // Render consolidated performance mode
  const renderConsolidatedMode = () => (
    <div className="performance-mode">
      <div className="users-performance-grid">
        {userPerformances.map(userPerf => (
          <div key={userPerf.userId} className="user-performance-card">
            <div className="user-header">
              <div className="user-info">
                <h4>{userPerf.userName}</h4>
                <span className="user-region">{userPerf.regionName}</span>
              </div>
            </div>
            
            <div className="sku-performances">
              {campaign.targetConfigs.map(config => {
                const performance = userPerf.performances[config.skuId];
                return (
                  <div key={config.skuId} className="sku-performance">
                    <div className="sku-header">
                      <span className="sku-code">{config.skuCode}</span>
                      <span className="target-info">Target: {performance?.target} {config.unit}</span>
                    </div>
                    <div className="performance-input">
                      <input
                        type="number"
                        className="form-input"
                        value={performance?.achieved || 0}
                        onChange={(e) => updateUserPerformance(userPerf.userId, config.skuId, parseFloat(e.target.value) || 0)}
                        placeholder="Achieved"
                        min="0"
                      />
                      <span className="unit-label">{config.unit}</span>
                    </div>
                    <div className="performance-percentage">
                      <div className="percentage-bar">
                        <div 
                          className="percentage-fill"
                          style={{ width: `${Math.min(performance?.percentage || 0, 100)}%` }}
                        />
                      </div>
                      <span className="percentage-text">{performance?.percentage || 0}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render date-wise performance mode
  const renderDateWiseMode = () => (
    <div className="performance-mode">
      <div className="date-selector">
        <label className="form-label">Performance Date</label>
        <input
          type="date"
          className="form-input"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>
      
      <div className="users-performance-grid">
        {userPerformances.map(userPerf => (
          <div key={userPerf.userId} className="user-performance-card">
            <div className="user-header">
              <div className="user-info">
                <h4>{userPerf.userName}</h4>
                <span className="user-region">{userPerf.regionName}</span>
                <span className="date-performance">Performance for {selectedDate}</span>
              </div>
            </div>
            
            <div className="sku-performances">
              {campaign.targetConfigs.map(config => {
                const datePerformance = userPerf.dateWisePerformances?.[selectedDate]?.[config.skuId] || 0;
                return (
                  <div key={config.skuId} className="sku-performance">
                    <div className="sku-header">
                      <span className="sku-code">{config.skuCode}</span>
                      <span className="date-label">Daily performance</span>
                    </div>
                    <div className="performance-input">
                      <input
                        type="number"
                        className="form-input"
                        value={datePerformance}
                        onChange={(e) => updateDateWisePerformance(userPerf.userId, selectedDate, config.skuId, parseFloat(e.target.value) || 0)}
                        placeholder="Daily achievement"
                        min="0"
                      />
                      <span className="unit-label">{config.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render CSV upload mode
  const renderCsvUploadMode = () => (
    <div className="performance-mode">
      <div className="csv-upload-area">
        <div {...getRootProps()} className={`csv-dropzone ${isDragActive ? 'active' : ''} ${csvError ? 'error' : ''}`}>
          <input {...getInputProps()} />
          <div className="dropzone-content">
            <div className="dropzone-icon">📄</div>
            <h5>Drop CSV file here or click to select</h5>
            <p>Upload performance data for multiple users</p>
            <p className="file-limit">Maximum file size: 5MB</p>
          </div>
        </div>

        {csvError && (
          <div className="csv-error">
            <span className="error-icon">⚠️</span>
            <span>{csvError}</span>
          </div>
        )}

        {csvFile && !csvError && (
          <div className="csv-success">
            <span className="success-icon">✅</span>
            <span>Successfully uploaded: {csvFile.name}</span>
            <span className="file-info">({csvData.length} records)</span>
          </div>
        )}
      </div>

      <div className="csv-format-guide">
        <h5>📋 Required CSV Format</h5>
        <div className="format-example">
          <code>
            user_id,user_name,date,{campaign.targetConfigs.map(c => c.skuCode).join(',')}
            <br />
            +919955100649,Sumit Jha,2025-09-07,{campaign.targetConfigs.map(() => '500').join(',')}
            <br />
            +919955100649,Sumit Jha,2025-09-08,{campaign.targetConfigs.map(() => '750').join(',')}
          </code>
        </div>
        
        <div className="format-notes">
          <h6>Important Notes:</h6>
          <ul>
            <li><strong>user_id:</strong> Must match participant ID from campaign</li>
            <li><strong>date:</strong> Format: YYYY-MM-DD</li>
            <li><strong>SKU Columns:</strong> Daily achievement values</li>
            <li>Multiple date entries will be consolidated automatically</li>
            <li>Values will be added to existing performance data</li>
          </ul>
        </div>
      </div>

      {csvData.length > 0 && !csvError && (
        <div className="csv-preview">
          <h5>📊 Upload Preview</h5>
          <div className="preview-table">
            <div className="preview-header">
              <span>User</span>
              <span>Date</span>
              {campaign.targetConfigs.map(config => (
                <span key={config.skuId}>{config.skuCode}</span>
              ))}
            </div>
            {csvData.slice(0, 5).map((row, index) => (
              <div key={index} className="preview-row">
                <span>{row.user_name}</span>
                <span>{row.date}</span>
                {campaign.targetConfigs.map(config => (
                  <span key={config.skuId}>{row[config.skuCode] || '0'}</span>
                ))}
              </div>
            ))}
          </div>
          {csvData.length > 5 && (
            <p className="preview-footer">
              Showing first 5 rows. Total: {csvData.length} records
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="performance-modal">
      <div className="modal-overlay" onClick={onClose} />
      
      <div className="modal-content">
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
            📊 Consolidated Performance
          </button>
          <button 
            className={`mode-btn ${activeMode === 'dateWise' ? 'active' : ''}`}
            onClick={() => setActiveMode('dateWise')}
          >
            📅 Date-wise Performance
          </button>
          <button 
            className={`mode-btn ${activeMode === 'csvUpload' ? 'active' : ''}`}
            onClick={() => setActiveMode('csvUpload')}
          >
            📄 CSV Upload
          </button>
        </div>

        {/* Performance Content */}
        <div className="performance-content">
          {activeMode === 'consolidated' && renderConsolidatedMode()}
          {activeMode === 'dateWise' && renderDateWiseMode()}
          {activeMode === 'csvUpload' && renderCsvUploadMode()}
        </div>

        {/* Region-wise Summary */}
        {Object.keys(regionSummary).length > 0 && (
          <div className="region-summary">
            <h4>🗺️ Region-wise Performance Summary</h4>
            <div className="summary-grid">
              {Object.values(regionSummary).map((region: any) => (
                <div key={region.regionName} className="region-summary-card">
                  <h5>{region.regionName}</h5>
                  <div className="region-stats">
                    <span className="user-count">{region.totalUsers} users</span>
                  </div>
                  <div className="sku-summaries">
                    {Object.entries(region.skuSummaries).map(([skuId, sku]: [string, any]) => {
                      const config = campaign.targetConfigs.find(c => c.skuId === skuId);
                      return (
                        <div key={skuId} className="sku-summary">
                          <span className="sku-code">{config?.skuCode}</span>
                          <span className="summary-values">
                            {sku.totalAchieved}/{sku.totalTarget} {config?.unit} ({sku.percentage}%)
                          </span>
                          <div className="summary-bar">
                            <div 
                              className="summary-fill"
                              style={{ width: `${Math.min(sku.percentage, 100)}%` }}
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

        {/* Modal Actions */}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : '💾 Save Performance Data'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PerformanceModal;