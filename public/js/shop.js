// Get session ID from URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');

if (!sessionId) {
    window.location.href = '/fragebogen.html';
}

let currentStage = 'A';

// Poll for stage updates
async function updateRecommendations() {
    try {
        const response = await fetch(`/api/stage?session=${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch stage');
        
        const data = await response.json();
        
        if (data.stage !== currentStage) {
            currentStage = data.stage;
            renderRecommendations(data);
        }
    } catch (error) {
        console.error('Error updating recommendations:', error);
    }
}

function renderRecommendations(data) {
    const title = document.getElementById('rec-title');
    const subtitle = document.getElementById('rec-subtitle');
    const grid = document.getElementById('recommendations-grid');
    
    switch (data.stage) {
        case 'A':
            // Stage A: Generic bestsellers
            title.textContent = 'Bestseller der Woche';
            subtitle.textContent = 'Die meistverkauften Produkte';
            grid.innerHTML = renderGenericProducts();
            break;
            
        case 'B':
            // Stage B: Interest-based
            title.textContent = 'Basierend auf Ihren Interessen';
            subtitle.textContent = 'Produkte, die zu Ihren Hobbys passen';
            grid.innerHTML = renderInterestProducts(data);
            break;
            
        case 'C':
            // Stage C: Hyper-personalized (creepy)
            title.textContent = 'Genau für Sie zusammengestellt';
            subtitle.textContent = '';
            grid.innerHTML = renderPersonalizedProducts(data, false);
            break;
            
        case 'D':
            // Stage D: Transparent
            title.textContent = 'Ihre persönlichen Empfehlungen';
            subtitle.textContent = 'Basierend auf den Informationen, die Sie uns gegeben haben';
            grid.innerHTML = renderPersonalizedProducts(data, true);
            break;
    }
}

function renderGenericProducts() {
    return `
        <div class="product-card">
            <div class="product-image">⌚</div>
            <div class="product-content">
                <h3 class="product-title">Smartwatch Pro</h3>
                <p class="product-description">Fitness-Tracking und Benachrichtigungen</p>
                <div class="product-price">149,99 €</div>
            </div>
        </div>
        <div class="product-card">
            <div class="product-image">👟</div>
            <div class="product-content">
                <h3 class="product-title">Running Schuhe</h3>
                <p class="product-description">Optimaler Komfort für jeden Läufer</p>
                <div class="product-price">89,99 €</div>
            </div>
        </div>
        <div class="product-card">
            <div class="product-image">📱</div>
            <div class="product-content">
                <h3 class="product-title">Smartphone Halter</h3>
                <p class="product-description">Universal für alle Geräte</p>
                <div class="product-price">19,99 €</div>
            </div>
        </div>
        <div class="product-card">
            <div class="product-image">🎒</div>
            <div class="product-content">
                <h3 class="product-title">Outdoor Rucksack</h3>
                <p class="product-description">Wasserabweisend, 30L Volumen</p>
                <div class="product-price">64,99 €</div>
            </div>
        </div>
    `;
}

function renderInterestProducts(data) {
    const interests = data.userData?.interests || '';
    const interestList = interests.split(',').map(i => i.trim());
    
    let products = '';
    
    if (interestList.some(i => i.toLowerCase().includes('sport') || i.toLowerCase().includes('lauf') || i.toLowerCase().includes('fitness'))) {
        products += `
            <div class="product-card">
                <div class="product-image">🏃</div>
                <div class="product-content">
                    <span class="recommendation-badge">Passend zu Ihren Interessen</span>
                    <h3 class="product-title">Premium Laufschuhe</h3>
                    <p class="product-description">Professionelle Running-Schuhe für ambitionierte Läufer</p>
                    <div class="product-price">119,99 €</div>
                </div>
            </div>
        `;
    }
    
    if (interestList.some(i => i.toLowerCase().includes('koch') || i.toLowerCase().includes('essen'))) {
        products += `
            <div class="product-card">
                <div class="product-image">🍳</div>
                <div class="product-content">
                    <span class="recommendation-badge">Passend zu Ihren Interessen</span>
                    <h3 class="product-title">Koch-Messer Set</h3>
                    <p class="product-description">Professionelles Set für Hobbyköche</p>
                    <div class="product-price">89,99 €</div>
                </div>
            </div>
        `;
    }
    
    if (interestList.some(i => i.toLowerCase().includes('gam') || i.toLowerCase().includes('spiel'))) {
        products += `
            <div class="product-card">
                <div class="product-image">🎮</div>
                <div class="product-content">
                    <span class="recommendation-badge">Passend zu Ihren Interessen</span>
                    <h3 class="product-title">Gaming Headset</h3>
                    <p class="product-description">7.1 Surround Sound für immersives Gaming</p>
                    <div class="product-price">79,99 €</div>
                </div>
            </div>
        `;
    }
    
    // Add generic fallback
    products += `
        <div class="product-card">
            <div class="product-image">📖</div>
            <div class="product-content">
                <span class="recommendation-badge">Könnte Sie interessieren</span>
                <h3 class="product-title">Bestseller Buch</h3>
                <p class="product-description">Aktuelle Top-Empfehlung</p>
                <div class="product-price">16,99 €</div>
            </div>
        </div>
    `;
    
    return products;
}

function renderPersonalizedProducts(data, showTransparency) {
    if (!data.recommendations || data.recommendations.length === 0) {
        return '<p class="loading">Empfehlungen werden geladen...</p>';
    }
    
    return data.recommendations.map(rec => `
        <div class="product-card">
            <div class="product-image">${rec.emoji}</div>
            <div class="product-content">
                ${rec.personalMessage ? `<div class="personalized-message">${rec.personalMessage}</div>` : ''}
                <h3 class="product-title">${rec.title}</h3>
                <p class="product-description">${rec.description}</p>
                ${showTransparency && rec.reason ? `
                    <div class="transparency-box">
                        <strong>Warum diese Empfehlung?</strong>
                        ${rec.reason}
                    </div>
                ` : ''}
                <div class="product-price">${rec.price}</div>
            </div>
        </div>
    `).join('');
}

// Initial load and polling
updateRecommendations();
setInterval(updateRecommendations, 2000); // Poll every 2 seconds
