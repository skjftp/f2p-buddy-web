import React, { useState } from 'react';

interface Sku {
  id: string;
  name: string;
  code: string;
  category: string;
  brand?: string;
  unitPrice: number;
}

interface SkuTarget {
  skuId: string;
  skuName: string;
  targetType: 'volume' | 'value';
  volumeTarget?: number; // Units
  valueTarget?: number; // Revenue
  regionBreakup: Record<string, number>; // regionId -> target
  distributionMethod: 'equal' | 'custom' | 'territory' | 'performance';
}

interface SkuTargetingProps {
  organizationId: string;
  selectedRegions: string[];
  onSkuTargetsChange: (targets: SkuTarget[]) => void;
}

const SkuTargeting: React.FC<SkuTargetingProps> = ({ 
  organizationId, 
  selectedRegions, 
  onSkuTargetsChange 
}) => {
  const [skus] = useState<Sku[]>([
    { id: '1', name: 'Product A Premium', code: 'PA-001', category: 'Premium', brand: 'Brand X', unitPrice: 250 },
    { id: '2', name: 'Product A Standard', code: 'PA-002', category: 'Standard', brand: 'Brand X', unitPrice: 150 },
    { id: '3', name: 'Product B Premium', code: 'PB-001', category: 'Premium', brand: 'Brand Y', unitPrice: 300 },
    { id: '4', name: 'Product B Standard', code: 'PB-002', category: 'Standard', brand: 'Brand Y', unitPrice: 200 },
  ]);
  
  const [skuTargets, setSkuTargets] = useState<SkuTarget[]>([]);

  const addSkuTarget = (sku: Sku) => {
    const newTarget: SkuTarget = {
      skuId: sku.id,
      skuName: sku.name,
      targetType: 'volume',
      volumeTarget: 0,
      valueTarget: 0,
      regionBreakup: {},
      distributionMethod: 'equal'
    };

    setSkuTargets(prev => [...prev, newTarget]);
  };

  const updateSkuTarget = (skuId: string, updates: Partial<SkuTarget>) => {
    setSkuTargets(prev => prev.map(target => 
      target.skuId === skuId ? { ...target, ...updates } : target
    ));
  };

  const removeSkuTarget = (skuId: string) => {
    setSkuTargets(prev => prev.filter(target => target.skuId !== skuId));
  };

  const distributeTargetToRegions = (skuId: string, totalTarget: number, method: string) => {
    const target = skuTargets.find(t => t.skuId === skuId);
    if (!target) return;

    let regionBreakup: Record<string, number> = {};

    switch (method) {
      case 'equal':
        const equalShare = Math.floor(totalTarget / selectedRegions.length);
        selectedRegions.forEach(regionId => {
          regionBreakup[regionId] = equalShare;
        });
        break;
        
      case 'territory':
        // Simulate territory-based distribution (larger territories get higher targets)
        const territoryWeights: Record<string, number> = {
          'north': 1.3, 'south': 1.1, 'east': 1.0, 'west': 0.9
        };
        const totalWeight = selectedRegions.reduce((sum, regionId) => 
          sum + (territoryWeights[regionId.toLowerCase()] || 1.0), 0
        );
        selectedRegions.forEach(regionId => {
          const weight = territoryWeights[regionId.toLowerCase()] || 1.0;
          regionBreakup[regionId] = Math.floor((totalTarget * weight) / totalWeight);
        });
        break;
        
      case 'performance':
        // Simulate performance-based distribution (better performing regions get higher targets)
        const performanceMultipliers: Record<string, number> = {
          'north': 1.4, 'south': 1.2, 'east': 1.0, 'west': 0.8
        };
        const totalPerformance = selectedRegions.reduce((sum, regionId) => 
          sum + (performanceMultipliers[regionId.toLowerCase()] || 1.0), 0
        );
        selectedRegions.forEach(regionId => {
          const multiplier = performanceMultipliers[regionId.toLowerCase()] || 1.0;
          regionBreakup[regionId] = Math.floor((totalTarget * multiplier) / totalPerformance);
        });
        break;
        
      default:
        // Custom - let user set individual targets
        break;
    }

    updateSkuTarget(skuId, { regionBreakup });
  };

  return (
    <div className="sku-targeting">
      <div className="sku-header">
        <h3>📦 SKU-wise Target Setting</h3>
      </div>
      
      <p className="section-description">
        Set different targets for individual products (SKUs). Each SKU can have volume or value targets distributed across regions.
      </p>

      {/* Available SKUs to Add */}
      <div className="available-skus">
        <h4>Available SKUs</h4>
        <div className="sku-grid">
          {skus.filter(sku => !skuTargets.find(target => target.skuId === sku.id)).map(sku => (
            <div key={sku.id} className="sku-card">
              <div className="sku-info">
                <div className="sku-name">{sku.name}</div>
                <div className="sku-details">
                  <span className="sku-code">{sku.code}</span>
                  <span className="sku-price">₹{sku.unitPrice}</span>
                </div>
                <div className="sku-meta">
                  <span className="sku-category">{sku.category}</span>
                  {sku.brand && <span className="sku-brand">{sku.brand}</span>}
                </div>
              </div>
              <button 
                className="btn-icon"
                onClick={() => addSkuTarget(sku)}
                title="Add to campaign"
              >
                +
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SKU Targets Configuration */}
      {skuTargets.length > 0 && (
        <div className="sku-targets">
          <h4>SKU Campaign Targets</h4>
          
          {skuTargets.map(target => (
            <div key={target.skuId} className="sku-target-config">
              <div className="sku-target-header">
                <h5>{target.skuName}</h5>
                <button 
                  className="btn-icon btn-danger"
                  onClick={() => removeSkuTarget(target.skuId)}
                >
                  ×
                </button>
              </div>
              
              <div className="target-type-selector">
                <label className="radio-option">
                  <input
                    type="radio"
                    name={`targetType_${target.skuId}`}
                    value="volume"
                    checked={target.targetType === 'volume'}
                    onChange={() => updateSkuTarget(target.skuId, { targetType: 'volume' })}
                  />
                  <span>Volume Target (Units)</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name={`targetType_${target.skuId}`}
                    value="value"
                    checked={target.targetType === 'value'}
                    onChange={() => updateSkuTarget(target.skuId, { targetType: 'value' })}
                  />
                  <span>Value Target (₹)</span>
                </label>
              </div>

              <div className="target-inputs">
                <div className="target-input">
                  <label>
                    {target.targetType === 'volume' ? 'Volume Target (Units)' : 'Value Target (₹)'}
                  </label>
                  <input
                    type="number"
                    value={target.targetType === 'volume' ? target.volumeTarget || '' : target.valueTarget || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      const updates = target.targetType === 'volume' 
                        ? { volumeTarget: value }
                        : { valueTarget: value };
                      updateSkuTarget(target.skuId, updates);
                    }}
                    placeholder={target.targetType === 'volume' ? 'Enter units' : 'Enter amount'}
                  />
                </div>

                <div className="distribution-method">
                  <label>Distribution Method</label>
                  <select
                    value={target.distributionMethod}
                    onChange={(e) => {
                      updateSkuTarget(target.skuId, { distributionMethod: e.target.value as any });
                      if (e.target.value !== 'custom') {
                        const totalTarget = target.targetType === 'volume' ? target.volumeTarget || 0 : target.valueTarget || 0;
                        distributeTargetToRegions(target.skuId, totalTarget, e.target.value);
                      }
                    }}
                  >
                    <option value="equal">Equal Distribution</option>
                    <option value="territory">Territory-based</option>
                    <option value="performance">Performance-based</option>
                    <option value="custom">Custom Distribution</option>
                  </select>
                </div>
              </div>

              {/* Regional Breakdown */}
              {selectedRegions.length > 0 && (
                <div className="regional-breakdown">
                  <h6>Regional Distribution</h6>
                  <div className="region-targets">
                    {selectedRegions.map(regionId => (
                      <div key={regionId} className="region-target-row">
                        <span className="region-name">Region {regionId}</span>
                        <input
                          type="number"
                          className="region-target-input"
                          value={target.regionBreakup[regionId] || ''}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            const newBreakup = { ...target.regionBreakup, [regionId]: value };
                            updateSkuTarget(target.skuId, { regionBreakup: newBreakup });
                          }}
                          placeholder="0"
                          disabled={target.distributionMethod !== 'custom'}
                        />
                        <span className="target-unit">
                          {target.targetType === 'volume' ? 'units' : '₹'}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="regional-summary">
                    <strong>
                      Total Distributed: {
                        Object.values(target.regionBreakup).reduce((sum, val) => sum + val, 0)
                      } {target.targetType === 'volume' ? 'units' : '₹'}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Campaign SKU Summary */}
      {skuTargets.length > 0 && (
        <div className="sku-campaign-summary">
          <h4>Campaign SKU Summary</h4>
          <div className="summary-stats">
            <div className="summary-stat">
              <span className="stat-label">Total SKUs</span>
              <span className="stat-value">{skuTargets.length}</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Volume Targets</span>
              <span className="stat-value">
                {skuTargets.filter(t => t.targetType === 'volume').reduce((sum, t) => sum + (t.volumeTarget || 0), 0)} units
              </span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Value Targets</span>
              <span className="stat-value">
                ₹{skuTargets.filter(t => t.targetType === 'value').reduce((sum, t) => sum + (t.valueTarget || 0), 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkuTargeting;