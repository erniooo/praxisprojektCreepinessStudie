const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');
if (!sessionId) window.location.href = '/';

let currentStage = null;
let shopData = null;
let profile = null;

// Generic fallback products
const GENERIC_PRODUCTS = [
    { name: 'Classic T-Shirt', price: '29,99 €', image: '', shop: 'NOVA', rating: 4.5, reviews: 124 },
    { name: 'Wireless Kopfhörer', price: '79,99 €', image: '', shop: 'NOVA', rating: 4.7, reviews: 203 },
    { name: 'Fitness Tracker', price: '49,99 €', image: '', shop: 'NOVA', rating: 4.3, reviews: 89 },
    { name: 'Küchenwaage Premium', price: '24,99 €', image: '', shop: 'NOVA', rating: 4.6, reviews: 156 },
    { name: 'Pflegeset Natural', price: '39,99 €', image: '', shop: 'NOVA', rating: 4.4, reviews: 67 },
    { name: 'Bestseller des Monats', price: '16,99 €', image: '', shop: 'NOVA', rating: 4.8, reviews: 312 },
    { name: 'Trinkflasche 750ml', price: '22,99 €', image: '', shop: 'NOVA', rating: 4.5, reviews: 178 },
    { name: 'Leder Geldbörse', price: '44,99 €', image: '', shop: 'NOVA', rating: 4.6, reviews: 95 }
];

function renderProductCard(product, stage) {
    const hasImage = product.image && product.image.startsWith('http');
    const imageSrc = hasImage ? `/api/image/proxy?url=${encodeURIComponent(product.image)}` : '';
    const imageHtml = hasImage
        ? `<img src="${imageSrc}" alt="${product.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<div class=product-img-placeholder>📦</div>'">`
        : '<div class="product-img-placeholder">📦</div>';
    
    const badge = product.personalLabel && stage !== 'generic'
        ? `<div class="product-badge">${stage === 'transparent' ? 'Empfohlen' : 'Für Sie'}</div>`
        : '';
    
    const personalMsg = product.personalLabel && stage !== 'generic'
        ? `<div class="personalized-message">${product.personalLabel}</div>`
        : '';
    
    const transparency = product.transparencyReason && stage === 'transparent'
        ? `<div class="transparency-box"><strong>Warum diese Empfehlung?</strong>${product.transparencyReason}</div>`
        : '';
    
    const rating = product.rating
        ? `<div class="product-rating">${'★'.repeat(Math.round(product.rating))}${'☆'.repeat(5 - Math.round(product.rating))} <span>(${product.reviews || ''})</span></div>`
        : '';

    return `
        <div class="product-card-new">
            <div class="product-image-new">${badge}${imageHtml}</div>
            <div class="product-info-new">
                ${personalMsg}
                <h3 class="product-name">${product.name}</h3>
                <p class="product-brand">${product.shop || 'NOVA'}</p>
                ${rating}
                ${transparency}
                <div class="product-price-new"><span class="price-current">${product.price}</span></div>
            </div>
        </div>
    `;
}

function renderGenericShop() {
    document.getElementById('topBar').textContent = 'Kostenloser Versand ab 50€ | 30 Tage Rückgaberecht';
    document.getElementById('greeting').textContent = '';
    document.getElementById('heroHeadline').textContent = 'Frühjahr Kollektion 2026';
    document.getElementById('heroSubtext').textContent = 'Entdecke die neuesten Trends';
    document.getElementById('heroCta').textContent = 'Jetzt shoppen';
    
    // Reset nav
    document.getElementById('mainNav').innerHTML = 
        ['Neu', 'Bestseller', 'Mode', 'Sport', 'Tech', 'Lifestyle']
        .map(c => `<a href="#">${c}</a>`).join('');
    
    // Render generic products
    document.getElementById('shopSections').innerHTML = `
        <section class="recommendations-section">
            <div class="section-header">
                <div><h2 class="section-title-new">Unsere Empfehlungen</h2>
                <p class="section-subtitle-new">Die beliebtesten Produkte dieser Woche</p></div>
                <a href="#" class="view-all">Alle ansehen →</a>
            </div>
            <div class="products-grid-new">
                ${GENERIC_PRODUCTS.map(p => renderProductCard(p, 'generic')).join('')}
            </div>
        </section>
    `;
    
    renderGenericTrustBadges();
}

