import React, { useState } from 'react';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestoreInstance, getStorageInstance } from '../../config/firebase';
import { Campaign } from '../../store/slices/campaignSlice';
import { toast } from 'react-toastify';
import { useDropzone } from 'react-dropzone';

interface CampaignEditProps {
  campaign: Campaign;
  onClose: () => void;
  onUpdate: () => void;
}

const CampaignEdit: React.FC<CampaignEditProps> = ({ campaign, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [campaignData, setCampaignData] = useState({
    name: campaign.name,
    description: campaign.description,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    status: campaign.status,
    banner: null as File | null
  });
  const [bannerPreview, setBannerPreview] = useState(campaign.banner || '');

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
      
      // Upload new banner if changed
      if (campaignData.banner) {
        const storageInstance = await getStorageInstance();
        const fileName = `${Date.now()}_${campaignData.banner.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const bannerRef = ref(storageInstance, `campaigns/${fileName}`);
        const snapshot = await uploadBytes(bannerRef, campaignData.banner);
        bannerUrl = await getDownloadURL(snapshot.ref);
      }

      const dbInstance = await getFirestoreInstance();
      await updateDoc(doc(dbInstance, 'campaigns', campaign.id), {
        name: campaignData.name,
        description: campaignData.description,
        startDate: campaignData.startDate,
        endDate: campaignData.endDate,
        status: campaignData.status,
        banner: bannerUrl,
        updatedAt: serverTimestamp()
      });

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

  const handleStatusChange = (newStatus: string) => {
    setCampaignData(prev => ({ ...prev, status: newStatus as 'draft' | 'active' | 'completed' | 'cancelled' }));
  };

  return (
    <div className="campaign-edit">
      <div className="edit-header">
        <h2>Edit Campaign</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="edit-content">
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
                  onChange={() => handleStatusChange(status.value)}
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

      <div className="edit-actions">
        <div className="action-group">
          <button 
            className="btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          
          <button 
            className="btn"
            onClick={handleUpdate}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Campaign'}
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

export default CampaignEdit;