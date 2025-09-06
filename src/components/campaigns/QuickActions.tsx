import React from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { Campaign } from '../../store/slices/campaignSlice';
import { toast } from 'react-toastify';

interface QuickActionsProps {
  campaign: Campaign;
  onUpdate?: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ campaign, onUpdate }) => {
  const handleStatusChange = async (newStatus: string) => {
    try {
      const dbInstance = await getFirestoreInstance();
      await updateDoc(doc(dbInstance, 'campaigns', campaign.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      toast.success(`Campaign ${newStatus}!`);
      onUpdate?.();
    } catch (error: any) {
      console.error('Error updating campaign status:', error);
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="quick-actions">
      {campaign.status === 'draft' && (
        <button 
          className="btn-icon" 
          onClick={() => handleStatusChange('active')}
          title="Activate Campaign"
          style={{background: 'var(--success)', color: 'white'}}
        >
          ▶️
        </button>
      )}
      
      {campaign.status === 'active' && (
        <button 
          className="btn-icon" 
          onClick={() => handleStatusChange('completed')}
          title="Complete Campaign"
          style={{background: 'var(--gray-500)', color: 'white'}}
        >
          ⏸️
        </button>
      )}
      
      {(campaign.status === 'active' || campaign.status === 'draft') && (
        <button 
          className="btn-icon" 
          onClick={() => handleStatusChange('cancelled')}
          title="Cancel Campaign"
          style={{background: 'var(--error)', color: 'white'}}
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default QuickActions;