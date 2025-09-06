import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestoreInstance, getStorageInstance } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { useDropzone } from 'react-dropzone';

interface CampaignWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

interface SKU {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string;
  unitPrice?: number;
  currency?: string;
}

interface HierarchyItem {
  id: string;
  name: string;
  parentId?: string;
  level: number;
}

interface HierarchyLevel {
  id: string;
  name: string;
  level: number;
  items: HierarchyItem[];
}

interface Designation {
  id: string;
  name: string;
  category: 'employee' | 'distributor' | 'retailer' | 'other';
  description: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  designationName: string;
  regionHierarchy: Record<string, string>;
  finalRegionName: string;
}

interface TargetConfig {
  skuId: string;
  skuName: string;
  skuCode: string;
  targetType: 'volume' | 'value';
  target: number;
  unit: string; // 'units', 'cases', 'INR', 'USD', etc.
}

interface RegionalDistribution {
  regionId: string;
  regionName: string;
  target: number;
  userCount: number;
  individualTarget: number;
}

interface UserTarget {
  userId: string;
  userName: string;
  regionName: string;
  targets: Record<string, number>; // skuId -> target
}

interface CampaignData {
  // Step 1: Basic Information
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  banner: File | null;

  // Step 2: SKU Selection
  selectedSkus: string[];

  // Step 3: Target Metrics Configuration
  targetConfigs: TargetConfig[];

  // Step 4: Regional and Designation Targeting
  selectedRegions: string[];
  selectedDesignations: string[];
  regionalDistribution: Record<string, RegionalDistribution[]>; // skuId -> distributions

  // Step 5: Contest Structure
  contestType: 'points' | 'milestone' | 'percentage' | 'ranking';
  pointSystem?: {
    basePointsPerUnit: Record<string, number>; // skuId -> points
    bonusMultipliers: Array<{threshold: number, multiplier: number}>;
  };
  milestoneSystem?: {
    milestones: Array<{name: string, target: number, points: number}>;
  };

  // Step 6: Prize Structure
  prizeStructure: {
    panIndiaLevel: Array<{rank: number, prize: string, value: string}>;
    regionalLevel: Array<{rank: number, prize: string, value: string}>;
    subRegionalLevel: Array<{rank: number, prize: string, value: string}>;
  };

  // Step 7: User Level Targets & Participants
  userTargets: UserTarget[];
  customTargetsEnabled: boolean;
}

