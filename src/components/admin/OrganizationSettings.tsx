import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { useDropzone } from 'react-dropzone';
import DesignationManager from './DesignationManager';

// Helper function to compress and convert image to base64 (same as AdminSetup)
const compressAndConvertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // For SVG files, just convert to base64 without compression
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    // For other image types, compress using canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions (max 200x200 for logos)
      const maxSize = 200;
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Fill with white background for JPEG, preserve transparency for PNG
      if (file.type === 'image/png' || file.type === 'image/gif') {
        // Keep transparent background for PNG/GIF
        ctx?.clearRect(0, 0, width, height);
      } else {
        // White background for JPEG
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);
        }
      }
      
      // Draw image
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Use appropriate format based on original file type
      const format = (file.type === 'image/png' || file.type === 'image/gif') ? 'image/png' : 'image/jpeg';
      const quality = format === 'image/jpeg' ? 0.7 : undefined;
      const compressedBase64 = canvas.toDataURL(format, quality);
      resolve(compressedBase64);
    };
    
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

interface HierarchyLevel {
  id: string;
  name: string; // e.g., "Zone", "Cluster", "District", "Area"
  level: number; // 1, 2, 3, 4...
  items: HierarchyItem[];
}

interface HierarchyItem {
  id: string;
  name: string; // e.g., "North", "South", "Cluster A", "District XYZ"
  parentId?: string;
  level: number;
}

interface Designation {
  id: string;
  name: string; // e.g., "Sales Executive", "Distributor", "Retailer"
  category: 'employee' | 'distributor' | 'retailer' | 'other';
  description: string;
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

const OrganizationSettings: React.FC = () => {
  const { organization } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'basic' | 'hierarchy' | 'designations' | 'skus'>('basic');
  
  const [basicInfo, setBasicInfo] = useState({
    name: organization?.name || '',
    logo: null as File | null,
    primaryColor: organization?.primaryColor || '#667eea',
    secondaryColor: organization?.secondaryColor || '#764ba2'
  });
  
  const [logoPreview, setLogoPreview] = useState(organization?.logo || '');
  
  const [hierarchyLevels, setHierarchyLevels] = useState<HierarchyLevel[]>([
    { id: '1', name: 'Zone', level: 1, items: [] }
  ]);
  
  const [designations, setDesignations] = useState<Designation[]>([
    { id: '1', name: 'Sales Executive', category: 'employee', description: 'Field sales representative' },
    { id: '2', name: 'Sales Manager', category: 'employee', description: 'Team lead and supervisor' },
    { id: '3', name: 'Distributor', category: 'distributor', description: 'Product distributor partner' },
    { id: '4', name: 'Retailer', category: 'retailer', description: 'Retail outlet partner' }
  ]);

  const [skus, setSkus] = useState<SKU[]>([]);
  const [newSku, setNewSku] = useState({
    name: '',
    code: '',
    category: '',
    description: '',
    unitPrice: '',
    currency: 'INR'
  });

  const [newHierarchyItem, setNewHierarchyItem] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [selectedParent, setSelectedParent] = useState('');
  const [showDesignationManager, setShowDesignationManager] = useState(false);
  
  // Load existing organization data on component mount
  useEffect(() => {
    const loadOrganizationData = async () => {
      if (!organization?.id) {
        setDataLoading(false);
        return;
      }

      try {
        const dbInstance = await getFirestoreInstance();
        const orgDoc = await getDoc(doc(dbInstance, 'organizations', organization.id));
        
        if (orgDoc.exists()) {
          const data = orgDoc.data();
          
          // Load hierarchy levels if they exist
          if (data.hierarchyLevels) {
            setHierarchyLevels(data.hierarchyLevels);
          }
          
          // Load designations if they exist
          if (data.designations) {
            setDesignations(data.designations);
          }
          
          // Load SKUs if they exist
          if (data.skus) {
            setSkus(data.skus);
          }
          
          // Update basic info
          setBasicInfo(prev => ({
            ...prev,
            name: data.name || prev.name,
            primaryColor: data.primaryColor || prev.primaryColor,
            secondaryColor: data.secondaryColor || prev.secondaryColor
          }));
          
          setLogoPreview(data.logo || '');
        }
      } catch (error) {
        console.error('Error loading organization data:', error);
        toast.error('Failed to load organization settings');
      } finally {
        setDataLoading(false);
      }
    };

    loadOrganizationData();
  }, [organization?.id]);
  
  const onLogoDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setBasicInfo(prev => ({ ...prev, logo: file }));
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onLogoDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.svg'] },
    multiple: false,
    maxSize: 500 * 1024, // 500KB max for Firestore compatibility
  });

  const addHierarchyLevel = () => {
    const newLevel: HierarchyLevel = {
      id: (hierarchyLevels.length + 1).toString(),
      name: `Level ${hierarchyLevels.length + 1}`,
      level: hierarchyLevels.length + 1,
      items: []
    };
    setHierarchyLevels(prev => [...prev, newLevel]);
  };

  const updateLevelName = (levelId: string, newName: string) => {
    setHierarchyLevels(prev => prev.map(level => 
      level.id === levelId ? { ...level, name: newName } : level
    ));
  };

  const addHierarchyItem = () => {
    if (!newHierarchyItem.trim()) return;

    const newItem: HierarchyItem = {
      id: `${selectedLevel}_${Date.now()}`,
      name: newHierarchyItem.trim(),
      parentId: selectedParent || undefined,
      level: selectedLevel
    };

    setHierarchyLevels(prev => prev.map(level => 
      level.level === selectedLevel 
        ? { ...level, items: [...level.items, newItem] }
        : level
    ));

    setNewHierarchyItem('');
  };

  const removeHierarchyItem = (levelNumber: number, itemId: string) => {
    setHierarchyLevels(prev => prev.map(level => 
      level.level === levelNumber 
        ? { ...level, items: level.items.filter(item => item.id !== itemId) }
        : level
    ));
  };

  const handleDesignationUpdate = (updatedDesignations: Designation[]) => {
    setDesignations(updatedDesignations);
  };

  const addSku = () => {
    if (!newSku.name.trim() || !newSku.code.trim()) {
      toast.error('SKU name and code are required');
      return;
    }

    // Check if SKU code already exists
    if (skus.some(sku => sku.code.toLowerCase() === newSku.code.toLowerCase())) {
      toast.error('SKU code already exists');
      return;
    }

    const sku: SKU = {
      id: `sku_${Date.now()}`,
      name: newSku.name.trim(),
      code: newSku.code.trim().toUpperCase(),
      category: newSku.category.trim(),
      description: newSku.description.trim(),
      unitPrice: newSku.unitPrice ? parseFloat(newSku.unitPrice) : undefined,
      currency: newSku.currency
    };

    setSkus(prev => [...prev, sku]);
    setNewSku({
      name: '',
      code: '',
      category: '',
      description: '',
      unitPrice: '',
      currency: 'INR'
    });
  };

  const removeSku = (skuId: string) => {
    setSkus(prev => prev.filter(sku => sku.id !== skuId));
  };

  const handleSave = async () => {
    if (!organization?.id) {
      toast.error('No organization found');
      return;
    }

    setLoading(true);
    try {
      console.log('💾 Saving organization settings...', {
        hierarchyLevels: hierarchyLevels.length,
        designations: designations.length,
        orgId: organization.id
      });

      let logoUrl = organization.logo || '';
      
      if (basicInfo.logo) {
        console.log('📷 Processing new logo...');
        
        // Stricter file size limits for Firestore compatibility
        const maxSize = basicInfo.logo.type === 'image/svg+xml' ? 50 * 1024 : 500 * 1024; // 50KB for SVG, 500KB for others
        if (basicInfo.logo.size > maxSize) {
          const sizeLimit = basicInfo.logo.type === 'image/svg+xml' ? '50KB' : '500KB';
          toast.error(`Logo file size must be less than ${sizeLimit}`);
          return;
        }
        
        try {
          logoUrl = await compressAndConvertToBase64(basicInfo.logo);
          console.log('✅ Logo processed, base64 size:', Math.round(logoUrl.length / 1024), 'KB');
          
          // Strict check for base64 size (Firestore document limit is ~1MB total)
          if (logoUrl.length > 200 * 1024) { // 200KB limit for base64 to leave room for other fields
            console.warn('Logo too large after processing, keeping existing logo');
            toast.warning('Logo is too large. Organization settings will be saved with existing logo.');
            logoUrl = organization.logo || ''; // Keep existing logo
          }
        } catch (error) {
          console.error('❌ Failed to process logo:', error);
          toast.warning('Failed to process logo image. Organization settings will be saved with existing logo.');
          logoUrl = organization.logo || ''; // Keep existing logo
        }
      }

      // Clean data for Firestore (remove any undefined values)
      const cleanHierarchyLevels = hierarchyLevels.map(level => ({
        id: level.id,
        name: level.name,
        level: level.level,
        items: level.items.map(item => ({
          id: item.id,
          name: item.name,
          level: item.level,
          ...(item.parentId && { parentId: item.parentId }) // Only include if not undefined
        }))
      }));

      const cleanDesignations = designations.map(designation => ({
        id: designation.id,
        name: designation.name,
        category: designation.category,
        description: designation.description || ''
      }));

      const cleanSkus = skus.map(sku => ({
        id: sku.id,
        name: sku.name,
        code: sku.code,
        category: sku.category,
        description: sku.description,
        ...(sku.unitPrice && { unitPrice: sku.unitPrice }),
        currency: sku.currency
      }));

      const updateData = {
        name: basicInfo.name,
        logo: logoUrl,
        primaryColor: basicInfo.primaryColor,
        secondaryColor: basicInfo.secondaryColor,
        hierarchyLevels: cleanHierarchyLevels,
        designations: cleanDesignations,
        skus: cleanSkus,
        updatedAt: serverTimestamp()
      };

      console.log('🔄 Updating organization document with clean data...', updateData);

      const dbInstance = await getFirestoreInstance();
      await updateDoc(doc(dbInstance, 'organizations', organization.id), updateData);

      console.log('✅ Organization updated successfully');
      toast.success('Organization settings updated successfully!');
      
      // Refresh the page to load new data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error: any) {
      console.error('❌ Error updating organization:', error);
      toast.error(`Failed to update settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getParentOptions = (level: number) => {
    if (level === 1) return [];
    const parentLevel = hierarchyLevels.find(l => l.level === level - 1);
    return parentLevel?.items || [];
  };

  // Recursive function to render tree nodes with proper nesting
  const renderTreeNode = (item: HierarchyItem, levels: HierarchyLevel[], currentLevel: number): React.ReactNode => {
    const children = levels[currentLevel + 1]?.items.filter(child => child.parentId === item.id) || [];
    
    return (
      <div key={item.id} className="tree-node-container">
        <div className="tree-node">
          <div className="node-name">{item.name}</div>
          <div className="node-level">{levels[currentLevel]?.name}</div>
        </div>
        
        {children.length > 0 && (
          <>
            {/* Vertical trunk line */}
            <div className="tree-trunk"></div>
            
            {/* Horizontal branch line */}
            <div className="tree-branch-line"></div>
            
            {/* Children container */}
            <div className="tree-children">
              {children.map((child) => (
                <div key={child.id} className="tree-child-container">
                  {/* Vertical connector to child */}
                  <div className="child-connector"></div>
                  
                  {/* Recursively render child and its descendants */}
                  {renderTreeNode(child, levels, currentLevel + 1)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  if (dataLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading organization settings...</p>
      </div>
    );
  }

  return (
    <div className="organization-settings">
      <div className="settings-header">
        <h2>Organization Settings</h2>
        <button className="btn" onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : '💾 Save Settings'}
        </button>
      </div>

      <div className="settings-tabs">
        <button 
          className={`settings-tab ${activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveTab('basic')}
        >
          🏢 Basic Info
        </button>
        <button 
          className={`settings-tab ${activeTab === 'hierarchy' ? 'active' : ''}`}
          onClick={() => setActiveTab('hierarchy')}
        >
          🗺️ Regional Hierarchy
        </button>
        <button 
          className={`settings-tab ${activeTab === 'designations' ? 'active' : ''}`}
          onClick={() => setActiveTab('designations')}
        >
          👔 Designations
        </button>
        <button 
          className={`settings-tab ${activeTab === 'skus' ? 'active' : ''}`}
          onClick={() => setActiveTab('skus')}
        >
          📦 SKU Management
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'basic' && (
          <div className="basic-settings">
            <div className="form-group">
              <label className="form-label">Organization Name</label>
              <input
                type="text"
                className="form-input"
                value={basicInfo.name}
                onChange={(e) => setBasicInfo(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter organization name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Organization Logo</label>
              <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
                <input {...getInputProps()} />
                {logoPreview ? (
                  <div style={{textAlign: 'center'}}>
                    <img 
                      src={logoPreview} 
                      alt="Logo preview" 
                      style={{
                        width: '120px', 
                        height: '120px', 
                        objectFit: 'cover',
                        borderRadius: '12px',
                        border: '2px solid var(--gray-200)'
                      }} 
                    />
                    <p style={{marginTop: '8px', fontSize: '12px'}}>Click to change</p>
                  </div>
                ) : (
                  <div style={{textAlign: 'center', padding: '30px'}}>
                    <div style={{fontSize: '32px', marginBottom: '8px'}}>🏢</div>
                    <p>Drop logo here or click to select</p>
                    <p style={{fontSize: '12px', color: '#666', marginTop: '4px'}}>
                      PNG, JPG, GIF up to 500KB, SVG up to 50KB
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div className="form-group">
                <label className="form-label">Primary Color</label>
                <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                  <input
                    type="color"
                    value={basicInfo.primaryColor}
                    onChange={(e) => setBasicInfo(prev => ({ ...prev, primaryColor: e.target.value }))}
                    style={{width: '40px', height: '40px', border: 'none', borderRadius: '8px'}}
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={basicInfo.primaryColor}
                    onChange={(e) => setBasicInfo(prev => ({ ...prev, primaryColor: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Secondary Color</label>
                <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                  <input
                    type="color"
                    value={basicInfo.secondaryColor}
                    onChange={(e) => setBasicInfo(prev => ({ ...prev, secondaryColor: e.target.value }))}
                    style={{width: '40px', height: '40px', border: 'none', borderRadius: '8px'}}
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={basicInfo.secondaryColor}
                    onChange={(e) => setBasicInfo(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hierarchy' && (
          <div className="hierarchy-settings">
            <div className="section-header">
              <h3>Regional Hierarchy Setup</h3>
              <button className="btn-secondary" onClick={addHierarchyLevel}>
                + Add Level
              </button>
            </div>
            <p className="section-description">
              Create your organization's regional breakdown. Start with top level (e.g., Zones) and work down to smaller areas.
            </p>

            <div className="hierarchy-builder">
              {hierarchyLevels.map((level) => (
                <div key={level.id} className="hierarchy-level">
                  <div className="level-header">
                    <h4>Level {level.level}</h4>
                    <input
                      type="text"
                      className="level-name-input"
                      value={level.name}
                      onChange={(e) => updateLevelName(level.id, e.target.value)}
                      placeholder="e.g., Zone, Cluster, District, Area"
                    />
                  </div>

                  <div className="add-item-form">
                    {level.level > 1 && (
                      <select
                        className="form-input"
                        value={selectedParent}
                        onChange={(e) => setSelectedParent(e.target.value)}
                        style={{marginBottom: '8px'}}
                      >
                        <option value="">Select Parent {hierarchyLevels[level.level - 2]?.name}</option>
                        {getParentOptions(level.level).map(parent => (
                          <option key={parent.id} value={parent.id}>
                            {parent.name}
                          </option>
                        ))}
                      </select>
                    )}
                    
                    <div style={{display: 'flex', gap: '8px'}}>
                      <input
                        type="text"
                        className="form-input"
                        value={selectedLevel === level.level ? newHierarchyItem : ''}
                        onChange={(e) => {
                          setSelectedLevel(level.level);
                          setNewHierarchyItem(e.target.value);
                        }}
                        placeholder={`Add ${level.name}`}
                        onKeyPress={(e) => e.key === 'Enter' && addHierarchyItem()}
                      />
                      <button 
                        className="btn-icon"
                        onClick={addHierarchyItem}
                        disabled={!newHierarchyItem.trim() || selectedLevel !== level.level}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="hierarchy-items">
                    {level.items.map((item) => (
                      <div key={item.id} className="hierarchy-item">
                        <span className="item-name">{item.name}</span>
                        <button 
                          className="btn-icon btn-danger"
                          onClick={() => removeHierarchyItem(level.level, item.id)}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="hierarchy-preview">
              <h4>Hierarchy Flowchart</h4>
              <div className="flowchart-scroll">
                <div className="flowchart-tree">
                  {hierarchyLevels.every(level => level.items.length === 0) ? (
                    <div className="empty-flowchart">
                      <div className="empty-icon">🗺️</div>
                      <h4>No Hierarchy Created Yet</h4>
                      <p>Add items to your hierarchy levels to see the organizational flowchart here.</p>
                    </div>
                  ) : (
                    <div className="tree-root">
                      {/* Render only top-level items, children will be recursive */}
                      {hierarchyLevels[0]?.items.map((rootItem) => 
                        renderTreeNode(rootItem, hierarchyLevels, 0)
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'designations' && (
          <div className="designations-settings">
            <div className="section-header">
              <h3>User Designations</h3>
              <button className="btn" onClick={() => setShowDesignationManager(true)}>
                ⚙️ Manage Designations
              </button>
            </div>
            <p className="section-description">
              Define roles for employees, distributors, retailers, and other participants in your campaigns.
            </p>

            <div className="designation-summary">
              <div className="category-grid">
                <div className="category-item">
                  <span className="category-icon">👥</span>
                  <div>
                    <span className="count">{designations.filter(d => d.category === 'employee').length}</span>
                    <span className="label">Employees</span>
                  </div>
                </div>
                <div className="category-item">
                  <span className="category-icon">🏪</span>
                  <div>
                    <span className="count">{designations.filter(d => d.category === 'distributor').length}</span>
                    <span className="label">Distributors</span>
                  </div>
                </div>
                <div className="category-item">
                  <span className="category-icon">🛒</span>
                  <div>
                    <span className="count">{designations.filter(d => d.category === 'retailer').length}</span>
                    <span className="label">Retailers</span>
                  </div>
                </div>
                <div className="category-item">
                  <span className="category-icon">📋</span>
                  <div>
                    <span className="count">{designations.filter(d => d.category === 'other').length}</span>
                    <span className="label">Others</span>
                  </div>
                </div>
              </div>
              
              <div className="designation-preview">
                <h4>Current Designations:</h4>
                <div className="designation-tags">
                  {designations.map((designation) => (
                    <span key={designation.id} className={`designation-tag ${designation.category}`}>
                      {designation.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'skus' && (
          <div className="skus-settings">
            <div className="section-header">
              <h3>SKU Management</h3>
              <button className="btn" onClick={addSku} disabled={!newSku.name.trim() || !newSku.code.trim()}>
                ➕ Add SKU
              </button>
            </div>
            <p className="section-description">
              Add products and services that will be used in your sales campaigns. Each SKU needs a unique code for tracking.
            </p>

            <div className="add-sku-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">SKU Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSku.name}
                    onChange={(e) => setNewSku(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Premium Widget"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">SKU Code *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSku.code}
                    onChange={(e) => setNewSku(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g., PWG001"
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSku.category}
                    onChange={(e) => setNewSku(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="e.g., Electronics"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Price</label>
                  <div style={{display: 'flex', gap: '8px'}}>
                    <select
                      className="form-input"
                      value={newSku.currency}
                      onChange={(e) => setNewSku(prev => ({ ...prev, currency: e.target.value }))}
                      style={{maxWidth: '80px'}}
                    >
                      <option value="INR">₹</option>
                      <option value="USD">$</option>
                      <option value="EUR">€</option>
                    </select>
                    <input
                      type="number"
                      className="form-input"
                      value={newSku.unitPrice}
                      onChange={(e) => setNewSku(prev => ({ ...prev, unitPrice: e.target.value }))}
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={newSku.description}
                  onChange={(e) => setNewSku(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the product/service"
                />
              </div>
            </div>

            <div className="skus-grid">
              {skus.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📦</div>
                  <h4>No SKUs Added</h4>
                  <p>Add your first product or service to get started with campaign creation.</p>
                </div>
              ) : (
                skus.map((sku) => (
                  <div key={sku.id} className="sku-card">
                    <div className="sku-header">
                      <div className="sku-code">{sku.code}</div>
                      <button 
                        className="btn-icon btn-danger"
                        onClick={() => removeSku(sku.id)}
                        title="Remove SKU"
                      >
                        ×
                      </button>
                    </div>
                    <div className="sku-content">
                      <h4 className="sku-name">{sku.name}</h4>
                      {sku.category && <span className="sku-category">{sku.category}</span>}
                      {sku.description && <p className="sku-description">{sku.description}</p>}
                      {sku.unitPrice && (
                        <div className="sku-price">
                          {sku.currency === 'INR' ? '₹' : sku.currency === 'USD' ? '$' : '€'}
                          {sku.unitPrice}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      
      {showDesignationManager && (
        <div className="modal-overlay">
          <div className="modal-content">
            <DesignationManager
              designations={designations}
              onUpdate={handleDesignationUpdate}
              onClose={() => setShowDesignationManager(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationSettings;