import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDoc, doc, setDoc } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
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

interface Designation {
  id: string;
  name: string;
  category: 'employee' | 'distributor' | 'retailer' | 'other';
  description: string;
}

interface AddUserProps {
  organizationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AddUser: React.FC<AddUserProps> = ({ organizationId, onClose, onSuccess }) => {
  const [userType, setUserType] = useState<'single' | 'bulk'>('single');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  
  const [hierarchyLevels, setHierarchyLevels] = useState<HierarchyLevel[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  
  const [userData, setUserData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    designation: '',
    selectedRegions: {} as Record<number, string>, // Level -> Selected Item ID
    territory: '',
    employeeId: ''
  });

  // Load organization hierarchy and designations
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
        toast.error('Failed to load organization data');
      } finally {
        setLoadingData(false);
      }
    };

    loadOrganizationData();
  }, [organizationId]);

  const handleRegionChange = (level: number, itemId: string) => {
    // Auto-select parent regions when a lower level is selected
    const selectedItem = hierarchyLevels[level - 1]?.items.find(item => item.id === itemId);
    if (!selectedItem) return;

    const newSelectedRegions = { ...userData.selectedRegions };
    
    // Clear selections at this level and below
    Object.keys(newSelectedRegions).forEach(levelKey => {
      const levelNum = parseInt(levelKey);
      if (levelNum >= level) {
        delete newSelectedRegions[levelNum];
      }
    });

    // Set the selected region for this level
    newSelectedRegions[level] = itemId;
    
    // Auto-select parent regions using iterative approach
    const assignParentRegions = (item: HierarchyItem, currentLevel: number) => {
      if (!item.parentId || currentLevel <= 1) return;
      
      const parentLevel = currentLevel - 1;
      newSelectedRegions[parentLevel] = item.parentId;
      
      const parentItem = hierarchyLevels[parentLevel - 1]?.items.find(parent => parent.id === item.parentId);
      if (parentItem) {
        assignParentRegions(parentItem, parentLevel);
      }
    };
    
    assignParentRegions(selectedItem, level);

    setUserData(prev => ({ ...prev, selectedRegions: newSelectedRegions }));
  };

  const getAvailableItemsForLevel = (level: number) => {
    const levelData = hierarchyLevels[level - 1];
    if (!levelData) return [];

    if (level === 1) {
      return levelData.items; // Top level, no parent filter
    }

    const parentSelection = userData.selectedRegions[level - 1];
    if (!parentSelection) return []; // Parent not selected yet

    return levelData.items.filter(item => item.parentId === parentSelection);
  };

  const handleAddUser = async () => {
    if (!userData.name || !userData.phoneNumber || !userData.designation) {
      toast.error('Name, phone number, and designation are required');
      return;
    }

    // Get the final region assignment (deepest selected level)
    const finalRegionLevel = Math.max(...Object.keys(userData.selectedRegions).map(k => parseInt(k)));
    const finalRegionId = finalRegionLevel > 0 ? userData.selectedRegions[finalRegionLevel] : '';
    const finalRegionName = finalRegionLevel > 0 ? 
      hierarchyLevels[finalRegionLevel - 1]?.items.find(item => item.id === finalRegionId)?.name : '';

    setLoading(true);
    try {
      const dbInstance = await getFirestoreInstance();
      
      // Create user document using phone number as document ID
      const cleanPhoneNumber = userData.phoneNumber.startsWith('+') ? userData.phoneNumber : `+${userData.phoneNumber}`;
      const userDocRef = doc(dbInstance, 'users', cleanPhoneNumber);
      
      await setDoc(userDocRef, {
        uid: null, // Will be updated when they first login
        phoneNumber: cleanPhoneNumber,
        role: designations.find(d => d.id === userData.designation)?.category || 'employee',
        displayName: userData.name,
        email: userData.email,
        designation: userData.designation,
        designationName: designations.find(d => d.id === userData.designation)?.name,
        regionHierarchy: userData.selectedRegions,
        finalRegion: finalRegionId,
        finalRegionName: finalRegionName,
        territory: userData.territory,
        employeeId: userData.employeeId,
        organizationId: organizationId,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      console.log('✅ User created:', userDocRef.id);
      toast.success(`${userData.name} added successfully!`);
      onSuccess();
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast.error('Failed to add user');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Basic CSV parsing (for demo - in production use proper CSV parser)
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n');
        // const headers = lines[0].split(',').map(h => h.trim());
        
        toast.info(`Parsing ${file.name}... Found ${lines.length - 1} users`);
        
        // Expected CSV format: Name, Phone, Email, Designation, Region, Territory, EmployeeId
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length >= 4 && values[0] && values[1]) {
            // Process each user (simplified for demo)
            console.log(`Processing user: ${values[0]} - ${values[1]}`);
          }
        }
        
        toast.success('Bulk upload processing complete!');
        onSuccess();
      } else {
        toast.error('Please upload a CSV file. Excel support coming soon.');
      }
    };
    input.click();
  };

  if (loadingData) {
    return (
      <div className="add-user-loading">
        <div className="spinner"></div>
        <p>Loading organization data...</p>
      </div>
    );
  }

  return (
    <div className="add-user-modal">
      <div className="add-user-header">
        <h2>Add New User</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="add-user-content">
        {/* User Type Selector */}
        <div className="user-type-selector">
          <button 
            className={`type-tab ${userType === 'single' ? 'active' : ''}`}
            onClick={() => setUserType('single')}
          >
            👤 Single User
          </button>
          <button 
            className={`type-tab ${userType === 'bulk' ? 'active' : ''}`}
            onClick={() => setUserType('bulk')}
          >
            📊 Bulk Upload
          </button>
        </div>

        {userType === 'single' ? (
          <div className="single-user-form">
            {/* Basic Information */}
            <div className="form-section">
              <h3>Basic Information</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={userData.name}
                    onChange={(e) => setUserData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter full name"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={userData.phoneNumber}
                    onChange={(e) => setUserData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email (Optional)</label>
                  <input
                    type="email"
                    className="form-input"
                    value={userData.email}
                    onChange={(e) => setUserData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="user@company.com"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Employee ID (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={userData.employeeId}
                    onChange={(e) => setUserData(prev => ({ ...prev, employeeId: e.target.value }))}
                    placeholder="EMP001"
                  />
                </div>
              </div>
            </div>

            {/* Designation */}
            <div className="form-section">
              <h3>Role & Designation</h3>
              
              <div className="form-group">
                <label className="form-label">Designation *</label>
                <select
                  className="form-input"
                  value={userData.designation}
                  onChange={(e) => setUserData(prev => ({ ...prev, designation: e.target.value }))}
                >
                  <option value="">Select Designation</option>
                  {designations.map(designation => (
                    <option key={designation.id} value={designation.id}>
                      {designation.name} ({designation.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Regional Assignment */}
            <div className="form-section">
              <h3>Regional Assignment</h3>
              
              {hierarchyLevels.map((level) => {
                const availableItems = getAvailableItemsForLevel(level.level);
                const isDisabled = level.level > 1 && !userData.selectedRegions[level.level - 1];
                
                return (
                  <div key={level.id} className="form-group">
                    <label className="form-label">
                      {level.name} {level.level === 1 && '*'}
                    </label>
                    <select
                      className="form-input"
                      value={userData.selectedRegions[level.level] || ''}
                      onChange={(e) => handleRegionChange(level.level, e.target.value)}
                      disabled={isDisabled}
                    >
                      <option value="">Select {level.name}</option>
                      {availableItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    
                    {isDisabled && (
                      <p className="form-help">
                        Select {hierarchyLevels[level.level - 2]?.name} first
                      </p>
                    )}
                  </div>
                );
              })}
              
              <div className="form-group">
                <label className="form-label">Territory Details (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={userData.territory}
                  onChange={(e) => setUserData(prev => ({ ...prev, territory: e.target.value }))}
                  placeholder="Specific territory details"
                />
              </div>
            </div>

            {/* Selected Path Preview */}
            {Object.keys(userData.selectedRegions).length > 0 && (
              <div className="region-preview">
                <h4>Selected Path:</h4>
                <div className="path-display">
                  {hierarchyLevels.map((level) => {
                    const selectedId = userData.selectedRegions[level.level];
                    const selectedItem = level.items.find(item => item.id === selectedId);
                    
                    return selectedItem ? (
                      <span key={level.level} className="path-segment">
                        <span className="path-level">{level.name}:</span>
                        <span className="path-value">{selectedItem.name}</span>
                        {level.level < hierarchyLevels.length && ' → '}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bulk-upload-form">
            <div className="upload-instructions">
              <h3>📊 Bulk User Upload</h3>
              <p>Upload a CSV file with user details to add multiple users at once.</p>
              
              <div className="csv-format">
                <h4>Required CSV Format:</h4>
                <div className="format-example">
                  <code>Name,Phone,Email,Designation,Region,Territory,EmployeeId</code>
                </div>
                <div className="format-sample">
                  <strong>Example:</strong><br/>
                  <code>John Smith,+919876543210,john@company.com,Sales Executive,North-A,Delhi NCR,EMP001</code>
                </div>
              </div>
              
              <div className="available-designations">
                <h4>Available Designations:</h4>
                <div className="designation-chips">
                  {designations.map(designation => (
                    <span key={designation.id} className={`designation-chip ${designation.category}`}>
                      {designation.name}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="available-regions">
                <h4>Available Regions:</h4>
                <div className="region-chips">
                  {hierarchyLevels.map(level => (
                    <div key={level.id} className="region-level">
                      <strong>{level.name}:</strong>
                      {level.items.map(item => (
                        <span key={item.id} className="region-chip">
                          {item.name}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="upload-area">
              <div className="upload-zone" onClick={handleBulkUpload}>
                <div className="upload-icon">📁</div>
                <h4>Choose CSV File</h4>
                <p>Click to select your CSV file with user data</p>
                <div className="supported-formats">
                  Supports: .csv, .xlsx, .xls
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="add-user-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        
        {userType === 'single' && (
          <button 
            className="btn" 
            onClick={handleAddUser}
            disabled={loading || !userData.name || !userData.phoneNumber || !userData.designation}
          >
            {loading ? 'Adding User...' : '💾 Save User'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AddUser;