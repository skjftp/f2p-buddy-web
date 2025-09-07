import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, serverTimestamp, getDoc, query, where, getDocs, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestoreInstance, getStorageInstance } from '../../config/firebase';
import { Campaign } from '../../store/slices/campaignSlice';
import { toast } from 'react-toastify';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../../contexts/AuthContext';

interface CampaignEditWizardProps {
  campaign: Campaign;
  onClose: () => void;
  onUpdate: () => void;
}

const CampaignEditWizard: React.FC<CampaignEditWizardProps> = ({ campaign, onClose, onUpdate }) => {
  const { organization } = useAuth();
  const [activeTab, setActiveTab] = useState<'basic' | 'skus' | 'targets' | 'regions' | 'contest' | 'prizes' | 'participants'>('basic');
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
  // Organization data
  const [organizationSkus, setOrganizationSkus] = useState<any[]>([]);
  const [hierarchyLevels, setHierarchyLevels] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  
  const [campaignData, setCampaignData] = useState({
    name: campaign.name,
    description: campaign.description,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    status: campaign.status,
    banner: null as File | null,
    
    // New campaign structure fields
    selectedSkus: [] as string[],
    targetConfigs: [] as any[],
    selectedRegions: [] as string[],
    selectedDesignations: [] as string[],
    regionalDistribution: {} as any,
    contestType: 'points' as string,
    pointSystem: undefined as any,
    milestoneSystem: undefined as any,
    prizeStructure: {
      panIndiaLevel: [] as any[],
      regionalLevel: [] as any[],
      subRegionalLevel: [] as any[]
    },
    userTargets: [] as any[],
    customTargetsEnabled: false,
    
    // Legacy fields for backward compatibility
    regionTargets: [] as any[],
    totalTarget: 0,
    skuTargets: [] as any[],
    volumeTargets: {} as any,
    valueTargets: {} as any,
    activityTargets: {} as any,
    individualPrizes: [] as any[],
    participantType: 'individual' as string,
    participants: campaign.participants || []
  });

  const [bannerPreview, setBannerPreview] = useState(campaign.banner || '');

  // Load complete campaign data on mount
  useEffect(() => {
    const loadCampaignData = async () => {
      if (!organization?.id) return;
      
      try {
        const dbInstance = await getFirestoreInstance();
        
        // Load organization data
        const orgDoc = await getDoc(doc(dbInstance, 'organizations', organization.id));
        if (orgDoc.exists()) {
          const orgData = orgDoc.data();
          if (orgData.skus) {
            setOrganizationSkus(orgData.skus);
          }
          if (orgData.hierarchyLevels) {
            setHierarchyLevels(orgData.hierarchyLevels);
          }
          if (orgData.designations) {
            setDesignations(orgData.designations);
          }
        }
        
        
        // Load campaign data
        const campaignDoc = await getDoc(doc(dbInstance, 'campaigns', campaign.id));
        
        if (campaignDoc.exists()) {
          const data = campaignDoc.data();
          setCampaignData(prev => ({
            ...prev,
            // New campaign structure fields
            selectedSkus: data.selectedSkus || [],
            targetConfigs: data.targetConfigs || [],
            selectedRegions: data.selectedRegions || [],
            selectedDesignations: data.selectedDesignations || [],
            regionalDistribution: data.regionalDistribution || {},
            contestType: data.contestType || 'points',
            pointSystem: data.pointSystem || undefined,
            milestoneSystem: data.milestoneSystem || undefined,
            prizeStructure: data.prizeStructure || {
              panIndiaLevel: [],
              regionalLevel: [],
              subRegionalLevel: []
            },
            userTargets: data.userTargets || [],
            customTargetsEnabled: data.customTargetsEnabled || false,
            
            // Legacy fields
            regionTargets: data.regionTargets || [],
            totalTarget: data.totalTarget || 0,
            skuTargets: data.skuTargets || [],
            volumeTargets: data.volumeTargets || {},
            valueTargets: data.valueTargets || {},
            activityTargets: data.activityTargets || {},
            individualPrizes: data.individualPrizes || []
          }));
        }
      } catch (error) {
        console.error('Error loading campaign data:', error);
      }
    };

    loadCampaignData();
  }, [campaign.id, organization?.id]);

  const onBannerDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setCampaignData(prev => ({ ...prev, banner: file }));
      const reader = new FileReader();
      reader.onload = () => setBannerPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onBannerDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif'] },
    multiple: false,
    maxSize: 10 * 1024 * 1024,
  });

  const handleUpdate = async () => {
    setLoading(true);
    try {
      let bannerUrl = campaign.banner || '';
      
      if (campaignData.banner) {
        const storageInstance = await getStorageInstance();
        const fileName = `${Date.now()}_${campaignData.banner.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const bannerRef = ref(storageInstance, `campaigns/${fileName}`);
        const snapshot = await uploadBytes(bannerRef, campaignData.banner);
        bannerUrl = await getDownloadURL(snapshot.ref);
      }

      const updateData: any = {
        name: campaignData.name,
        description: campaignData.description,
        startDate: campaignData.startDate,
        endDate: campaignData.endDate,
        status: campaignData.status,
        banner: bannerUrl,
        
        // New campaign structure fields
        selectedSkus: campaignData.selectedSkus,
        targetConfigs: campaignData.targetConfigs,
        selectedRegions: campaignData.selectedRegions,
        selectedDesignations: campaignData.selectedDesignations,
        regionalDistribution: campaignData.regionalDistribution,
        contestType: campaignData.contestType,
        prizeStructure: campaignData.prizeStructure,
        userTargets: campaignData.userTargets,
        customTargetsEnabled: campaignData.customTargetsEnabled,
        
        // Legacy fields for backward compatibility
        regionTargets: campaignData.regionTargets,
        totalTarget: campaignData.totalTarget,
        skuTargets: campaignData.skuTargets,
        volumeTargets: campaignData.volumeTargets,
        valueTargets: campaignData.valueTargets,
        activityTargets: campaignData.activityTargets,
        individualPrizes: campaignData.individualPrizes,
        participants: campaignData.participants,
        updatedAt: serverTimestamp()
      };

      // Only add pointSystem and milestoneSystem if they have data
      if (campaignData.pointSystem && Object.keys(campaignData.pointSystem.basePointsPerUnit || {}).length > 0) {
        updateData.pointSystem = campaignData.pointSystem;
      }
      
      if (campaignData.milestoneSystem && campaignData.milestoneSystem.milestones && campaignData.milestoneSystem.milestones.length > 0) {
        updateData.milestoneSystem = campaignData.milestoneSystem;
      }

      const dbInstance = await getFirestoreInstance();
      await updateDoc(doc(dbInstance, 'campaigns', campaign.id), updateData);

      toast.success('Campaign updated successfully!');
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error updating campaign:', error);
      toast.error('Failed to update campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setLoading(true);
    try {
      const dbInstance = await getFirestoreInstance();
      await deleteDoc(doc(dbInstance, 'campaigns', campaign.id));
      
      toast.success('Campaign deleted successfully!');
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign');
    } finally {
      setLoading(false);
      setDeleteConfirm(false);
    }
  };

  // Recalculate targets with current organization users
  const recalculateTargets = async () => {
    console.log('🔄 Recalculating targets with current organization users...');
    
    try {
      const dbInstance = await getFirestoreInstance();
      
      // Load current organization users
      const usersQuery = query(
        collection(dbInstance, 'users'),
        where('organizationId', '==', organization?.id)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const currentUsers: any[] = [];
      
      usersSnapshot.forEach((doc) => {
        currentUsers.push({ id: doc.id, ...doc.data() });
      });
      
      console.log('👥 Current organization users:', currentUsers.length);
      
      // Filter users based on campaign targeting
      const eligibleUsers = currentUsers.filter(user => {
        const hasDesignation = campaignData.selectedDesignations.some(desId => 
          designations.find(des => des.id === desId)?.name === user.designationName
        );
        
        const hasRegion = campaignData.selectedRegions.some(regionId => {
          const regionItem = hierarchyLevels.flatMap(l => l.items).find(item => item.id === regionId);
          return Object.values(user.regionHierarchy || {}).includes(regionId) ||
                 user.finalRegionName === regionItem?.name;
        });
        
        return hasDesignation && hasRegion;
      });
      
      console.log('✅ Eligible users after recalculation:', eligibleUsers.length);
      
      // Create new user targets
      const newUserTargets: any[] = [];
      
      eligibleUsers.forEach(user => {
        const userTargetData: any = {
          userId: user.id,
          userName: user.name || user.displayName || 'Unknown User',
          regionName: user.finalRegionName || 'Unknown Region',
          targets: {}
        };

        // Find the best matching region with targets for this user
        let bestRegionMatch: any = null;
        let bestMatchLevel = 0;
        
        campaignData.targetConfigs.forEach((config: any) => {
          const distributions = campaignData.regionalDistribution[config.skuId] || [];
          
          distributions.forEach((dist: any) => {
            const regionItem = hierarchyLevels.flatMap(l => l.items).find(item => item.id === dist.regionId);
            
            const userBelongsToRegion = Object.values(user.regionHierarchy || {}).includes(dist.regionId) ||
                                       user.finalRegionName === dist.regionName;
            
            if (userBelongsToRegion && regionItem && regionItem.level > bestMatchLevel && dist.target > 0) {
              bestMatchLevel = regionItem.level;
              bestRegionMatch = dist;
            }
          });
        });

        // Assign targets - handle parent regions that have 0 targets
        campaignData.targetConfigs.forEach((config: any) => {
          const distributions = campaignData.regionalDistribution[config.skuId] || [];
          
          // Find any region the user belongs to that has targets
          const userDistribution = distributions.find((dist: any) => {
            const belongsToRegion = Object.values(user.regionHierarchy || {}).includes(dist.regionId) ||
                                   user.finalRegionName === dist.regionName;
            return belongsToRegion && dist.target > 0;
          });
          
          if (userDistribution) {
            userTargetData.targets[config.skuId] = userDistribution.individualTarget;
            console.log(`✅ Assigned ${user.userName}: ${config.skuCode} = ${userDistribution.individualTarget} from ${userDistribution.regionName}`);
          } else {
            // If no direct match, find first available target for user's hierarchy
            const hierarchyRegions = Object.values(user.regionHierarchy || {});
            
            for (const regionId of hierarchyRegions) {
              const regionDist = distributions.find((dist: any) => dist.regionId === regionId && dist.target > 0);
              if (regionDist) {
                userTargetData.targets[config.skuId] = regionDist.individualTarget;
                console.log(`✅ Assigned ${user.userName}: ${config.skuCode} = ${regionDist.individualTarget} from hierarchy match ${regionDist.regionName}`);
                break;
              }
            }
            
            // Ultimate fallback: use any target from Delhi/Punjab if user is in NA1
            if (!userTargetData.targets[config.skuId] && user.finalRegionName) {
              const childRegions = distributions.filter((dist: any) => dist.target > 0);
              if (childRegions.length > 0) {
                // Use first available child region target
                userTargetData.targets[config.skuId] = childRegions[0].individualTarget;
                console.log(`🔄 Fallback assigned ${user.userName}: ${config.skuCode} = ${childRegions[0].individualTarget} from fallback ${childRegions[0].regionName}`);
              }
            }
          }
        });

        newUserTargets.push(userTargetData);
      });
      
      setCampaignData(prev => ({
        ...prev,
        userTargets: newUserTargets
      }));
      
      const oldCount = campaignData.userTargets?.length || 0;
      console.log(`🎯 Targets recalculated: ${oldCount} → ${newUserTargets.length} users`);
      toast.success(`Targets updated! Now includes ${newUserTargets.length} users (was ${oldCount})`);
      
    } catch (error) {
      console.error('❌ Error recalculating targets:', error);
      toast.error('Failed to recalculate targets');
    }
  };

  const renderBasicTab = () => (
    <div className="edit-tab-content">
      <div className="form-group">
        <label className="form-label">Campaign Name</label>
        <input
          type="text"
          className="form-input"
          value={campaignData.name}
          onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          className="form-input"
          rows={3}
          value={campaignData.description}
          onChange={(e) => setCampaignData(prev => ({ ...prev, description: e.target.value }))}
        />
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
        <div className="form-group">
          <label className="form-label">Start Date</label>
          <input
            type="date"
            className="form-input"
            value={campaignData.startDate}
            onChange={(e) => setCampaignData(prev => ({ ...prev, startDate: e.target.value }))}
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">End Date</label>
          <input
            type="date"
            className="form-input"
            value={campaignData.endDate}
            onChange={(e) => setCampaignData(prev => ({ ...prev, endDate: e.target.value }))}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Campaign Status</label>
        <div className="status-options">
          {[
            { value: 'draft', label: '📝 Draft', desc: 'Campaign not yet active' },
            { value: 'active', label: '🟢 Active', desc: 'Campaign is live and running' },
            { value: 'completed', label: '✅ Completed', desc: 'Campaign has ended' },
            { value: 'cancelled', label: '❌ Cancelled', desc: 'Campaign was cancelled' }
          ].map(status => (
            <label key={status.value} className="status-option">
              <input
                type="radio"
                name="status"
                value={status.value}
                checked={campaignData.status === status.value}
                onChange={() => setCampaignData(prev => ({ ...prev, status: status.value as any }))}
              />
              <div className="status-content">
                <strong>{status.label}</strong>
                <p>{status.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Campaign Banner</label>
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          {bannerPreview ? (
            <div className="banner-preview" style={{textAlign: 'center'}}>
              <img 
                src={bannerPreview} 
                alt="Banner preview" 
                style={{
                  width: '200px', 
                  height: '100px', 
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '2px solid var(--gray-200)'
                }} 
              />
              <p style={{marginTop: '8px', fontSize: '12px', color: 'var(--gray-500)'}}>Click to change</p>
            </div>
          ) : (
            <div style={{textAlign: 'center', padding: '20px'}}>
              <div style={{fontSize: '32px', marginBottom: '8px'}}>📸</div>
              <p>Drop banner image here or click to select</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSkuTab = () => {
    const handleSkuSelection = (skuId: string, selected: boolean) => {
      setCampaignData(prev => {
        const newSelectedSkus = selected 
          ? [...prev.selectedSkus, skuId]
          : prev.selectedSkus.filter(id => id !== skuId);

        // Update target configs to match selected SKUs
        const newTargetConfigs = newSelectedSkus.map(id => {
          const existingConfig = prev.targetConfigs.find(c => c.skuId === id);
          if (existingConfig) return existingConfig;
          
          const sku = organizationSkus.find(s => s.id === id);
          return {
            skuId: id,
            skuName: sku?.name || '',
            skuCode: sku?.code || '',
            targetType: 'volume' as const,
            target: 0,
            unit: 'units'
          };
        });

        return {
          ...prev,
          selectedSkus: newSelectedSkus,
          targetConfigs: newTargetConfigs
        };
      });
    };

    return (
      <div className="edit-tab-content">
        <div className="section-header">
          <h3>📦 SKU Selection</h3>
          <p>Modify which SKUs are included in this campaign</p>
        </div>

        {organizationSkus.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h4>No SKUs Available</h4>
            <p>Please add SKUs in Organization Settings first.</p>
          </div>
        ) : (
          <div className="skus-selection">
            {organizationSkus.map((sku) => (
              <label key={sku.id} className="sku-selection-item">
                <input
                  type="checkbox"
                  checked={campaignData.selectedSkus.includes(sku.id)}
                  onChange={(e) => handleSkuSelection(sku.id, e.target.checked)}
                />
                <div className="sku-info">
                  <div className="sku-header">
                    <span className="sku-code">{sku.code}</span>
                    <span className="sku-name">{sku.name}</span>
                  </div>
                  {sku.category && <span className="sku-category">{sku.category}</span>}
                  {sku.description && <p className="sku-description">{sku.description}</p>}
                  {sku.unitPrice && (
                    <div className="sku-price">
                      {sku.currency === 'INR' ? '₹' : sku.currency === 'USD' ? '$' : '€'}
                      {sku.unitPrice}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="selection-summary">
          <strong>Selected: {campaignData.selectedSkus.length} SKU(s)</strong>
        </div>
      </div>
    );
  };

  const renderTargetsTab = () => {
    const updateTargetConfig = (skuId: string, updates: any) => {
      setCampaignData(prev => ({
        ...prev,
        targetConfigs: prev.targetConfigs.map(config =>
          config.skuId === skuId ? { ...config, ...updates } : config
        )
      }));
    };

    return (
      <div className="edit-tab-content">
        <div className="section-header">
          <h3>🎯 Target Metrics Configuration</h3>
          <p>Edit target values and types for selected SKUs</p>
        </div>

        {campaignData.selectedSkus.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h4>No SKUs Selected</h4>
            <p>Please select SKUs in the previous tab first.</p>
          </div>
        ) : (
          <div className="target-configs">
            {campaignData.targetConfigs.map((config) => (
              <div key={config.skuId} className="target-config-item">
                <h4>{config.skuCode} - {config.skuName}</h4>
                
                <div className="config-row">
                  <div className="form-group">
                    <label className="form-label">Target Type</label>
                    <select
                      className="form-input"
                      value={config.targetType}
                      onChange={(e) => updateTargetConfig(config.skuId, { 
                        targetType: e.target.value as 'volume' | 'value',
                        unit: e.target.value === 'volume' ? 'units' : 'INR'
                      })}
                    >
                      <option value="volume">Volume Based</option>
                      <option value="value">Value Based</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Target Value</label>
                    <input
                      type="number"
                      className="form-input"
                      value={config.target}
                      onChange={(e) => updateTargetConfig(config.skuId, { target: parseFloat(e.target.value) || 0 })}
                      placeholder="Enter target"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <select
                      className="form-input"
                      value={config.unit}
                      onChange={(e) => updateTargetConfig(config.skuId, { unit: e.target.value })}
                    >
                      {config.targetType === 'volume' ? (
                        <>
                          <option value="units">Units</option>
                          <option value="cases">Cases</option>
                          <option value="kg">Kilograms</option>
                          <option value="liters">Liters</option>
                        </>
                      ) : (
                        <>
                          <option value="INR">₹ (INR)</option>
                          <option value="USD">$ (USD)</option>
                          <option value="EUR">€ (EUR)</option>
                        </>
                      )}
                    </select>
                  </div>

                  {campaignData.targetConfigs.length > 1 && (
                    <div className="form-group">
                      <label className="form-label">Ranking Weightage (%)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={config.weightage || 0}
                        onChange={(e) => updateTargetConfig(config.skuId, { weightage: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g., 70"
                        min="0"
                        max="100"
                      />
                      <div className="form-help">
                        Weight for leaderboard ranking
                      </div>
                    </div>
                  )}
                </div>

                {campaignData.targetConfigs.length > 1 && (
                  <div className="weightage-summary">
                    <h5>⚖️ Ranking Weightage Distribution</h5>
                    <div className="weightage-grid">
                      {campaignData.targetConfigs.map(cfg => (
                        <div key={cfg.skuId} className="weightage-card">
                          <span className="sku-badge">{cfg.skuCode}</span>
                          <span className="weightage-percent">{cfg.weightage || 0}%</span>
                        </div>
                      ))}
                    </div>
                    <div className="weightage-validation">
                      <span className="total-label">Total Weightage:</span>
                      <span className={`total-value ${
                        campaignData.targetConfigs.reduce((sum, cfg) => sum + (cfg.weightage || 0), 0) === 100 
                          ? 'valid' : 'invalid'
                      }`}>
                        {campaignData.targetConfigs.reduce((sum, cfg) => sum + (cfg.weightage || 0), 0)}%
                      </span>
                      {campaignData.targetConfigs.reduce((sum, cfg) => sum + (cfg.weightage || 0), 0) !== 100 && (
                        <div className="weightage-actions">
                          <span className="validation-warning">
                            ⚠️ Should total 100% for accurate ranking
                          </span>
                          <button 
                            type="button"
                            className="btn-auto-balance"
                            onClick={() => {
                              const equalWeight = Math.round(100 / campaignData.targetConfigs.length);
                              setCampaignData(prev => ({
                                ...prev,
                                targetConfigs: prev.targetConfigs.map(cfg => ({
                                  ...cfg,
                                  weightage: equalWeight
                                }))
                              }));
                            }}
                          >
                            Auto-Balance
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderRegionsTab = () => (
    <div className="edit-tab-content">
      <div className="section-header">
        <h3>🗺️ Regional & Designation Targeting</h3>
        <p>View and edit regional distribution and targeting</p>
      </div>

      {/* Exact Creation Interface - Interactive Selection */}
      <div className="targeting-sections">
        {/* Regional Targeting Section - Same as Creation */}
        <div className="targeting-section">
          <div className="section-header">
            <h4>🗺️ Regional Targeting</h4>
            <div className="selected-count">
              {campaignData.selectedRegions.length} region(s) selected
            </div>
          </div>

          {hierarchyLevels.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏗️</div>
              <h4>Loading Hierarchy...</h4>
              <p>Please wait while organization hierarchy loads.</p>
            </div>
          ) : (
            <div className="hierarchy-selection">
              {hierarchyLevels.map(level => (
                <div key={level.id} className="hierarchy-level-section">
                  <h5 className="level-title">{level.name}</h5>
                  <div className="hierarchy-items">
                    {level.items.map((item: any) => {
                      const isSelected = campaignData.selectedRegions.includes(item.id);
                      
                      return (
                        <label 
                          key={item.id} 
                          className={`hierarchy-item ${isSelected ? 'selected' : ''}`}
                        >
                          <div className="checkbox-wrapper">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setCampaignData(prev => ({
                                  ...prev,
                                  selectedRegions: checked
                                    ? [...prev.selectedRegions, item.id]
                                    : prev.selectedRegions.filter(id => id !== item.id)
                                }));
                              }}
                            />
                          </div>
                          <div className="item-info">
                            <span className="item-name">{item.name}</span>
                            {item.parentId && (
                              <span className="parent-info">
                                under {hierarchyLevels.flatMap(l => l.items).find(p => p.id === item.parentId)?.name}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Designation Targeting Section - Same as Creation */}
        <div className="targeting-section">
          <div className="section-header">
            <h4>👔 Designation Targeting</h4>
            <div className="selected-count">
              {campaignData.selectedDesignations.length} designation(s) selected
            </div>
          </div>

          {designations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h4>Loading Designations...</h4>
              <p>Please wait while designations load.</p>
            </div>
          ) : (
            <div className="designations-grid">
              {designations.map(designation => (
                <label 
                  key={designation.id}
                  className={`designation-item ${campaignData.selectedDesignations.includes(designation.id) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={campaignData.selectedDesignations.includes(designation.id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setCampaignData(prev => ({
                        ...prev,
                        selectedDesignations: checked
                          ? [...prev.selectedDesignations, designation.id]
                          : prev.selectedDesignations.filter(id => id !== designation.id)
                      }));
                    }}
                  />
                  <div className="designation-info">
                    <span className={`category-badge ${designation.category}`}>
                      {designation.category}
                    </span>
                    <span className="designation-name">{designation.name}</span>
                    {designation.description && (
                      <span className="designation-desc">{designation.description}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Regional Distribution Display */}
      {Object.keys(campaignData.regionalDistribution || {}).length > 0 && (
        <div className="distribution-display">
          <h4>📊 Current Regional Distribution</h4>
          {Object.entries(campaignData.regionalDistribution).map(([skuId, distributions]) => {
            const config = campaignData.targetConfigs.find(c => c.skuId === skuId);
            return (
              <div key={skuId} className="sku-distribution-view">
                <h5>{config?.skuCode || skuId} Distribution</h5>
                <div className="distribution-table">
                  <div className="table-header">
                    <span>Region</span>
                    <span>Target</span>
                    <span>Users</span>
                    <span>Per User</span>
                  </div>
                  {(distributions as any[]).map((dist: any) => (
                    <div key={dist.regionId} className="distribution-row">
                      <span>{dist.regionName}</span>
                      <span>{dist.target} {config?.unit}</span>
                      <span>{dist.userCount}</span>
                      <span>{dist.individualTarget} {config?.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Exact Step 4 Interface with Existing Data */}
      <div className="step4-interface">
        {/* Show current editable target distribution */}
        {Object.keys(campaignData.regionalDistribution || {}).length > 0 && (
          <div className="distribution-preview">
            <h4>📋 Current Regional Distribution (Editable)</h4>
            
            {campaignData.targetConfigs.map(config => {
              const distributions = campaignData.regionalDistribution[config.skuId] || [];
              const totalDistributed = distributions.reduce((sum: number, dist: any) => sum + dist.target, 0);
              
              const updateRegionalTarget = (regionId: string, newTarget: number) => {
                setCampaignData(prev => {
                  const newDistribution = { ...prev.regionalDistribution };
                  if (newDistribution[config.skuId]) {
                    newDistribution[config.skuId] = newDistribution[config.skuId].map((dist: any) =>
                      dist.regionId === regionId 
                        ? { 
                            ...dist, 
                            target: newTarget,
                            individualTarget: dist.userCount > 0 ? Math.round(newTarget / dist.userCount) : newTarget
                          }
                        : dist
                    );
                  }
                  return {
                    ...prev,
                    regionalDistribution: newDistribution
                  };
                });
              };
              
              return (
                <div key={config.skuId} className="sku-distribution-card">
                  <div className="sku-header">
                    <span className="sku-code">{config.skuCode}</span>
                    <span className="sku-name">{config.skuName}</span>
                    <span className="total-target">
                      {config.target} {config.unit} total
                    </span>
                  </div>
                  
                  <div className="distribution-table">
                    <div className="table-header">
                      <span>Region</span>
                      <span>Target (Editable)</span>
                      <span>Users</span>
                      <span>Per User</span>
                    </div>
                    {distributions.map((dist: any) => (
                      <div key={dist.regionId} className="distribution-row editable">
                        <span className="region-name">{dist.regionName}</span>
                        <div className="editable-target">
                          <input
                            type="number"
                            className="target-input"
                            value={dist.target}
                            onChange={(e) => updateRegionalTarget(dist.regionId, parseFloat(e.target.value) || 0)}
                            min="0"
                          />
                          <span className="unit-label">{config.unit}</span>
                        </div>
                        <span className="user-count">{dist.userCount}</span>
                        <span className="individual-target">
                          {dist.individualTarget} {config.unit}
                        </span>
                      </div>
                    ))}
                    <div className="distribution-footer">
                      <span>Total Distributed:</span>
                      <span className={`total-distributed ${totalDistributed !== config.target ? 'variance' : ''}`}>
                        {totalDistributed} {config.unit}
                      </span>
                      {totalDistributed !== config.target && (
                        <span className="variance">
                          (Target: {config.target} | Variance: ±{Math.abs(config.target - totalDistributed)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderContestTab = () => (
    <div className="edit-tab-content">
      <div className="section-header">
        <h3>🏆 Contest Structure</h3>
        <p>Edit contest type and point/milestone configuration</p>
      </div>

      <div className="contest-type-selection">
        <label className="contest-type-option">
          <input
            type="radio"
            name="contestType"
            value="points"
            checked={campaignData.contestType === 'points'}
            onChange={(e) => setCampaignData(prev => ({ ...prev, contestType: e.target.value as any }))}
          />
          <div className="option-content">
            <div className="option-icon">⭐</div>
            <div className="option-text">
              <strong>Point System</strong>
              <p>Participants earn points for achieving targets</p>
            </div>
          </div>
        </label>

        <label className="contest-type-option">
          <input
            type="radio"
            name="contestType"
            value="milestone"
            checked={campaignData.contestType === 'milestone'}
            onChange={(e) => setCampaignData(prev => ({ ...prev, contestType: e.target.value as any }))}
          />
          <div className="option-content">
            <div className="option-icon">🏁</div>
            <div className="option-text">
              <strong>Milestone System</strong>
              <p>Participants unlock rewards at specific achievement levels</p>
            </div>
          </div>
        </label>

        <label className="contest-type-option">
          <input
            type="radio"
            name="contestType"
            value="ranking"
            checked={campaignData.contestType === 'ranking'}
            onChange={(e) => setCampaignData(prev => ({ ...prev, contestType: e.target.value as any }))}
          />
          <div className="option-content">
            <div className="option-icon">🏆</div>
            <div className="option-text">
              <strong>Ranking System</strong>
              <p>Top performers compete for rank-based prizes</p>
            </div>
          </div>
        </label>
      </div>

      {campaignData.contestType === 'points' && campaignData.pointSystem && (
        <div className="point-system-config">
          <h4>Point System Configuration</h4>
          <p>Current point system settings (editing coming soon)</p>
          <div className="config-preview">
            {Object.keys(campaignData.pointSystem.basePointsPerUnit || {}).map(skuId => {
              const points = campaignData.pointSystem.basePointsPerUnit[skuId];
              const config = campaignData.targetConfigs.find(c => c.skuId === skuId);
              return (
                <div key={skuId} className="point-preview">
                  <span>{config?.skuCode}: {points} points per {config?.unit}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderPrizesTab = () => {
    const updatePrize = (level: 'panIndiaLevel' | 'regionalLevel' | 'subRegionalLevel', index: number, field: 'rank' | 'prize' | 'value', value: string | number) => {
      setCampaignData(prev => ({
        ...prev,
        prizeStructure: {
          ...prev.prizeStructure,
          [level]: prev.prizeStructure[level].map((prize, i) => 
            i === index ? { ...prize, [field]: value } : prize
          )
        }
      }));
    };

    const addPrize = (level: 'panIndiaLevel' | 'regionalLevel' | 'subRegionalLevel') => {
      const nextRank = campaignData.prizeStructure[level].length + 1;
      setCampaignData(prev => ({
        ...prev,
        prizeStructure: {
          ...prev.prizeStructure,
          [level]: [...prev.prizeStructure[level], { rank: nextRank, prize: '', value: '' }]
        }
      }));
    };

    const removePrize = (level: 'panIndiaLevel' | 'regionalLevel' | 'subRegionalLevel', index: number) => {
      setCampaignData(prev => ({
        ...prev,
        prizeStructure: {
          ...prev.prizeStructure,
          [level]: prev.prizeStructure[level].filter((_, i) => i !== index)
        }
      }));
    };

    const renderPrizeLevel = (
      level: 'panIndiaLevel' | 'regionalLevel' | 'subRegionalLevel',
      title: string,
      icon: string
    ) => (
      <div className="prize-level-section">
        <div className="level-header">
          <h4>{icon} {title}</h4>
          <button className="btn-secondary" onClick={() => addPrize(level)}>
            + Add Prize
          </button>
        </div>
        
        {campaignData.prizeStructure[level].length === 0 ? (
          <div className="empty-prizes">
            <p>No prizes configured for this level</p>
          </div>
        ) : (
          <div className="prizes-list">
            {campaignData.prizeStructure[level].map((prize, index) => (
              <div key={index} className="prize-edit-item">
                <div className="prize-form">
                  <div className="form-group">
                    <label>Rank</label>
                    <input
                      type="number"
                      className="form-input"
                      value={prize.rank}
                      onChange={(e) => updatePrize(level, index, 'rank', parseInt(e.target.value) || 1)}
                      style={{width: '80px'}}
                    />
                  </div>
                  <div className="form-group">
                    <label>Prize</label>
                    <input
                      type="text"
                      className="form-input"
                      value={prize.prize}
                      onChange={(e) => updatePrize(level, index, 'prize', e.target.value)}
                      placeholder="e.g., iPhone 15 Pro"
                    />
                  </div>
                  <div className="form-group">
                    <label>Value</label>
                    <input
                      type="text"
                      className="form-input"
                      value={prize.value}
                      onChange={(e) => updatePrize(level, index, 'value', e.target.value)}
                      placeholder="e.g., ₹1,20,000"
                    />
                  </div>
                  <button 
                    className="btn-icon btn-danger"
                    onClick={() => removePrize(level, index)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    return (
      <div className="edit-tab-content">
        <div className="section-header">
          <h3>🎁 Prize Structure</h3>
          <p>Edit prize configuration for different levels</p>
        </div>

        <div className="prize-levels">
          {renderPrizeLevel('panIndiaLevel', 'Pan India Level', '🇮🇳')}
          {renderPrizeLevel('regionalLevel', 'Regional Level', '🗺️')}
          {renderPrizeLevel('subRegionalLevel', 'Sub-Regional Level', '📍')}
        </div>
      </div>
    );
  };


  return (
    <div className="campaign-edit-wizard">
      <div className="edit-wizard-header">
        <h2>Edit Campaign: {campaign.name}</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="edit-wizard-tabs">
        <button 
          className={`edit-tab ${activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveTab('basic')}
        >
          📋 Campaign Info
        </button>
        <button 
          className={`edit-tab ${activeTab === 'skus' ? 'active' : ''}`}
          onClick={() => setActiveTab('skus')}
        >
          📦 SKU Selection
        </button>
        <button 
          className={`edit-tab ${activeTab === 'targets' ? 'active' : ''}`}
          onClick={() => setActiveTab('targets')}
        >
          🎯 Target Metrics
        </button>
        <button 
          className={`edit-tab ${activeTab === 'regions' ? 'active' : ''}`}
          onClick={() => setActiveTab('regions')}
        >
          🗺️ Regional Targeting
        </button>
        <button 
          className={`edit-tab ${activeTab === 'contest' ? 'active' : ''}`}
          onClick={() => setActiveTab('contest')}
        >
          🏆 Contest Structure
        </button>
        <button 
          className={`edit-tab ${activeTab === 'prizes' ? 'active' : ''}`}
          onClick={() => setActiveTab('prizes')}
        >
          🎁 Prize Structure
        </button>
        <button 
          className={`edit-tab ${activeTab === 'participants' ? 'active' : ''}`}
          onClick={() => setActiveTab('participants')}
        >
          👥 User Targets
        </button>
      </div>

      <div className="edit-wizard-content">
        {activeTab === 'basic' && renderBasicTab()}
        {activeTab === 'skus' && renderSkuTab()}
        {activeTab === 'targets' && renderTargetsTab()}
        {activeTab === 'regions' && renderRegionsTab()}
        {activeTab === 'contest' && renderContestTab()}
        {activeTab === 'prizes' && renderPrizesTab()}
        {activeTab === 'participants' && (
          <div className="step-content">
            <div className="step-header">
              <h3>👥 User Targets & Participants</h3>
              <p>Review and finalize individual user targets for the campaign</p>
            </div>

            {Object.keys(campaignData.regionalDistribution || {}).length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎯</div>
                <h4>No Regional Distribution Data</h4>
                <p>Campaign doesn't have regional distribution data. This may be a legacy campaign.</p>
              </div>
            ) : (
              <div className="user-targets">
                {/* Target Mode Selection */}
                <div className="target-mode-selection">
                  <h4>📊 Target Assignment Method</h4>
                  <div className="mode-options">
                    <label className="mode-option">
                      <input
                        type="radio"
                        name="targetMode"
                        value="computed"
                        checked={!campaignData.customTargetsEnabled}
                        onChange={() => setCampaignData(prev => ({ ...prev, customTargetsEnabled: false }))}
                      />
                      <div className="option-content">
                        <div className="option-icon">🔄</div>
                        <div className="option-text">
                          <strong>Use Current Targets</strong>
                          <p>Display computed targets from regional distribution</p>
                          <div className="option-features">
                            <span>• Based on regional target distribution</span>
                            <span>• Computed individual user targets</span>
                            <span>• Maintains target accuracy</span>
                          </div>
                        </div>
                      </div>
                    </label>

                    <label className="mode-option">
                      <input
                        type="radio"
                        name="targetMode"
                        value="custom"
                        checked={campaignData.customTargetsEnabled}
                        onChange={() => setCampaignData(prev => ({ ...prev, customTargetsEnabled: true }))}
                      />
                      <div className="option-content">
                        <div className="option-icon">📄</div>
                        <div className="option-text">
                          <strong>Custom CSV Upload</strong>
                          <p>Upload new user-specific target assignments</p>
                          <div className="option-features">
                            <span>• Individual target control</span>
                            <span>• Bulk upload capability</span>
                            <span>• Override current values</span>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Current Targets Display */}
                {!campaignData.customTargetsEnabled && (
                  <div className="computed-targets-section">
                    <div className="section-header">
                      <h4>🔄 Current Individual Targets</h4>
                      <div className="targets-actions">
                        <span className="targets-info">
                          {campaignData.userTargets?.length || 0} participant(s)
                        </span>
                        <button 
                          className="btn-recalculate"
                          onClick={recalculateTargets}
                          title="Recalculate targets with current organization users"
                        >
                          🔄 Recalculate Targets
                        </button>
                      </div>
                    </div>

                    {(!campaignData.userTargets || campaignData.userTargets.length === 0) ? (
                      <div className="empty-targets">
                        <div className="empty-icon">👥</div>
                        <h5>No User Targets Computed</h5>
                        <p>User targets will be computed based on regional distribution and eligible participants.</p>
                      </div>
                    ) : (
                      <div className="targets-display">
                        <div className="targets-summary">
                          <div className="summary-cards">
                            <div className="summary-card">
                              <span className="card-number">{campaignData.userTargets.length}</span>
                              <span className="card-label">Participants</span>
                            </div>
                            <div className="summary-card">
                              <span className="card-number">{campaignData.targetConfigs?.length || 0}</span>
                              <span className="card-label">SKUs</span>
                            </div>
                            <div className="summary-card">
                              <span className="card-number">{campaignData.selectedRegions.length}</span>
                              <span className="card-label">Regions</span>
                            </div>
                          </div>
                        </div>

                        <div className="targets-table">
                          <div className="table-header">
                            <span>Participant</span>
                            <span>Region</span>
                            {campaignData.targetConfigs?.map((config: any) => (
                              <span key={config.skuId}>
                                {config.skuCode} ({config.unit})
                              </span>
                            ))}
                          </div>
                          
                          <div className="table-body">
                            {campaignData.userTargets.slice(0, 20).map((userTarget: any, index: number) => (
                              <div key={userTarget.userId} className="table-row">
                                <div className="participant-info">
                                  <span className="participant-name">{userTarget.userName}</span>
                                  <span className="participant-id">#{userTarget.userId}</span>
                                </div>
                                <span className="participant-region">{userTarget.regionName}</span>
                                {campaignData.targetConfigs?.map((config: any) => (
                                  <span key={config.skuId} className="target-value">
                                    {userTarget.targets?.[config.skuId] || 0}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>

                          {campaignData.userTargets.length > 20 && (
                            <div className="table-footer">
                              <p>Showing first 20 participants. Total: {campaignData.userTargets.length}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Custom CSV Upload Mode */}
                {campaignData.customTargetsEnabled && (
                  <div className="csv-upload-section">
                    <div className="section-header">
                      <h4>📄 Custom Target Upload</h4>
                      <p>Upload new target assignments via CSV</p>
                    </div>

                    <div className="csv-upload-area">
                      <div className="csv-dropzone">
                        <div className="dropzone-content">
                          <div className="dropzone-icon">📄</div>
                          <h5>CSV Upload Coming Soon</h5>
                          <p>Custom CSV upload functionality will be implemented</p>
                        </div>
                      </div>
                    </div>

                    <div className="csv-format-guide">
                      <h5>📋 Required CSV Format</h5>
                      <div className="format-example">
                        <code>
                          user_id,user_name,region,{campaignData.targetConfigs?.map((c: any) => c.skuCode).join(',')}
                          <br />
                          +919955100649,Sumit Jha,Delhi,{campaignData.targetConfigs?.map(() => '1000').join(',')}
                        </code>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="edit-wizard-actions">
        <div className="action-group">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          
          <button 
            className="btn"
            onClick={handleUpdate}
            disabled={loading}
          >
            {loading ? 'Updating...' : '💾 Update Campaign'}
          </button>
        </div>
        
        <div className="danger-zone">
          <button 
            className={`btn-danger ${deleteConfirm ? 'confirm' : ''}`}
            onClick={handleDelete}
            disabled={loading}
          >
            {deleteConfirm ? 'Click Again to Delete' : '🗑️ Delete Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignEditWizard;