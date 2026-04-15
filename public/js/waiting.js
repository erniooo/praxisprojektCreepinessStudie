const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');
if (!sessionId) window.location.href = '/';

async function checkStatus() {
    try {
        const res = await fetch(`/api/session/status?session=${sessionId}`);
        const data = await res.json();
        
        if (data.status === 'shop_ready') {
            window.location.href = `/shop.html?session=${sessionId}`;
        }
    } catch (err) {
        console.error('Status check error:', err);
    }
}

setInterval(checkStatus, 3000);
checkStatus();
