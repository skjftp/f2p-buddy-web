import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useDropzone } from 'react-dropzone';

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

interface HierarchyImporterProps {
  onImport: (hierarchyLevels: HierarchyLevel[]) => void;
  onClose: () => void;
}

const HierarchyImporter: React.FC<HierarchyImporterProps> = ({ onImport, onClose }) => {
  const [csvData, setCsvData] = useState<string>('');
  const [previewData, setPreviewData] = useState<HierarchyLevel[]>([]);
  const [importing, setImporting] = useState(false);

  const sampleCSV = `Region,Cluster,Branch,Channel
North,NC1,NC1_BR1,NC1_BR1_CH1
North,NC1,NC1_BR1,NC1_BR1_CH2
North,NC1,NC1_BR2,NC1_BR2_CH1
South,SC1,SC1_BR1,SC1_BR1_CH1`;

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setCsvData(text);
        parseCSVData(text);
      };
      reader.readAsText(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.txt'] },
    multiple: false
  });

  const parseCSVData = (csvText: string) => {
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) {
        toast.error('CSV file must have at least a header and one data row');
        return;
      }

      const header = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1);

      // Validate header
      const expectedColumns = ['Region', 'Cluster', 'Branch', 'Channel'];
      const hasValidHeader = expectedColumns.every(col => 
        header.some(h => h.toLowerCase().includes(col.toLowerCase()))
      );

      if (!hasValidHeader) {
        toast.error(`CSV header must include: ${expectedColumns.join(', ')}`);
        return;
      }

      // Parse data into hierarchy structure
      const levels: HierarchyLevel[] = [
        { id: '1', name: 'Region', level: 1, items: [] },
        { id: '2', name: 'Cluster', level: 2, items: [] },
        { id: '3', name: 'Branch', level: 3, items: [] },
        { id: '4', name: 'Channel', level: 4, items: [] }
      ];

      const regions = new Set<string>();
      const clusters = new Set<string>();
      const branches = new Set<string>();
      const channels = new Set<string>();
      const regionToCluster = new Map<string, string>();
      const clusterToBranch = new Map<string, string>();
      const branchToChannel = new Map<string, string>();

      rows.forEach((row, index) => {
        const values = row.split(',').map(v => v.trim());
        if (values.length < 4) {
          console.warn(`Row ${index + 2} has insufficient columns, skipping`);
          return;
        }

        const [region, cluster, branch, channel] = values;

        if (region) regions.add(region);
        if (cluster) {
          clusters.add(cluster);
          if (region) regionToCluster.set(cluster, region);
        }
        if (branch) {
          branches.add(branch);
          if (cluster) clusterToBranch.set(branch, cluster);
        }
        if (channel) {
          channels.add(channel);
          if (branch) branchToChannel.set(channel, branch);
        }
      });

      // Create hierarchy items
      regions.forEach(region => {
        levels[0].items.push({
          id: `region_${region.toLowerCase().replace(/\s+/g, '_')}`,
          name: region,
          level: 1
        });
      });

      clusters.forEach(cluster => {
        const parentRegion = regionToCluster.get(cluster);
        levels[1].items.push({
          id: `cluster_${cluster.toLowerCase().replace(/\s+/g, '_')}`,
          name: cluster,
          parentId: parentRegion ? `region_${parentRegion.toLowerCase().replace(/\s+/g, '_')}` : undefined,
          level: 2
        });
      });

      branches.forEach(branch => {
        const parentCluster = clusterToBranch.get(branch);
        levels[2].items.push({
          id: `branch_${branch.toLowerCase().replace(/\s+/g, '_')}`,
          name: branch,
          parentId: parentCluster ? `cluster_${parentCluster.toLowerCase().replace(/\s+/g, '_')}` : undefined,
          level: 3
        });
      });

      channels.forEach(channel => {
        const parentBranch = branchToChannel.get(channel);
        levels[3].items.push({
          id: `channel_${channel.toLowerCase().replace(/\s+/g, '_')}`,
          name: channel,
          parentId: parentBranch ? `branch_${parentBranch.toLowerCase().replace(/\s+/g, '_')}` : undefined,
          level: 4
        });
      });

      setPreviewData(levels);
      toast.success(`Parsed ${regions.size} regions, ${clusters.size} clusters, ${branches.size} branches, ${channels.size} channels`);
      
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Failed to parse CSV file. Please check the format.');
    }
  };

  const handleImport = () => {
    if (previewData.length === 0) {
      toast.error('No data to import. Please upload and parse a CSV file first.');
      return;
    }

    setImporting(true);
    try {
      onImport(previewData);
      toast.success('Hierarchy imported successfully!');
      onClose();
    } catch (error) {
      console.error('Error importing hierarchy:', error);
      toast.error('Failed to import hierarchy');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `Region,Cluster,Branch,Channel
North,NC1,NC1_BR1,NC1_BR1_CH1
North,NC1,NC1_BR1,NC1_BR1_CH2
North,NC1,NC1_BR1,NC1_BR1_CH3
North,NC1,NC1_BR1,NC1_BR1_CH4
North,NC1,NC1_BR2,NC1_BR2_CH1
North,NC1,NC1_BR2,NC1_BR2_CH2
South,SC1,SC1_BR1,SC1_BR1_CH1
South,SC1,SC1_BR1,SC1_BR1_CH2
East,EC1,EC1_BR1,EC1_BR1_CH1
West,WC1,WC1_BR1,WC1_BR1_CH1`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hierarchy_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="hierarchy-importer">
      <div className="importer-header">
        <h3>Import Regional Hierarchy</h3>
        <button className="btn-icon" onClick={onClose}>×</button>
      </div>

      <div className="importer-content">
        <div className="import-instructions">
          <h4>📋 How to Import</h4>
          <ol>
            <li><strong>Download Template:</strong> Get the CSV template with correct format</li>
            <li><strong>Fill Data:</strong> Add your organizational hierarchy data</li>
            <li><strong>Upload CSV:</strong> Drag & drop or click to select your file</li>
            <li><strong>Preview & Import:</strong> Review the parsed data and import</li>
          </ol>

          <div className="template-section">
            <button className="btn" onClick={downloadTemplate}>
              📥 Download CSV Template
            </button>
            <p className="template-note">
              Template includes sample data showing the expected format. Replace with your actual data.
            </p>
          </div>
        </div>

        <div className="upload-section">
          <h4>📤 Upload CSV File</h4>
          <div {...getRootProps()} className={`csv-dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            <div className="dropzone-content">
              {isDragActive ? (
                <>
                  <div className="drop-icon">📂</div>
                  <p>Drop the CSV file here...</p>
                </>
              ) : (
                <>
                  <div className="upload-icon">📄</div>
                  <p><strong>Click to select</strong> or drag & drop your CSV file</p>
                  <p className="file-info">Supports .csv and .txt files</p>
                </>
              )}
            </div>
          </div>

          <div className="manual-input-section">
            <h5>Or paste CSV content directly:</h5>
            <textarea
              className="csv-textarea"
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder={sampleCSV}
              rows={8}
            />
            <button 
              className="btn-secondary" 
              onClick={() => parseCSVData(csvData)}
              disabled={!csvData.trim()}
            >
              Parse CSV Data
            </button>
          </div>
        </div>

        {previewData.length > 0 && (
          <div className="preview-section">
            <h4>📊 Preview Parsed Data</h4>
            <div className="preview-stats">
              {previewData.map((level, index) => (
                <div key={level.id} className="stat-item">
                  <span className="stat-number">{level.items.length}</span>
                  <span className="stat-label">{level.name}s</span>
                </div>
              ))}
            </div>

            <div className="preview-sample">
              <h5>Sample Hierarchy:</h5>
              <div className="hierarchy-tree-preview">
                {previewData[0]?.items.slice(0, 2).map(region => (
                  <div key={region.id} className="tree-node">
                    <div className="node-name">{region.name}</div>
                    <div className="node-children">
                      {previewData[1]?.items.filter(cluster => cluster.parentId === region.id).slice(0, 2).map(cluster => (
                        <div key={cluster.id} className="child-node">
                          <div className="node-name">{cluster.name}</div>
                          <div className="node-children">
                            {previewData[2]?.items.filter(branch => branch.parentId === cluster.id).slice(0, 1).map(branch => (
                              <div key={branch.id} className="child-node">
                                <div className="node-name">{branch.name}</div>
                                <div className="channel-count">
                                  +{previewData[3]?.items.filter(channel => channel.parentId === branch.id).length} channels
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="importer-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn" 
            onClick={handleImport}
            disabled={previewData.length === 0 || importing}
          >
            {importing ? 'Importing...' : '🚀 Import Hierarchy'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HierarchyImporter;