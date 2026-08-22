import React from 'react';
import './DraftRoom.css';

function FPLDraftRoom({ user, onBack }) {
  return (
    <div className="draft-room">
      <div className="draft-connect">
        <button className="back-btn" onClick={onBack}>← Back to Dashboard</button>
        <h1>⚽ FPL Draft Room</h1>
        <p className="subtitle">Your Fantasy Premier League draft companion is hosted separately for instant access during live drafts.</p>
        
        <div className="connect-form">
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
              The FPL Draft Tool connects you to a live draft board with real-time recommendations 
              based on the Premier League Scout's official rankings.
            </p>
            <a 
              href="http://fpl-draft-tool-257641257020.s3-website-us-east-1.amazonaws.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="connect-btn"
              style={{ display: 'inline-block', textDecoration: 'none', padding: '14px 28px' }}
            >
              ⚽ Open FPL Draft Tool
            </a>
            <p style={{ color: 'var(--text-muted)', marginTop: '12px', fontSize: '0.75rem' }}>
              Opens in a new tab • Snake draft • 8 teams • Auto-saves your picks
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FPLDraftRoom;
