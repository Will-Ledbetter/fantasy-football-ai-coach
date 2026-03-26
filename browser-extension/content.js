// Content script for Fantasy Football AI Coach Helper
// Detects when user is on ESPN Fantasy and offers quick setup

(function() {
    'use strict';

    // Only run on ESPN Fantasy pages
    if (!window.location.hostname.includes('fantasy.espn.com')) {
        return;
    }

    // Check if we're on a league page
    const leagueIdMatch = window.location.href.match(/leagueId=(\d+)/);
    if (!leagueIdMatch) {
        return;
    }

    // Don't show if already shown
    if (document.getElementById('ff-ai-coach-banner')) {
        return;
    }

    // Create notification banner
    const banner = document.createElement('div');
    banner.id = 'ff-ai-coach-banner';
    banner.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: space-between;
        ">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="font-size: 1.5rem;">🏈</div>
                <div>
                    <div style="font-weight: 600; font-size: 0.95rem;">Fantasy Football AI Coach</div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">Connect this league for AI-powered lineup recommendations</div>
                </div>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <button id="ff-connect-btn" style="
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.85rem;
                    transition: all 0.3s;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                   onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    Quick Connect
                </button>
                <button id="ff-close-btn" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                    padding: 4px;
                    opacity: 0.7;
                    transition: opacity 0.3s;
                " onmouseover="this.style.opacity='1'" 
                   onmouseout="this.style.opacity='0.7'">
                    ×
                </button>
            </div>
        </div>
    `;

    // Add to page
    document.body.appendChild(banner);

    // Add some top margin to prevent covering content
    document.body.style.marginTop = '60px';

    // Handle connect button
    document.getElementById('ff-connect-btn').addEventListener('click', function() {
        // Open extension popup or redirect to setup
        chrome.runtime.sendMessage({ action: 'openSetup', leagueId: leagueIdMatch[1] });
    });

    // Handle close button
    document.getElementById('ff-close-btn').addEventListener('click', function() {
        banner.remove();
        document.body.style.marginTop = '';
        
        // Remember that user closed it (store in localStorage)
        localStorage.setItem('ff-ai-coach-banner-closed', Date.now().toString());
    });

    // Auto-hide after 10 seconds
    setTimeout(() => {
        if (document.getElementById('ff-ai-coach-banner')) {
            banner.style.transform = 'translateY(-100%)';
            banner.style.transition = 'transform 0.5s ease';
            
            setTimeout(() => {
                if (banner.parentNode) {
                    banner.remove();
                    document.body.style.marginTop = '';
                }
            }, 500);
        }
    }, 10000);

    // Don't show again for 24 hours if user closed it
    const lastClosed = localStorage.getItem('ff-ai-coach-banner-closed');
    if (lastClosed && (Date.now() - parseInt(lastClosed)) < 24 * 60 * 60 * 1000) {
        banner.remove();
        document.body.style.marginTop = '';
    }
})();