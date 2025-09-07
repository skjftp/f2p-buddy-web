import React, { useState, useEffect, useCallback } from 'react';
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
    bonusMultipliers?: Array<{threshold: number, multiplier: number}>;
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
  
  // Step 7 state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvError, setCsvError] = useState<string>('');
  
  // Step 4 state
  const [distributionAlgorithm, setDistributionAlgorithm] = useState<'equal' | 'territory' | 'performance' | 'custom'>('equal');

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

  // CSV handling functions
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
        const expectedHeaders = ['user_id', 'user_name', 'region', ...campaignData.targetConfigs.map(c => c.skuCode)];
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
        
        // Convert to UserTarget format
        const userTargets: UserTarget[] = data.map(row => ({
          userId: row.user_id || `csv_${Date.now()}_${Math.random()}`,
          userName: row.user_name,
          regionName: row.region,
          targets: campaignData.targetConfigs.reduce((acc, config) => {
            acc[config.skuId] = parseFloat(row[config.skuCode]) || 0;
            return acc;
          }, {} as Record<string, number>)
        }));

        setCampaignData(prev => ({ ...prev, userTargets }));
        
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

  const { getRootProps: getCsvRootProps, getInputProps: getCsvInputProps, isDragActive: isCsvDragActive } = useDropzone({
    onDrop: onCsvDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  // Generate sample CSV
  const generateSampleCsv = () => {
    const eligibleUsers = organizationUsers.filter(user => {
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

    const headers = ['user_id', 'user_name', 'region', ...campaignData.targetConfigs.map(c => c.skuCode)];
    let csv = headers.join(',') + '\n';
    
    eligibleUsers.slice(0, 10).forEach(user => { // Limit to first 10 for sample
      const row = [
        user.id,
        user.name,
        user.finalRegionName || 'Unknown Region',
        ...campaignData.targetConfigs.map(() => '0') // Default targets
      ];
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign_targets_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Compute user targets from regional distribution
  const computeUserTargets = useCallback(() => {
    const userTargets: UserTarget[] = [];
    
    // Get eligible users based on region and designation selection
    const eligibleUsers = organizationUsers.filter(user => {
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

    // For each eligible user, calculate their targets
    eligibleUsers.forEach(user => {
      const userTargetData: UserTarget = {
        userId: user.id,
        userName: user.name,
        regionName: user.finalRegionName || 'Unknown Region',
        targets: {}
      };

      // Find which region this user belongs to from selected regions
      const userRegionId = campaignData.selectedRegions.find(regionId => {
        const regionItem = hierarchyLevels.flatMap(l => l.items).find(item => item.id === regionId);
        return Object.values(user.regionHierarchy || {}).includes(regionId) ||
               user.finalRegionName === regionItem?.name;
      });

      if (userRegionId) {
        campaignData.targetConfigs.forEach(config => {
          const regionalDist = campaignData.regionalDistribution[config.skuId]?.find(
            dist => dist.regionId === userRegionId
          );
          
          if (regionalDist) {
            userTargetData.targets[config.skuId] = regionalDist.individualTarget;
          }
        });
      }

      userTargets.push(userTargetData);
    });

    setCampaignData(prev => ({ ...prev, userTargets }));
  }, [campaignData.selectedDesignations, campaignData.selectedRegions, campaignData.targetConfigs, campaignData.regionalDistribution, organizationUsers, designations, hierarchyLevels]);

  // Auto-compute when switching to computed mode
  useEffect(() => {
    if (!campaignData.customTargetsEnabled && Object.keys(campaignData.regionalDistribution).length > 0) {
      computeUserTargets();
    }
  }, [campaignData.customTargetsEnabled, campaignData.regionalDistribution, computeUserTargets]);

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

      // Build hierarchy tree for proper parent-child distribution
      const buildDistributionTree = (items: HierarchyItem[]) => {
        // Group by level
        const levelGroups: Record<number, HierarchyItem[]> = {};
        items.forEach(item => {
          if (!levelGroups[item.level]) levelGroups[item.level] = [];
          levelGroups[item.level].push(item);
        });

        const distributionMap: Record<string, { target: number, children: string[] }> = {};

        // Start with top level items and distribute total target
        const topLevelItems = levelGroups[Math.min(...Object.keys(levelGroups).map(Number))];
        
        topLevelItems.forEach(item => {
          const topLevelTarget = Math.round(totalTarget / topLevelItems.length);
          distributionMap[item.id] = { target: topLevelTarget, children: [] };
        });

        // Process each level from top to bottom
        const sortedLevels = Object.keys(levelGroups).map(Number).sort();
        
        sortedLevels.forEach(level => {
          if (level === sortedLevels[0]) return; // Skip top level, already processed

          levelGroups[level].forEach(childItem => {
            if (childItem.parentId && distributionMap[childItem.parentId]) {
              // Add this child to parent's children list
              distributionMap[childItem.parentId].children.push(childItem.id);
            }
          });
        });

        // Now distribute parent targets to children
        sortedLevels.forEach(level => {
          levelGroups[level].forEach(parentItem => {
            if (distributionMap[parentItem.id] && distributionMap[parentItem.id].children.length > 0) {
              const parentTarget = distributionMap[parentItem.id].target;
              const childrenCount = distributionMap[parentItem.id].children.length;
              const childTarget = Math.round(parentTarget / childrenCount);

              // Distribute to children
              distributionMap[parentItem.id].children.forEach(childId => {
                if (!distributionMap[childId]) {
                  distributionMap[childId] = { target: childTarget, children: [] };
                }
              });

              // Adjust parent target to 0 since it's distributed to children
              distributionMap[parentItem.id].target = 0;
            }
          });
        });

        return distributionMap;
      };

      const distributionMap = buildDistributionTree(selectedRegionItems);

      // Create final distributions array with user counts
      selectedRegionItems.forEach(regionItem => {
        const regionTarget = distributionMap[regionItem.id]?.target || 0;
        
        // Only include regions that have actual targets (leaf nodes)
        if (regionTarget > 0) {
          // Get users in this region
          const usersInRegion = organizationUsers.filter(user => {
            const userRegionIds = Object.values(user.regionHierarchy || {});
            return userRegionIds.includes(regionItem.id) || 
                   user.finalRegionName === regionItem.name;
          });

          const userCount = Math.max(1, usersInRegion.length);
          const individualTarget = Math.round(regionTarget / userCount);

          distributions.push({
            regionId: regionItem.id,
            regionName: regionItem.name,
            target: regionTarget,
            userCount,
            individualTarget
          });
        }
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
  const renderStep4 = () => {
    const handleRegionToggle = (itemId: string, level: number) => {
      const newSelected = new Set(campaignData.selectedRegions);
      
      if (newSelected.has(itemId)) {
        // Deselecting - remove item and all children
        newSelected.delete(itemId);
        removeAllChildren(itemId, newSelected);
      } else {
        // Selecting - add item, auto-select parents, and auto-select all children
        newSelected.add(itemId);
        autoSelectParents(itemId, newSelected);
        addAllChildren(itemId, newSelected);
      }
      
      setCampaignData(prev => ({ ...prev, selectedRegions: Array.from(newSelected) }));
      
      // Trigger target distribution recalculation
      setTimeout(() => {
        if (Array.from(newSelected).length > 0) {
          computeRegionalDistribution(distributionAlgorithm);
        }
      }, 100);
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

    const addAllChildren = (parentId: string, selectedSet: Set<string>) => {
      hierarchyLevels.forEach(level => {
        level.items.forEach(item => {
          if (item.parentId === parentId) {
            selectedSet.add(item.id);
            addAllChildren(item.id, selectedSet);
          }
        });
      });
    };

    const autoSelectParents = (childId: string, selectedSet: Set<string>) => {
      const childItem = hierarchyLevels.flatMap(l => l.items).find(item => item.id === childId);
      if (childItem?.parentId && !selectedSet.has(childItem.parentId)) {
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
                      checked={distributionAlgorithm === 'equal'}
                      onChange={() => {
                        setDistributionAlgorithm('equal');
                        computeRegionalDistribution('equal');
                      }}
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
                      checked={distributionAlgorithm === 'territory'}
                      onChange={() => {
                        setDistributionAlgorithm('territory');
                        computeRegionalDistribution('territory');
                      }}
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
                      checked={distributionAlgorithm === 'performance'}
                      onChange={() => {
                        setDistributionAlgorithm('performance');
                        computeRegionalDistribution('performance');
                      }}
                    />
                    <div className="option-content">
                      <div className="option-icon">📈</div>
                      <div className="option-text">
                        <strong>Performance-based</strong>
                        <p>Higher performers get higher targets based on historical data</p>
                      </div>
                    </div>
                  </label>

                  <label className="algorithm-option">
                    <input 
                      type="radio" 
                      name="algorithm" 
                      value="custom"
                      checked={distributionAlgorithm === 'custom'}
                      onChange={() => {
                        setDistributionAlgorithm('custom');
                        // Don't auto-compute for custom, let user edit
                      }}
                    />
                    <div className="option-content">
                      <div className="option-icon">✏️</div>
                      <div className="option-text">
                        <strong>Custom Distribution</strong>
                        <p>Manually set targets for each region</p>
                      </div>
                    </div>
                  </label>
                </div>

                {Object.keys(campaignData.regionalDistribution).length > 0 && (
                  <div className="distribution-preview">
                    <h5>📋 Hierarchical Distribution Logic</h5>
                    
                    {/* Example explanation */}
                    <div className="distribution-example">
                      <div className="example-card">
                        <h6>🔍 Example: How Distribution Works</h6>
                        <div className="example-tree">
                          <div className="example-node">
                            <strong>Total Target: 1000 units</strong>
                          </div>
                          <div className="example-branch">
                            <div className="example-node">
                              North Zone: 250 units (25%)
                              <div className="sub-nodes">
                                <div>Delhi District: 125 units (50% of 250)</div>
                                <div>Punjab District: 125 units (50% of 250)</div>
                              </div>
                            </div>
                            <div className="example-node">
                              South Zone: 250 units (25%)
                            </div>
                            <div className="example-node">
                              East Zone: 250 units (25%)
                            </div>
                            <div className="example-node">
                              West Zone: 250 units (25%)
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Editable distribution results */}
                    {campaignData.targetConfigs.map(config => {
                      const distributions = campaignData.regionalDistribution[config.skuId] || [];
                      const totalDistributed = distributions.reduce((sum, dist) => sum + dist.target, 0);
                      
                      const updateRegionalTarget = (regionId: string, newTarget: number) => {
                        setCampaignData(prev => {
                          const newDistribution = { ...prev.regionalDistribution };
                          if (newDistribution[config.skuId]) {
                            newDistribution[config.skuId] = newDistribution[config.skuId].map(dist =>
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
                              <span>Target {distributionAlgorithm === 'custom' ? '(Editable)' : ''}</span>
                              <span>Users</span>
                              <span>Per User</span>
                            </div>
                            {distributions.map(dist => (
                              <div key={dist.regionId} className="distribution-row editable">
                                <span className="region-name">{dist.regionName}</span>
                                {distributionAlgorithm === 'custom' ? (
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
                                ) : (
                                  <span className="region-target">
                                    {dist.target} {config.unit}
                                  </span>
                                )}
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
                              {distributionAlgorithm === 'custom' && totalDistributed !== config.target && (
                                <button 
                                  className="btn-small"
                                  onClick={() => {
                                    // Auto-balance to match target
                                    const diff = config.target - totalDistributed;
                                    const perRegion = Math.round(diff / distributions.length);
                                    distributions.forEach(dist => {
                                      updateRegionalTarget(dist.regionId, dist.target + perRegion);
                                    });
                                  }}
                                >
                                  Auto Balance
                                </button>
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
  const renderStep6 = () => {
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

    const getPrizeTemplates = () => [
      { name: 'Cash Prize', suggestions: ['₹10,000', '₹25,000', '₹50,000', '₹1,00,000'] },
      { name: 'Gift Voucher', suggestions: ['Amazon ₹5,000', 'Flipkart ₹10,000', 'Reliance ₹15,000'] },
      { name: 'Electronics', suggestions: ['iPhone 15', 'Samsung Galaxy', 'MacBook Air', 'iPad'] },
      { name: 'Travel Package', suggestions: ['Goa Trip', 'Dubai Package', 'Thailand Tour', 'Europe Package'] },
      { name: 'Recognition', suggestions: ['Certificate of Excellence', 'Trophy + Certificate', 'Wall Plaque'] }
    ];

    const renderPrizeLevel = (
      level: 'panIndiaLevel' | 'regionalLevel' | 'subRegionalLevel',
      title: string,
      icon: string,
      description: string
    ) => (
      <div className="prize-level-card">
        <div className="prize-level-header">
          <div className="level-info">
            <h4>{icon} {title}</h4>
            <p>{description}</p>
          </div>
          <div className="level-stats">
            <span className="prize-count">{campaignData.prizeStructure[level].length} prize(s)</span>
          </div>
        </div>

        <div className="prizes-container">
          {campaignData.prizeStructure[level].length === 0 ? (
            <div className="empty-prizes">
              <div className="empty-icon">🏆</div>
              <p>No prizes configured for this level</p>
              <button 
                className="btn-secondary"
                onClick={() => addPrize(level)}
              >
                + Add First Prize
              </button>
            </div>
          ) : (
            <div className="prizes-grid">
              {campaignData.prizeStructure[level]
                .sort((a, b) => a.rank - b.rank)
                .map((prize, index) => (
                <div key={index} className="prize-card">
                  <div className="prize-header">
                    <div className="rank-badge">
                      #{prize.rank}
                    </div>
                    <button 
                      className="btn-icon btn-danger"
                      onClick={() => removePrize(level, index)}
                      title="Remove prize"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="prize-form">
                    <div className="form-group">
                      <label className="form-label">Rank Position</label>
                      <input
                        type="number"
                        className="form-input"
                        value={prize.rank}
                        onChange={(e) => updatePrize(level, index, 'rank', parseInt(e.target.value) || 1)}
                        min="1"
                        placeholder="1"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Prize Description</label>
                      <input
                        type="text"
                        className="form-input"
                        value={prize.prize}
                        onChange={(e) => updatePrize(level, index, 'prize', e.target.value)}
                        placeholder="e.g., iPhone 15 Pro"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Prize Value</label>
                      <input
                        type="text"
                        className="form-input"
                        value={prize.value}
                        onChange={(e) => updatePrize(level, index, 'value', e.target.value)}
                        placeholder="e.g., ₹1,20,000"
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="add-prize-card">
                <button 
                  className="add-prize-btn"
                  onClick={() => addPrize(level)}
                >
                  <div className="add-icon">+</div>
                  <span>Add Prize</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );

    return (
      <div className="step-content">
        <div className="step-header">
          <h3>🎁 Prize Structure</h3>
          <p>Configure rewards for different performance levels and regions</p>
        </div>

        <div className="prize-structure">
          {/* Prize Templates */}
          <div className="prize-templates">
            <h4>💡 Prize Ideas</h4>
            <p>Common prize categories to inspire your reward structure</p>
            <div className="templates-grid">
              {getPrizeTemplates().map((template, index) => (
                <div key={index} className="template-card">
                  <div className="template-name">{template.name}</div>
                  <div className="template-suggestions">
                    {template.suggestions.map((suggestion, i) => (
                      <span key={i} className="suggestion-tag">{suggestion}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prize Levels */}
          <div className="prize-levels">
            {renderPrizeLevel(
              'panIndiaLevel',
              'Pan India Level',
              '🇮🇳',
              'Top performers across the entire organization'
            )}

            {renderPrizeLevel(
              'regionalLevel',
              'Regional Level',
              '🗺️',
              'Best performers within each selected region'
            )}

            {renderPrizeLevel(
              'subRegionalLevel',
              'Sub-Regional Level',
              '📍',
              'Winners at district/area level within regions'
            )}
          </div>

          {/* Prize Summary */}
          <div className="prize-summary">
            <h4>📊 Prize Distribution Summary</h4>
            <div className="summary-stats">
              <div className="summary-stat">
                <span className="stat-number">
                  {campaignData.prizeStructure.panIndiaLevel.length + 
                   campaignData.prizeStructure.regionalLevel.length + 
                   campaignData.prizeStructure.subRegionalLevel.length}
                </span>
                <span className="stat-label">Total Prizes</span>
              </div>
              <div className="summary-stat">
                <span className="stat-number">{campaignData.selectedRegions.length}</span>
                <span className="stat-label">Target Regions</span>
              </div>
              <div className="summary-stat">
                <span className="stat-number">
                  {organizationUsers.filter(user => 
                    campaignData.selectedDesignations.some(desId => 
                      designations.find(des => des.id === desId)?.name === user.designationName
                    ) &&
                    campaignData.selectedRegions.some(regionId => 
                      Object.values(user.regionHierarchy || {}).includes(regionId) ||
                      user.finalRegionName === hierarchyLevels.flatMap(l => l.items).find(item => item.id === regionId)?.name
                    )
                  ).length}
                </span>
                <span className="stat-label">Eligible Participants</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 7: User Targets & Participants
  const renderStep7 = () => (
      <div className="step-content">
        <div className="step-header">
          <h3>👥 User Targets & Participants</h3>
          <p>Review and finalize individual user targets for the campaign</p>
        </div>

        {Object.keys(campaignData.regionalDistribution).length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h4>Complete Regional Distribution First</h4>
            <p>Please complete regional targeting and distribution in Step 4 to proceed with user target assignment.</p>
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
                      <strong>Auto-Computed Targets</strong>
                      <p>Automatically calculated from regional distribution</p>
                      <div className="option-features">
                        <span>• Equal distribution within regions</span>
                        <span>• Based on user count per region</span>
                        <span>• Maintains total target accuracy</span>
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
                      <p>Upload your own user-specific target assignments</p>
                      <div className="option-features">
                        <span>• Individual target control</span>
                        <span>• Bulk upload capability</span>
                        <span>• Override computed values</span>
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Computed Targets Display */}
            {!campaignData.customTargetsEnabled && (
              <div className="computed-targets-section">
                <div className="section-header">
                  <h4>🔄 Auto-Computed Individual Targets</h4>
                  <button 
                    className="btn-secondary"
                    onClick={computeUserTargets}
                  >
                    🔄 Recalculate
                  </button>
                </div>

                {campaignData.userTargets.length === 0 ? (
                  <div className="empty-targets">
                    <div className="empty-icon">👥</div>
                    <h5>No Eligible Participants Found</h5>
                    <p>No users match the selected regional and designation criteria. Please review your targeting in Step 4.</p>
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
                          <span className="card-number">
                            {Object.keys(campaignData.regionalDistribution).length}
                          </span>
                          <span className="card-label">SKUs</span>
                        </div>
                        <div className="summary-card">
                          <span className="card-number">
                            {campaignData.selectedRegions.length}
                          </span>
                          <span className="card-label">Regions</span>
                        </div>
                      </div>
                    </div>

                    <div className="targets-table">
                      <div className="table-header">
                        <span>Participant</span>
                        <span>Region</span>
                        {campaignData.targetConfigs.map(config => (
                          <span key={config.skuId}>
                            {config.skuCode} ({config.unit})
                          </span>
                        ))}
                      </div>
                      
                      <div className="table-body">
                        {campaignData.userTargets.slice(0, 20).map((userTarget, index) => (
                          <div key={userTarget.userId} className="table-row">
                            <div className="participant-info">
                              <span className="participant-name">{userTarget.userName}</span>
                              <span className="participant-id">#{userTarget.userId}</span>
                            </div>
                            <span className="participant-region">{userTarget.regionName}</span>
                            {campaignData.targetConfigs.map(config => (
                              <span key={config.skuId} className="target-value">
                                {userTarget.targets[config.skuId] || 0}
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

            {/* Custom CSV Upload */}
            {campaignData.customTargetsEnabled && (
              <div className="csv-upload-section">
                <div className="section-header">
                  <h4>📄 Custom Target Upload</h4>
                  <button 
                    className="btn-secondary"
                    onClick={generateSampleCsv}
                  >
                    📥 Download Template
                  </button>
                </div>

                <div className="csv-upload-area">
                  <div {...getCsvRootProps()} className={`csv-dropzone ${isCsvDragActive ? 'active' : ''} ${csvError ? 'error' : ''}`}>
                    <input {...getCsvInputProps()} />
                    <div className="dropzone-content">
                      <div className="dropzone-icon">📄</div>
                      <h5>Drop CSV file here or click to select</h5>
                      <p>Maximum file size: 5MB</p>
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
                      <span className="file-info">({csvData.length} participants)</span>
                    </div>
                  )}
                </div>

                <div className="csv-format-guide">
                  <h5>📋 Required CSV Format</h5>
                  <div className="format-example">
                    <code>
                      user_id,user_name,region,{campaignData.targetConfigs.map(c => c.skuCode).join(',')}
                      <br />
                      user_001,Sumit Kumar,North Zone - Delhi,{campaignData.targetConfigs.map(() => '1000').join(',')}
                      <br />
                      user_002,Priya Sharma,South Zone - Chennai,{campaignData.targetConfigs.map(() => '800').join(',')}
                    </code>
                  </div>
                  
                  <div className="format-notes">
                    <h6>Important Notes:</h6>
                    <ul>
                      <li><strong>user_id:</strong> Unique identifier for each participant</li>
                      <li><strong>user_name:</strong> Full name of the participant</li>
                      <li><strong>region:</strong> Participant's assigned region</li>
                      <li><strong>SKU Columns:</strong> Target values for each selected SKU</li>
                      <li>Use numeric values only for SKU targets</li>
                      <li>CSV must contain all participants eligible for the campaign</li>
                    </ul>
                  </div>
                </div>

                {csvData.length > 0 && !csvError && (
                  <div className="csv-preview">
                    <h5>📊 Upload Preview</h5>
                    <div className="preview-table">
                      <div className="preview-header">
                        <span>User Name</span>
                        <span>Region</span>
                        {campaignData.targetConfigs.map(config => (
                          <span key={config.skuId}>{config.skuCode}</span>
                        ))}
                      </div>
                      {csvData.slice(0, 5).map((row, index) => (
                        <div key={index} className="preview-row">
                          <span>{row.user_name}</span>
                          <span>{row.region}</span>
                          {campaignData.targetConfigs.map(config => (
                            <span key={config.skuId}>{row[config.skuCode] || '0'}</span>
                          ))}
                        </div>
                      ))}
                    </div>
                    {csvData.length > 5 && (
                      <p className="preview-footer">
                        Showing first 5 rows. Total: {csvData.length} participants
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
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