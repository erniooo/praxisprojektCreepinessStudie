const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');
if (!sessionId) window.location.href = '/';

let mediaRecorder;
let audioChunks = [];
let startTime;
let timerInterval;
let audioContext;
let analyser;

async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Setup visualizer
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    drawWaveform();
    
    // Setup recorder
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
    };
    
    mediaRecorder.start(1000); // collect chunks every second
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const sec = String(elapsed % 60).padStart(2, '0');
    document.getElementById('timer').textContent = `${min}:${sec}`;
}

function drawWaveform() {
    const canvas = document.getElementById('waveform');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;
        ctx.clearRect(0, 0, w, h);
        
        const barCount = 60;
        const barWidth = w / barCount - 2;
        const step = Math.floor(bufferLength / barCount);
        
        for (let i = 0; i < barCount; i++) {
            const val = dataArray[i * step] / 255;
            const barHeight = Math.max(2, val * h * 0.8);
            const x = i * (barWidth + 2);
            const y = (h - barHeight) / 2;
            
            ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + val * 0.6})`;
            ctx.fillRect(x, y, barWidth, barHeight);
        }
    }
    draw();
}

document.getElementById('stopBtn').addEventListener('click', async () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    
    const btn = document.getElementById('stopBtn');
    btn.disabled = true;
    btn.textContent = 'Wird beendet...';
    
    mediaRecorder.stop();
    clearInterval(timerInterval);
    
    // Wait for last data
    await new Promise(resolve => {
        mediaRecorder.onstop = resolve;
    });
    
    // Show upload status
    document.getElementById('uploadStatus').style.display = 'flex';
    btn.style.display = 'none';
    document.querySelector('.rec-indicator').style.display = 'none';
    
    // Upload audio
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('audio', blob, `${sessionId}.webm`);
    
    try {
        await fetch('/api/audio/upload', { method: 'POST', body: formData });
        
        // Open moderator panel in new tab, redirect current to waiting
        window.open(`/moderator.html?session=${sessionId}`, '_blank');
        window.location.href = `/waiting.html?session=${sessionId}`;
    } catch (err) {
        alert('Fehler beim Hochladen. Bitte versuchen Sie es erneut.');
        btn.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Interview beenden';
    }
});

startRecording();
