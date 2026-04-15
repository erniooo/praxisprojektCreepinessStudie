const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');
if (!sessionId) {
    document.body.innerHTML = '<p style="color:white;padding:40px;">Keine Session-ID.</p>';
    throw new Error('Keine Session-ID.');
}

const levelDescriptions = {
    1: 'Baseline: Generischer Shop, keine sichtbaren Interviewdetails.',
    2: 'Harmlos: Name, Stadt oder grobe Interessen.',
    3: 'Deutlich: Mehrere Interviewdetails kombiniert.',
    4: 'Hyper: Cross-Context aus Aussagen, Profilpanel und Kontrollcenter.',
    5: 'Creepy Peak: Genau ein beilaufiger Interviewmoment wird sichtbar.'
};

const fallbackStageScripts = {
    generic: {
        goal: 'Baseline-Reaktion ohne Priming erfassen.',
        questions: [
            'Was faellt dir zuerst auf?',
            'Wie normal oder glaubwuerdig wirkt die Seite?',
            'Was wirkt passend, was unpassend?'
        ]
    },
    personalized: {
        goal: 'Treffsicherheit und vermutete Datengrundlage herausarbeiten.',
        questions: [
            'Welche Empfehlungen wirken auf dich zugeschnitten?',
            'Woher glaubst du, hat das System diese Informationen?',
            'Gab es etwas, das fast zu gut gepasst hat?'
        ]
    },
    transparent: {
        goal: 'Transparenz, Kontrolle und moegliche Uebertransparenz pruefen.',
        questions: [
            'Hilft dir die Erklaerung oder macht sie es unangenehmer?',
            'Welche Informationen sollte ein Shop nicht nutzen?',
            'Was wuerdest du gern selbst steuern oder ausschalten?'
        ]
    }
};

const stageLabels = {
    generic: 'Baseline',
    personalized: 'Personalisierte Stage',
    transparent: 'Transparente Stage'
};

let currentStage = 'generic';
let stageStartedAt = Date.now();
let stageScripts = fallbackStageScripts;
let moderatorNotes = {};
let lastRenderedTranscript = '';
let lastRenderedProfile = '';
let stageNoteDirty = false;

function el(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function asText(value) {
    if (Array.isArray(value)) return value.join(', ');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return value ?? '';
}

function formatElapsed(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function updateStageTimer() {
    const timer = el('stageTimer');
    if (timer) timer.textContent = formatElapsed(Date.now() - stageStartedAt);
}

function resetStageTimer() {
    stageStartedAt = Date.now();
    updateStageTimer();
}

function setActiveStageButton(stage) {
    document.querySelectorAll('.btn-stage-mod').forEach(button => {
        button.classList.toggle('active', button.dataset.stage === stage);
    });
}

function getStageScript(stage) {
    return stageScripts?.[stage] || fallbackStageScripts[stage] || fallbackStageScripts.generic;
}

function renderStageScript() {
    const card = el('stageScriptCard');
    const content = el('stageScriptContent');
    if (!card || !content) return;

    const script = getStageScript(currentStage);
    const questions = (script.questions || [])
        .map(question => `<li>${escapeHtml(question)}</li>`)
        .join('');

    content.innerHTML = `
        <div class="stage-script-kicker">${escapeHtml(stageLabels[currentStage] || currentStage)}</div>
        <p class="stage-script-goal">${escapeHtml(script.goal || '')}</p>
        <ol class="stage-question-list">${questions}</ol>
        <div class="stage-rating-reminder">
            Nach dieser Stage Mini-Rating anzeigen: Hilfreichkeit, Nachvollziehbarkeit, Unheimlichkeit, Vertrauen.
        </div>
    `;

    const noteInput = el('stageNote');
    if (noteInput && document.activeElement !== noteInput && !stageNoteDirty) {
        noteInput.value = moderatorNotes?.[currentStage]?.note || '';
    }
}

function showShopControls() {
    el('shopControls').style.display = 'block';
    el('releaseBtn').style.display = 'block';
    el('ratingsBtn').style.display = 'block';
    el('stageScriptCard').style.display = 'block';
    renderStageScript();
}

function renderRatingsSummary(data) {
    const result = el('ratingsResult');
    if (!result) return;

    const entries = Object.values(data.ratingsByStage || {})
        .filter(entry => entry && entry.ratings)
        .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));

    if (!entries.length && data.ratings) {
        entries.push({ stage: data.stage || currentStage, ratings: data.ratings });
    }

    if (!entries.length) {
        result.style.display = 'none';
        result.innerHTML = '';
        return;
    }

    result.style.display = 'block';
    result.innerHTML = entries.map(entry => {
        const ratings = entry.ratings || {};
        return `
            <div class="stage-rating-row">
                <span>${escapeHtml(stageLabels[entry.stage] || entry.stage || 'Stage')}</span>
                <strong>H ${escapeHtml(ratings.helpfulness || '-')}</strong>
                <strong>N ${escapeHtml(ratings.comprehensibility || '-')}</strong>
                <strong>U ${escapeHtml(ratings.creepiness || '-')}</strong>
                <strong>V ${escapeHtml(ratings.trust || '-')}</strong>
            </div>
        `;
    }).join('');
}

async function setStage(stage) {
    await fetch('/api/stage/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, stage })
    });
    currentStage = stage;
    stageNoteDirty = false;
    setActiveStageButton(stage);
    resetStageTimer();
    renderStageScript();
}

el('levelSlider').addEventListener('input', event => {
    el('levelDesc').textContent = levelDescriptions[event.target.value];
});

el('generateBtn').addEventListener('click', async () => {
    const btn = el('generateBtn');
    const level = parseInt(el('levelSlider').value, 10);
    btn.disabled = true;
    btn.textContent = 'Generiere...';

    try {
        const response = await fetch('/api/shop/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, level })
        });
        if (!response.ok) throw new Error('Generation konnte nicht gestartet werden.');
        el('statusText').textContent = 'Shop-Generierung gestartet...';
    } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Erneut versuchen';
        el('statusText').textContent = `Fehler: ${err.message}`;
    }
});

document.querySelectorAll('.btn-stage-mod').forEach(button => {
    button.addEventListener('click', () => setStage(button.dataset.stage));
});

el('releaseBtn').addEventListener('click', async () => {
    await fetch('/api/shop/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
    });
    el('releaseBtn').textContent = 'Freigegeben';
    el('releaseBtn').disabled = true;
    el('linkBox').style.display = 'block';
    el('participantLink').value = `${window.location.origin}/shop.html?session=${sessionId}`;
});

el('ratingsBtn').addEventListener('click', async () => {
    const btn = el('ratingsBtn');
    btn.disabled = true;
    btn.textContent = `Mini-Rating fuer ${stageLabels[currentStage] || currentStage} laeuft...`;
    await fetch('/api/stage/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, stage: 'show_ratings' })
    });
});

el('saveNoteBtn').addEventListener('click', async () => {
    const note = el('stageNote').value;
    const status = el('noteSaveStatus');
    status.textContent = 'Speichere...';
    await fetch('/api/moderator/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, stage: currentStage, note })
    });
    moderatorNotes[currentStage] = {
        stage: currentStage,
        note,
        timestamp: new Date().toISOString()
    };
    stageNoteDirty = false;
    status.textContent = 'Notiz gespeichert.';
    setTimeout(() => {
        if (status.textContent === 'Notiz gespeichert.') status.textContent = '';
    }, 1800);
});

function renderTranscript(transcript) {
    const serialized = JSON.stringify(transcript || []);
    if (serialized === lastRenderedTranscript) return;
    lastRenderedTranscript = serialized;

    const area = el('transcriptArea');
    area.innerHTML = (transcript || []).map(turn => `
        <div class="transcript-turn ${escapeHtml(turn.speaker)}">
            <span class="speaker-label">${turn.speaker === 'interviewer' ? 'Interviewer' : 'Teilnehmer'}</span>
            <p>${escapeHtml(turn.text)}</p>
        </div>
    `).join('');
}

function renderProfile(profile) {
    const serialized = JSON.stringify(profile || {});
    if (serialized === lastRenderedProfile) return;
    lastRenderedProfile = serialized;

    const fields = [
        ['Name', profile.name],
        ['Alter', profile.age],
        ['Stadt', profile.city],
        ['Interessen', profile.interests],
        ['Shopping', profile.shopping_habits],
        ['Marken', profile.brands],
        ['Lebenslage', profile.life_events],
        ['Preissensitiv', profile.price_sensitivity],
        ['Erwaehnte Produkte', profile.mentioned_products],
        ['Subtile Details', profile.subtle_details]
    ];

    el('profileContent').innerHTML = fields
        .map(([key, value]) => [key, asText(value)])
        .filter(([, value]) => value && value !== 'null' && value !== '[]')
        .map(([key, value]) => `<div class="profile-row"><span class="profile-key">${escapeHtml(key)}</span><span class="profile-val">${escapeHtml(value)}</span></div>`)
        .join('');
    el('profileCard').style.display = 'block';
}

function updateRatingsButton(status) {
    const btn = el('ratingsBtn');
    if (!btn || btn.style.display === 'none') return;

    if (status === 'show_ratings') {
        btn.disabled = true;
        btn.textContent = `Warte auf Bewertung fuer ${stageLabels[currentStage] || currentStage}...`;
        return;
    }

    btn.disabled = false;
    btn.textContent = `Mini-Rating jetzt anzeigen (${stageLabels[currentStage] || currentStage})`;
}

async function pollStatus() {
    try {
        const response = await fetch(`/api/session/status?session=${sessionId}`);
        if (!response.ok) throw new Error('Status nicht verfuegbar.');
        const data = await response.json();

        el('statusText').textContent = data.progress || data.status || '';

        if (data.transcript) {
            renderTranscript(data.transcript);
            el('transcriptStatus').textContent = 'Fertig';
            el('transcriptStatus').classList.add('done');
        }

        if (data.profile) {
            renderProfile(data.profile);
            el('levelCard').style.display = 'block';
        }

        if (data.shopData?.stageMetadata?.stageScripts) {
            stageScripts = data.shopData.stageMetadata.stageScripts;
            renderStageScript();
        }

        moderatorNotes = data.moderatorNotes || {};
        renderStageScript();

        if (data.stage && data.stage !== currentStage) {
            currentStage = data.stage;
            stageNoteDirty = false;
            setActiveStageButton(currentStage);
            resetStageTimer();
            renderStageScript();
        }

        if (data.shopData || ['shop_generated', 'shop_ready', 'show_ratings'].includes(data.status)) {
            showShopControls();
        }

        if (data.releasedAt) {
            el('releaseBtn').textContent = 'Freigegeben';
            el('releaseBtn').disabled = true;
            el('linkBox').style.display = 'block';
            el('participantLink').value = `${window.location.origin}/shop.html?session=${sessionId}`;
        }

        if (data.status === 'shop_generated' || data.status === 'shop_ready') {
            const generateBtn = el('generateBtn');
            generateBtn.textContent = 'Erneut generieren';
            generateBtn.disabled = false;
        }

        if (data.status === 'error') {
            const generateBtn = el('generateBtn');
            generateBtn.textContent = 'Fehler - erneut versuchen';
            generateBtn.disabled = false;
        }

        renderRatingsSummary(data);
        updateRatingsButton(data.status);
    } catch (err) {
        el('statusText').textContent = err.message;
    }
}

setActiveStageButton(currentStage);
renderStageScript();
updateStageTimer();
el('stageNote').addEventListener('input', () => {
    stageNoteDirty = true;
});
setInterval(updateStageTimer, 1000);
pollStatus();
setInterval(pollStatus, 2000);
