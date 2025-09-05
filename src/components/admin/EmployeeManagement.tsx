import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getFirestoreInstance } from '../../config/firebase';

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    if (!organizationId) {
      // Show placeholder data
      const placeholderEmployees: Employee[] = [
        {
          id: '1',
          displayName: 'John Smith',
          phoneNumber: '+91 98765 43210',
          joinedAt: new Date(Date.now() - 2592000000).toISOString(),
          status: 'active',
          totalAchievements: 12,
          currentRank: 1
        },
        {
          id: '2',
          displayName: 'Sarah Johnson',
          phoneNumber: '+91 98765 43211',
          joinedAt: new Date(Date.now() - 1814400000).toISOString(),
          status: 'active',
          totalAchievements: 11,
          currentRank: 2
        },
        {
          id: '3',
          displayName: 'Mike Chen',
          phoneNumber: '+91 98765 43212',
          joinedAt: new Date(Date.now() - 1296000000).toISOString(),
          status: 'inactive',
          totalAchievements: 8,
          currentRank: 5
        }
      ];
      
      setEmployees(placeholderEmployees);
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

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.phoneNumber.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="employee-management">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-management">
      <div className="content-header">
        <h2>Employee Management</h2>
        <button className="btn">+ Invite Employee</button>
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
        
        <div className="filter-controls">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="employees-table">
        <div className="table-header">
          <div className="header-cell">Employee</div>
          <div className="header-cell">Phone</div>
          <div className="header-cell">Joined</div>
          <div className="header-cell">Rank</div>
          <div className="header-cell">Achievements</div>
          <div className="header-cell">Status</div>
          <div className="header-cell">Actions</div>
        </div>
        
        <div className="table-body">
          {filteredEmployees.map((employee) => (
            <div key={employee.id} className="table-row">
              <div className="table-cell">
                <div className="employee-info">
                  <div className="employee-avatar">
                    {employee.displayName.charAt(0)}
                  </div>
                  <span className="employee-name">{employee.displayName}</span>
                </div>
              </div>
              <div className="table-cell">{employee.phoneNumber}</div>
              <div className="table-cell">
                {new Date(employee.joinedAt).toLocaleDateString()}
              </div>
              <div className="table-cell">
                {employee.currentRank > 0 ? `#${employee.currentRank}` : '-'}
              </div>
              <div className="table-cell">{employee.totalAchievements}</div>
              <div className="table-cell">
                <span className={`status-badge ${employee.status}`}>
                  {employee.status}
                </span>
              </div>
              <div className="table-cell">
                <div className="action-buttons">
                  <button className="btn-icon" title="View Profile">👤</button>
                  <button className="btn-icon" title="Send Message">💬</button>
                  <button className="btn-icon" title="More Options">⋯</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {filteredEmployees.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>No Employees Found</h3>
          <p>
            {searchTerm ? 
              'No employees match your search criteria.' : 
              'Invite employees to join your organization.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;