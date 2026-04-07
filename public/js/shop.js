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
        <div class="product-card-new">
            <div class="product-image-new">
                <div class="product-badge">Bestseller</div>
                <div class="product-img-placeholder">⌚</div>
            </div>
            <div class="product-info-new">
                <h3 class="product-name">Smartwatch Pro</h3>
                <p class="product-brand">NOVA Tech</p>
                <div class="product-rating">★★★★★ <span>(156)</span></div>
                <div class="product-price-new">
                    <span class="price-current">149,99 €</span>
                </div>
            </div>
        </div>
        <div class="product-card-new">
            <div class="product-image-new">
                <div class="product-img-placeholder">👟</div>
            </div>
            <div class="product-info-new">
                <h3 class="product-name">Running Schuhe</h3>
                <p class="product-brand">NOVA Sport</p>
                <div class="product-rating">★★★★☆ <span>(203)</span></div>
                <div class="product-price-new">
                    <span class="price-current">89,99 €</span>
                </div>
            </div>
        </div>
        <div class="product-card-new">
            <div class="product-image-new">
                <div class="product-badge sale">-15%</div>
                <div class="product-img-placeholder">📱</div>
            </div>
            <div class="product-info-new">
                <h3 class="product-name">Smartphone Halter</h3>
                <p class="product-brand">NOVA Tech</p>
                <div class="product-rating">★★★★★ <span>(89)</span></div>
                <div class="product-price-new">
                    <span class="price-original">22,99 €</span>
                    <span class="price-current">19,99 €</span>
                </div>
            </div>
        </div>
        <div class="product-card-new">
            <div class="product-image-new">
                <div class="product-img-placeholder">🎒</div>
            </div>
            <div class="product-info-new">
                <h3 class="product-name">Outdoor Rucksack</h3>
                <p class="product-brand">NOVA Adventure</p>
                <div class="product-rating">★★★★★ <span>(124)</span></div>
                <div class="product-price-new">
                    <span class="price-current">64,99 €</span>
                </div>
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
            <div class="product-card-new">
                <div class="product-image-new">
                    <div class="product-badge">Für Sie empfohlen</div>
                    <div class="product-img-placeholder">🏃</div>
                </div>
                <div class="product-info-new">
                    <h3 class="product-name">Premium Laufschuhe</h3>
                    <p class="product-brand">NOVA Run</p>
                    <div class="product-rating">★★★★★ <span>(178)</span></div>
                    <div class="product-price-new">
                        <span class="price-current">119,99 €</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    if (interestList.some(i => i.toLowerCase().includes('koch') || i.toLowerCase().includes('essen'))) {
        products += `
            <div class="product-card-new">
                <div class="product-image-new">
                    <div class="product-badge">Für Sie empfohlen</div>
                    <div class="product-img-placeholder">🍳</div>
                </div>
                <div class="product-info-new">
                    <h3 class="product-name">Profi Koch-Messer Set</h3>
                    <p class="product-brand">NOVA Kitchen</p>
                    <div class="product-rating">★★★★★ <span>(234)</span></div>
                    <div class="product-price-new">
                        <span class="price-current">89,99 €</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    if (interestList.some(i => i.toLowerCase().includes('gam') || i.toLowerCase().includes('spiel'))) {
        products += `
            <div class="product-card-new">
                <div class="product-image-new">
                    <div class="product-badge">Für Sie empfohlen</div>
                    <div class="product-img-placeholder">🎮</div>
                </div>
                <div class="product-info-new">
                    <h3 class="product-name">Gaming Headset Pro</h3>
                    <p class="product-brand">NOVA Gaming</p>
                    <div class="product-rating">★★★★★ <span>(312)</span></div>
                    <div class="product-price-new">
                        <span class="price-current">79,99 €</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add generic fallback
    products += `
        <div class="product-card-new">
            <div class="product-image-new">
                <div class="product-img-placeholder">📖</div>
            </div>
            <div class="product-info-new">
                <h3 class="product-name">Bestseller Buch</h3>
                <p class="product-brand">NOVA Publishing</p>
                <div class="product-rating">★★★★☆ <span>(89)</span></div>
                <div class="product-price-new">
                    <span class="price-current">16,99 €</span>
                </div>
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
        <div class="product-card-new">
            <div class="product-image-new">
                ${!showTransparency ? '<div class="product-badge">Speziell für Sie</div>' : '<div class="product-badge">Empfohlen</div>'}
                <div class="product-img-placeholder">${rec.emoji}</div>
            </div>
            <div class="product-info-new">
                ${rec.personalMessage && !showTransparency ? `<div class="personalized-message">${rec.personalMessage}</div>` : ''}
                <h3 class="product-name">${rec.title}</h3>
                <p class="product-brand">NOVA Premium</p>
                ${rec.description ? `<div class="product-rating">★★★★★ <span>(${Math.floor(Math.random() * 200 + 50)})</span></div>` : ''}
                ${showTransparency && rec.reason ? `
                    <div class="transparency-box">
                        <strong>Warum diese Empfehlung?</strong>
                        ${rec.reason}
                    </div>
                ` : ''}
                <div class="product-price-new">
                    <span class="price-current">${rec.price}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Initial load and polling
async function init() {
    await updateRecommendations();
    // Force render even if stage hasn't changed
    const response = await fetch(`/api/stage?session=${sessionId}`);
    const data = await response.json();
    renderRecommendations(data);
}

init();
setInterval(updateRecommendations, 2000); // Poll every 2 seconds