const NewCampaignWizard: React.FC<CampaignWizardProps> = ({ onClose, onComplete }) => {
  const { user, organization } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [organizationSkus, setOrganizationSkus] = useState<SKU[]>([]);
  const [hierarchyLevels, setHierarchyLevels] = useState<HierarchyLevel[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [organizationUsers, setOrganizationUsers] = useState<User[]>([]);
  
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    banner: null,
    selectedSkus: [],
    targetConfigs: [],
    selectedRegions: [],
    selectedDesignations: [],
    regionalDistribution: {},
    contestType: 'points',
    prizeStructure: {
      panIndiaLevel: [],
      regionalLevel: [],
      subRegionalLevel: []
    },
    userTargets: [],
    customTargetsEnabled: false
  });

  const [bannerPreview, setBannerPreview] = useState('');

  // Load organization SKUs and users
  useEffect(() => {
    const loadOrganizationData = async () => {
      if (!organization?.id) return;

      try {
        const dbInstance = await getFirestoreInstance();
        
        // Load organization settings to get SKUs, hierarchy, and designations
        const orgDoc = await getDoc(doc(dbInstance, 'organizations', organization.id));
        if (orgDoc.exists()) {
          const data = orgDoc.data();
          
          if (data.skus) {
            setOrganizationSkus(data.skus);
          }
          
          if (data.hierarchyLevels) {
            setHierarchyLevels(data.hierarchyLevels);
          }
          
          if (data.designations) {
            setDesignations(data.designations);
          }
        }

        // Load users for participant assignment
        const usersQuery = query(
          collection(dbInstance, 'users'),
          where('orgId', '==', organization.id)
        );
        const usersSnapshot = await getDocs(usersQuery);
        const users: User[] = [];
        usersSnapshot.forEach((doc) => {
          users.push({ id: doc.id, ...doc.data() } as User);
        });
        setOrganizationUsers(users);

      } catch (error) {
        console.error('Error loading organization data:', error);
      }
    };

    loadOrganizationData();
  }, [organization?.id]);

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

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 7));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

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

  const updateTargetConfig = (skuId: string, updates: Partial<TargetConfig>) => {
    setCampaignData(prev => ({
      ...prev,
      targetConfigs: prev.targetConfigs.map(config =>
        config.skuId === skuId ? { ...config, ...updates } : config
      )
    }));
  };

  const computeRegionalDistribution = (algorithm: 'equal' | 'territory' | 'performance' | 'custom' = 'equal') => {
    const newDistribution: Record<string, RegionalDistribution[]> = {};

    campaignData.targetConfigs.forEach(config => {
      const distributions: RegionalDistribution[] = [];
      const totalTarget = config.target;
      const selectedRegionItems = campaignData.selectedRegions.map(regionId => 
        hierarchyLevels.flatMap(l => l.items).find(item => item.id === regionId)
      ).filter(Boolean) as HierarchyItem[];

      selectedRegionItems.forEach((regionItem, index) => {
        // Get users in this region
        const usersInRegion = organizationUsers.filter(user => {
          // Check if user belongs to this region
          const userRegionIds = Object.values(user.regionHierarchy || {});
          return userRegionIds.includes(regionItem.id) || 
                 user.finalRegionName === regionItem.name;
        });

        const userCount = Math.max(1, usersInRegion.length); // At least 1 for calculation
        let regionTarget = 0;
        
        switch (algorithm) {
          case 'equal':
            regionTarget = Math.round(totalTarget / selectedRegionItems.length);
            break;
          case 'territory':
            // Territory size factor (deeper levels = smaller territories)
            const sizeFactor = 1 / (regionItem.level || 1);
            const totalSizeFactor = selectedRegionItems.reduce((sum, item) => sum + (1 / (item.level || 1)), 0);
            regionTarget = Math.round(totalTarget * sizeFactor / totalSizeFactor);
            break;
          case 'performance':
            // Performance-based with some randomization for demo
            const performanceFactor = 0.7 + Math.random() * 0.6; // 0.7 to 1.3 multiplier
            const avgTarget = totalTarget / selectedRegionItems.length;
            regionTarget = Math.round(avgTarget * performanceFactor);
            break;
          default:
            regionTarget = 0;
        }

        const individualTarget = userCount > 0 ? Math.round(regionTarget / userCount) : regionTarget;

        distributions.push({
          regionId: regionItem.id,
          regionName: regionItem.name,
          target: regionTarget,
          userCount,
          individualTarget
        });
      });

      // Adjust for rounding discrepancies
      const totalDistributed = distributions.reduce((sum, dist) => sum + dist.target, 0);
      if (totalDistributed !== totalTarget && distributions.length > 0) {
        const difference = totalTarget - totalDistributed;
        distributions[0].target += difference;
        distributions[0].individualTarget = distributions[0].userCount > 0 
          ? Math.round(distributions[0].target / distributions[0].userCount)
          : distributions[0].target;
      }

      newDistribution[config.skuId] = distributions;
    });

    setCampaignData(prev => ({
      ...prev,
      regionalDistribution: newDistribution
    }));
  };


  const handleSubmit = async () => {
    setLoading(true);
    try {
      let bannerUrl = '';
      
      if (campaignData.banner) {
        const storageInstance = await getStorageInstance();
        const fileName = `${Date.now()}_${campaignData.banner.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const bannerRef = ref(storageInstance, `campaigns/${fileName}`);
        const snapshot = await uploadBytes(bannerRef, campaignData.banner);
        bannerUrl = await getDownloadURL(snapshot.ref);
      }

      const campaignDoc = {
        name: campaignData.name,
        description: campaignData.description,
        startDate: campaignData.startDate,
        endDate: campaignData.endDate,
        banner: bannerUrl,
        selectedSkus: campaignData.selectedSkus,
        targetConfigs: campaignData.targetConfigs,
        selectedRegions: campaignData.selectedRegions,
        selectedDesignations: campaignData.selectedDesignations,
        regionalDistribution: campaignData.regionalDistribution,
        contestType: campaignData.contestType,
        pointSystem: campaignData.pointSystem,
        milestoneSystem: campaignData.milestoneSystem,
        prizeStructure: campaignData.prizeStructure,
        userTargets: campaignData.userTargets,
        customTargetsEnabled: campaignData.customTargetsEnabled,
        status: 'draft',
        orgId: organization?.id || '',
        createdBy: user?.id || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const dbInstance = await getFirestoreInstance();
      await addDoc(collection(dbInstance, 'campaigns'), campaignDoc);
      
      toast.success('Campaign created successfully!');
      onComplete();
      onClose();
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Basic Information
  const renderStep1 = () => (
    <div className="step-content">
      <div className="step-header">
        <h3>📋 Campaign Information</h3>
        <p>Basic details about your sales campaign</p>
      </div>

      <div className="form-group">
        <label className="form-label">Campaign Name *</label>
        <input
          type="text"
          className="form-input"
          value={campaignData.name}
          onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Q4 Premium Widget Sales Drive"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          className="form-input"
          rows={3}
          value={campaignData.description}
          onChange={(e) => setCampaignData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of campaign goals and expectations"
        />
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
        <div className="form-group">
          <label className="form-label">Start Date *</label>
          <input
            type="date"
            className="form-input"
            value={campaignData.startDate}
            onChange={(e) => setCampaignData(prev => ({ ...prev, startDate: e.target.value }))}
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">End Date *</label>
          <input
            type="date"
            className="form-input"
            value={campaignData.endDate}
            onChange={(e) => setCampaignData(prev => ({ ...prev, endDate: e.target.value }))}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Campaign Banner</label>
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          {bannerPreview ? (
            <div style={{textAlign: 'center'}}>
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

  // Step 2: SKU Selection
  const renderStep2 = () => (
    <div className="step-content">
      <div className="step-header">
        <h3>📦 SKU Selection</h3>
        <p>Select products/services for this campaign</p>
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

  // Step 3: Target Metrics Configuration
  const renderStep3 = () => (
    <div className="step-content">
      <div className="step-header">
        <h3>🎯 Target Metrics Configuration</h3>
        <p>Set targets for each selected SKU</p>
      </div>

      {campaignData.selectedSkus.length === 0 ? (
        <div className="empty-state">
          <p>Please select SKUs in the previous step first.</p>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Step 4: Regional & Designation Targeting
  const renderStep4 = () => {
    const handleRegionToggle = (itemId: string, level: number) => {
      const newSelected = new Set(campaignData.selectedRegions);
      if (newSelected.has(itemId)) {
        newSelected.delete(itemId);
        // Remove children
        removeAllChildren(itemId, newSelected);
      } else {
        newSelected.add(itemId);
        // Auto-select parents if not already selected
        autoSelectParents(itemId, newSelected);
      }
      setCampaignData(prev => ({ ...prev, selectedRegions: Array.from(newSelected) }));
    };

    const removeAllChildren = (parentId: string, selectedSet: Set<string>) => {
      hierarchyLevels.forEach(level => {
        level.items.forEach(item => {
          if (item.parentId === parentId) {
            selectedSet.delete(item.id);
            removeAllChildren(item.id, selectedSet);
          }
        });
      });
    };

    const autoSelectParents = (childId: string, selectedSet: Set<string>) => {
      const childItem = hierarchyLevels.flatMap(l => l.items).find(item => item.id === childId);
      if (childItem?.parentId) {
        selectedSet.add(childItem.parentId);
        autoSelectParents(childItem.parentId, selectedSet);
      }
    };

    const getPartialState = (itemId: string): 'none' | 'partial' | 'all' => {
      const children = hierarchyLevels.flatMap(l => l.items).filter(item => item.parentId === itemId);
      if (children.length === 0) return 'none';
      
      const selectedChildren = children.filter(child => campaignData.selectedRegions.includes(child.id));
      if (selectedChildren.length === 0) return 'none';
      if (selectedChildren.length === children.length) return 'all';
      return 'partial';
    };

    const handleDesignationToggle = (designationId: string) => {
      const newSelected = campaignData.selectedDesignations.includes(designationId)
        ? campaignData.selectedDesignations.filter(id => id !== designationId)
        : [...campaignData.selectedDesignations, designationId];
      setCampaignData(prev => ({ ...prev, selectedDesignations: newSelected }));
    };

    return (
      <div className="step-content">
        <div className="step-header">
          <h3>🗺️ Regional & Designation Targeting</h3>
          <p>Select regions and designations for your campaign</p>
        </div>

        {campaignData.targetConfigs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h4>Configure Target Metrics First</h4>
            <p>Please configure target metrics in the previous step to enable regional targeting.</p>
          </div>
        ) : (
          <div className="targeting-sections">
            {/* Regional Targeting Section */}
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
                  <h4>No Hierarchy Configured</h4>
                  <p>Please configure your organization hierarchy in Settings first.</p>
                </div>
              ) : (
                <div className="hierarchy-selection">
                  {hierarchyLevels.map(level => (
                    <div key={level.id} className="hierarchy-level-section">
                      <h5 className="level-title">{level.name}</h5>
                      <div className="hierarchy-items">
                        {level.items.map(item => {
                          const isSelected = campaignData.selectedRegions.includes(item.id);
                          const partialState = getPartialState(item.id);
                          
                          return (
                            <label 
                              key={item.id} 
                              className={`hierarchy-item ${isSelected ? 'selected' : ''} ${partialState === 'partial' ? 'partial' : ''}`}
                            >
                              <div className="checkbox-wrapper">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleRegionToggle(item.id, item.level)}
                                />
                                {partialState === 'partial' && <span className="partial-indicator">~</span>}
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

            {/* Designation Targeting Section */}
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
                  <h4>No Designations Configured</h4>
                  <p>Please configure user designations in Settings first.</p>
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
                        onChange={() => handleDesignationToggle(designation.id)}
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

            {/* Distribution Algorithm Selection */}
            {campaignData.selectedRegions.length > 0 && (
              <div className="targeting-section">
                <div className="section-header">
                  <h4>📊 Distribution Algorithm</h4>
                  <p>Choose how to distribute targets across selected regions</p>
                </div>

                <div className="algorithm-options">
                  <label className="algorithm-option">
                    <input 
                      type="radio" 
                      name="algorithm" 
                      value="equal"
                      onChange={() => computeRegionalDistribution('equal')}
                    />
                    <div className="option-content">
                      <div className="option-icon">⚖️</div>
                      <div className="option-text">
                        <strong>Equal Distribution</strong>
                        <p>Divide targets equally across all selected regions</p>
                      </div>
                    </div>
                  </label>

                  <label className="algorithm-option">
                    <input 
                      type="radio" 
                      name="algorithm" 
                      value="territory"
                      onChange={() => computeRegionalDistribution('territory')}
                    />
                    <div className="option-content">
                      <div className="option-icon">🗺️</div>
                      <div className="option-text">
                        <strong>Territory-based</strong>
                        <p>Larger territories get proportionally higher targets</p>
                      </div>
                    </div>
                  </label>

                  <label className="algorithm-option">
                    <input 
                      type="radio" 
                      name="algorithm" 
                      value="performance"
                      onChange={() => computeRegionalDistribution('performance')}
                    />
                    <div className="option-content">
                      <div className="option-icon">📈</div>
                      <div className="option-text">
                        <strong>Performance-based</strong>
                        <p>Higher performers get higher targets based on historical data</p>
                      </div>
                    </div>
                  </label>
                </div>

                {Object.keys(campaignData.regionalDistribution).length > 0 && (
                  <div className="distribution-preview">
                    <h5>📋 Computed Regional Distribution</h5>
                    {campaignData.targetConfigs.map(config => {
                      const distributions = campaignData.regionalDistribution[config.skuId] || [];
                      const totalDistributed = distributions.reduce((sum, dist) => sum + dist.target, 0);
                      
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
                              <span>Target</span>
                              <span>Users</span>
                              <span>Per User</span>
                            </div>
                            {distributions.map(dist => (
                              <div key={dist.regionId} className="distribution-row">
                                <span className="region-name">{dist.regionName}</span>
                                <span className="region-target">
                                  {dist.target} {config.unit}
                                </span>
                                <span className="user-count">{dist.userCount}</span>
                                <span className="individual-target">
                                  {dist.individualTarget} {config.unit}
                                </span>
                              </div>
                            ))}
                            <div className="distribution-footer">
                              <span>Total Distributed:</span>
                              <span className="total-distributed">
                                {totalDistributed} {config.unit}
                              </span>
                              {totalDistributed !== config.target && (
                                <span className="variance">
                                  (±{Math.abs(config.target - totalDistributed)})
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
            )}
          </div>
        )}
      </div>
    );
  };

  // Step 5: Contest Structure
  const renderStep5 = () => {
    const updatePointSystem = (skuId: string, points: number) => {
      setCampaignData(prev => ({
        ...prev,
        pointSystem: {
          ...prev.pointSystem,
          basePointsPerUnit: {
            ...prev.pointSystem?.basePointsPerUnit,
            [skuId]: points
          }
        }
      }));
    };

    const addBonusMultiplier = () => {
      const threshold = 100; // Default 100% target
      const multiplier = 1.5; // Default 1.5x multiplier
      
      setCampaignData(prev => ({
        ...prev,
        pointSystem: {
          ...prev.pointSystem,
          basePointsPerUnit: prev.pointSystem?.basePointsPerUnit || {},
          bonusMultipliers: [
            ...(prev.pointSystem?.bonusMultipliers || []),
            { threshold, multiplier }
          ]
        }
      }));
    };

    const updateBonusMultiplier = (index: number, field: 'threshold' | 'multiplier', value: number) => {
      setCampaignData(prev => ({
        ...prev,
        pointSystem: {
          ...prev.pointSystem,
          basePointsPerUnit: prev.pointSystem?.basePointsPerUnit || {},
          bonusMultipliers: prev.pointSystem?.bonusMultipliers?.map((bonus, i) => 
            i === index ? { ...bonus, [field]: value } : bonus
          ) || []
        }
      }));
    };

    const removeBonusMultiplier = (index: number) => {
      setCampaignData(prev => ({
        ...prev,
        pointSystem: {
          ...prev.pointSystem,
          basePointsPerUnit: prev.pointSystem?.basePointsPerUnit || {},
          bonusMultipliers: prev.pointSystem?.bonusMultipliers?.filter((_, i) => i !== index) || []
        }
      }));
    };

    const addMilestone = () => {
      const newMilestone = {
        name: 'New Milestone',
        target: 50, // 50% of target
        points: 100
      };
      
      setCampaignData(prev => ({
        ...prev,
        milestoneSystem: {
          milestones: [
            ...(prev.milestoneSystem?.milestones || []),
            newMilestone
          ]
        }
      }));
    };

    const updateMilestone = (index: number, field: 'name' | 'target' | 'points', value: string | number) => {
      setCampaignData(prev => ({
        ...prev,
        milestoneSystem: {
          milestones: prev.milestoneSystem?.milestones?.map((milestone, i) => 
            i === index ? { ...milestone, [field]: value } : milestone
          ) || []
        }
      }));
    };

    const removeMilestone = (index: number) => {
      setCampaignData(prev => ({
        ...prev,
        milestoneSystem: {
          milestones: prev.milestoneSystem?.milestones?.filter((_, i) => i !== index) || []
        }
      }));
    };

    return (
      <div className="step-content">
        <div className="step-header">
          <h3>🏆 Contest Structure</h3>
          <p>Configure how participants earn points and achieve milestones</p>
        </div>

        {campaignData.targetConfigs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h4>Configure Target Metrics First</h4>
            <p>Please configure target metrics to enable contest structure configuration.</p>
          </div>
        ) : (
          <div className="contest-structure">
            {/* Contest Type Selection */}
            <div className="structure-section">
              <h4>📋 Contest Type</h4>
              <div className="contest-types">
                <label className="contest-type-card">
                  <input
                    type="radio"
                    name="contestType"
                    value="points"
                    checked={campaignData.contestType === 'points'}
                    onChange={(e) => setCampaignData(prev => ({ ...prev, contestType: e.target.value as any }))}
                  />
                  <div className="card-content">
                    <div className="card-icon">⭐</div>
                    <div className="card-text">
                      <strong>Point System</strong>
                      <p>Participants earn points for every unit/value achieved</p>
                      <div className="card-features">
                        <span>• Base points per SKU</span>
                        <span>• Bonus multipliers</span>
                        <span>• Achievement tracking</span>
                      </div>
                    </div>
                  </div>
                </label>

                <label className="contest-type-card">
                  <input
                    type="radio"
                    name="contestType"
                    value="milestone"
                    checked={campaignData.contestType === 'milestone'}
                    onChange={(e) => setCampaignData(prev => ({ ...prev, contestType: e.target.value as any }))}
                  />
                  <div className="card-content">
                    <div className="card-icon">🏁</div>
                    <div className="card-text">
                      <strong>Milestone System</strong>
                      <p>Participants unlock rewards at specific achievement levels</p>
                      <div className="card-features">
                        <span>• Achievement levels</span>
                        <span>• Milestone rewards</span>
                        <span>• Progressive unlocking</span>
                      </div>
                    </div>
                  </div>
                </label>

                <label className="contest-type-card">
                  <input
                    type="radio"
                    name="contestType"
                    value="ranking"
                    checked={campaignData.contestType === 'ranking'}
                    onChange={(e) => setCampaignData(prev => ({ ...prev, contestType: e.target.value as any }))}
                  />
                  <div className="card-content">
                    <div className="card-icon">🏆</div>
                    <div className="card-text">
                      <strong>Ranking System</strong>
                      <p>Top performers compete for rank-based prizes</p>
                      <div className="card-features">
                        <span>• Leaderboard rankings</span>
                        <span>• Competitive environment</span>
                        <span>• Top performer rewards</span>
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Point System Configuration */}
            {campaignData.contestType === 'points' && (
              <div className="structure-section">
                <h4>⭐ Point System Configuration</h4>
                
                {/* Base Points per SKU */}
                <div className="config-subsection">
                  <h5>Base Points per Unit</h5>
                  <p>Configure how many points participants earn for each unit/value achieved</p>
                  <div className="sku-points-grid">
                    {campaignData.targetConfigs.map(config => (
                      <div key={config.skuId} className="sku-points-card">
                        <div className="sku-info">
                          <span className="sku-code">{config.skuCode}</span>
                          <span className="sku-name">{config.skuName}</span>
                          <span className="sku-unit">per {config.unit}</span>
                        </div>
                        <div className="points-input">
                          <input
                            type="number"
                            className="form-input"
                            placeholder="10"
                            min="1"
                            value={campaignData.pointSystem?.basePointsPerUnit?.[config.skuId] || ''}
                            onChange={(e) => updatePointSystem(config.skuId, parseInt(e.target.value) || 0)}
                          />
                          <span className="input-suffix">points</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bonus Multipliers */}
                <div className="config-subsection">
                  <div className="subsection-header">
                    <h5>Bonus Multipliers</h5>
                    <button className="btn-secondary" onClick={addBonusMultiplier}>
                      + Add Bonus
                    </button>
                  </div>
                  <p>Reward overachievers with bonus point multipliers</p>
                  
                  {campaignData.pointSystem?.bonusMultipliers?.length === 0 || !campaignData.pointSystem?.bonusMultipliers ? (
                    <div className="empty-bonus">
                      <p>No bonus multipliers configured. Add bonuses to reward overachievement.</p>
                    </div>
                  ) : (
                    <div className="bonus-multipliers">
                      {campaignData.pointSystem.bonusMultipliers.map((bonus, index) => (
                        <div key={index} className="bonus-multiplier-card">
                          <div className="bonus-config">
                            <div className="bonus-field">
                              <label>Achievement Level</label>
                              <div className="input-with-suffix">
                                <input
                                  type="number"
                                  className="form-input"
                                  value={bonus.threshold}
                                  onChange={(e) => updateBonusMultiplier(index, 'threshold', parseFloat(e.target.value) || 0)}
                                  min="1"
                                />
                                <span className="input-suffix">% of target</span>
                              </div>
                            </div>
                            <div className="bonus-field">
                              <label>Multiplier</label>
                              <div className="input-with-suffix">
                                <input
                                  type="number"
                                  className="form-input"
                                  value={bonus.multiplier}
                                  onChange={(e) => updateBonusMultiplier(index, 'multiplier', parseFloat(e.target.value) || 0)}
                                  min="1"
                                  step="0.1"
                                />
                                <span className="input-suffix">× points</span>
                              </div>
                            </div>
                          </div>
                          <button 
                            className="btn-icon btn-danger"
                            onClick={() => removeBonusMultiplier(index)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Milestone System Configuration */}
            {campaignData.contestType === 'milestone' && (
              <div className="structure-section">
                <div className="subsection-header">
                  <h4>🏁 Milestone Configuration</h4>
                  <button className="btn-secondary" onClick={addMilestone}>
                    + Add Milestone
                  </button>
                </div>
                <p>Create achievement milestones that participants can unlock</p>

                {campaignData.milestoneSystem?.milestones?.length === 0 || !campaignData.milestoneSystem?.milestones ? (
                  <div className="empty-milestones">
                    <div className="empty-icon">🏁</div>
                    <h5>No Milestones Configured</h5>
                    <p>Add milestones to create achievement levels for participants</p>
                  </div>
                ) : (
                  <div className="milestones-list">
                    {campaignData.milestoneSystem.milestones
                      .sort((a, b) => a.target - b.target)
                      .map((milestone, index) => (
                      <div key={index} className="milestone-card">
                        <div className="milestone-config">
                          <div className="milestone-field">
                            <label>Milestone Name</label>
                            <input
                              type="text"
                              className="form-input"
                              value={milestone.name}
                              onChange={(e) => updateMilestone(index, 'name', e.target.value)}
                              placeholder="e.g., Bronze Achievement"
                            />
                          </div>
                          <div className="milestone-field">
                            <label>Target Level</label>
                            <div className="input-with-suffix">
                              <input
                                type="number"
                                className="form-input"
                                value={milestone.target}
                                onChange={(e) => updateMilestone(index, 'target', parseFloat(e.target.value) || 0)}
                                min="1"
                                max="200"
                              />
                              <span className="input-suffix">% of target</span>
                            </div>
                          </div>
                          <div className="milestone-field">
                            <label>Points Reward</label>
                            <div className="input-with-suffix">
                              <input
                                type="number"
                                className="form-input"
                                value={milestone.points}
                                onChange={(e) => updateMilestone(index, 'points', parseFloat(e.target.value) || 0)}
                                min="1"
                              />
                              <span className="input-suffix">points</span>
                            </div>
                          </div>
                        </div>
                        <button 
                          className="btn-icon btn-danger"
                          onClick={() => removeMilestone(index)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Ranking System Info */}
            {campaignData.contestType === 'ranking' && (
              <div className="structure-section">
                <h4>🏆 Ranking System</h4>
                <div className="ranking-info">
                  <div className="info-card">
                    <div className="info-icon">📊</div>
                    <div className="info-content">
                      <h5>Automatic Leaderboards</h5>
                      <p>Participants will be ranked based on their achievement percentage against individual targets. Real-time leaderboards will be generated at regional and pan-India levels.</p>
                    </div>
                  </div>
                  <div className="info-card">
                    <div className="info-icon">🏅</div>
                    <div className="info-content">
                      <h5>Rank-Based Rewards</h5>
                      <p>Prizes will be awarded to top performers based on their final rankings. Configure specific prizes for different ranks in the next step.</p>
                    </div>
                  </div>
                  <div className="info-card">
                    <div className="info-icon">📈</div>
                    <div className="info-content">
                      <h5>Performance Tracking</h5>
                      <p>Individual and team performance will be tracked throughout the campaign duration, with regular updates to maintain competitive engagement.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Step 6: Prize Structure
  const renderStep6 = () => (
    <div className="step-content">
      <div className="step-header">
        <h3>🎁 Prize Structure</h3>
        <p>Define rewards at different levels</p>
      </div>

      <div className="prize-levels">
        <div className="prize-level">
          <h4>🏆 Pan India Level</h4>
          <div className="prizes-list">
            {campaignData.prizeStructure.panIndiaLevel.map((prize, index) => (
              <div key={index} className="prize-item">
                <input 
                  type="number" 
                  placeholder="Rank" 
                  className="form-input" 
                  style={{width: '60px'}}
                  value={prize.rank}
                />
                <input 
                  type="text" 
                  placeholder="Prize" 
                  className="form-input"
                  value={prize.prize}
                />
                <input 
                  type="text" 
                  placeholder="Value" 
                  className="form-input"
                  value={prize.value}
                />
                <button className="btn-icon btn-danger" onClick={() => {
                  setCampaignData(prev => ({
                    ...prev,
                    prizeStructure: {
                      ...prev.prizeStructure,
                      panIndiaLevel: prev.prizeStructure.panIndiaLevel.filter((_, i) => i !== index)
                    }
                  }));
                }}>×</button>
              </div>
            ))}
            <button 
              className="btn-secondary"
              onClick={() => {
                setCampaignData(prev => ({
                  ...prev,
                  prizeStructure: {
                    ...prev.prizeStructure,
                    panIndiaLevel: [...prev.prizeStructure.panIndiaLevel, {rank: 1, prize: '', value: ''}]
                  }
                }));
              }}
            >
              + Add Pan India Prize
            </button>
          </div>
        </div>

        <div className="prize-level">
          <h4>🗺️ Regional Level</h4>
          <div className="prizes-list">
            {campaignData.prizeStructure.regionalLevel.map((prize, index) => (
              <div key={index} className="prize-item">
                <input 
                  type="number" 
                  placeholder="Rank" 
                  className="form-input" 
                  style={{width: '60px'}}
                  value={prize.rank}
                />
                <input 
                  type="text" 
                  placeholder="Prize" 
                  className="form-input"
                  value={prize.prize}
                />
                <input 
                  type="text" 
                  placeholder="Value" 
                  className="form-input"
                  value={prize.value}
                />
                <button className="btn-icon btn-danger" onClick={() => {
                  setCampaignData(prev => ({
                    ...prev,
                    prizeStructure: {
                      ...prev.prizeStructure,
                      regionalLevel: prev.prizeStructure.regionalLevel.filter((_, i) => i !== index)
                    }
                  }));
                }}>×</button>
              </div>
            ))}
            <button 
              className="btn-secondary"
              onClick={() => {
                setCampaignData(prev => ({
                  ...prev,
                  prizeStructure: {
                    ...prev.prizeStructure,
                    regionalLevel: [...prev.prizeStructure.regionalLevel, {rank: 1, prize: '', value: ''}]
                  }
                }));
              }}
            >
              + Add Regional Prize
            </button>
          </div>
        </div>

        <div className="prize-level">
          <h4>📍 Sub-Regional Level</h4>
          <div className="prizes-list">
            {campaignData.prizeStructure.subRegionalLevel.map((prize, index) => (
              <div key={index} className="prize-item">
                <input 
                  type="number" 
                  placeholder="Rank" 
                  className="form-input" 
                  style={{width: '60px'}}
                  value={prize.rank}
                />
                <input 
                  type="text" 
                  placeholder="Prize" 
                  className="form-input"
                  value={prize.prize}
                />
                <input 
                  type="text" 
                  placeholder="Value" 
                  className="form-input"
                  value={prize.value}
                />
                <button className="btn-icon btn-danger" onClick={() => {
                  setCampaignData(prev => ({
                    ...prev,
                    prizeStructure: {
                      ...prev.prizeStructure,
                      subRegionalLevel: prev.prizeStructure.subRegionalLevel.filter((_, i) => i !== index)
                    }
                  }));
                }}>×</button>
              </div>
            ))}
            <button 
              className="btn-secondary"
              onClick={() => {
                setCampaignData(prev => ({
                  ...prev,
                  prizeStructure: {
                    ...prev.prizeStructure,
                    subRegionalLevel: [...prev.prizeStructure.subRegionalLevel, {rank: 1, prize: '', value: ''}]
                  }
                }));
              }}
            >
              + Add Sub-Regional Prize
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Step 7: User Targets & Participants
  const renderStep7 = () => (
    <div className="step-content">
      <div className="step-header">
        <h3>👥 User Targets & Participants</h3>
        <p>Review computed individual targets or upload custom targets</p>
      </div>

      <div className="target-options">
        <label className="target-option">
          <input
            type="radio"
            name="targetMode"
            value="computed"
            checked={!campaignData.customTargetsEnabled}
            onChange={() => setCampaignData(prev => ({ ...prev, customTargetsEnabled: false }))}
          />
          <div>
            <strong>Use Computed Targets</strong>
            <p>Auto-computed from regional distribution</p>
          </div>
        </label>

        <label className="target-option">
          <input
            type="radio"
            name="targetMode"
            value="custom"
            checked={campaignData.customTargetsEnabled}
            onChange={() => setCampaignData(prev => ({ ...prev, customTargetsEnabled: true }))}
          />
          <div>
            <strong>Custom CSV Upload</strong>
            <p>Upload your own user-level targets</p>
          </div>
        </label>
      </div>

      {!campaignData.customTargetsEnabled ? (
        <div className="computed-targets">
          <h4>Auto-Computed Individual Targets</h4>
          <p>Based on regional distribution from Step 4:</p>
          
          {Object.keys(campaignData.regionalDistribution).length > 0 ? (
            <div className="targets-preview">
              <div className="targets-summary">
                <p><strong>Example:</strong> If Sumit is the only user in North Zone - Delhi:</p>
                {campaignData.targetConfigs.map(config => {
                  const northDistribution = campaignData.regionalDistribution[config.skuId]?.find(d => d.regionName === 'Region North Zone');
                  return (
                    <div key={config.skuId} className="target-example">
                      <span className="sku-code">{config.skuCode}:</span>
                      <span className="target-value">
                        {northDistribution?.individualTarget || 0} {config.unit}
                      </span>
                      <span className="explanation">
                        (Full regional target as only participant)
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="distribution-logic">
                <h5>Distribution Logic:</h5>
                <ul>
                  <li>If 1 user in region → Gets full regional target</li>
                  <li>If 4 users in region → Target divided equally (25% each)</li>
                  <li>Custom CSV can override these calculations</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="empty-targets">
              <p>Complete regional targeting in Step 4 to see computed targets</p>
            </div>
          )}
        </div>
      ) : (
        <div className="custom-targets">
          <h4>Upload Custom Targets</h4>
          <div className="csv-upload">
            <div className="upload-area">
              <div className="upload-icon">📄</div>
              <p>Drop CSV file here or click to upload</p>
              <button className="btn-secondary">Choose File</button>
            </div>
            <div className="csv-format">
              <h5>Expected CSV Format:</h5>
              <code>
                user_id,user_name,region,{campaignData.targetConfigs.map(c => c.skuCode).join(',')}<br/>
                user1,Sumit,North Zone - Delhi,1000,500<br/>
                user2,Rahul,South Zone - Chennai,800,400
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1: return 'Campaign Information';
      case 2: return 'SKU Selection';
      case 3: return 'Target Metrics';
      case 4: return 'Regional Targeting';
      case 5: return 'Contest Structure';
      case 6: return 'Prize Structure';
      case 7: return 'User Targets';
      default: return 'Campaign Setup';
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return campaignData.name.trim() && campaignData.startDate && campaignData.endDate;
      case 2: return campaignData.selectedSkus.length > 0;
      case 3: return campaignData.targetConfigs.every(c => c.target > 0);
      case 4: return campaignData.selectedRegions.length > 0;
      case 5: return true; // Always allow proceeding from contest structure
      default: return true;
    }
  };

  return (
    <div className="campaign-wizard">
      <div className="wizard-header">
        <h2>Create New Campaign</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="wizard-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{width: `${(currentStep / 7) * 100}%`}}
          />
        </div>
        <div className="step-indicators">
          {[1, 2, 3, 4, 5, 6, 7].map(step => (
            <div 
              key={step}
              className={`step-indicator ${currentStep >= step ? 'active' : ''}`}
            >
              {step}
            </div>
          ))}
        </div>
        <div className="step-title">
          Step {currentStep} of 7: {getStepTitle(currentStep)}
        </div>
      </div>

      <div className="wizard-content">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
        {currentStep === 6 && renderStep6()}
        {currentStep === 7 && renderStep7()}
      </div>

      <div className="wizard-actions">
        <div className="action-group">
          {currentStep > 1 && (
            <button className="btn-secondary" onClick={prevStep}>
              ← Previous
            </button>
          )}
          
          {currentStep < 7 ? (
            <button 
              className="btn" 
              onClick={nextStep}
              disabled={!canProceed()}
            >
              Next →
            </button>
          ) : (
            <button 
              className="btn"
              onClick={handleSubmit}
              disabled={loading || !canProceed()}
            >
              {loading ? 'Creating...' : '🚀 Create Campaign'}
            </button>
          )}
        </div>

        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default NewCampaignWizard;