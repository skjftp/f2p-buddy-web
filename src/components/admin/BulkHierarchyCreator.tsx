import React, { useState } from 'react';
import { toast } from 'react-toastify';

interface HierarchyLevel {
  id: string;
  name: string;
  level: number;
  items: HierarchyItem[];
}

interface HierarchyItem {
  id: string;
  name: string;
  parentId?: string;
  level: number;
}

interface BulkHierarchyCreatorProps {
  onGenerate: (hierarchyLevels: HierarchyLevel[]) => void;
  onClose: () => void;
}

const BulkHierarchyCreator: React.FC<BulkHierarchyCreatorProps> = ({ onGenerate, onClose }) => {
  const [config, setConfig] = useState({
    regions: ['North', 'South', 'East', 'West'],
    clustersPerRegion: 3,
    branchesPerCluster: 3,
    channelsPerBranch: 4,
    namingPattern: 'code' // 'code' or 'descriptive'
  });
  const [generating, setGenerating] = useState(false);
  const [previewCount, setPreviewCount] = useState({
    regions: 0,
    clusters: 0,
    branches: 0,
    channels: 0,
    total: 0
  });

  React.useEffect(() => {
    const regions = config.regions.length;
    const clusters = regions * config.clustersPerRegion;
    const branches = clusters * config.branchesPerCluster;
    const channels = branches * config.channelsPerBranch;
    const total = regions + clusters + branches + channels;

    setPreviewCount({ regions, clusters, branches, channels, total });
  }, [config]);

  const generateNamingPatterns = () => {
    const patterns = {
      code: {
        cluster: (region: string, index: number) => `${region.charAt(0)}C${index + 1}`,
        branch: (cluster: string, index: number) => `${cluster}_BR${index + 1}`,
        channel: (branch: string, index: number) => `${branch}_CH${index + 1}`
      },
      descriptive: {
        cluster: (region: string, index: number) => `${region} Cluster ${index + 1}`,
        branch: (cluster: string, index: number) => `${cluster} Branch ${index + 1}`,
        channel: (branch: string, index: number) => `${branch} Channel ${index + 1}`
      }
    };
    return patterns[config.namingPattern as keyof typeof patterns];
  };

  const generateHierarchy = () => {
    setGenerating(true);
    
    try {
      const levels: HierarchyLevel[] = [
        { id: '1', name: 'Region', level: 1, items: [] },
        { id: '2', name: 'Cluster', level: 2, items: [] },
        { id: '3', name: 'Branch', level: 3, items: [] },
        { id: '4', name: 'Channel', level: 4, items: [] }
      ];

      const naming = generateNamingPatterns();

      // Generate regions
      config.regions.forEach((regionName, regionIndex) => {
        const regionId = `region_${regionName.toLowerCase().replace(/\s+/g, '_')}`;
        levels[0].items.push({
          id: regionId,
          name: regionName,
          level: 1
        });

        // Generate clusters for this region
        for (let clusterIndex = 0; clusterIndex < config.clustersPerRegion; clusterIndex++) {
          const clusterName = naming.cluster(regionName, clusterIndex);
          const clusterId = `cluster_${clusterName.toLowerCase().replace(/\s+/g, '_')}`;
          
          levels[1].items.push({
            id: clusterId,
            name: clusterName,
            parentId: regionId,
            level: 2
          });

          // Generate branches for this cluster
          for (let branchIndex = 0; branchIndex < config.branchesPerCluster; branchIndex++) {
            const branchName = naming.branch(clusterName, branchIndex);
            const branchId = `branch_${branchName.toLowerCase().replace(/[\s_]+/g, '_')}`;
            
            levels[2].items.push({
              id: branchId,
              name: branchName,
              parentId: clusterId,
              level: 3
            });

            // Generate channels for this branch
            for (let channelIndex = 0; channelIndex < config.channelsPerBranch; channelIndex++) {
              const channelName = naming.channel(branchName, channelIndex);
              const channelId = `channel_${channelName.toLowerCase().replace(/[\s_]+/g, '_')}`;
              
              levels[3].items.push({
                id: channelId,
                name: channelName,
                parentId: branchId,
                level: 4
              });
            }
          }
        }
      });

      onGenerate(levels);
      toast.success(`Generated ${previewCount.total} organizational units!`);
      onClose();

    } catch (error) {
      console.error('Error generating hierarchy:', error);
      toast.error('Failed to generate hierarchy');
    } finally {
      setGenerating(false);
    }
  };

  const addRegion = () => {
    const newRegion = `Region ${config.regions.length + 1}`;
    setConfig(prev => ({
      ...prev,
      regions: [...prev.regions, newRegion]
    }));
  };

  const removeRegion = (index: number) => {
    if (config.regions.length <= 1) {
      toast.warning('At least one region is required');
      return;
    }
    setConfig(prev => ({
      ...prev,
      regions: prev.regions.filter((_, i) => i !== index)
    }));
  };

  const updateRegion = (index: number, newName: string) => {
    setConfig(prev => ({
      ...prev,
      regions: prev.regions.map((region, i) => i === index ? newName : region)
    }));
  };

  return (
    <div className="bulk-hierarchy-creator">
      <div className="creator-header">
        <h3>🏗️ Bulk Hierarchy Generator</h3>
        <button className="btn-icon" onClick={onClose}>×</button>
      </div>

      <div className="creator-content">
        <div className="creator-description">
          <p>Quickly generate a standardized organizational hierarchy with configurable structure and naming patterns.</p>
        </div>

        <div className="config-section">
          <h4>📍 Regions</h4>
          <div className="regions-list">
            {config.regions.map((region, index) => (
              <div key={index} className="region-item">
                <input
                  type="text"
                  value={region}
                  onChange={(e) => updateRegion(index, e.target.value)}
                  className="region-input"
                />
                <button
                  className="btn-icon btn-danger"
                  onClick={() => removeRegion(index)}
                  disabled={config.regions.length <= 1}
                  title="Remove region"
                >
                  ×
                </button>
              </div>
            ))}
            <button className="btn-secondary" onClick={addRegion}>
              + Add Region
            </button>
          </div>
        </div>

        <div className="config-section">
          <h4>🏗️ Structure Configuration</h4>
          <div className="config-grid">
            <div className="config-item">
              <label>Clusters per Region</label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.clustersPerRegion}
                onChange={(e) => setConfig(prev => ({ ...prev, clustersPerRegion: parseInt(e.target.value) || 1 }))}
                className="form-input"
              />
            </div>
            <div className="config-item">
              <label>Branches per Cluster</label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.branchesPerCluster}
                onChange={(e) => setConfig(prev => ({ ...prev, branchesPerCluster: parseInt(e.target.value) || 1 }))}
                className="form-input"
              />
            </div>
            <div className="config-item">
              <label>Channels per Branch</label>
              <input
                type="number"
                min="1"
                max="20"
                value={config.channelsPerBranch}
                onChange={(e) => setConfig(prev => ({ ...prev, channelsPerBranch: parseInt(e.target.value) || 1 }))}
                className="form-input"
              />
            </div>
          </div>
        </div>

        <div className="config-section">
          <h4>🏷️ Naming Pattern</h4>
          <div className="naming-options">
            <label className="naming-option">
              <input
                type="radio"
                name="naming"
                value="code"
                checked={config.namingPattern === 'code'}
                onChange={(e) => setConfig(prev => ({ ...prev, namingPattern: e.target.value }))}
              />
              <span>Code-based (NC1, NC1_BR1, NC1_BR1_CH1)</span>
            </label>
            <label className="naming-option">
              <input
                type="radio"
                name="naming"
                value="descriptive"
                checked={config.namingPattern === 'descriptive'}
                onChange={(e) => setConfig(prev => ({ ...prev, namingPattern: e.target.value }))}
              />
              <span>Descriptive (North Cluster 1, North Cluster 1 Branch 1)</span>
            </label>
          </div>
        </div>

        <div className="preview-section">
          <h4>📊 Generation Preview</h4>
          <div className="preview-stats">
            <div className="preview-stat">
              <span className="stat-number">{previewCount.regions}</span>
              <span className="stat-label">Regions</span>
            </div>
            <div className="preview-stat">
              <span className="stat-number">{previewCount.clusters}</span>
              <span className="stat-label">Clusters</span>
            </div>
            <div className="preview-stat">
              <span className="stat-number">{previewCount.branches}</span>
              <span className="stat-label">Branches</span>
            </div>
            <div className="preview-stat">
              <span className="stat-number">{previewCount.channels}</span>
              <span className="stat-label">Channels</span>
            </div>
            <div className="preview-stat total">
              <span className="stat-number">{previewCount.total}</span>
              <span className="stat-label">Total Units</span>
            </div>
          </div>

          <div className="preview-warning">
            {previewCount.total > 500 && (
              <div className="warning-message">
                <span className="warning-icon">⚠️</span>
                <span>Large hierarchy ({previewCount.total} units). Consider reducing the structure size for better performance.</span>
              </div>
            )}
          </div>
        </div>

        <div className="creator-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn" 
            onClick={generateHierarchy}
            disabled={generating || previewCount.total === 0}
          >
            {generating ? 'Generating...' : `🚀 Generate ${previewCount.total} Units`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkHierarchyCreator;