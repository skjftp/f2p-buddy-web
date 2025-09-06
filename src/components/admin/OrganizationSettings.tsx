import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestoreInstance, getStorageInstance } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { useDropzone } from 'react-dropzone';

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
  description?: string;
}

const OrganizationSettings: React.FC = () => {
  const { user, organization } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'hierarchy' | 'designations'>('basic');
  
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

  const [newHierarchyItem, setNewHierarchyItem] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [selectedParent, setSelectedParent] = useState('');
  
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
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    multiple: false,
    maxSize: 5 * 1024 * 1024,
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

  const addDesignation = () => {
    const name = prompt('Enter designation name:');
    if (!name) return;

    const category = prompt('Enter category (employee/distributor/retailer/other):') as any;
    if (!['employee', 'distributor', 'retailer', 'other'].includes(category)) {
      toast.error('Invalid category');
      return;
    }

    const newDesignation: Designation = {
      id: Date.now().toString(),
      name,
      category,
      description: ''
    };

    setDesignations(prev => [...prev, newDesignation]);
  };

  const removeDesignation = (id: string) => {
    setDesignations(prev => prev.filter(d => d.id !== id));
  };

  const handleSave = async () => {
    if (!organization?.id) {
      toast.error('No organization found');
      return;
    }

    setLoading(true);
    try {
      let logoUrl = organization.logo || '';
      
      if (basicInfo.logo) {
        const storageInstance = await getStorageInstance();
        const fileName = `logo_${Date.now()}_${basicInfo.logo.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const logoRef = ref(storageInstance, `organizations/${fileName}`);
        const snapshot = await uploadBytes(logoRef, basicInfo.logo);
        logoUrl = await getDownloadURL(snapshot.ref);
      }

      const dbInstance = await getFirestoreInstance();
      await updateDoc(doc(dbInstance, 'organizations', organization.id), {
        name: basicInfo.name,
        logo: logoUrl,
        primaryColor: basicInfo.primaryColor,
        secondaryColor: basicInfo.secondaryColor,
        hierarchyLevels: hierarchyLevels,
        designations: designations,
        updatedAt: serverTimestamp()
      });

      toast.success('Organization settings updated successfully!');
    } catch (error: any) {
      console.error('Error updating organization:', error);
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const getParentOptions = (level: number) => {
    if (level === 1) return [];
    const parentLevel = hierarchyLevels.find(l => l.level === level - 1);
    return parentLevel?.items || [];
  };

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
              <h4>Hierarchy Preview</h4>
              <div className="preview-tree">
                {hierarchyLevels.map((level) => (
                  <div key={level.id} className="preview-level">
                    <strong>{level.name}:</strong> 
                    {level.items.length === 0 ? (
                      <span className="empty-level">No items added</span>
                    ) : (
                      <span className="level-items">
                        {level.items.map(item => item.name).join(', ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'designations' && (
          <div className="designations-settings">
            <div className="section-header">
              <h3>User Designations</h3>
              <button className="btn-secondary" onClick={addDesignation}>
                + Add Designation
              </button>
            </div>
            <p className="section-description">
              Define roles for employees, distributors, retailers, and other participants in your campaigns.
            </p>

            <div className="designations-grid">
              {designations.map((designation) => (
                <div key={designation.id} className="designation-card">
                  <div className="designation-header">
                    <h4>{designation.name}</h4>
                    <span className={`category-badge ${designation.category}`}>
                      {designation.category}
                    </span>
                  </div>
                  <p className="designation-description">
                    {designation.description || 'No description'}
                  </p>
                  <div className="designation-actions">
                    <button 
                      className="btn-icon btn-danger"
                      onClick={() => removeDesignation(designation.id)}
                      title="Remove"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="designation-categories">
              <h4>Categories</h4>
              <div className="category-grid">
                <div className="category-item">
                  <span className="category-icon">👥</span>
                  <span>Employee</span>
                  <span className="count">{designations.filter(d => d.category === 'employee').length}</span>
                </div>
                <div className="category-item">
                  <span className="category-icon">🏪</span>
                  <span>Distributor</span>
                  <span className="count">{designations.filter(d => d.category === 'distributor').length}</span>
                </div>
                <div className="category-item">
                  <span className="category-icon">🛒</span>
                  <span>Retailer</span>
                  <span className="count">{designations.filter(d => d.category === 'retailer').length}</span>
                </div>
                <div className="category-item">
                  <span className="category-icon">📋</span>
                  <span>Other</span>
                  <span className="count">{designations.filter(d => d.category === 'other').length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationSettings;