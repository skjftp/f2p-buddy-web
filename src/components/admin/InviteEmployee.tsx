import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { toast } from 'react-toastify';

interface InviteEmployeeProps {
  organizationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const InviteEmployee: React.FC<InviteEmployeeProps> = ({ organizationId, onClose, onSuccess }) => {
  const [inviteData, setInviteData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    department: '',
    designation: '',
    territory: ''
  });
  const [loading, setLoading] = useState(false);
  const [inviteType, setInviteType] = useState<'single' | 'bulk'>('single');

  const handleInvite = async () => {
    if (!inviteData.name || !inviteData.phoneNumber) {
      toast.error('Name and phone number are required');
      return;
    }

    setLoading(true);
    try {
      const dbInstance = await getFirestoreInstance();
      
      // Create invitation record
      await addDoc(collection(dbInstance, 'invitations'), {
        organizationId: organizationId,
        name: inviteData.name,
        phoneNumber: inviteData.phoneNumber,
        email: inviteData.email,
        department: inviteData.department,
        designation: inviteData.designation,
        territory: inviteData.territory,
        status: 'pending',
        invitedAt: serverTimestamp(),
        invitedBy: 'admin' // Could get from auth context
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast.error('Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = () => {
    toast.info('Bulk upload feature coming soon!');
  };

  return (
    <div className="invite-employee">
      <div className="invite-header">
        <h2>Invite Employee</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="invite-content">
        <div className="invite-type-selector">
          <button 
            className={`type-btn ${inviteType === 'single' ? 'active' : ''}`}
            onClick={() => setInviteType('single')}
          >
            👤 Single Invite
          </button>
          <button 
            className={`type-btn ${inviteType === 'bulk' ? 'active' : ''}`}
            onClick={() => setInviteType('bulk')}
          >
            📊 Bulk Upload
          </button>
        </div>

        {inviteType === 'single' ? (
          <div className="single-invite-form">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                value={inviteData.name}
                onChange={(e) => setInviteData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter employee name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="tel"
                className="form-input"
                value={inviteData.phoneNumber}
                onChange={(e) => setInviteData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email (Optional)</label>
              <input
                type="email"
                className="form-input"
                value={inviteData.email}
                onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="employee@company.com"
              />
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input
                  type="text"
                  className="form-input"
                  value={inviteData.department}
                  onChange={(e) => setInviteData(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="Sales, Marketing, etc."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Designation</label>
                <input
                  type="text"
                  className="form-input"
                  value={inviteData.designation}
                  onChange={(e) => setInviteData(prev => ({ ...prev, designation: e.target.value }))}
                  placeholder="Sales Executive, Manager, etc."
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Territory</label>
              <input
                type="text"
                className="form-input"
                value={inviteData.territory}
                onChange={(e) => setInviteData(prev => ({ ...prev, territory: e.target.value }))}
                placeholder="North Zone, Mumbai, etc."
              />
            </div>
          </div>
        ) : (
          <div className="bulk-invite-form">
            <div className="upload-area">
              <div className="upload-icon">📊</div>
              <h4>Upload Employee List</h4>
              <p>Upload an Excel file with employee details</p>
              <div className="file-format">
                <strong>Required columns:</strong> Name, Phone, Email, Department, Designation, Territory
              </div>
              <button 
                className="btn"
                onClick={handleBulkUpload}
                style={{marginTop: '16px'}}
              >
                📁 Choose Excel File
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="invite-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        
        {inviteType === 'single' && (
          <button 
            className="btn" 
            onClick={handleInvite}
            disabled={loading || !inviteData.name || !inviteData.phoneNumber}
          >
            {loading ? 'Sending Invite...' : '📤 Send Invitation'}
          </button>
        )}
      </div>
    </div>
  );
};

export default InviteEmployee;