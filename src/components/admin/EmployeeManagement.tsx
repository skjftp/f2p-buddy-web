import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';
import { toast } from 'react-toastify';
import InviteEmployee from './InviteEmployee';

interface Employee {
  id: string;
  displayName: string;
  phoneNumber: string;
  joinedAt: string;
  status: 'active' | 'inactive';
  totalAchievements: number;
  currentRank: number;
}

interface EmployeeManagementProps {
  organizationId: string;
}

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ organizationId }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

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
              status: 'active',
              totalAchievements: 0,
              currentRank: 0
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
          onClick={() => setShowInviteModal(true)}
        >
          + Invite Employee
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
          <div key={employee.id} className="employee-card">
            <div className="employee-header">
              <div className="employee-avatar">
                {employee.displayName.charAt(0)}
              </div>
              <div className="employee-info">
                <h3 className="employee-name">{employee.displayName}</h3>
                <p className="employee-phone">{employee.phoneNumber}</p>
              </div>
              <div className="employee-status">
                <span className={`status-badge ${employee.status}`}>
                  {employee.status === 'active' ? '🟢' : '🔴'} {employee.status}
                </span>
              </div>
            </div>
            
            <div className="employee-stats">
              <div className="stat-row">
                <span className="stat-label">Achievements</span>
                <span className="stat-value">{employee.totalAchievements}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Current Rank</span>
                <span className="stat-value">
                  {employee.currentRank > 0 ? `#${employee.currentRank}` : 'Unranked'}
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Joined</span>
                <span className="stat-value">
                  {new Date(employee.joinedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="employee-actions">
              <button className="btn-icon" title="View Profile">👤</button>
              <button className="btn-icon" title="Send Message">💬</button>
              <button className="btn-icon" title="More Options">⋯</button>
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
                onClick={() => setShowInviteModal(true)}
                style={{marginTop: '16px'}}
              >
                + Invite First Employee
              </button>
            </>
          )}
        </div>
      )}

      {showInviteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <InviteEmployee
              organizationId={organizationId}
              onClose={() => setShowInviteModal(false)}
              onSuccess={() => {
                setShowInviteModal(false);
                toast.success('Employee invited successfully!');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;