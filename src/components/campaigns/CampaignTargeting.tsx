import React, { useState, useEffect } from 'react';
import { getFirestoreInstance } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

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

interface RegionTarget {
  regionId: string;
  regionName: string;
  level: number;
  target: number;
  distributionType: 'equal' | 'custom' | 'performance' | 'seniority';
  userTargets?: Record<string, number>; // userId -> target
}

interface CampaignTargetingProps {
  organizationId: string;
  initialSelectedRegions?: string[];
  initialSelectedDesignations?: string[];
  initialRegionTargets?: RegionTarget[];
  onTargetingChange: (data: {
    selectedRegions: string[];
    selectedDesignations: string[];
    regionTargets: RegionTarget[];
    totalTarget: number;
  }) => void;
}

const CampaignTargeting: React.FC<CampaignTargetingProps> = ({ 
  organizationId, 
  initialSelectedRegions = [],
  initialSelectedDesignations = [],
  initialRegionTargets = [],
  onTargetingChange 
}) => {
  const [hierarchyLevels, setHierarchyLevels] = useState<HierarchyLevel[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set(initialSelectedRegions));
  const [selectedDesignations, setSelectedDesignations] = useState<Set<string>>(new Set(initialSelectedDesignations));
  const [regionTargets, setRegionTargets] = useState<RegionTarget[]>(initialRegionTargets);
  const [totalTarget, setTotalTarget] = useState(0);
  const [showTargetBreakup, setShowTargetBreakup] = useState(false);

  // Update state when initial values change (for edit mode)
  useEffect(() => {
    if (initialSelectedRegions.length > 0) {
      setSelectedRegions(new Set(initialSelectedRegions));
    }
    if (initialSelectedDesignations.length > 0) {
      setSelectedDesignations(new Set(initialSelectedDesignations));
    }
    if (initialRegionTargets.length > 0) {
      setRegionTargets(initialRegionTargets);
    }
  }, [initialSelectedRegions, initialSelectedDesignations, initialRegionTargets]);

  useEffect(() => {
    const loadOrganizationData = async () => {
      try {
        const dbInstance = await getFirestoreInstance();
        const orgDoc = await getDoc(doc(dbInstance, 'organizations', organizationId));
        
        if (orgDoc.exists()) {
          const data = orgDoc.data();
          setHierarchyLevels(data.hierarchyLevels || []);
          setDesignations(data.designations || []);
        }
      } catch (error) {
        console.error('Error loading organization data:', error);
      }
    };

    loadOrganizationData();
  }, [organizationId]);

  const handleRegionToggle = (itemId: string, level: number) => {
    const newSelected = new Set(selectedRegions);
    
    if (newSelected.has(itemId)) {
      // Deselecting - remove this item and all children
      newSelected.delete(itemId);
      removeAllChildren(itemId, newSelected);
    } else {
      // Selecting - add this item and all children
      newSelected.add(itemId);
      addAllChildren(itemId, newSelected);
      
      // Auto-select parent if all siblings are selected
      autoSelectParents(itemId, newSelected);
    }
    
    setSelectedRegions(newSelected);
    updateTargeting(newSelected, selectedDesignations);
  };

  const addAllChildren = (parentId: string, selected: Set<string>) => {
    hierarchyLevels.forEach(level => {
      level.items.forEach(item => {
        if (item.parentId === parentId) {
          selected.add(item.id);
          addAllChildren(item.id, selected); // Recursive for all descendants
        }
      });
    });
  };

  const removeAllChildren = (parentId: string, selected: Set<string>) => {
    hierarchyLevels.forEach(level => {
      level.items.forEach(item => {
        if (item.parentId === parentId) {
          selected.delete(item.id);
          removeAllChildren(item.id, selected); // Recursive for all descendants
        }
      });
    });
  };

  const autoSelectParents = (itemId: string, selected: Set<string>) => {
    const item = hierarchyLevels.flatMap(l => l.items).find(i => i.id === itemId);
    if (!item?.parentId) return;

    // Check if all siblings are selected
    const siblings = hierarchyLevels.flatMap(l => l.items).filter(i => i.parentId === item.parentId);
    const allSiblingsSelected = siblings.every(sibling => selected.has(sibling.id));

    if (allSiblingsSelected) {
      selected.add(item.parentId);
      autoSelectParents(item.parentId, selected); // Check parent's parent
    }
  };

  const handleDesignationToggle = (designationId: string) => {
    const newSelected = new Set(selectedDesignations);
    
    if (newSelected.has(designationId)) {
      newSelected.delete(designationId);
    } else {
      newSelected.add(designationId);
    }
    
    setSelectedDesignations(newSelected);
    updateTargeting(selectedRegions, newSelected);
  };

  const updateTargeting = (regions: Set<string>, designations: Set<string>) => {
    onTargetingChange({
      selectedRegions: Array.from(regions),
      selectedDesignations: Array.from(designations),
      regionTargets: regionTargets,
      totalTarget: totalTarget
    });
  };

  const handleRegionTargetChange = (regionId: string, target: number, distributionType: string) => {
    const regionName = hierarchyLevels.flatMap(l => l.items).find(item => item.id === regionId)?.name || '';
    const level = hierarchyLevels.flatMap(l => l.items).find(item => item.id === regionId)?.level || 0;
    
    const updatedTargets = regionTargets.filter(rt => rt.regionId !== regionId);
    if (target > 0) {
      updatedTargets.push({
        regionId,
        regionName,
        level,
        target,
        distributionType: distributionType as any
      });
    }
    
    setRegionTargets(updatedTargets);
    updateTargeting(selectedRegions, selectedDesignations);
  };

  const distributionTypes = [
    { value: 'equal', label: 'Equal Distribution', desc: 'Split target equally among all users' },
    { value: 'custom', label: 'Custom Distribution', desc: 'Set individual targets for each user' },
    { value: 'performance', label: 'Performance-based', desc: 'Distribute based on past performance' },
    { value: 'seniority', label: 'Seniority-based', desc: 'Higher targets for senior team members' },
    { value: 'territory', label: 'Territory-based', desc: 'Based on territory size and potential' }
  ];

  return (
    <div className="campaign-targeting">
      {/* Region Multi-Select */}
      <div className="targeting-section">
        <h3>🗺️ Regional Targeting</h3>
        <p>Select regions to include in this campaign. Selecting a region auto-selects all sub-regions.</p>
        
        <div className="region-tree">
          {hierarchyLevels.map(level => (
            <div key={level.id} className="level-section">
              <h4>{level.name}</h4>
              <div className="region-items">
                {level.items.map(item => {
                  const isSelected = selectedRegions.has(item.id);
                  const isPartiallySelected = !isSelected && hierarchyLevels.flatMap(l => l.items)
                    .some(child => child.parentId === item.id && selectedRegions.has(child.id));

                  return (
                    <label key={item.id} className={`region-checkbox ${isSelected ? 'selected' : ''} ${isPartiallySelected ? 'partial' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleRegionToggle(item.id, level.level)}
                      />
                      <span className="checkbox-custom"></span>
                      <span className="region-name">{item.name}</span>
                      {item.parentId && (
                        <span className="region-parent">
                          under {hierarchyLevels.flatMap(l => l.items).find(p => p.id === item.parentId)?.name}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Designation Multi-Select */}
      <div className="targeting-section">
        <h3>👔 Designation Targeting</h3>
        <p>Select which user types can participate in this campaign.</p>
        
        <div className="designation-grid">
          {designations.map(designation => (
            <label key={designation.id} className={`designation-checkbox ${selectedDesignations.has(designation.id) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={selectedDesignations.has(designation.id)}
                onChange={() => handleDesignationToggle(designation.id)}
              />
              <span className="checkbox-custom"></span>
              <div className="designation-info">
                <span className="designation-name">{designation.name}</span>
                <span className={`category-badge ${designation.category}`}>
                  {designation.category}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Target Breakdown */}
      {selectedRegions.size > 0 && (
        <div className="targeting-section">
          <div className="section-header">
            <h3>🎯 Target Setting & Distribution</h3>
            <button 
              className="btn-secondary"
              onClick={() => setShowTargetBreakup(!showTargetBreakup)}
            >
              {showTargetBreakup ? 'Hide Breakup' : 'Set Region Targets'}
            </button>
          </div>
          
          <div className="total-target">
            <label className="form-label">Total Campaign Target</label>
            <input
              type="number"
              className="form-input"
              value={totalTarget}
              onChange={(e) => setTotalTarget(parseInt(e.target.value) || 0)}
              placeholder="Enter total target value"
            />
          </div>

          {showTargetBreakup && (
            <div className="target-breakup">
              <h4>Regional Target Breakdown</h4>
              
              {Array.from(selectedRegions).map(regionId => {
                const region = hierarchyLevels.flatMap(l => l.items).find(item => item.id === regionId);
                if (!region) return null;

                const currentTarget = regionTargets.find(rt => rt.regionId === regionId);

                return (
                  <div key={regionId} className="region-target">
                    <div className="region-target-header">
                      <h5>{region.name}</h5>
                      <span className="level-badge">
                        {hierarchyLevels.find(l => l.level === region.level)?.name}
                      </span>
                    </div>
                    
                    <div className="target-controls">
                      <div className="target-input">
                        <label>Target Value</label>
                        <input
                          type="number"
                          value={currentTarget?.target || ''}
                          onChange={(e) => handleRegionTargetChange(
                            regionId, 
                            parseInt(e.target.value) || 0,
                            currentTarget?.distributionType || 'equal'
                          )}
                          placeholder="0"
                        />
                      </div>
                      
                      <div className="distribution-select">
                        <label>Distribution Method</label>
                        <select
                          value={currentTarget?.distributionType || 'equal'}
                          onChange={(e) => handleRegionTargetChange(
                            regionId,
                            currentTarget?.target || 0,
                            e.target.value
                          )}
                        >
                          {distributionTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="distribution-info">
                      <small>{distributionTypes.find(t => t.value === (currentTarget?.distributionType || 'equal'))?.desc}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {(selectedRegions.size > 0 || selectedDesignations.size > 0) && (
        <div className="targeting-summary">
          <h4>Campaign Targeting Summary</h4>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Regions</span>
              <span className="summary-value">{selectedRegions.size} selected</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Designations</span>
              <span className="summary-value">{selectedDesignations.size} selected</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Target Breakups</span>
              <span className="summary-value">{regionTargets.length} regions</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignTargeting;