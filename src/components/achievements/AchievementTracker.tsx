import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface Achievement {
  id: string;
  type: 'sales' | 'calls' | 'meetings' | 'referrals';
  value: number;
  description: string;
  dateAchieved: string;
  verified: boolean;
  campaignName?: string;
}

interface AchievementTrackerProps {
  userId?: string;
}

const AchievementTracker: React.FC<AchievementTrackerProps> = ({ userId }) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      // Show placeholder data for demo
      const placeholderAchievements: Achievement[] = [
        {
          id: '1',
          type: 'sales',
          value: 15000,
          description: 'Closed ₹15,000 in sales',
          dateAchieved: new Date().toISOString(),
          verified: true,
          campaignName: 'Q4 Sales Push'
        },
        {
          id: '2',
          type: 'calls',
          value: 50,
          description: 'Made 50 client calls',
          dateAchieved: new Date(Date.now() - 86400000).toISOString(),
          verified: true,
          campaignName: 'Customer Outreach'
        },
        {
          id: '3',
          type: 'meetings',
          value: 12,
          description: 'Conducted 12 client meetings',
          dateAchieved: new Date(Date.now() - 172800000).toISOString(),
          verified: false,
          campaignName: 'Business Development'
        }
      ];
      
      setAchievements(placeholderAchievements);
      setLoading(false);
      return;
    }

    // Real implementation would query user's achievements
    const achievementsQuery = query(
      collection(db, 'achievements'),
      where('userId', '==', userId),
      orderBy('dateAchieved', 'desc')
    );

    const unsubscribe = onSnapshot(achievementsQuery, (snapshot) => {
      const achievementList: Achievement[] = [];
      snapshot.forEach((doc) => {
        achievementList.push({ id: doc.id, ...doc.data() } as Achievement);
      });
      
      setAchievements(achievementList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  if (loading) {
    return (
      <div className="achievement-tracker">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  const getAchievementIcon = (type: string) => {
    switch (type) {
      case 'sales': return '💰';
      case 'calls': return '📞';
      case 'meetings': return '🤝';
      case 'referrals': return '👥';
      default: return '🏆';
    }
  };

  const formatValue = (type: string, value: number) => {
    switch (type) {
      case 'sales': return `₹${value.toLocaleString()}`;
      default: return value.toString();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="achievement-tracker">
      <div className="achievements-list">
        {achievements.map((achievement) => (
          <div key={achievement.id} className="achievement-item">
            <div className="achievement-icon">
              {getAchievementIcon(achievement.type)}
            </div>
            <div className="achievement-content">
              <div className="achievement-header">
                <h4 className="achievement-description">
                  {achievement.description}
                </h4>
                {achievement.campaignName && (
                  <span className="campaign-tag">
                    {achievement.campaignName}
                  </span>
                )}
              </div>
              <div className="achievement-meta">
                <span className="achievement-value">
                  {formatValue(achievement.type, achievement.value)}
                </span>
                <span className="achievement-date">
                  {formatDate(achievement.dateAchieved)}
                </span>
              </div>
            </div>
            <div className="achievement-status">
              {achievement.verified ? (
                <span className="verified-badge">✅</span>
              ) : (
                <span className="pending-badge">⏳</span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {achievements.length === 0 && (
        <div className="empty-achievements">
          <div className="empty-icon">🎯</div>
          <h3>No Achievements Yet</h3>
          <p>Start participating in campaigns to earn your first achievements!</p>
        </div>
      )}
    </div>
  );
};

export default AchievementTracker;