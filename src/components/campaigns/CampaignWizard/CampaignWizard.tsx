import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestoreInstance, getStorageInstance } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { useDropzone } from 'react-dropzone';

interface CampaignWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

interface CampaignData {
  // Step 1: Basic Info
  name: string;
  startDate: string;
  endDate: string;
  description: string;
  banner: File | null;
  
  // Step 2: Campaign Type
  geographic: string[];
  hierarchy: string[];
  channel: string[];
  
  // Step 3: Target Metrics
  volumeTargets: {
    units?: number;
    cases?: number;
  };
  valueTargets: {
    revenue?: number;
    collection?: number;
  };
  productTargets: {
    skuWise?: boolean;
    categoryWise?: boolean;
    brandWise?: boolean;
  };
  activityTargets: {
    pc?: number;
    orderEntry?: number;
    primarySales?: number;
    secondarySales?: number;
    tertiarySales?: number;
    clearSales?: number;
    newOutlets?: number;
    displayCompliance?: number;
  };
  
  // Step 4: Contest Structure
  contestType: 'points' | 'milestone' | 'percentage' | 'ranking' | 'slab';
  pointValues: Record<string, number>;
  milestones: Array<{name: string, target: number, reward: string}>;
  
  // Step 5: Prizes
  individualPrizes: Array<{
    rank: number;
    type: 'cash' | 'voucher' | 'gadget' | 'trip';
    value: string;
    description: string;
  }>;
  teamPrizes: Array<{
    rank: number;
    type: string;
    value: string;
    description: string;
  }>;
  recognition: Array<{
    type: 'certificate' | 'trophy' | 'badge';
    criteria: string;
    description: string;
  }>;
  
  // Step 6: Participants
  participantType: 'bulk' | 'individual' | 'auto';
  participants: string[];
  hierarchyFilter: string[];
  geographyFilter: string[];
}

const CampaignWizard: React.FC<CampaignWizardProps> = ({ onClose, onComplete }) => {
  const { user, organization } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    startDate: '',
    endDate: '',
    description: '',
    banner: null,
    geographic: [],
    hierarchy: [],
    channel: [],
    volumeTargets: {},
    valueTargets: {},
    productTargets: {},
    activityTargets: {},
    contestType: 'points',
    pointValues: {},
    milestones: [],
    individualPrizes: [],
    teamPrizes: [],
    recognition: [],
    participantType: 'individual',
    participants: [],
    hierarchyFilter: [],
    geographyFilter: []
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onBannerDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif'] },
    multiple: false,
    maxSize: 10 * 1024 * 1024,
  });

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 6));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    if (!user || !organization) {
      toast.error('Authentication error - Please login again');
      return;
    }

    if (!campaignData.name || !campaignData.startDate || !campaignData.endDate) {
      toast.error('Please fill in required fields: name, start date, end date');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting campaign creation...', {
        user: user.uid,
        organization: organization.id,
        campaignName: campaignData.name
      });

      let bannerUrl = '';
      
      if (campaignData.banner) {
        console.log('Uploading banner...');
        const storageInstance = await getStorageInstance();
        // Use timestamp-based naming which is now allowed by storage rules
        const bannerRef = ref(storageInstance, `campaigns/${Date.now()}_${campaignData.banner.name}`);
        const snapshot = await uploadBytes(bannerRef, campaignData.banner);
        bannerUrl = await getDownloadURL(snapshot.ref);
        console.log('Banner uploaded:', bannerUrl);
      }

      console.log('Creating campaign document...');
      const dbInstance = await getFirestoreInstance();
      
      // Simplified campaign data for Firestore compatibility
      const simplifiedCampaignData = {
        name: campaignData.name,
        startDate: campaignData.startDate,
        endDate: campaignData.endDate,
        description: campaignData.description,
        banner: bannerUrl,
        
        // Convert complex objects to simple format
        geographic: campaignData.geographic,
        hierarchy: campaignData.hierarchy,
        channel: campaignData.channel,
        contestType: campaignData.contestType,
        
        // Basic metrics for compatibility with existing structure
        type: [], // Empty for now, will be populated based on targets
        metrics: {},
        prizes: campaignData.individualPrizes.map(prize => ({
          position: prize.rank,
          title: `${prize.type} Prize`,
          description: prize.description
        })),
        participants: campaignData.participants,
        
        // Required fields
        orgId: organization.id,
        createdBy: user.uid,
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(dbInstance, 'campaigns'), simplifiedCampaignData);
      console.log('Campaign created successfully:', docRef.id);

      toast.success('Campaign created successfully!');
      onComplete();
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      
      // More detailed error reporting
      if (error.code === 'permission-denied') {
        toast.error('Permission denied - Check your admin access');
      } else if (error.code === 'unavailable') {
        toast.error('Database connection issue - Please try again');
      } else if (error.message?.includes('offline')) {
        toast.error('You appear to be offline - Check your connection');
      } else {
        toast.error(`Campaign creation failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="wizard-step">
      <h2>Campaign Information</h2>
      <p className="step-description">Basic details about your sales incentive campaign</p>
      
      <div className="form-group">
        <label className="form-label">Campaign Name</label>
        <input
          type="text"
          className="form-input"
          value={campaignData.name}
          onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Q4 Sales Blitz, Diwali Bonanza"
        />
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
        <div className="form-group">
          <label className="form-label">Start Date</label>
          <input
            type="date"
            className="form-input"
            value={campaignData.startDate}
            onChange={(e) => setCampaignData(prev => ({ ...prev, startDate: e.target.value }))}
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">End Date</label>
          <input
            type="date"
            className="form-input"
            value={campaignData.endDate}
            onChange={(e) => setCampaignData(prev => ({ ...prev, endDate: e.target.value }))}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          className="form-input"
          rows={3}
          value={campaignData.description}
          onChange={(e) => setCampaignData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe the campaign objectives and motivation for participants..."
        />
      </div>

      <div className="form-group">
        <label className="form-label">Campaign Banner</label>
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          {bannerPreview ? (
            <div className="banner-preview" style={{textAlign: 'center'}}>
              <img 
                src={bannerPreview} 
                alt="Banner preview" 
                style={{
                  width: '200px', 
                  height: '100px', 
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '2px solid var(--gray-200)'
                }} 
              />
              <p style={{marginTop: '8px', fontSize: '12px', color: 'var(--gray-500)'}}>Click to replace</p>
            </div>
          ) : (
            <div style={{textAlign: 'center', padding: '20px'}}>
              <div style={{fontSize: '32px', marginBottom: '8px'}}>📸</div>
              <p>Drop banner image here or click to select</p>
              <p style={{fontSize: '12px', color: 'var(--gray-500)'}}>PNG, JPG, GIF up to 10MB</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="wizard-step">
      <h2>Campaign Type Selection</h2>
      <p className="step-description">Define the scope and targeting for this campaign</p>
      
      <div className="campaign-types">
        <div className="type-section">
          <h4>Geographic Scope</h4>
          <div className="checkbox-group">
            {['Zonal', 'Regional', 'District', 'Territory', 'City-wise'].map(option => (
              <label key={option} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={campaignData.geographic.includes(option)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCampaignData(prev => ({
                        ...prev,
                        geographic: [...prev.geographic, option]
                      }));
                    } else {
                      setCampaignData(prev => ({
                        ...prev,
                        geographic: prev.geographic.filter(item => item !== option)
                      }));
                    }
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="type-section">
          <h4>Hierarchy Level</h4>
          <div className="checkbox-group">
            {['Individual Sales Person', 'Sales Team', 'ASM Level', 'RSM Level'].map(option => (
              <label key={option} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={campaignData.hierarchy.includes(option)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCampaignData(prev => ({
                        ...prev,
                        hierarchy: [...prev.hierarchy, option]
                      }));
                    } else {
                      setCampaignData(prev => ({
                        ...prev,
                        hierarchy: prev.hierarchy.filter(item => item !== option)
                      }));
                    }
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="type-section">
          <h4>Channel Type</h4>
          <div className="checkbox-group">
            {['Distributor', 'Retailer', 'Dealer', 'Direct Sales'].map(option => (
              <label key={option} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={campaignData.channel.includes(option)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCampaignData(prev => ({
                        ...prev,
                        channel: [...prev.channel, option]
                      }));
                    } else {
                      setCampaignData(prev => ({
                        ...prev,
                        channel: prev.channel.filter(item => item !== option)
                      }));
                    }
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="wizard-step">
      <h2>Target Metrics Configuration</h2>
      <p className="step-description">Set targets for different sales metrics</p>
      
      <div className="metrics-configuration">
        <div className="metric-section">
          <h4>📦 Volume-based Targets</h4>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
            <div className="form-group">
              <label className="form-label">Units Sold</label>
              <input
                type="number"
                className="form-input"
                value={campaignData.volumeTargets.units || ''}
                onChange={(e) => setCampaignData(prev => ({
                  ...prev,
                  volumeTargets: { ...prev.volumeTargets, units: parseInt(e.target.value) || 0 }
                }))}
                placeholder="Target units"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Cases Moved</label>
              <input
                type="number"
                className="form-input"
                value={campaignData.volumeTargets.cases || ''}
                onChange={(e) => setCampaignData(prev => ({
                  ...prev,
                  volumeTargets: { ...prev.volumeTargets, cases: parseInt(e.target.value) || 0 }
                }))}
                placeholder="Target cases"
              />
            </div>
          </div>
        </div>

        <div className="metric-section">
          <h4>💰 Value-based Targets</h4>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
            <div className="form-group">
              <label className="form-label">Revenue Target (₹)</label>
              <input
                type="number"
                className="form-input"
                value={campaignData.valueTargets.revenue || ''}
                onChange={(e) => setCampaignData(prev => ({
                  ...prev,
                  valueTargets: { ...prev.valueTargets, revenue: parseInt(e.target.value) || 0 }
                }))}
                placeholder="Revenue target"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Collection Target (₹)</label>
              <input
                type="number"
                className="form-input"
                value={campaignData.valueTargets.collection || ''}
                onChange={(e) => setCampaignData(prev => ({
                  ...prev,
                  valueTargets: { ...prev.valueTargets, collection: parseInt(e.target.value) || 0 }
                }))}
                placeholder="Collection target"
              />
            </div>
          </div>
        </div>

        <div className="metric-section">
          <h4>🎯 Activity-based Targets</h4>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
            <div className="form-group">
              <label className="form-label">PC Achievement</label>
              <input
                type="number"
                className="form-input"
                value={campaignData.activityTargets.pc || ''}
                onChange={(e) => setCampaignData(prev => ({
                  ...prev,
                  activityTargets: { ...prev.activityTargets, pc: parseInt(e.target.value) || 0 }
                }))}
                placeholder="Productive calls"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Order Entry %</label>
              <input
                type="number"
                className="form-input"
                value={campaignData.activityTargets.orderEntry || ''}
                onChange={(e) => setCampaignData(prev => ({
                  ...prev,
                  activityTargets: { ...prev.activityTargets, orderEntry: parseInt(e.target.value) || 0 }
                }))}
                placeholder="Order percentage"
              />
            </div>
            <div className="form-group">
              <label className="form-label">New Outlets</label>
              <input
                type="number"
                className="form-input"
                value={campaignData.activityTargets.newOutlets || ''}
                onChange={(e) => setCampaignData(prev => ({
                  ...prev,
                  activityTargets: { ...prev.activityTargets, newOutlets: parseInt(e.target.value) || 0 }
                }))}
                placeholder="New outlet targets"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Display Compliance %</label>
              <input
                type="number"
                className="form-input"
                value={campaignData.activityTargets.displayCompliance || ''}
                onChange={(e) => setCampaignData(prev => ({
                  ...prev,
                  activityTargets: { ...prev.activityTargets, displayCompliance: parseInt(e.target.value) || 0 }
                }))}
                placeholder="Display compliance"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="wizard-step">
      <h2>Contest Structure</h2>
      <p className="step-description">Configure how participants earn points and rewards</p>
      
      <div className="contest-types">
        <h4>Contest Type</h4>
        <div className="radio-group">
          {[
            { value: 'points', label: 'Point-based System', desc: 'Earn points for each achievement' },
            { value: 'milestone', label: 'Milestone-based', desc: 'Unlock rewards at specific targets' },
            { value: 'percentage', label: 'Percentage Achievement', desc: 'Rewards based on target completion %' },
            { value: 'ranking', label: 'Leaderboard Ranking', desc: 'Top performers win prizes' },
            { value: 'slab', label: 'Slab-based', desc: 'Different rewards for different achievement levels' }
          ].map(option => (
            <label key={option.value} className="radio-item">
              <input
                type="radio"
                name="contestType"
                value={option.value}
                checked={campaignData.contestType === option.value}
                onChange={(e) => setCampaignData(prev => ({ ...prev, contestType: e.target.value as any }))}
              />
              <div className="radio-content">
                <strong>{option.label}</strong>
                <p>{option.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="wizard-step">
      <h2>Prize & Reward Structure</h2>
      <p className="step-description">Configure rewards to motivate your team</p>
      
      <div className="prize-sections">
        <div className="prize-section">
          <h4>🏆 Individual Prizes</h4>
          <div className="prize-grid">
            {[1, 2, 3].map(rank => (
              <div key={rank} className="prize-card">
                <h5>#{rank} Position</h5>
                <div className="form-group">
                  <select 
                    className="form-input"
                    value={campaignData.individualPrizes.find(p => p.rank === rank)?.type || ''}
                    onChange={(e) => {
                      const newPrizes = [...campaignData.individualPrizes];
                      const existingIndex = newPrizes.findIndex(p => p.rank === rank);
                      if (existingIndex >= 0) {
                        newPrizes[existingIndex].type = e.target.value as any;
                      } else {
                        newPrizes.push({ rank, type: e.target.value as any, value: '', description: '' });
                      }
                      setCampaignData(prev => ({ ...prev, individualPrizes: newPrizes }));
                    }}
                  >
                    <option value="">Select prize type</option>
                    <option value="cash">💰 Cash</option>
                    <option value="voucher">🎫 Voucher</option>
                    <option value="gadget">📱 Gadget</option>
                    <option value="trip">✈️ Trip</option>
                  </select>
                </div>
                <div className="form-group">
                  <input
                    className="form-input"
                    placeholder="Prize value/description"
                    value={campaignData.individualPrizes.find(p => p.rank === rank)?.description || ''}
                    onChange={(e) => {
                      const newPrizes = [...campaignData.individualPrizes];
                      const existingIndex = newPrizes.findIndex(p => p.rank === rank);
                      if (existingIndex >= 0) {
                        newPrizes[existingIndex].description = e.target.value;
                      }
                      setCampaignData(prev => ({ ...prev, individualPrizes: newPrizes }));
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="wizard-step">
      <h2>Participant Management</h2>
      <p className="step-description">Add participants to this campaign</p>
      
      <div className="participant-options">
        <h4>How do you want to add participants?</h4>
        <div className="radio-group">
          {[
            { value: 'individual', label: '👤 Individual Addition', desc: 'Add participants one by one via mobile number' },
            { value: 'bulk', label: '📊 Bulk Upload', desc: 'Upload Excel file with participant details' },
            { value: 'auto', label: '🎯 Auto-assign', desc: 'Automatically assign based on hierarchy/geography' }
          ].map(option => (
            <label key={option.value} className="radio-item">
              <input
                type="radio"
                name="participantType"
                value={option.value}
                checked={campaignData.participantType === option.value}
                onChange={(e) => setCampaignData(prev => ({ ...prev, participantType: e.target.value as any }))}
              />
              <div className="radio-content">
                <strong>{option.label}</strong>
                <p>{option.desc}</p>
              </div>
            </label>
          ))}
        </div>
        
        {campaignData.participantType === 'individual' && (
          <div className="form-group">
            <label className="form-label">Mobile Numbers (one per line)</label>
            <textarea
              className="form-input"
              rows={5}
              placeholder="+919876543210&#10;+919876543211&#10;+919876543212"
              onChange={(e) => {
                const phones = e.target.value.split('\n').filter(phone => phone.trim());
                setCampaignData(prev => ({ ...prev, participants: phones }));
              }}
            />
          </div>
        )}
        
        {campaignData.participantType === 'bulk' && (
          <div className="upload-section">
            <div style={{background: 'var(--gray-100)', padding: '16px', borderRadius: 'var(--radius-md)', textAlign: 'center'}}>
              <div style={{fontSize: '24px', marginBottom: '8px'}}>📊</div>
              <p>Upload Excel file with columns: Name, Mobile, Territory, Team</p>
              <button className="btn" style={{marginTop: '12px'}}>
                📁 Choose File
              </button>
            </div>
          </div>
        )}
        
        {campaignData.participantType === 'auto' && (
          <div>
            <div className="form-group">
              <label className="form-label">Hierarchy Filter</label>
              <select multiple className="form-input" style={{height: '100px'}}>
                <option value="asm">ASM Level</option>
                <option value="rsm">RSM Level</option>
                <option value="sales-team">Sales Team</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Geography Filter</label>
              <select multiple className="form-input" style={{height: '100px'}}>
                <option value="north">North Zone</option>
                <option value="south">South Zone</option>
                <option value="east">East Zone</option>
                <option value="west">West Zone</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="campaign-wizard">
      <div className="wizard-header">
        <h1>Create Sales Campaign</h1>
        <button className="close-btn" onClick={onClose}>×</button>
        
        {/* Debug info - remove in production */}
        {(!user || !organization) && (
          <div style={{background: 'rgba(255,0,0,0.2)', padding: '8px', borderRadius: '4px', fontSize: '12px', marginTop: '8px'}}>
            Debug: User={user?.uid || 'null'}, Org={organization?.id || 'null'}
          </div>
        )}
        
        <div className="progress-steps">
          {[1, 2, 3, 4, 5, 6].map((step) => (
            <div key={step} className={`step ${currentStep >= step ? 'active' : ''}`}>
              {step}
            </div>
          ))}
        </div>
      </div>

      <div className="wizard-content">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
        {currentStep === 6 && renderStep6()}
      </div>

      <div className="wizard-actions">
        <div>
          {currentStep > 1 && (
            <button className="btn-secondary" onClick={prevStep}>
              ← Back
            </button>
          )}
        </div>
        <div>
          {currentStep < 6 ? (
            <button className="btn" onClick={nextStep}>
              Next →
            </button>
          ) : (
            <button className="btn" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Creating...' : '🚀 Create Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignWizard;