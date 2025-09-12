import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'warning' | 'danger' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return '🗑️';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '⚠️';
    }
  };

  return (
    <div className="confirm-dialog-overlay">
      <div className="confirm-dialog">
        <div className="confirm-dialog-header">
          <div className={`confirm-icon ${type}`}>
            {getIcon()}
          </div>
          <h3>{title}</h3>
        </div>
        
        <div className="confirm-dialog-content">
          <p>{message}</p>
        </div>
        
        <div className="confirm-dialog-actions">
          <button className="btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-warning'}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;