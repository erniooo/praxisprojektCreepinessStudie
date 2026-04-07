let currentStep = 1;
const totalSteps = 7;

const steps = document.querySelectorAll('.step');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const stepTitle = document.getElementById('stepTitle');
const stepSubtitle = document.getElementById('stepSubtitle');

// Step titles and subtitles
const stepContent = {
    1: { title: 'Willkommen', subtitle: 'Bevor wir beginnen, möchte ich Sie kurz kennenlernen.' },
    2: { title: 'Alter', subtitle: 'Diese Informationen helfen mir, das Gespräch besser zu kontextualisieren.' },
    3: { title: 'Wohnort', subtitle: 'Noch ein paar kurze Fragen.' },
    4: { title: 'Interessen', subtitle: 'Was sind Ihre Hobbys?' },
    5: { title: 'Online-Shopping', subtitle: 'Fast geschafft!' },
    6: { title: 'Lebenssituation', subtitle: 'Nur noch 2 Fragen.' },
    7: { title: 'Letzte Frage', subtitle: 'Vielen Dank für Ihre Zeit!' }
};

function updateProgress() {
    const progress = (currentStep / totalSteps) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Frage ${currentStep} von ${totalSteps}`;
    
    // Update title and subtitle
    stepTitle.textContent = stepContent[currentStep].title;
    stepSubtitle.textContent = stepContent[currentStep].subtitle;
}

function showStep(step) {
    steps.forEach((s, index) => {
        if (index + 1 === step) {
            s.classList.add('active');
            // Auto-focus first input
            const input = s.querySelector('input, select');
            if (input) setTimeout(() => input.focus(), 100);
        } else {
            s.classList.remove('active');
        }
    });
    
    // Show/hide prev button
    prevBtn.style.display = step === 1 ? 'none' : 'block';
    
    // Update next button text
    if (step === totalSteps) {
        nextBtn.textContent = 'Abschließen';
    } else {
        nextBtn.textContent = 'Weiter';
    }
    
    updateProgress();
}

function validateCurrentStep() {
    const currentStepElement = document.querySelector(`.step[data-step="${currentStep}"]`);
    const inputs = currentStepElement.querySelectorAll('input[required], select[required]');
    
    for (let input of inputs) {
        if (!input.value || !input.checkValidity()) {
            input.reportValidity();
            return false;
        }
    }
    return true;
}

nextBtn.addEventListener('click', async () => {
    if (!validateCurrentStep()) {
        return;
    }
    
    if (currentStep < totalSteps) {
        currentStep++;
        showStep(currentStep);
    } else {
        // Final step - submit form
        await submitForm();
    }
});

prevBtn.addEventListener('click', () => {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
    }
});

// Allow Enter key to advance
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        nextBtn.click();
    }
});

async function submitForm() {
    const formData = {
        firstName: document.getElementById('firstName').value,
        age: document.getElementById('age').value,
        city: document.getElementById('city').value,
        interests: document.getElementById('interests').value,
        lastPurchase: document.getElementById('lastPurchase').value,
        lifestyle: document.getElementById('lifestyle').value,
        healthFocus: document.getElementById('healthFocus').value || 'nicht angegeben'
    };

    nextBtn.disabled = true;
    nextBtn.textContent = 'Wird verarbeitet...';

    try {
        const response = await fetch('/api/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error('Server-Fehler');
        }

        const data = await response.json();
        
        // Redirect to moderator panel with session ID
        window.location.href = `/moderator.html?session=${data.sessionId}`;
        
    } catch (error) {
        console.error('Error:', error);
        alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
        nextBtn.disabled = false;
        nextBtn.textContent = 'Abschließen';
    }
}

// Initialize
showStep(1);
