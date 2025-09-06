import React, { useState } from 'react';

interface Designation {
  id: string;
  name: string;
  category: 'employee' | 'distributor' | 'retailer' | 'other';
  description: string;
}

interface DesignationManagerProps {
  designations: Designation[];
  onUpdate: (designations: Designation[]) => void;
  onClose: () => void;
}

const DesignationManager: React.FC<DesignationManagerProps> = ({ designations, onUpdate, onClose }) => {
  const [localDesignations, setLocalDesignations] = useState<Designation[]>(designations);
  const [newDesignation, setNewDesignation] = useState({
    name: '',
    category: 'employee' as 'employee' | 'distributor' | 'retailer' | 'other',
    description: ''
  });

  const addDesignation = () => {
    if (!newDesignation.name.trim()) return;

    const designation: Designation = {
      id: Date.now().toString(),
      name: newDesignation.name.trim(),
      category: newDesignation.category,
      description: newDesignation.description.trim()
    };

    setLocalDesignations(prev => [...prev, designation]);
    setNewDesignation({ name: '', category: 'employee', description: '' });
  };

  const removeDesignation = (id: string) => {
    setLocalDesignations(prev => prev.filter(d => d.id !== id));
  };

  const handleSave = () => {
    onUpdate(localDesignations);
    onClose();
  };

  const predefinedDesignations = [
    { name: 'Sales Executive', category: 'employee', description: 'Field sales representative' },
    { name: 'Sales Manager', category: 'employee', description: 'Team leader and supervisor' },
    { name: 'ASM (Area Sales Manager)', category: 'employee', description: 'Area-level management' },
    { name: 'RSM (Regional Sales Manager)', category: 'employee', description: 'Regional management' },
    { name: 'Distributor', category: 'distributor', description: 'Product distributor partner' },
    { name: 'Super Distributor', category: 'distributor', description: 'Large-scale distributor' },
    { name: 'Retailer', category: 'retailer', description: 'Retail outlet partner' },
    { name: 'Premium Retailer', category: 'retailer', description: 'High-value retail partner' },
  ];

  const addPredefinedDesignation = (predefined: any) => {
    const exists = localDesignations.find(d => d.name === predefined.name);
    if (exists) return;

    const designation: Designation = {
      id: Date.now().toString(),
      name: predefined.name,
      category: predefined.category,
      description: predefined.description
    };

    setLocalDesignations(prev => [...prev, designation]);
  };

  return (
    <div className="designation-manager">
      <div className="manager-header">
        <h2>Manage Designations</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="manager-content">
        {/* Add New Designation Form */}
        <div className="add-designation-section">
          <h3>Add New Designation</h3>
          
          <div className="add-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Designation Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newDesignation.name}
                  onChange={(e) => setNewDesignation(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Sales Executive"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-input"
                  value={newDesignation.category}
                  onChange={(e) => setNewDesignation(prev => ({ ...prev, category: e.target.value as any }))}
                >
                  <option value="employee">👥 Employee</option>
                  <option value="distributor">🏪 Distributor</option>
                  <option value="retailer">🛒 Retailer</option>
                  <option value="other">📋 Other</option>
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-input"
                value={newDesignation.description}
                onChange={(e) => setNewDesignation(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this role"
              />
            </div>
            
            <button 
              className="btn"
              onClick={addDesignation}
              disabled={!newDesignation.name.trim()}
            >
              + Add Designation
            </button>
          </div>
        </div>

        {/* Quick Add Predefined */}
        <div className="predefined-section">
          <h3>Quick Add Common Designations</h3>
          <div className="predefined-grid">
            {predefinedDesignations.map((predefined, index) => (
              <button
                key={index}
                className="predefined-btn"
                onClick={() => addPredefinedDesignation(predefined)}
                disabled={localDesignations.find(d => d.name === predefined.name) !== undefined}
              >
                {predefined.name}
              </button>
            ))}
          </div>
        </div>

        {/* Current Designations */}
        <div className="current-designations">
          <h3>Current Designations ({localDesignations.length})</h3>
          
          {localDesignations.length === 0 ? (
            <div className="empty-designations">
              <p>No designations added yet. Add some using the form above or quick-add buttons.</p>
            </div>
          ) : (
            <div className="designations-list">
              {localDesignations.map((designation) => (
                <div key={designation.id} className="designation-item">
                  <div className="designation-info">
                    <div className="designation-name">{designation.name}</div>
                    <div className="designation-meta">
                      <span className={`category-badge ${designation.category}`}>
                        {designation.category}
                      </span>
                      {designation.description && (
                        <span className="designation-desc">{designation.description}</span>
                      )}
                    </div>
                  </div>
                  <button 
                    className="btn-icon btn-danger"
                    onClick={() => removeDesignation(designation.id)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="manager-actions">
        <div className="action-summary">
          {localDesignations.length} designations ready to save
        </div>
        <div className="action-buttons">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={handleSave}>
            💾 Save Designations
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesignationManager;