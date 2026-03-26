document.addEventListener('DOMContentLoaded', function() {
    const extractBtn = document.getElementById('extractBtn');
    const copyBtn = document.getElementById('copyBtn');
    const openSetupBtn = document.getElementById('openSetupBtn');
    const statusDiv = document.getElementById('status');
    const credentialsDiv = document.getElementById('credentials');

    extractBtn.addEventListener('click', extractCredentials);
    copyBtn.addEventListener('click', copyToClipboard);
    openSetupBtn.addEventListener('click', openSetupPage);

    async function extractCredentials() {
        try {
            extractBtn.disabled = true;
            extractBtn.textContent = 'Extracting...';
            
            statusDiv.className = 'status info';
            statusDiv.textContent = 'Extracting credentials...';

            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('fantasy.espn.com')) {
                throw new Error('Please navigate to your ESPN Fantasy league page first');
            }

            // Extract league ID from URL
            const leagueIdMatch = tab.url.match(/leagueId=(\d+)/);
            if (!leagueIdMatch) {
                throw new Error('Could not find league ID in URL. Make sure you\'re on your league page.');
            }
            const leagueId = leagueIdMatch[1];

            // Get cookies
            const espnS2Cookie = await chrome.cookies.get({
                url: 'https://fantasy.espn.com',
                name: 'espn_s2'
            });

            const swidCookie = await chrome.cookies.get({
                url: 'https://fantasy.espn.com',
                name: 'SWID'
            });

            if (!espnS2Cookie || !swidCookie) {
                throw new Error('Could not find ESPN cookies. Make sure you\'re logged in to ESPN Fantasy.');
            }

            // Display credentials
            document.getElementById('leagueId').textContent = leagueId;
            document.getElementById('espnS2').textContent = espnS2Cookie.value;
            document.getElementById('swid').textContent = swidCookie.value;

            credentialsDiv.style.display = 'block';
            copyBtn.style.display = 'block';

            statusDiv.className = 'status success';
            statusDiv.textContent = '✅ Credentials extracted successfully!';

        } catch (error) {
            statusDiv.className = 'status error';
            statusDiv.textContent = `❌ ${error.message}`;
        } finally {
            extractBtn.disabled = false;
            extractBtn.textContent = 'Extract Credentials';
        }
    }

    async function copyToClipboard() {
        const leagueId = document.getElementById('leagueId').textContent;
        const espnS2 = document.getElementById('espnS2').textContent;
        const swid = document.getElementById('swid').textContent;

        const credentials = {
            leagueId: leagueId,
            espnS2: espnS2,
            swid: swid
        };

        try {
            await navigator.clipboard.writeText(JSON.stringify(credentials, null, 2));
            
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ Copied!';
            copyBtn.style.background = '#10b981';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '';
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }

    function openSetupPage() {
        // Replace with your actual setup URL
        chrome.tabs.create({
            url: 'https://your-fantasy-ai-coach-domain.com/setup'
        });
    }
});