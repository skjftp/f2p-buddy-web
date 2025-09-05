import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AnalyticsDashboardProps {
  organizationId: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ organizationId }) => {
  const [analyticsData, setAnalyticsData] = useState({
    performanceData: [
      { month: 'Jan', sales: 45000, calls: 320, meetings: 45 },
      { month: 'Feb', sales: 52000, calls: 380, meetings: 52 },
      { month: 'Mar', sales: 48000, calls: 350, meetings: 48 },
      { month: 'Apr', sales: 61000, calls: 420, meetings: 61 },
      { month: 'May', sales: 55000, calls: 390, meetings: 55 },
      { month: 'Jun', sales: 67000, calls: 450, meetings: 67 }
    ],
    achievementTypes: [
      { name: 'Sales', value: 45, color: '#28a745' },
      { name: 'Calls', value: 30, color: '#17a2b8' },
      { name: 'Meetings', value: 15, color: '#ffc107' },
      { name: 'Referrals', value: 10, color: '#fd7e14' }
    ],
    topPerformers: [
      { name: 'John Smith', achievements: 24, points: 2850 },
      { name: 'Sarah Johnson', achievements: 22, points: 2720 },
      { name: 'Mike Chen', achievements: 20, points: 2650 },
      { name: 'Lisa Wang', achievements: 18, points: 2400 },
      { name: 'David Brown', achievements: 16, points: 2200 }
    ]
  });
  
  const [selectedMetric, setSelectedMetric] = useState<'sales' | 'calls' | 'meetings'>('sales');

  return (
    <div className="analytics-dashboard">
      <div className="content-header">
        <h2>Analytics Dashboard</h2>
        <div className="date-range-selector">
          <select className="form-input">
            <option value="6months">Last 6 Months</option>
            <option value="1year">Last Year</option>
            <option value="3months">Last 3 Months</option>
          </select>
        </div>
      </div>

      <div className="analytics-grid">
        {/* Performance Trend Chart */}
        <div className="analytics-card full-width">
          <div className="card-header">
            <h3>Performance Trends</h3>
            <div className="metric-selector">
              <button 
                className={`metric-btn ${selectedMetric === 'sales' ? 'active' : ''}`}
                onClick={() => setSelectedMetric('sales')}
              >
                Sales
              </button>
              <button 
                className={`metric-btn ${selectedMetric === 'calls' ? 'active' : ''}`}
                onClick={() => setSelectedMetric('calls')}
              >
                Calls
              </button>
              <button 
                className={`metric-btn ${selectedMetric === 'meetings' ? 'active' : ''}`}
                onClick={() => setSelectedMetric('meetings')}
              >
                Meetings
              </button>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey={selectedMetric} 
                  stroke="#667eea" 
                  strokeWidth={3}
                  dot={{ fill: '#667eea', strokeWidth: 2, r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Achievement Distribution */}
        <div className="analytics-card">
          <div className="card-header">
            <h3>Achievement Distribution</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={analyticsData.achievementTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {analyticsData.achievementTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Performers */}
        <div className="analytics-card">
          <div className="card-header">
            <h3>Top Performers</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analyticsData.topPerformers}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="achievements" fill="#28a745" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key Metrics Summary */}
        <div className="analytics-card full-width">
          <div className="card-header">
            <h3>Key Metrics Summary</h3>
          </div>
          <div className="metrics-summary">
            <div className="summary-item">
              <div className="summary-icon">📈</div>
              <div className="summary-content">
                <h4>Average Monthly Growth</h4>
                <p className="summary-value">+12.3%</p>
                <p className="summary-change positive">↑ 2.1% vs last period</p>
              </div>
            </div>
            
            <div className="summary-item">
              <div className="summary-icon">🎯</div>
              <div className="summary-content">
                <h4>Goal Achievement Rate</h4>
                <p className="summary-value">87.5%</p>
                <p className="summary-change positive">↑ 5.2% vs last period</p>
              </div>
            </div>
            
            <div className="summary-item">
              <div className="summary-icon">👥</div>
              <div className="summary-content">
                <h4>Employee Engagement</h4>
                <p className="summary-value">92.1%</p>
                <p className="summary-change neutral">→ 0.3% vs last period</p>
              </div>
            </div>
            
            <div className="summary-item">
              <div className="summary-icon">💰</div>
              <div className="summary-content">
                <h4>Revenue Per Employee</h4>
                <p className="summary-value">₹45,250</p>
                <p className="summary-change positive">↑ 8.7% vs last period</p>
              </div>
            </div>
          </div>
        </div>

        {/* Campaign Performance */}
        <div className="analytics-card full-width">
          <div className="card-header">
            <h3>Recent Campaign Performance</h3>
          </div>
          <div className="campaign-performance-table">
            <div className="table-header">
              <div>Campaign</div>
              <div>Participants</div>
              <div>Completion Rate</div>
              <div>Average Score</div>
              <div>Status</div>
            </div>
            <div className="table-body">
              <div className="table-row">
                <div>Q2 Sales Challenge</div>
                <div>24</div>
                <div>87.5%</div>
                <div>8.3/10</div>
                <div><span className="status-badge completed">Completed</span></div>
              </div>
              <div className="table-row">
                <div>Customer Outreach</div>
                <div>18</div>
                <div>92.1%</div>
                <div>9.1/10</div>
                <div><span className="status-badge active">Active</span></div>
              </div>
              <div className="table-row">
                <div>Referral Program</div>
                <div>15</div>
                <div>76.3%</div>
                <div>7.8/10</div>
                <div><span className="status-badge active">Active</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;