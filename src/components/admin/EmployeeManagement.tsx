import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { toast } from 'react-toastify';
import AddUser from './AddUser';

interface Employee {
  id: string;
  displayName: string;
  phoneNumber: string;
  joinedAt: string;
  status: 'active' | 'inactive';
  totalAchievements: number;
  currentRank: number;
  designationName?: string;
  finalRegionName?: string;
  regionHierarchy?: Record<number, string>;
}

interface EmployeeManagementProps {
  organizationId: string;
}

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ organizationId }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (deleteConfirm !== userId) {
      setDeleteConfirm(userId);
      setTimeout(() => setDeleteConfirm(null), 3000); // Reset after 3 seconds
      return;
    }

    try {
      const dbInstance = await getFirestoreInstance();
      await deleteDoc(doc(dbInstance, 'users', userId));
      toast.success(`${userName} removed from organization`);
      setDeleteConfirm(null);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const setupEmployeeListener = async (): Promise<(() => void) | undefined> => {
      try {
        const dbInstance = await getFirestoreInstance();
        const employeesQuery = query(
          collection(dbInstance, 'users'),
          where('organizationId', '==', organizationId),
          where('role', '==', 'employee')
        );

        const unsubscribe = onSnapshot(employeesQuery, (snapshot) => {
          const employeeList: Employee[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            employeeList.push({
              id: doc.id,
              displayName: data.displayName || 'Unknown User',
              phoneNumber: data.phoneNumber || '',
              joinedAt: data.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
              status: data.status || 'active',
              totalAchievements: 0,
              currentRank: 0,
              designationName: data.designationName || '',
              finalRegionName: data.finalRegionName || '',
              regionHierarchy: data.regionHierarchy || {}
            });
          });
          
          setEmployees(employeeList);
          setLoading(false);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('Failed to setup employee listener:', error);
        setLoading(false);
        return undefined;
      }
    };
    
    let unsubscribe: (() => void) | null = null;
    setupEmployeeListener().then(unsub => {
      if (unsub) {
        unsubscribe = unsub;
      }
    });
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [organizationId]);

  const filteredEmployees = employees.filter(employee => 
    employee.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.phoneNumber.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="employee-management">
      <div className="content-header">
        <h2>Team Members</h2>
        <button 
          className="btn" 
          onClick={() => setShowAddUserModal(true)}
        >
          + Add User
        </button>
      </div>

      <div className="management-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="team-stats">
          <div className="stat-item">
            <span className="stat-number">{employees.length}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{employees.filter(e => e.status === 'active').length}</span>
            <span className="stat-label">Active</span>
          </div>
        </div>
      </div>

      <div className="employee-grid">
        {filteredEmployees.map((employee) => (
          <div key={employee.id} className="employee-card-compact">
            <div className="employee-main">
              <div className="employee-avatar">
                {employee.displayName.charAt(0)}
              </div>
              <div className="employee-details">
                <div className="employee-name">{employee.displayName}</div>
                <div className="employee-meta">
                  <span className="employee-phone">{employee.phoneNumber}</span>
                  <span className={`status-dot ${employee.status}`}></span>
                </div>
                <div className="employee-tags">
                  {employee.designationName && (
                    <span className="designation-tag">{employee.designationName}</span>
                  )}
                  {employee.finalRegionName && (
                    <span className="region-tag">{employee.finalRegionName}</span>
                  )}
                </div>
              </div>
              <div className="employee-actions-compact">
                <button className="btn-icon-small" title="View Profile">👤</button>
                <button 
                  className={`btn-icon-small btn-danger ${deleteConfirm === employee.id ? 'confirm' : ''}`}
                  onClick={() => handleDeleteUser(employee.id, employee.displayName)}
                  title={deleteConfirm === employee.id ? "Click again to delete" : "Delete user"}
                >
                  {deleteConfirm === employee.id ? '⚠️' : '🗑️'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>
            {searchTerm ? 
              'No employees match your search' : 
              employees.length === 0 ? 
                'No Team Members Yet' : 
                'No matching employees'
            }
          </h3>
          {employees.length === 0 && (
            <>
              <p>Invite employees to join your organization and participate in campaigns.</p>
              <button 
                className="btn" 
                onClick={() => setShowAddUserModal(true)}
                style={{marginTop: '16px'}}
              >
                + Add First User
              </button>
            </>
          )}
        </div>
      )}

      {showAddUserModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <AddUser
              organizationId={organizationId}
              onClose={() => setShowAddUserModal(false)}
              onSuccess={() => {
                setShowAddUserModal(false);
                toast.success('User added successfully!');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;