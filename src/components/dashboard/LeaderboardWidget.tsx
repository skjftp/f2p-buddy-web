import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface LeaderboardEntry {
  id: string;
  displayName: string;
  totalPoints: number;
  achievements: number;
  position: number;
}

interface LeaderboardWidgetProps {
  organizationId: string;
}

const LeaderboardWidget: React.FC<LeaderboardWidgetProps> = ({ organizationId }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;

    // This would be calculated from achievements collection
    // For now, showing placeholder data
    const placeholderData: LeaderboardEntry[] = [
      { id: '1', displayName: 'John Smith', totalPoints: 2850, achievements: 12, position: 1 },
      { id: '2', displayName: 'Sarah Johnson', totalPoints: 2720, achievements: 11, position: 2 },
      { id: '3', displayName: 'Mike Chen', totalPoints: 2650, achievements: 10, position: 3 },
      { id: '4', displayName: 'Lisa Wang', totalPoints: 2400, achievements: 9, position: 4 },
      { id: '5', displayName: 'David Brown', totalPoints: 2200, achievements: 8, position: 5 },
    ];

    setLeaderboard(placeholderData);
    setLoading(false);
  }, [organizationId]);

  if (loading) {
    return (
      <div className="leaderboard-widget">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${position}`;
    }
  };

  return (
    <div className="leaderboard-widget">
      <div className="leaderboard-list">
        {leaderboard.map((entry, index) => (
          <div key={entry.id} className="leaderboard-item">
            <div className="rank-badge">
              {getRankIcon(entry.position)}
            </div>
            <div className="user-info">
              <div className="user-avatar">
                {entry.displayName.charAt(0)}
              </div>
              <div className="user-details">
                <h4 className="user-name">{entry.displayName}</h4>
                <p className="user-stats">
                  {entry.achievements} achievements
                </p>
              </div>
            </div>
            <div className="user-points">
              <span className="points-value">{entry.totalPoints.toLocaleString()}</span>
              <span className="points-label">pts</span>
            </div>
          </div>
        ))}
      </div>
      
      {leaderboard.length === 0 && (
        <div className="empty-leaderboard">
          <div className="empty-icon">🏆</div>
          <p>No rankings yet. Complete achievements to appear on the leaderboard!</p>
        </div>
      )}
    </div>
  );
};

export default LeaderboardWidget;