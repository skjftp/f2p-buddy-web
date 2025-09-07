import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestoreInstance, getStorageInstance } from '../../config/firebase';
import { Campaign } from '../../store/slices/campaignSlice';
import { toast } from 'react-toastify';
import { useDropzone } from 'react-dropzone';
import CampaignTargeting from './CampaignTargeting';
import SkuTargeting from './SkuTargeting';

interface CampaignEditWizardProps {
  campaign: Campaign;
  onClose: () => void;
  onUpdate: () => void;
}

const CampaignEditWizard: React.FC<CampaignEditWizardProps> = ({ campaign, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'skus' | 'targets' | 'regions' | 'contest' | 'prizes' | 'participants'>('basic');
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
  const [campaignData, setCampaignData] = useState({
    name: campaign.name,
    description: campaign.description,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    status: campaign.status,
    banner: null as File | null,
    selectedRegions: [] as string[],
    selectedDesignations: [] as string[],
    regionTargets: [] as any[],
    totalTarget: 0,
    skuTargets: [] as any[],
    volumeTargets: {} as any,
    valueTargets: {} as any,
    activityTargets: {} as any,
    contestType: 'points' as string,
    individualPrizes: [] as any[],
    participantType: 'individual' as string,
    participants: campaign.participants || []
  });

  const [bannerPreview, setBannerPreview] = useState(campaign.banner || '');

  // Load complete campaign data on mount
  useEffect(() => {
    const loadCampaignData = async () => {
      try {
        const dbInstance = await getFirestoreInstance();
        const campaignDoc = await getDoc(doc(dbInstance, 'campaigns', campaign.id));
        
        if (campaignDoc.exists()) {
          const data = campaignDoc.data();
          setCampaignData(prev => ({
            ...prev,
            selectedRegions: data.selectedRegions || [],
            selectedDesignations: data.selectedDesignations || [],
            regionTargets: data.regionTargets || [],
            totalTarget: data.totalTarget || 0,
            skuTargets: data.skuTargets || [],
            volumeTargets: data.volumeTargets || {},
            valueTargets: data.valueTargets || {},
            activityTargets: data.activityTargets || {},
            contestType: data.contestType || 'points',
            individualPrizes: data.individualPrizes || []
          }));
        }
      } catch (error) {
        console.error('Error loading campaign data:', error);
      }
    };

    loadCampaignData();
  }, [campaign.id]);

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

  const handleUpdate = async () => {
    setLoading(true);
    try {
      let bannerUrl = campaign.banner || '';
      
      if (campaignData.banner) {
        const storageInstance = await getStorageInstance();
        const fileName = `${Date.now()}_${campaignData.banner.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const bannerRef = ref(storageInstance, `campaigns/${fileName}`);
        const snapshot = await uploadBytes(bannerRef, campaignData.banner);
        bannerUrl = await getDownloadURL(snapshot.ref);
      }

      const updateData = {
        name: campaignData.name,
        description: campaignData.description,
        startDate: campaignData.startDate,
        endDate: campaignData.endDate,
        status: campaignData.status,
        banner: bannerUrl,
        selectedRegions: campaignData.selectedRegions,
        selectedDesignations: campaignData.selectedDesignations,
        regionTargets: campaignData.regionTargets,
        totalTarget: campaignData.totalTarget,
        skuTargets: campaignData.skuTargets,
        volumeTargets: campaignData.volumeTargets,
        valueTargets: campaignData.valueTargets,
        activityTargets: campaignData.activityTargets,
        contestType: campaignData.contestType,
        individualPrizes: campaignData.individualPrizes,
        participants: campaignData.participants,
        updatedAt: serverTimestamp()
      };

      const dbInstance = await getFirestoreInstance();
      await updateDoc(doc(dbInstance, 'campaigns', campaign.id), updateData);

      toast.success('Campaign updated successfully!');
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error updating campaign:', error);
      toast.error('Failed to update campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setLoading(true);
    try {
      const dbInstance = await getFirestoreInstance();
      await deleteDoc(doc(dbInstance, 'campaigns', campaign.id));
      
      toast.success('Campaign deleted successfully!');
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign');
    } finally {
      setLoading(false);
      setDeleteConfirm(false);
    }
  };

  const handleTargetingChange = (targetingData: any) => {
    setCampaignData(prev => ({
      ...prev,
      selectedRegions: targetingData.selectedRegions,
      selectedDesignations: targetingData.selectedDesignations,
      regionTargets: targetingData.regionTargets,
      totalTarget: targetingData.totalTarget
    }));
  };

  const handleSkuTargetsChange = (skuTargets: any[]) => {
    setCampaignData(prev => ({
      ...prev,
      skuTargets: skuTargets
    }));
  };

  const renderBasicTab = () => (
    <div className="edit-tab-content">
      <div className="form-group">
        <label className="form-label">Campaign Name</label>
        <input
          type="text"
          className="form-input"
          value={campaignData.name}
          onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          className="form-input"
          rows={3}
          value={campaignData.description}
          onChange={(e) => setCampaignData(prev => ({ ...prev, description: e.target.value }))}
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
        <label className="form-label">Campaign Status</label>
        <div className="status-options">
          {[
            { value: 'draft', label: '📝 Draft', desc: 'Campaign not yet active' },
            { value: 'active', label: '🟢 Active', desc: 'Campaign is live and running' },
            { value: 'completed', label: '✅ Completed', desc: 'Campaign has ended' },
            { value: 'cancelled', label: '❌ Cancelled', desc: 'Campaign was cancelled' }
          ].map(status => (
            <label key={status.value} className="status-option">
              <input
                type="radio"
                name="status"
                value={status.value}
                checked={campaignData.status === status.value}
                onChange={() => setCampaignData(prev => ({ ...prev, status: status.value as any }))}
              />
              <div className="status-content">
                <strong>{status.label}</strong>
                <p>{status.desc}</p>
              </div>
            </label>
          ))}
        </div>
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
              <p style={{marginTop: '8px', fontSize: '12px', color: 'var(--gray-500)'}}>Click to change</p>
            </div>
          ) : (
            <div style={{textAlign: 'center', padding: '20px'}}>
              <div style={{fontSize: '32px', marginBottom: '8px'}}>📸</div>
              <p>Drop banner image here or click to select</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSkuTab = () => (
    <div className="edit-tab-content">
      <div className="section-header">
        <h3>📦 SKU Selection</h3>
        <p>Modify which SKUs are included in this campaign</p>
      </div>
      <div className="coming-soon">
        <p>SKU editing coming soon. Use current campaign creation for SKU management.</p>
      </div>
    </div>
  );

  const renderTargetsTab = () => (
    <div className="edit-tab-content">
      <div className="section-header">
        <h3>🎯 Target Metrics Configuration</h3>
        <p>Edit target values and types for selected SKUs</p>
      </div>
      <div className="coming-soon">
        <p>Target metrics editing coming soon. Use current campaign creation for target management.</p>
      </div>
    </div>
  );

  const renderRegionsTab = () => (
    <CampaignTargeting
      organizationId={campaign.orgId}
      onTargetingChange={handleTargetingChange}
    />
  );

  const renderContestTab = () => (
    <div className="edit-tab-content">
      <div className="section-header">
        <h3>🏆 Contest Structure</h3>
        <p>Edit contest type and point/milestone configuration</p>
      </div>
      <div className="coming-soon">
        <p>Contest structure editing coming soon. Use current campaign creation for contest management.</p>
      </div>
    </div>
  );

  const renderPrizesTab = () => (
    <div className="edit-tab-content">
      <div className="section-header">
        <h3>🎁 Prize Structure</h3>
        <p>Edit prize configuration for different levels</p>
      </div>
      <div className="coming-soon">
        <p>Prize structure editing coming soon. Use current campaign creation for prize management.</p>
      </div>
    </div>
  );

  const renderSkuTab_Old = () => (
    <SkuTargeting
      organizationId={campaign.orgId}
      selectedRegions={campaignData.selectedRegions}
      onSkuTargetsChange={handleSkuTargetsChange}
    />
  );

  return (
    <div className="campaign-edit-wizard">
      <div className="edit-wizard-header">
        <h2>Edit Campaign: {campaign.name}</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="edit-wizard-tabs">
        <button 
          className={`edit-tab ${activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveTab('basic')}
        >
          📋 Campaign Info
        </button>
        <button 
          className={`edit-tab ${activeTab === 'skus' ? 'active' : ''}`}
          onClick={() => setActiveTab('skus')}
        >
          📦 SKU Selection
        </button>
        <button 
          className={`edit-tab ${activeTab === 'targets' ? 'active' : ''}`}
          onClick={() => setActiveTab('targets')}
        >
          🎯 Target Metrics
        </button>
        <button 
          className={`edit-tab ${activeTab === 'regions' ? 'active' : ''}`}
          onClick={() => setActiveTab('regions')}
        >
          🗺️ Regional Targeting
        </button>
        <button 
          className={`edit-tab ${activeTab === 'contest' ? 'active' : ''}`}
          onClick={() => setActiveTab('contest')}
        >
          🏆 Contest Structure
        </button>
        <button 
          className={`edit-tab ${activeTab === 'prizes' ? 'active' : ''}`}
          onClick={() => setActiveTab('prizes')}
        >
          🎁 Prize Structure
        </button>
        <button 
          className={`edit-tab ${activeTab === 'participants' ? 'active' : ''}`}
          onClick={() => setActiveTab('participants')}
        >
          👥 User Targets
        </button>
      </div>

      <div className="edit-wizard-content">
        {activeTab === 'basic' && renderBasicTab()}
        {activeTab === 'skus' && renderSkuTab()}
        {activeTab === 'targets' && renderTargetsTab()}
        {activeTab === 'regions' && renderRegionsTab()}
        {activeTab === 'contest' && renderContestTab()}
        {activeTab === 'prizes' && renderPrizesTab()}
        {activeTab === 'participants' && (
          <div className="participants-tab">
            <h3>Campaign Participants</h3>
            <p>Manage who can participate in this campaign</p>
            
            <div className="participants-list">
              <div className="participants-count">
                <strong>Current Participants: {campaignData.participants.length}</strong>
              </div>
              
              {campaignData.participants.length === 0 ? (
                <div className="empty-participants">
                  <p>No participants added yet. Participants will be auto-assigned based on regional and designation targeting.</p>
                </div>
              ) : (
                <div className="participant-items">
                  {campaignData.participants.map((participantId, index) => (
                    <div key={index} className="participant-item">
                      <span>Participant {participantId}</span>
                      <button 
                        className="btn-icon-small btn-danger"
                        onClick={() => {
                          setCampaignData(prev => ({
                            ...prev,
                            participants: prev.participants.filter(p => p !== participantId)
                          }));
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="edit-wizard-actions">
        <div className="action-group">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          
          <button 
            className="btn"
            onClick={handleUpdate}
            disabled={loading}
          >
            {loading ? 'Updating...' : '💾 Update Campaign'}
          </button>
        </div>
        
        <div className="danger-zone">
          <button 
            className={`btn-danger ${deleteConfirm ? 'confirm' : ''}`}
            onClick={handleDelete}
            disabled={loading}
          >
            {deleteConfirm ? 'Click Again to Delete' : '🗑️ Delete Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignEditWizard;