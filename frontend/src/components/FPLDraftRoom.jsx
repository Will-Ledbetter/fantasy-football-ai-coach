import React, { useState, useEffect, useCallback } from 'react';
import './DraftRoom.css';
import { FPL_PLAYERS } from './fplPlayers';

const NUM_TEAMS = 8;
const NUM_ROUNDS = 17;
const SQUAD_REQ = { GK: 1, DEF: 3, MID: 5, FWD: 2 };
const BENCH_SLOTS = 6;

function FPLDraftRoom({ user, onBack }) {
  const [myPosition, setMyPosition] = useState(() => parseInt(localStorage.getItem('fplMyPosition')) || 6);
  const [draftPicks, setDraftPicks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fplDraftState2'))?.draftPicks || []; } catch { return []; }
  });
  const [currentPickIndex, setCurrentPickIndex] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fplDraftState2'))?.currentPickIndex || 0; } catch { return 0; }
  });
  const [activeTab, setActiveTab] = useState('recs');
  const [posFilter, setPosFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [selectedCell, setSelectedCell] = useState(null);

  // Save state
  useEffect(() => {
    localStorage.setItem('fplDraftState2', JSON.stringify({ draftPicks, currentPickIndex }));
    localStorage.setItem('fplMyPosition', myPosition);
  }, [draftPicks, currentPickIndex, myPosition]);

  function getTeamForPick(pickIndex) {
    const round = Math.floor(pickIndex / NUM_TEAMS);
    const posInRound = pickIndex % NUM_TEAMS;
    return round % 2 === 0 ? posInRound + 1 : NUM_TEAMS - posInRound;
  }

  function getRoundForPick(pickIndex) { return Math.floor(pickIndex / NUM_TEAMS) + 1; }
  function isMyPick(pickIndex) { return getTeamForPick(pickIndex) === myPosition; }

  function getMyPicks() { return draftPicks.filter(dp => dp.team === myPosition); }
  function getSquadCounts() {
    const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    getMyPicks().forEach(p => counts[p.player.pos]++);
    return counts;
  }
  function getAvailablePlayers() {
    const taken = new Set(draftPicks.map(dp => dp.player.name));
    return FPL_PLAYERS.filter(p => !taken.has(p.name));
  }

  function openModal(pickIndex) {
    setSelectedCell(pickIndex);
    setModalSearch('');
    setModalOpen(true);
  }

  function selectPlayer(rank) {
    const player = FPL_PLAYERS.find(p => p.rank === rank);
    if (!player || selectedCell === null) return;
    const team = getTeamForPick(selectedCell);
    const newPicks = [...draftPicks, { pickIndex: selectedCell, round: getRoundForPick(selectedCell), team, player }];
    setDraftPicks(newPicks);
    if (selectedCell === currentPickIndex) {
      let next = currentPickIndex + 1;
      while (next < NUM_TEAMS * NUM_ROUNDS && newPicks.find(dp => dp.pickIndex === next)) next++;
      setCurrentPickIndex(next);
    }
    setModalOpen(false);
  }

  function editPick(pickIndex) {
    const existing = draftPicks.find(dp => dp.pickIndex === pickIndex);
    if (!existing) return;
    const action = window.prompt(`${existing.player.name} (${existing.player.pos})\n\nType "swap" to change or "clear" to remove:`, 'swap');
    if (action === 'clear') {
      const newPicks = draftPicks.filter(dp => dp.pickIndex !== pickIndex);
      setDraftPicks(newPicks);
      if (pickIndex < currentPickIndex) setCurrentPickIndex(pickIndex);
    } else if (action === 'swap') {
      setDraftPicks(draftPicks.filter(dp => dp.pickIndex !== pickIndex));
      openModal(pickIndex);
    }
  }

  function undoLastPick() {
    if (draftPicks.length === 0) return;
    const last = draftPicks[draftPicks.length - 1];
    setDraftPicks(draftPicks.slice(0, -1));
    if (last.pickIndex < currentPickIndex) setCurrentPickIndex(last.pickIndex);
  }

  function resetDraft() {
    if (!window.confirm('Reset entire draft?')) return;
    setDraftPicks([]);
    setCurrentPickIndex(0);
  }

  // Recommendation engine
  function getRecommendations() {
    const available = getAvailablePlayers();
    const counts = getSquadCounts();
    const myPickCount = getMyPicks().length;
    const round = myPickCount + 1;

    return available.slice(0, 80).map(p => {
      let score = 200 - p.rank;
      const startingRemaining = {
        GK: SQUAD_REQ.GK - Math.min(counts.GK, SQUAD_REQ.GK),
        DEF: SQUAD_REQ.DEF - Math.min(counts.DEF, SQUAD_REQ.DEF),
        MID: SQUAD_REQ.MID - Math.min(counts.MID, SQUAD_REQ.MID),
        FWD: SQUAD_REQ.FWD - Math.min(counts.FWD, SQUAD_REQ.FWD)
      };
      if (startingRemaining[p.pos] > 0) score += 15;
      if (round <= 3 && (p.pos === 'MID' || p.pos === 'FWD')) score += 15;
      if (round <= 3 && p.pos === 'GK') score -= 30;
      if (round >= 5 && round <= 9 && p.pos === 'DEF' && startingRemaining.DEF > 1) score += 10;
      if (round >= 12 && p.pos === 'GK' && startingRemaining.GK > 0) score += 25;
      const posAvailable = available.filter(a => a.pos === p.pos);
      if (startingRemaining[p.pos] > 0 && posAvailable.length <= startingRemaining[p.pos] + 3) score += 30;
      return { ...p, score };
    }).sort((a, b) => b.score - a.score).slice(0, 12);
  }

  function getStrategy() {
    const counts = getSquadCounts();
    const round = getMyPicks().length + 1;
    if (round > 17) return 'Draft complete!';
    let note = '';
    if (round <= 2) note = 'Target elite MIDs/FWDs. With 5 MID + 2 FWD starters, these are your difference-makers.';
    else if (round <= 5) note = 'Continue premium MIDs and FWDs. Build your starting core now.';
    else if (round <= 8) note = 'Start defenders. Only need 3 but make them count — attacking FBs and set-piece CBs.';
    else if (round <= 12) note = 'Bench depth. Best available regardless of position.';
    else if (round <= 15) note = 'Fill remaining bench. Upside picks and differentials.';
    else note = 'Final picks — grab GK if needed and close out.';
    
    const remaining = { GK: SQUAD_REQ.GK - Math.min(counts.GK, SQUAD_REQ.GK), DEF: SQUAD_REQ.DEF - Math.min(counts.DEF, SQUAD_REQ.DEF), MID: SQUAD_REQ.MID - Math.min(counts.MID, SQUAD_REQ.MID), FWD: SQUAD_REQ.FWD - Math.min(counts.FWD, SQUAD_REQ.FWD) };
    const urgent = Object.entries(remaining).filter(([,n]) => n > 0);
    const roundsLeft = 17 - getMyPicks().length;
    if (roundsLeft <= urgent.reduce((a,[,n]) => a+n, 0) + 2 && urgent.length > 0) {
      note += `\n\n⚠️ Starting slots tight! Need: ${urgent.map(([p,n]) => `${n}× ${p}`).join(', ')}`;
    }
    return note;
  }

  const recs = getRecommendations();
  const filteredRecs = posFilter === 'ALL' ? recs : recs.filter(r => r.pos === posFilter);
  const isCurrentlyMyPick = isMyPick(currentPickIndex);
  const currentRound = getRoundForPick(currentPickIndex);
  const currentPickInRound = (currentPickIndex % NUM_TEAMS) + 1;

  const modalPlayers = getAvailablePlayers().filter(p => {
    if (!modalSearch) return true;
    const s = modalSearch.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.team.toLowerCase().includes(s) || p.pos.toLowerCase().includes(s);
  }).slice(0, 40);

  return (
    <div className="draft-room">
      <div className="draft-header">
        <div className="draft-header-left">
          <button className="back-btn" onClick={onBack}>←</button>
          <h1>⚽ FPL Draft</h1>
          <span className="live-badge" style={{ background: '#10b981' }}>● ACTIVE</span>
        </div>
        <div className="draft-header-right">
          <span className="draft-info">
            Rd {currentRound} • Pick {currentPickInRound}
            {isCurrentlyMyPick && <span className="your-turn"> — YOUR PICK!</span>}
          </span>
          <select value={myPosition} onChange={e => setMyPosition(parseInt(e.target.value))}>
            {Array.from({ length: 8 }, (_, i) => <option key={i+1} value={i+1}>Team {i+1}</option>)}
          </select>
          <span className="my-slot-badge">My Team: #{myPosition}</span>
          <button className="change-strat-btn" onClick={undoLastPick}>↩ Undo</button>
          <button className="change-strat-btn" onClick={resetDraft}>Reset</button>
        </div>
      </div>

      <div className="draft-layout">
        {/* Draft Board */}
        <div className="draft-board-section">
          <h2>Draft Board — {draftPicks.length}/{NUM_TEAMS * NUM_ROUNDS} picks</h2>
          <div className="fpl-board">
            <div className="fpl-board-grid">
              {/* Header */}
              <div className="fpl-cell fpl-header">RD</div>
              {Array.from({ length: NUM_TEAMS }, (_, i) => (
                <div key={i} className={`fpl-cell fpl-header ${i + 1 === myPosition ? 'fpl-my-col' : ''}`}>
                  {i + 1 === myPosition ? `★ T${i+1}` : `T${i+1}`}
                </div>
              ))}
              {/* Rows */}
              {Array.from({ length: NUM_ROUNDS }, (_, r) => (
                <React.Fragment key={r}>
                  <div className="fpl-cell fpl-round">{r + 1}</div>
                  {Array.from({ length: NUM_TEAMS }, (_, col) => {
                    const pickIndex = r % 2 === 0 ? r * NUM_TEAMS + col : r * NUM_TEAMS + (NUM_TEAMS - 1 - col);
                    const pick = draftPicks.find(dp => dp.pickIndex === pickIndex);
                    const isMe = (col + 1) === myPosition;
                    const isCurrent = pickIndex === currentPickIndex;
                    return (
                      <div 
                        key={col} 
                        className={`fpl-cell ${isMe ? 'fpl-my-col' : ''} ${isCurrent ? 'fpl-current' : ''} ${pick ? 'fpl-filled' : ''}`}
                        onClick={() => pick ? editPick(pickIndex) : openModal(pickIndex)}
                      >
                        {pick ? (
                          <div className="fpl-pick-content">
                            <span className={`fpl-pick-name pos-${pick.player.pos.toLowerCase()}`}>{pick.player.name}</span>
                          </div>
                        ) : (
                          <span className="fpl-pick-empty">{r+1}.{(pickIndex % NUM_TEAMS) + 1}</span>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="draft-recs-section">
          <div className="recs-tabs">
            <button className={activeTab === 'recs' ? 'active' : ''} onClick={() => setActiveTab('recs')}>Recs</button>
            <button className={activeTab === 'squad' ? 'active' : ''} onClick={() => setActiveTab('squad')}>My Squad</button>
            <button className={activeTab === 'available' ? 'active' : ''} onClick={() => setActiveTab('available')}>Available</button>
          </div>
          <div className="panel-content">
            {activeTab === 'recs' && (
              <div className="recs-content">
                <div className="strategy-box">{getStrategy()}</div>
                <div className="pos-filters">
                  {['ALL','GK','DEF','MID','FWD'].map(p => (
                    <button key={p} className={posFilter === p ? 'active' : ''} onClick={() => setPosFilter(p)}>{p}</button>
                  ))}
                </div>
                <div className="recs-list">
                  {filteredRecs.map((r, i) => (
                    <div key={r.rank} className={`rec-card ${i === 0 ? 'top-pick' : ''}`}>
                      <div className="rec-header">
                        <span className={`rec-pos pos-${r.pos.toLowerCase()}`}>{r.pos}</span>
                        <span className="rec-name">{r.name}</span>
                      </div>
                      <div className="rec-details">
                        <span>{r.team}</span>
                        <span>Rank #{r.rank}</span>
                      </div>
                      {i === 0 && <div className="rec-tag">★ Top Pick</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'squad' && (
              <div className="squad-content">
                <h3>My Squad ({getMyPicks().length}/17)</h3>
                {['GK','DEF','MID','FWD'].map(pos => (
                  <div key={pos} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                      {pos} ({getSquadCounts()[pos]}/{SQUAD_REQ[pos]})
                    </div>
                    {getMyPicks().filter(p => p.player.pos === pos).map((p, i) => (
                      <div key={i} className="squad-row">
                        <span className="pick-num">Rd {p.round}</span>
                        <span className={`pick-pos pos-${pos.toLowerCase()}`}>{pos}</span>
                        <span className="pick-player">{p.player.name}</span>
                        <span className="pick-team">{p.player.team}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'available' && (
              <div className="recs-content">
                <div className="pos-filters">
                  {['ALL','GK','DEF','MID','FWD'].map(p => (
                    <button key={p} className={posFilter === p ? 'active' : ''} onClick={() => setPosFilter(p)}>{p}</button>
                  ))}
                </div>
                <div className="recs-list">
                  {(posFilter === 'ALL' ? getAvailablePlayers() : getAvailablePlayers().filter(p => p.pos === posFilter)).slice(0, 30).map(p => (
                    <div key={p.rank} className="rec-card">
                      <div className="rec-header">
                        <span className={`rec-pos pos-${p.pos.toLowerCase()}`}>{p.pos}</span>
                        <span className="rec-name">{p.name}</span>
                      </div>
                      <div className="rec-details"><span>{p.team}</span><span>#{p.rank}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fpl-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="fpl-modal" onClick={e => e.stopPropagation()}>
            <div className="fpl-modal-header">
              <h3>Select Player — Rd {selectedCell !== null ? getRoundForPick(selectedCell) : ''}</h3>
              <button onClick={() => setModalOpen(false)}>×</button>
            </div>
            <input 
              className="fpl-modal-search" 
              placeholder="Search players..." 
              value={modalSearch} 
              onChange={e => setModalSearch(e.target.value)} 
              autoFocus 
            />
            <div className="fpl-modal-list">
              {modalPlayers.map(p => (
                <div key={p.rank} className="fpl-modal-item" onClick={() => selectPlayer(p.rank)}>
                  <span className={`pick-pos pos-${p.pos.toLowerCase()}`}>{p.pos}</span>
                  <span className="pick-player">{p.name}</span>
                  <span className="pick-team">{p.team}</span>
                  <span className="pick-num">#{p.rank}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FPLDraftRoom;
