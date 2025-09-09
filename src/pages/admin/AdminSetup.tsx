import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { toast } from 'react-toastify';
import { useDropzone } from 'react-dropzone';

// Helper function to compress and convert image to base64
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
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Convert to base64 with compression
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7); // 70% quality
      resolve(compressedBase64);
    };
    
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

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
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.svg']
    },
    multiple: false,
    maxSize: 500 * 1024, // 500KB max for Firestore compatibility
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
      
      // Convert logo to base64 data URL if provided (temporary CORS workaround)
      if (organizationData.logo) {
        // Stricter file size limits for Firestore compatibility
        const maxSize = organizationData.logo.type === 'image/svg+xml' ? 50 * 1024 : 500 * 1024; // 50KB for SVG, 500KB for others
        if (organizationData.logo.size > maxSize) {
          const sizeLimit = organizationData.logo.type === 'image/svg+xml' ? '50KB' : '500KB';
          toast.error(`Logo file size must be less than ${sizeLimit}`);
          return;
        }
        
        try {
          logoUrl = await compressAndConvertToBase64(organizationData.logo);
          console.log('✅ Logo processed, base64 size:', Math.round(logoUrl.length / 1024), 'KB');
          
          // Strict check for base64 size (Firestore document limit is ~1MB total)
          if (logoUrl.length > 200 * 1024) { // 200KB limit for base64 to leave room for other fields
            console.warn('Logo too large after processing, proceeding without logo');
            toast.warning('Logo is too large. Organization will be created without logo. You can add a logo later.');
            logoUrl = ''; // Skip the logo
          }
        } catch (error) {
          console.error('❌ Failed to process logo:', error);
          toast.warning('Failed to process logo image. Organization will be created without logo.');
          logoUrl = ''; // Proceed without logo
        }
      }

      // Create organization
      const dbInstance = await getFirestoreInstance();
      console.log('🏢 Creating organization with data:', {
        name: organizationData.name,
        adminId: user.uid,
        logoSize: logoUrl.length,
        settings: organizationData.settings
      });
      
      // Try creating organization (with fallback for serverTimestamp issues)
      let orgRef;
      try {
        orgRef = await addDoc(collection(dbInstance, 'organizations'), {
          name: organizationData.name,
          logo: logoUrl,
          primaryColor: organizationData.primaryColor,
          secondaryColor: organizationData.secondaryColor,
          adminId: user.uid,
          settings: organizationData.settings,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (timestampError: any) {
        console.warn('⚠️ ServerTimestamp failed, trying with regular timestamp:', timestampError);
        // Fallback without serverTimestamp
        orgRef = await addDoc(collection(dbInstance, 'organizations'), {
          name: organizationData.name,
          logo: logoUrl,
          primaryColor: organizationData.primaryColor,
          secondaryColor: organizationData.secondaryColor,
          adminId: user.uid,
          settings: organizationData.settings,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      console.log('✅ Organization created successfully:', orgRef.id);

      // Update user with organization ID - use the same logic as AuthContext
      // First try phone number, then fallback to UID (matching AuthContext.tsx logic)
      let userDocId = user.phoneNumber || user.uid;
      
      console.log('📝 Attempting to update user document:', userDocId, 'with orgId:', orgRef.id);
      
      // Check if phone-based document exists first
      try {
        const phoneDocRef = doc(dbInstance, 'users', user.phoneNumber || '');
        const phoneDoc = await getDoc(phoneDocRef);
        
        if (!phoneDoc.exists() && user.phoneNumber) {
          console.log('📞 Phone-based document not found, trying UID-based document');
          userDocId = user.uid; // Fallback to UID
        }
      } catch (checkError) {
        console.log('📞 Error checking phone document, using UID:', checkError);
        userDocId = user.uid;
      }
      
      try {
        await updateDoc(doc(dbInstance, 'users', userDocId), {
          organizationId: orgRef.id,
          updatedAt: serverTimestamp()
        });
      } catch (updateError: any) {
        console.warn('⚠️ User update with serverTimestamp failed, trying regular timestamp:', updateError);
        await updateDoc(doc(dbInstance, 'users', userDocId), {
          organizationId: orgRef.id,
          updatedAt: new Date().toISOString()
        });
      }
      
      console.log('✅ User document updated successfully');

      toast.success('Organization created successfully!');
      navigate('/admin/dashboard');
      
    } catch (error: any) {
      console.error('❌ Error creating organization:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // More specific error messages
      if (error.code === 'permission-denied') {
        toast.error('Permission denied. Please ensure you have admin privileges.');
      } else if (error.code === 'invalid-argument') {
        toast.error('Invalid data format. Please try without logo or with a smaller image.');
      } else if (error.code === 'resource-exhausted') {
        toast.error('Document too large. Please use a smaller logo.');
      } else {
        toast.error(`Failed to create organization: ${error.message}`);
      }
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
              <p className="upload-hint">PNG, JPG, GIF up to 500KB, SVG up to 50KB</p>
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