import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { useDropzone } from 'react-dropzone';

interface CampaignWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

interface CampaignData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  banner: File | null;
  type: ('sales' | 'calls' | 'meetings' | 'referrals')[];
  metrics: {
    sales?: { target: number; unit: string; };
    calls?: { target: number; unit: string; };
    meetings?: { target: number; unit: string; };
    referrals?: { target: number; unit: string; };
  };
  prizes: {
    position: number;
    title: string;
    description: string;
    image?: File;
  }[];
  participants: string[];
}

const CampaignWizard: React.FC<CampaignWizardProps> = ({ onClose, onComplete }) => {
  const { user, organization } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    banner: null,
    type: [],
    metrics: {},
    prizes: [
      { position: 1, title: 'First Prize', description: '' },
      { position: 2, title: 'Second Prize', description: '' },
      { position: 3, title: 'Third Prize', description: '' }
    ],
    participants: []
  });

  const [bannerPreview, setBannerPreview] = useState<string>('');

  const onBannerDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setCampaignData(prev => ({ ...prev, banner: file }));
      
      const reader = new FileReader();
      reader.onload = () => setBannerPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps: getBannerProps, getInputProps: getBannerInputProps, isDragActive: isBannerDragActive } = useDropzone({
    onDrop: onBannerDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif'] },
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleInputChange = (field: string, value: any) => {
    setCampaignData(prev => ({ ...prev, [field]: value }));
  };

  const handleTypeToggle = (type: 'sales' | 'calls' | 'meetings' | 'referrals') => {
    setCampaignData(prev => ({
      ...prev,
      type: prev.type.includes(type) 
        ? prev.type.filter(t => t !== type)
        : [...prev.type, type]
    }));
  };

  const handleMetricChange = (type: 'sales' | 'calls' | 'meetings' | 'referrals', field: 'target' | 'unit', value: any) => {
    setCampaignData(prev => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        [type]: {
          ...prev.metrics[type],
          [field]: value
        }
      }
    }));
  };

  const handlePrizeChange = (index: number, field: string, value: any) => {
    setCampaignData(prev => ({
      ...prev,
      prizes: prev.prizes.map((prize, i) => 
        i === index ? { ...prize, [field]: value } : prize
      )
    }));
  };

  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        if (!campaignData.name.trim()) {
          toast.error('Campaign name is required');
          return false;
        }
        if (!campaignData.description.trim()) {
          toast.error('Campaign description is required');
          return false;
        }
        break;
      case 2:
        if (!campaignData.startDate || !campaignData.endDate) {
          toast.error('Start and end dates are required');
          return false;
        }
        if (new Date(campaignData.startDate) >= new Date(campaignData.endDate)) {
          toast.error('End date must be after start date');
          return false;
        }
        break;
      case 3:
        if (campaignData.type.length === 0) {
          toast.error('At least one campaign type must be selected');
          return false;
        }
        break;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user || !organization) {
      toast.error('Authentication error');
      return;
    }

    setLoading(true);
    
    try {
      let bannerUrl = '';
      
      if (campaignData.banner) {
        const bannerRef = ref(storage, `campaigns/${Date.now()}_${campaignData.banner.name}`);
        const snapshot = await uploadBytes(bannerRef, campaignData.banner);
        bannerUrl = await getDownloadURL(snapshot.ref);
      }

      // Process metrics to only include selected types
      const processedMetrics: any = {};
      campaignData.type.forEach(type => {
        if (campaignData.metrics[type]) {
          processedMetrics[type] = {
            target: campaignData.metrics[type]!.target || 0,
            achieved: 0
          };
        }
      });

      await addDoc(collection(db, 'campaigns'), {
        name: campaignData.name,
        description: campaignData.description,
        startDate: campaignData.startDate,
        endDate: campaignData.endDate,
        banner: bannerUrl,
        type: campaignData.type,
        metrics: processedMetrics,
        prizes: campaignData.prizes.filter(prize => prize.title && prize.description),
        participants: [],
        orgId: organization.id,
        createdBy: user.uid,
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('Campaign created successfully!');
      onComplete();
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="wizard-step">
      <h2>Campaign Details</h2>
      <p className="step-description">Basic information about your campaign</p>
      
      <div className="form-group">
        <label className="form-label">Campaign Name *</label>
        <input
          type="text"
          className="form-input"
          value={campaignData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder="e.g., Q4 Sales Challenge"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description *</label>
        <textarea
          className="form-input"
          rows={4}
          value={campaignData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="Describe what this campaign is about and what participants need to do..."
        />
      </div>

      <div className="form-group">
        <label className="form-label">Campaign Banner</label>
        <div {...getBannerProps()} className={`dropzone ${isBannerDragActive ? 'active' : ''}`}>
          <input {...getBannerInputProps()} />
          {bannerPreview ? (
            <div className="banner-preview">
              <img src={bannerPreview} alt="Campaign banner" className="preview-image" />
              <p>Click or drag to replace</p>
            </div>
          ) : (
            <div className="dropzone-content">
              <div className="upload-icon">🖼️</div>
              <p>Upload campaign banner</p>
              <p className="upload-hint">PNG, JPG, GIF up to 10MB</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="wizard-step">
      <h2>Timeline</h2>
      <p className="step-description">Set the duration for your campaign</p>
      
      <div className="date-inputs">
        <div className="form-group">
          <label className="form-label">Start Date *</label>
          <input
            type="date"
            className="form-input"
            value={campaignData.startDate}
            onChange={(e) => handleInputChange('startDate', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="form-group">
          <label className="form-label">End Date *</label>
          <input
            type="date"
            className="form-input"
            value={campaignData.endDate}
            onChange={(e) => handleInputChange('endDate', e.target.value)}
            min={campaignData.startDate || new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      {campaignData.startDate && campaignData.endDate && (
        <div className="campaign-duration">
          <h4>Campaign Duration</h4>
          <p>
            {Math.ceil((new Date(campaignData.endDate).getTime() - new Date(campaignData.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
          </p>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="wizard-step">
      <h2>Campaign Types & Metrics</h2>
      <p className="step-description">Choose what activities to track</p>
      
      <div className="campaign-types">
        {[
          { type: 'sales', icon: '💰', label: 'Sales', unit: 'Amount (₹)' },
          { type: 'calls', icon: '📞', label: 'Calls', unit: 'Number of calls' },
          { type: 'meetings', icon: '🤝', label: 'Meetings', unit: 'Number of meetings' },
          { type: 'referrals', icon: '👥', label: 'Referrals', unit: 'Number of referrals' }
        ].map(({ type, icon, label, unit }) => (
          <div key={type} className="campaign-type-card">
            <div className="type-header">
              <label className="type-checkbox">
                <input
                  type="checkbox"
                  checked={campaignData.type.includes(type as any)}
                  onChange={() => handleTypeToggle(type as any)}
                />
                <span className="type-icon">{icon}</span>
                <span className="type-label">{label}</span>
              </label>
            </div>
            
            {campaignData.type.includes(type as any) && (
              <div className="type-metrics">
                <div className="form-group">
                  <label className="form-label">Target</label>
                  <input
                    type="number"
                    className="form-input"
                    value={campaignData.metrics[type as keyof typeof campaignData.metrics]?.target || ''}
                    onChange={(e) => handleMetricChange(type as any, 'target', Number(e.target.value))}
                    placeholder={`Enter target ${unit.toLowerCase()}`}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="wizard-step">
      <h2>Prizes & Rewards</h2>
      <p className="step-description">Define rewards for top performers</p>
      
      <div className="prizes-section">
        {campaignData.prizes.map((prize, index) => (
          <div key={index} className="prize-card">
            <div className="prize-header">
              <span className="prize-position">
                {prize.position === 1 && '🥇'}
                {prize.position === 2 && '🥈'}
                {prize.position === 3 && '🥉'}
                {prize.position} Place
              </span>
            </div>
            
            <div className="prize-form">
              <div className="form-group">
                <label className="form-label">Prize Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={prize.title}
                  onChange={(e) => handlePrizeChange(index, 'title', e.target.value)}
                  placeholder="e.g., Gold Medal + ₹10,000"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={prize.description}
                  onChange={(e) => handlePrizeChange(index, 'description', e.target.value)}
                  placeholder="Detailed description of the prize..."
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="campaign-wizard">
      <div className="wizard-header">
        <h1>Create New Campaign</h1>
        <button className="close-btn" onClick={onClose}>×</button>
        
        <div className="wizard-progress">
          <div className="progress-steps">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className={`progress-step ${currentStep >= step ? 'active' : ''}`}>
                {step}
              </div>
            ))}
          </div>
          <div className="progress-line">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="wizard-content">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>

      <div className="wizard-actions">
        <div className="actions-left">
          {currentStep > 1 && (
            <button className="btn btn-secondary" onClick={prevStep}>
              ← Back
            </button>
          )}
        </div>
        
        <div className="actions-right">
          {currentStep < 4 ? (
            <button className="btn" onClick={nextStep}>
              Next →
            </button>
          ) : (
            <button 
              className="btn" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignWizard;