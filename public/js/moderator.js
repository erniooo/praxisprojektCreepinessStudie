const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');

if (!sessionId) {
    document.getElementById('errorMessage').textContent = 'Keine Session-ID gefunden. Bitte starten Sie mit dem Fragebogen.';
    document.getElementById('errorMessage').style.display = 'block';
} else {
    document.getElementById('sessionId').textContent = sessionId;
    const participantUrl = `${window.location.origin}/shop.html?session=${sessionId}`;
    document.getElementById('participantLink').href = participantUrl;
    document.getElementById('participantLink').textContent = participantUrl;
    
    loadSessionData();
}

let currentStage = 'A';

async function loadSessionData() {
    try {
        const response = await fetch(`/api/stage?session=${sessionId}`);
        if (!response.ok) throw new Error('Failed to load session');
        
        const data = await response.json();
        currentStage = data.stage;
        
        // Highlight active stage
        document.querySelectorAll('.btn-stage').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.stage === currentStage) {
                btn.classList.add('active');
            }
        });
        
        // Display participant data
        if (data.userData) {
            const ud = data.userData;
            document.getElementById('participantData').innerHTML = `
                <p><strong>Vorname:</strong> ${ud.firstName}</p>
                <p><strong>Alter:</strong> ${ud.age}</p>
                <p><strong>Stadt:</strong> ${ud.city}</p>
                <p><strong>Interessen:</strong> ${ud.interests}</p>
                <p><strong>Letzte Käufe:</strong> ${ud.lastPurchase}</p>
                <p><strong>Lebenssituation:</strong> ${ud.lifestyle}</p>
                <p><strong>Gesundheitsfokus:</strong> ${ud.healthFocus || 'nicht angegeben'}</p>
            `;
        }
        
    } catch (error) {
        console.error('Error loading session:', error);
        document.getElementById('errorMessage').textContent = 'Fehler beim Laden der Session-Daten.';
        document.getElementById('errorMessage').style.display = 'block';
    }
}

async function setStage(stage) {
    try {
        const response = await fetch('/api/set-stage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session: sessionId,
                stage: stage
            })
        });
        
        if (!response.ok) throw new Error('Failed to set stage');
        
        currentStage = stage;
        
        // Update UI
        document.querySelectorAll('.btn-stage').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.stage === stage) {
                btn.classList.add('active');
            }
        });
        
    } catch (error) {
        console.error('Error setting stage:', error);
        alert('Fehler beim Wechseln der Stage. Bitte versuchen Sie es erneut.');
    }
}

// Poll for updates (in case of external changes)
setInterval(loadSessionData, 5000);
