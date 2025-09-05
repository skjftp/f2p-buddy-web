import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestoreInstance, getStorageInstance } from '../../config/firebase';
import { toast } from 'react-toastify';
import { useDropzone } from 'react-dropzone';

const AdminSetup: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  const [organizationData, setOrganizationData] = useState({
    name: '',
    logo: null as File | null,
    primaryColor: '#667eea',
    secondaryColor: '#764ba2',
    settings: {
      allowSelfRegistration: true,
      requireApproval: false,
      timezone: 'Asia/Kolkata'
    }
  });

  const [logoPreview, setLogoPreview] = useState<string>('');

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setOrganizationData(prev => ({ ...prev, logo: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    multiple: false,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const handleInputChange = (field: string, value: any) => {
    setOrganizationData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSettingsChange = (field: string, value: any) => {
    setOrganizationData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: value
      }
    }));
  };

  const handleSubmit = async () => {
    if (!organizationData.name.trim()) {
      toast.error('Organization name is required');
      return;
    }

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    setLoading(true);
    
    try {
      let logoUrl = '';
      
      // Upload logo if provided
      if (organizationData.logo) {
        const storageInstance = await getStorageInstance();
        const logoRef = ref(storageInstance, `organizations/${Date.now()}_${organizationData.logo.name}`);
        const snapshot = await uploadBytes(logoRef, organizationData.logo);
        logoUrl = await getDownloadURL(snapshot.ref);
      }

      // Create organization
      const dbInstance = await getFirestoreInstance();
      const orgRef = await addDoc(collection(dbInstance, 'organizations'), {
        name: organizationData.name,
        logo: logoUrl,
        primaryColor: organizationData.primaryColor,
        secondaryColor: organizationData.secondaryColor,
        adminId: user.uid,
        settings: organizationData.settings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update user with organization ID
      await updateDoc(doc(dbInstance, 'users', user.uid), {
        organizationId: orgRef.id,
        updatedAt: serverTimestamp()
      });

      toast.success('Organization created successfully!');
      navigate('/admin/dashboard');
      
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast.error('Failed to create organization. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="setup-step">
      <h2>Organization Details</h2>
      <p className="step-description">Set up your organization's basic information</p>
      
      <div className="form-group">
        <label className="form-label">Organization Name *</label>
        <input
          type="text"
          className="form-input"
          value={organizationData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder="Enter your organization name"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Organization Logo</label>
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          {logoPreview ? (
            <div className="logo-preview">
              <img src={logoPreview} alt="Logo preview" className="preview-image" />
              <p>Click or drag to replace</p>
            </div>
          ) : (
            <div className="dropzone-content">
              <div className="upload-icon">📁</div>
              <p>Drag & drop your logo here, or click to select</p>
              <p className="upload-hint">PNG, JPG, GIF up to 5MB</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="setup-step">
      <h2>Brand Colors</h2>
      <p className="step-description">Choose your organization's theme colors</p>
      
      <div className="color-selection">
        <div className="form-group">
          <label className="form-label">Primary Color</label>
          <div className="color-input-group">
            <input
              type="color"
              value={organizationData.primaryColor}
              onChange={(e) => handleInputChange('primaryColor', e.target.value)}
              className="color-picker"
            />
            <input
              type="text"
              value={organizationData.primaryColor}
              onChange={(e) => handleInputChange('primaryColor', e.target.value)}
              className="color-text-input"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Secondary Color</label>
          <div className="color-input-group">
            <input
              type="color"
              value={organizationData.secondaryColor}
              onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
              className="color-picker"
            />
            <input
              type="text"
              value={organizationData.secondaryColor}
              onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
              className="color-text-input"
            />
          </div>
        </div>
      </div>

      <div className="color-preview">
        <h3>Preview</h3>
        <div className="preview-card" style={{ 
          background: `linear-gradient(135deg, ${organizationData.primaryColor} 0%, ${organizationData.secondaryColor} 100%)` 
        }}>
          <p style={{ color: 'white', margin: 0, padding: '20px' }}>
            Sample card with your brand colors
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="setup-step">
      <h2>Organization Settings</h2>
      <p className="step-description">Configure how your organization operates</p>
      
      <div className="settings-group">
        <div className="setting-item">
          <div className="setting-info">
            <h4>Allow Employee Self-Registration</h4>
            <p>Employees can join your organization by entering a code</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={organizationData.settings.allowSelfRegistration}
              onChange={(e) => handleSettingsChange('allowSelfRegistration', e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <h4>Require Admin Approval</h4>
            <p>New employee registrations need admin approval</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={organizationData.settings.requireApproval}
              onChange={(e) => handleSettingsChange('requireApproval', e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="form-group">
          <label className="form-label">Timezone</label>
          <select
            className="form-input"
            value={organizationData.settings.timezone}
            onChange={(e) => handleSettingsChange('timezone', e.target.value)}
          >
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="America/New_York">America/New_York (EST)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-setup-container">
      <div className="setup-card">
        <div className="setup-header">
          <h1>Set up your Organization</h1>
          <div className="progress-bar">
            <div className="progress-steps">
              {[1, 2, 3].map((step) => (
                <div key={step} className={`step ${currentStep >= step ? 'active' : ''}`}>
                  {step}
                </div>
              ))}
            </div>
            <div className="progress-line">
              <div 
                className="progress-fill" 
                style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="setup-content">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        <div className="setup-actions">
          {currentStep > 1 && (
            <button 
              className="btn btn-secondary"
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              Back
            </button>
          )}
          
          {currentStep < 3 ? (
            <button 
              className="btn"
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={currentStep === 1 && !organizationData.name.trim()}
            >
              Next
            </button>
          ) : (
            <button 
              className="btn"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Organization'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSetup;