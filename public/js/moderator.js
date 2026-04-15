const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');
if (!sessionId) document.body.innerHTML = '<p style="color:white;padding:40px;">Keine Session-ID.</p>';

const levelDescriptions = {
    1: 'Subtil: Nur Name im Greeting, sonst generisch.',
    2: 'Moderat: Name + Stadt, grobe Kategorien.',
    3: 'Stark: Interessen-spezifische Produkte, persönliche Nachrichten.',
    4: 'Hyper: Cross-context Daten, Lebenslage eingebaut, "Kunden wie du".',
    5: 'Extrem: Beiläufig Erwähntes genutzt, sehr spezifische Anspielungen.'
};

let currentStage = 'generic';

// Level slider
document.getElementById('levelSlider').addEventListener('input', (e) => {
    document.getElementById('levelDesc').textContent = levelDescriptions[e.target.value];
});

// Generate shop
document.getElementById('generateBtn').addEventListener('click', async () => {
    const btn = document.getElementById('generateBtn');
    const level = document.getElementById('levelSlider').value;
    btn.disabled = true;
    btn.textContent = 'Generiere...';
    
    await fetch('/api/shop/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, level: parseInt(level) })
    });
    
    // Poll for completion
    const pollGen = setInterval(async () => {
        const res = await fetch(`/api/session/status?session=${sessionId}`);
        const data = await res.json();
        
        document.getElementById('statusText').textContent = data.progress || '';
        
        if (data.status === 'shop_generated') {
            clearInterval(pollGen);
            btn.textContent = 'Erneut generieren';
            btn.disabled = false;
            showShopControls();
        } else if (data.status === 'error') {
            clearInterval(pollGen);
            btn.textContent = 'Fehler - Erneut versuchen';
            btn.disabled = false;
        }
    }, 2000);
});

// Stage buttons
document.querySelectorAll('.btn-stage-mod').forEach(btn => {
    btn.addEventListener('click', async () => {
        const stage = btn.dataset.stage;
        await fetch('/api/stage/set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, stage })
        });
        currentStage = stage;
        document.querySelectorAll('.btn-stage-mod').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Release shop
document.getElementById('releaseBtn').addEventListener('click', async () => {
    await fetch('/api/shop/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
    });
    document.getElementById('releaseBtn').textContent = 'Freigegeben!';
    document.getElementById('releaseBtn').disabled = true;
    document.getElementById('linkBox').style.display = 'block';
    document.getElementById('participantLink').value = 
        `${window.location.origin}/shop.html?session=${sessionId}`;
});

function showShopControls() {
    document.getElementById('shopControls').style.display = 'block';
    document.getElementById('releaseBtn').style.display = 'block';
    document.getElementById('ratingsBtn').style.display = 'block';
}

// Ratings trigger
document.getElementById('ratingsBtn').addEventListener('click', async () => {
    const btn = document.getElementById('ratingsBtn');
    await fetch('/api/stage/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, stage: 'show_ratings' })
    });
    btn.textContent = 'Ratings angezeigt...';
    btn.disabled = true;

    // Poll for ratings result
    const pollRatings = setInterval(async () => {
        const res = await fetch(`/api/session/status?session=${sessionId}`);
        const data = await res.json();
        if (data.ratings) {
            clearInterval(pollRatings);
            const r = data.ratings;
            document.getElementById('ratingsResult').style.display = 'block';
            document.getElementById('ratingsResult').innerHTML =
                `Hilfreichkeit: <strong>${r.helpfulness}/7</strong> | ` +
                `Nachvollziehbarkeit: <strong>${r.comprehensibility}/7</strong> | ` +
                `Unheimlichkeit: <strong>${r.creepiness}/7</strong>`;
        }
    }, 3000);
});

function renderTranscript(transcript) {
    const area = document.getElementById('transcriptArea');
    area.innerHTML = transcript.map(t => `
        <div class="transcript-turn ${t.speaker}">
            <span class="speaker-label">${t.speaker === 'interviewer' ? 'Interviewer' : 'Teilnehmer'}</span>
            <p>${t.text}</p>
        </div>
    `).join('');
}

function renderProfile(profile) {
    const el = document.getElementById('profileContent');
    const fields = [
        ['Name', profile.name],
        ['Alter', profile.age],
        ['Stadt', profile.city],
        ['Interessen', (profile.interests || []).join(', ')],
        ['Shopping', (profile.shopping_habits || []).join(', ')],
        ['Marken', (profile.brands || []).join(', ')],
        ['Lebenslage', (profile.life_events || []).join(', ')],
        ['Preissensitiv', profile.price_sensitivity],
        ['Erwähnte Produkte', (profile.mentioned_products || []).join(', ')],
        ['Subtile Details', (profile.subtle_details || []).join(', ')],
    ];
    
    el.innerHTML = fields
        .filter(([, v]) => v && v !== 'null')
        .map(([k, v]) => `<div class="profile-row"><span class="profile-key">${k}</span><span class="profile-val">${v}</span></div>`)
        .join('');
    
    document.getElementById('profileCard').style.display = 'block';
}

// Poll for updates
async function pollStatus() {
    try {
        const res = await fetch(`/api/session/status?session=${sessionId}`);
        const data = await res.json();
        
        document.getElementById('statusText').textContent = data.progress || data.status;
        
        if (data.transcript) {
            renderTranscript(data.transcript);
            document.getElementById('transcriptStatus').textContent = 'Fertig';
            document.getElementById('transcriptStatus').classList.add('done');
        }
        
        if (data.profile) {
            renderProfile(data.profile);
            document.getElementById('levelCard').style.display = 'block';
        }
        
        if (data.status === 'shop_generated' || data.status === 'shop_ready') {
            showShopControls();
        }
        
        // Keep polling unless done
        if (!['profile_ready', 'shop_generated', 'shop_ready', 'error'].includes(data.status)) {
            setTimeout(pollStatus, 2000);
        }
    } catch (err) {
        setTimeout(pollStatus, 3000);
    }
}

pollStatus();