function renderPersonalizedShop(data, stage) {
    const sd = data;
    const stageKey = stage === 'generic' ? 'generic' : 'personalized';
    
    // Top bar
    const banner = sd.topBanner;
    document.getElementById('topBar').textContent = 
        typeof banner === 'object' ? (banner[stageKey] || banner.generic) : banner;
    
    // Greeting
    const greet = sd.greeting;
    document.getElementById('greeting').textContent = 
        stage !== 'generic' ? (typeof greet === 'object' ? (greet.personalized || '') : greet) : '';
    
    // Hero
    const hero = sd.hero;
    const heroData = typeof hero === 'object' && hero[stageKey] ? hero[stageKey] : hero.generic || hero;
    document.getElementById('heroHeadline').textContent = heroData.headline || 'Frühjahr Kollektion 2026';
    document.getElementById('heroSubtext').textContent = heroData.subtext || 'Entdecke die neuesten Trends';
    document.getElementById('heroCta').textContent = heroData.cta || 'Jetzt shoppen';
    
    // Nav
    const nav = sd.navCategories;
    const navItems = typeof nav === 'object' && !Array.isArray(nav)
        ? (nav[stageKey] || nav.generic || ['Neu', 'Bestseller', 'Mode'])
        : (nav || ['Neu', 'Bestseller', 'Mode']);
    document.getElementById('mainNav').innerHTML = navItems.map(c => `<a href="#">${c}</a>`).join('');
    
    // Sections
    const sections = sd.sections || [];
    let sectionsHtml = '';
    
    for (const section of sections) {
        if (!section.products || section.products.length === 0) continue;
        
        const title = typeof section.title === 'object' 
            ? (section.title[stageKey] || section.title.generic) 
            : section.title;
        const subtitle = typeof section.subtitle === 'object'
            ? (section.subtitle[stageKey] || section.subtitle.generic)
            : section.subtitle;
        
        if (!title) continue;
        
        sectionsHtml += `
            <section class="recommendations-section">
                <div class="section-header">
                    <div><h2 class="section-title-new">${title}</h2>
                    ${subtitle ? `<p class="section-subtitle-new">${subtitle}</p>` : ''}</div>
                    <a href="#" class="view-all">Alle ansehen →</a>
                </div>
                <div class="products-grid-new">
                    ${section.products.map(p => renderProductCard(p, stage)).join('')}
                </div>
            </section>
        `;
    }
    
    document.getElementById('shopSections').innerHTML = sectionsHtml || '<p style="text-align:center;padding:40px;color:#666;">Keine Produkte verfügbar.</p>';
    
    // Trust badges
    if (sd.trustBadges && stage !== 'generic') {
        renderCustomTrustBadges(sd.trustBadges, stageKey);
    } else {
        renderGenericTrustBadges();
    }
}

function renderGenericTrustBadges() {
    document.getElementById('trustBadges').innerHTML = `
        <div class="trust-badge"><span class="trust-icon">✓</span><div><strong>Schneller Versand</strong><p>1-3 Werktage</p></div></div>
        <div class="trust-badge"><span class="trust-icon">↺</span><div><strong>Einfache Rückgabe</strong><p>30 Tage kostenlos</p></div></div>
        <div class="trust-badge"><span class="trust-icon">🔒</span><div><strong>Sicherer Kauf</strong><p>SSL verschlüsselt</p></div></div>
    `;
}

function renderCustomTrustBadges(badges, stageKey) {
    const icons = { truck: '✓', return: '↺', lock: '🔒' };
    document.getElementById('trustBadges').innerHTML = badges.map(b => {
        const title = typeof b.title === 'object' ? (b.title[stageKey] || b.title.generic) : b.title;
        const text = typeof b.text === 'object' ? (b.text[stageKey] || b.text.generic) : b.text;
        return `<div class="trust-badge"><span class="trust-icon">${icons[b.icon] || '✓'}</span><div><strong>${title}</strong><p>${text}</p></div></div>`;
    }).join('');
}

async function fetchAndRender() {
    try {
        const res = await fetch(`/api/shop/data?session=${sessionId}`);
        const data = await res.json();
        
        if (data.stage !== currentStage || !shopData) {
            currentStage = data.stage;
            shopData = data.shopData;
            profile = data.profile;
            
            if (!shopData) {
                renderGenericShop();
            } else {
                renderPersonalizedShop(shopData, currentStage);
            }
        }
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

fetchAndRender();
setInterval(fetchAndRender, 2000);

// === Mini-Ratings ===
const ratings = {};

document.querySelectorAll('.rating-scale').forEach(scale => {
    const key = scale.dataset.key;
    scale.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            scale.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            ratings[key] = parseInt(btn.dataset.val);
            // Enable submit if all 3 rated
            if (ratings.helpfulness && ratings.comprehensibility && ratings.creepiness) {
                document.getElementById('submitRatings').disabled = false;
            }
        });
    });
});

document.getElementById('submitRatings').addEventListener('click', async () => {
    const btn = document.getElementById('submitRatings');
    btn.disabled = true;
    btn.textContent = 'Wird gespeichert...';
    try {
        await fetch('/api/ratings/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, ratings })
        });
        document.getElementById('ratingsOverlay').innerHTML =
            '<div class="ratings-card" style="text-align:center;"><h2>Vielen Dank!</h2><p class="ratings-subtitle">Ihre Bewertung wurde gespeichert.</p></div>';
        setTimeout(() => {
            document.getElementById('ratingsOverlay').style.display = 'none';
        }, 3000);
    } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Bewertung abschicken';
    }
});

// Listen for show_ratings status
async function checkRatings() {
    try {
        const res = await fetch(`/api/session/status?session=${sessionId}`);
        const data = await res.json();
        if (data.status === 'show_ratings') {
            document.getElementById('ratingsOverlay').style.display = 'flex';
        }
    } catch (err) {}
}
setInterval(checkRatings, 2000);
