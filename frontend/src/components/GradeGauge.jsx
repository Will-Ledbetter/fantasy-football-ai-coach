import React, { useState, useEffect } from 'react';
import './GradeGauge.css';

export function getGradeColor(grade) {
  if (!grade) return '#9a9590';
  if (grade.startsWith('A')) return '#4ac878';
  if (grade.startsWith('B')) return '#C8944A';
  if (grade.startsWith('C')) return '#a87a3a';
  return '#ef4444';
}

export default function GradeGauge({ grade, score, animate = true }) {
  const [animatedScore, setAnimatedScore] = useState(animate ? 0 : score);
  const clampedScore = Math.max(0, Math.min(100, animatedScore));

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setAnimatedScore(score), 50);
      return () => clearTimeout(timer);
    }
  }, [score, animate]);

  const radius = 50;
  const strokeWidth = 6;
  const center = 60;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75; // 270° sweep
  const arcLength = circumference * arcFraction;
  const fillLength = arcLength * (clampedScore / 100);
  const dashOffset = arcLength - fillLength;
  const color = getGradeColor(grade);

  return (
    <div className="grade-gauge">
      <svg viewBox="0 0 120 120" className="grade-gauge-svg">
        {/* Background arc */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none"
          stroke="rgba(200, 148, 74, 0.15)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(135 ${center} ${center})`}
        />
        {/* Filled arc */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(135 ${center} ${center})`}
          className="grade-gauge-fill"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="grade-gauge-label">
        <span className="grade-gauge-letter" style={{ color }}>{grade}</span>
        <span className="grade-gauge-score">{clampedScore}/100</span>
      </div>
    </div>
  );
}

function gradeLabel(grade) {
  if (!grade) return '';
  if (grade === 'A+') return 'Elite';
  if (grade.startsWith('A')) return 'Strong';
  if (grade === 'B+') return 'Good';
  if (grade.startsWith('B')) return 'Solid';
  if (grade.startsWith('C')) return 'Average';
  if (grade.startsWith('D')) return 'Weak';
  return 'Risky';
}

export function PositionGrades({ grades }) {
  if (!grades || grades.length === 0) return null;

  return (
    <div className="position-grades">
      {grades.map((pg, i) => (
        <div key={pg.position || i} className="position-grade-card">
          <span className="pg-position">{pg.position}</span>
          <span className="pg-grade" style={{ color: getGradeColor(pg.grade) }}>{pg.grade}</span>
          <span className="pg-summary">{gradeLabel(pg.grade)}</span>
        </div>
      ))}
    </div>
  );
}
