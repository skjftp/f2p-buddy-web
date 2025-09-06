import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
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
        
        // Load organization settings to get SKUs
        const orgDoc = await getDoc(doc(dbInstance, 'organizations', organization.id));
        if (orgDoc.exists() && orgDoc.data().skus) {
          setOrganizationSkus(orgDoc.data().skus);
        }

        // Load users for participant assignment would be implemented here

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
    // Auto-compute regional distribution based on selected regions and target configs
    const newDistribution: Record<string, RegionalDistribution[]> = {};

    campaignData.targetConfigs.forEach(config => {
      const distributions: RegionalDistribution[] = [];
      const totalTarget = config.target;
      const regionCount = campaignData.selectedRegions.length;

      campaignData.selectedRegions.forEach((regionId, index) => {
        let regionTarget = 0;
        
        switch (algorithm) {
          case 'equal':
            regionTarget = Math.round(totalTarget / regionCount);
            break;
          case 'territory':
            // Larger territories get proportionally more targets
            regionTarget = Math.round(totalTarget * (index + 1) / (regionCount * (regionCount + 1) / 2));
            break;
          case 'performance':
            // Mock performance-based distribution
            regionTarget = Math.round(totalTarget * (0.8 + Math.random() * 0.4) / regionCount);
            break;
          default:
            regionTarget = 0;
        }

        distributions.push({
          regionId,
          regionName: `Region ${regionId}`,
          target: regionTarget,
          userCount: 1, // Mock user count
          individualTarget: regionTarget
        });
      });

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
  const renderStep4 = () => (
    <div className="step-content">
      <div className="step-header">
        <h3>🗺️ Regional & Designation Targeting</h3>
        <p>Auto-computed regional distribution based on your target metrics</p>
      </div>

      {campaignData.targetConfigs.length === 0 ? (
        <div className="empty-state">
          <p>Please configure target metrics in the previous step first.</p>
        </div>
      ) : (
        <div className="targeting-config">
          <div className="distribution-controls">
            <h4>Distribution Algorithm</h4>
            <div className="algorithm-options">
              <label className="algorithm-option">
                <input 
                  type="radio" 
                  name="algorithm" 
                  value="equal"
                  onChange={() => computeRegionalDistribution('equal')}
                />
                <div>
                  <strong>Equal Distribution</strong>
                  <p>Divide targets equally across all regions</p>
                </div>
              </label>
              <label className="algorithm-option">
                <input 
                  type="radio" 
                  name="algorithm" 
                  value="territory"
                  onChange={() => computeRegionalDistribution('territory')}
                />
                <div>
                  <strong>Territory-based</strong>
                  <p>Larger territories get higher targets</p>
                </div>
              </label>
              <label className="algorithm-option">
                <input 
                  type="radio" 
                  name="algorithm" 
                  value="performance"
                  onChange={() => computeRegionalDistribution('performance')}
                />
                <div>
                  <strong>Performance-based</strong>
                  <p>Based on historical performance</p>
                </div>
              </label>
            </div>
          </div>

          <div className="mock-regions">
            <h4>Mock Region Selection</h4>
            <p>In actual implementation, this would show your organization's hierarchy</p>
            <div className="region-checkboxes">
              {['North Zone', 'South Zone', 'East Zone', 'West Zone'].map(region => (
                <label key={region} className="region-checkbox">
                  <input
                    type="checkbox"
                    checked={campaignData.selectedRegions.includes(region)}
                    onChange={(e) => {
                      const newRegions = e.target.checked
                        ? [...campaignData.selectedRegions, region]
                        : campaignData.selectedRegions.filter(r => r !== region);
                      setCampaignData(prev => ({ ...prev, selectedRegions: newRegions }));
                    }}
                  />
                  {region}
                </label>
              ))}
            </div>
          </div>

          {campaignData.selectedRegions.length > 0 && Object.keys(campaignData.regionalDistribution).length > 0 && (
            <div className="distribution-preview">
              <h4>Computed Regional Distribution</h4>
              {campaignData.targetConfigs.map(config => (
                <div key={config.skuId} className="sku-distribution">
                  <h5>{config.skuCode} - Total Target: {config.target} {config.unit}</h5>
                  <div className="distribution-table">
                    {campaignData.regionalDistribution[config.skuId]?.map(dist => (
                      <div key={dist.regionId} className="distribution-row">
                        <span className="region-name">{dist.regionName}</span>
                        <span className="region-target">{dist.target} {config.unit}</span>
                        <span className="user-count">{dist.userCount} user(s)</span>
                        <span className="individual-target">
                          {dist.individualTarget} {config.unit}/user
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Step 5: Contest Structure
  const renderStep5 = () => (
    <div className="step-content">
      <div className="step-header">
        <h3>🏆 Contest Structure</h3>
        <p>Configure how participants earn points/rewards</p>
      </div>

      <div className="contest-types">
        <label className="contest-type-option">
          <input
            type="radio"
            name="contestType"
            value="points"
            checked={campaignData.contestType === 'points'}
            onChange={(e) => setCampaignData(prev => ({ ...prev, contestType: e.target.value as any }))}
          />
          <div>
            <strong>Point System</strong>
            <p>Participants earn points for achieving targets</p>
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
          <div>
            <strong>Milestone System</strong>
            <p>Specific milestones unlock rewards</p>
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
          <div>
            <strong>Ranking System</strong>
            <p>Top performers get rewards by rank</p>
          </div>
        </label>
      </div>

      {campaignData.contestType === 'points' && (
        <div className="point-system-config">
          <h4>Point System Configuration</h4>
          <p>Based on your SKU targets:</p>
          {campaignData.targetConfigs.map(config => (
            <div key={config.skuId} className="sku-points">
              <label>
                Points per {config.unit} of {config.skuCode}:
                <input
                  type="number"
                  className="form-input"
                  placeholder="10"
                  style={{marginLeft: '8px', width: '80px'}}
                />
              </label>
            </div>
          ))}
        </div>
      )}

      {campaignData.contestType === 'milestone' && (
        <div className="milestone-system-config">
          <h4>Milestone Configuration</h4>
          <p>Create achievement milestones based on your targets</p>
          <div className="milestone-creator">
            <input type="text" placeholder="Milestone name" className="form-input" />
            <input type="number" placeholder="Target %" className="form-input" />
            <input type="number" placeholder="Points" className="form-input" />
            <button className="btn-icon">+</button>
          </div>
        </div>
      )}
    </div>
  );

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