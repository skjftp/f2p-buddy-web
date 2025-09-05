import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface StatsOverviewProps {
  stats: {
    totalAchievements: number;
    currentRank: number;
    totalPoints: number;
    activeCampaignsCount: number;
  };
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  const { colors } = useTheme();

  const statCards = [
    {
      icon: '🏆',
      title: 'Total Achievements',
      value: stats.totalAchievements,
      color: '#FFD700'
    },
    {
      icon: '📊',
      title: 'Current Rank',
      value: stats.currentRank > 0 ? `#${stats.currentRank}` : 'Unranked',
      color: '#28a745'
    },
    {
      icon: '⭐',
      title: 'Total Points',
      value: stats.totalPoints.toLocaleString(),
      color: '#17a2b8'
    },
    {
      icon: '🎯',
      title: 'Active Campaigns',
      value: stats.activeCampaignsCount,
      color: '#fd7e14'
    }
  ];

  return (
    <div className="stats-overview">
      <h2 className="section-title">Your Performance</h2>
      <div className="stats-grid">
        {statCards.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: stat.color }}>
              {stat.icon}
            </div>
            <div className="stat-content">
              <h3 className="stat-value">{stat.value}</h3>
              <p className="stat-title">{stat.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsOverview;