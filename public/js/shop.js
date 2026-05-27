const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');
if (!sessionId) window.location.href = '/';

let currentStage = null;
let shopData = null;
let profile = null;
let currentRatingStage = 'generic';
let ratings = {};
let lastProfileJson = '';
let controlState = {};
let controlStateSessionKey = '';

const GENERIC_PRODUCTS = [
    { name: 'Classic T-Shirt', price: '29,99 EUR', image: '', shop: 'NOVA', rating: 4.5, reviews: 124 },
    { name: 'Wireless Kopfhoerer', price: '79,99 EUR', image: '', shop: 'NOVA', rating: 4.7, reviews: 203 },
    { name: 'Fitness Tracker', price: '49,99 EUR', image: '', shop: 'NOVA', rating: 4.3, reviews: 89 },
    { name: 'Kuechenwaage Premium', price: '24,99 EUR', image: '', shop: 'NOVA', rating: 4.6, reviews: 156 },
    { name: 'Pflegeset Natural', price: '39,99 EUR', image: '', shop: 'NOVA', rating: 4.4, reviews: 67 },
    { name: 'Bestseller des Monats', price: '16,99 EUR', image: '', shop: 'NOVA', rating: 4.8, reviews: 312 },
    { name: 'Trinkflasche 750ml', price: '22,99 EUR', image: '', shop: 'NOVA', rating: 4.5, reviews: 178 },
    { name: 'Leder Geldboerse', price: '44,99 EUR', image: '', shop: 'NOVA', rating: 4.6, reviews: 95 }
];

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getStageLabel(stage) {
    if (stage === 'transparent') return 'Transparent';
    if (stage === 'personalized') return 'Personalisiert';
    return 'Baseline';
}

function getStageKey(stage) {
    if (stage === 'transparent') return 'transparent';
    if (stage === 'personalized') return 'personalized';
    return 'generic';
}

function stageValue(value, stage, fallback = '') {
    const stageKey = getStageKey(stage);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (Object.prototype.hasOwnProperty.call(value, stageKey)) {
            return value[stageKey] ?? fallback;
        }
        return value.personalized ?? value.generic ?? fallback;
    }
    return value ?? fallback;
}

function isHexColor(value) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || ''));
}

function cleanChoice(value, allowed, fallback) {
    const normalized = String(value || '').toLowerCase();
    return allowed.includes(normalized) ? normalized : fallback;
}

function applyShopDesign(data, stage) {
    const design = data?.design || {};
    const palette = design.palette || {};
    const defaults = {
        background: '#F5F6F3',
        surface: '#FFFFFF',
        text: '#101211',
        muted: '#646A66',
        accent: '#1F5B45',
        accentText: '#FFFFFF',
        softAccent: '#EAF4EE',
        border: '#DDE2DD',
        heroBackground: '#101211',
        heroText: '#FFFFFF'
    };

    Object.entries(defaults).forEach(([key, fallback]) => {
        const value = isHexColor(palette[key]) ? palette[key] : fallback;
        document.body.style.setProperty(`--ai-${key}`, value);
    });

    const stageKey = getStageKey(stage);
    const heroLayout = cleanChoice(design.heroLayout, ['gallery', 'editorial', 'minimal', 'split'], 'gallery');
    const cardStyle = cleanChoice(design.cardStyle, ['editorial', 'soft', 'premium', 'catalog'], 'editorial');
    const density = cleanChoice(design.density, ['airy', 'balanced', 'compact'], 'balanced');
    const imageTreatment = cleanChoice(design.imageTreatment, ['clean', 'editorial', 'rounded', 'catalog'], 'clean');

    document.body.classList.remove(
        'stage-generic', 'stage-personalized', 'stage-transparent',
        'hero-gallery', 'hero-editorial', 'hero-minimal', 'hero-split',
        'card-editorial', 'card-soft', 'card-premium', 'card-catalog',
        'density-airy', 'density-balanced', 'density-compact',
        'image-clean', 'image-editorial', 'image-rounded', 'image-catalog'
    );
    document.body.classList.add(
        'ai-designed',
        `stage-${stageKey}`,
        `hero-${heroLayout}`,
        `card-${cardStyle}`,
        `density-${density}`,
        `image-${imageTreatment}`
    );
}

function getShopLevel(data) {
    return Number(data?.level || data?.stageMetadata?.level || 1);
}

function getSignalValue(data, key) {
    return getVisibleSignals(data).find(signal => signal.key === key)?.value || '';
}

function getControlSessionKey(data) {
    return `${data?.generatedAt || ''}:${data?.level || ''}`;
}

function initializeControlState(data) {
    const key = getControlSessionKey(data);
    if (key && key !== controlStateSessionKey) {
        controlState = {};
        controlStateSessionKey = key;
    }

    (data?.controlOptions || []).forEach(option => {
        if (!Object.prototype.hasOwnProperty.call(controlState, option.id)) {
            controlState[option.id] = Boolean(option.enabled);
        }
    });
}

function isControlEnabled(id) {
    return controlState[id] !== false;
}

function getVisibleSignals(data) {
    const signals = data?.usedSignals || [];
    return signals.filter(signal => {
        if (signal.key === 'city' && !isControlEnabled('location')) return false;
        if (['life_events', 'subtle_details'].includes(signal.key) && !isControlEnabled('subtle_mentions')) return false;
        if (!['name', 'city'].includes(signal.key) && !isControlEnabled('interview_details')) return false;
        return true;
    });
}

function shouldShowProductPersonalization(product) {
    if (!isControlEnabled('interview_details')) return false;
    if (product.isCreepyMoment && !isControlEnabled('subtle_mentions')) return false;
    return true;
}

function getProfileName(data) {
    const signalName = getSignalValue(data, 'name');
    const profileName = profile?.name && profile.name !== 'null' ? profile.name : '';
    return String(signalName || profileName || '').replace(/^hallo,?\s+/i, '').trim();
}

function collectHeroProducts(data) {
    const products = [];
    (data?.sections || []).forEach(section => {
        (section.products || []).forEach(product => {
            if (product.image && product.image.startsWith('http') && products.length < 3) {
                products.push(product);
            }
        });
    });
    return products;
}

function renderHeroProductStrip(data, stage) {
    const strip = document.getElementById('heroProductStrip');
    const banner = document.getElementById('heroBanner');
    if (!strip || !banner) return;

    const products = stage !== 'generic' ? collectHeroProducts(data) : [];
    if (!products.length) {
        strip.style.display = 'none';
        strip.innerHTML = '';
        banner.classList.remove('hero-with-products');
        return;
    }

    strip.innerHTML = products.map((product, index) => `
        <div class="hero-product-thumb hero-product-thumb-${index + 1}">
            ${getImageHtml(product)}
            <span>${escapeHtml(product.name)}</span>
        </div>
    `).join('');
    strip.style.display = 'grid';
    banner.classList.add('hero-with-products');
}

function renderHeroPersonalization(data, stage) {
    const banner = document.getElementById('heroBanner');
    const kicker = document.getElementById('heroPersonalKicker');
    const contextRow = document.getElementById('heroContextRow');
    if (!banner || !kicker || !contextRow) return;

    const level = getShopLevel(data);
    const shouldShowHyperSignals = stage !== 'generic' && level >= 4 && isControlEnabled('interview_details');
    banner.classList.toggle('hero-personalized', stage !== 'generic');
    banner.classList.toggle('hero-hyper', shouldShowHyperSignals);

    if (!shouldShowHyperSignals) {
        kicker.style.display = 'none';
        kicker.textContent = '';
        contextRow.style.display = 'none';
        contextRow.innerHTML = '';
        renderHeroProductStrip(data, stage);
        return;
    }

    const name = getProfileName(data);
    kicker.textContent = name ? `Hallo ${name}` : 'Hallo';
    kicker.style.display = 'inline-flex';

    const visibleSignals = getVisibleSignals(data);
    const contextItems = visibleSignals
        .filter(signal => signal.key !== 'name')
        .map(signal => signal.value)
        .filter(Boolean)
        .slice(0, 4);

    contextRow.innerHTML = contextItems
        .map(item => `<span class="hero-context-chip">${escapeHtml(item)}</span>`)
        .join('');
    contextRow.style.display = contextItems.length ? 'flex' : 'none';
    renderHeroProductStrip(data, stage);
}

function getImageHtml(product) {
    const hasImage = product.image && product.image.startsWith('http');
    if (!hasImage) return '<div class="product-img-placeholder">Box</div>';
    const imageSrc = `/api/image/proxy?url=${encodeURIComponent(product.image)}`;
    return `<img src="${imageSrc}" alt="${escapeHtml(product.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<div class=product-img-placeholder>Box</div>'">`;
}

function renderProductCard(product, stage, sectionIndex = 0, productIndex = 0) {
    const imageHtml = getImageHtml(product);
    const shouldPersonalize = stage !== 'generic' && shouldShowProductPersonalization(product);
    const badgeText = product.isCreepyMoment ? 'Aus dem Gespraech' : (stage === 'transparent' ? 'Empfohlen' : 'Fuer Sie');
    const badge = product.personalLabel && shouldPersonalize
        ? `<div class="product-badge">${escapeHtml(badgeText)}</div>`
        : '';
    const personalMsg = product.personalLabel && shouldPersonalize
        ? `<div class="personalized-message">${escapeHtml(product.personalLabel)}</div>`
        : '';
    const transparency = product.transparencyReason && stage === 'transparent'
        ? `<div class="transparency-box"><strong>Warum diese Empfehlung?</strong>${escapeHtml(product.transparencyReason)}</div>`
        : '';
    const ratingValue = Math.max(0, Math.min(5, Math.round(product.rating || 0)));
    const rating = product.rating
        ? `<div class="product-rating">${'★'.repeat(ratingValue)}${'☆'.repeat(5 - ratingValue)} <span>(${escapeHtml(product.reviews || '')})</span></div>`
        : '';

    return `
        <div class="product-card-new ${product.isCreepyMoment && shouldPersonalize ? 'creepy-product-card' : ''}">
            <div class="product-image-new">${badge}${imageHtml}</div>
            <div class="product-info-new">
                ${personalMsg}
                <h3 class="product-name">${escapeHtml(product.name)}</h3>
                <p class="product-brand">${escapeHtml(product.shop || 'NOVA')}</p>
                ${rating}
                ${transparency}
                <div class="product-price-new"><span class="price-current">${escapeHtml(product.price)}</span></div>
            </div>
        </div>
    `;
}

function renderPersonalizationPanel(data, stage) {
    const panel = document.getElementById('personalizationPanel');
    if (!panel || stage === 'generic' || !data) {
        if (panel) panel.style.display = 'none';
        return;
    }

    const signals = getVisibleSignals(data);
    const signalChips = signals.length
        ? signals.map(signal => `<span class="signal-chip ${signal.sensitivity === 'high' ? 'sensitive' : ''}">${escapeHtml(signal.label)}: ${escapeHtml(signal.value)}</span>`).join('')
        : '<span class="signal-chip">Personalisierung reduziert</span>';
    const creepyMoment = data.creepyMoment && getShopLevel(data) >= 5 && isControlEnabled('subtle_mentions') && isControlEnabled('interview_details')
        ? `<div class="creepy-moment-banner"><strong>${escapeHtml(data.creepyMoment.headline)}</strong><p>${escapeHtml(data.creepyMoment.text)}</p></div>`
        : '';
    const transparentInfo = stage === 'transparent'
        ? `<div class="data-basis-box"><strong>${escapeHtml(data.explanationDetails?.transparentIntro || 'Genutzte Signale')}</strong><div class="signal-chip-row">${signalChips}</div></div>`
        : `<div class="signal-chip-row">${signalChips}</div>`;
    const variant = data.design?.stageVariants?.[getStageKey(stage)] || {};
    const panelTitle = variant.panelTitle || 'Personalisierungsprofil';
    const panelSummary = isControlEnabled('interview_details')
        ? (variant.panelSummary || data.explanationDetails?.summary || 'Der Shop wurde anhand deines Interviewprofils angepasst.')
        : 'Persoenliche Interviewdetails sind aktuell ausgeblendet. Die Produktauswahl bleibt als Design-Stimulus sichtbar.';
    const moodLabel = variant.moodLabel || getStageLabel(stage);

    panel.innerHTML = `
        <div class="personalization-panel-header">
            <span>${escapeHtml(moodLabel)}</span>
            <strong>${escapeHtml(panelTitle)}</strong>
        </div>
        <p>${escapeHtml(panelSummary)}</p>
        ${transparentInfo}
        ${creepyMoment}
    `;
    panel.style.display = 'block';
}

function renderControlCenter(data, stage) {
    const panel = document.getElementById('controlCenterPanel');
    const options = data?.controlOptions || [];
    if (!panel || stage === 'generic' || !data || !options.length) {
        if (panel) panel.style.display = 'none';
        return;
    }

    initializeControlState(data);
    const optionHtml = options.map(option => `
        <label class="control-toggle ${isControlEnabled(option.id) ? 'is-on' : 'is-off'}">
            <input class="control-toggle-input" type="checkbox" data-control-id="${escapeHtml(option.id)}" ${isControlEnabled(option.id) ? 'checked' : ''}>
            <span class="visual-switch"><span></span></span>
            <span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.description)}</small></span>
        </label>
    `).join('');
    const sensitiveSignals = getVisibleSignals(data).filter(signal => signal.sensitivity === 'high');
    const sensitiveButtons = stage === 'transparent' && sensitiveSignals.length
        ? `<div class="sensitive-controls">${sensitiveSignals.map(signal => `<span class="signal-visibility-pill">Sichtbar: ${escapeHtml(signal.label)}</span>`).join('')}</div>`
        : '';
    const controlHint = !isControlEnabled('interview_details')
        ? '<p class="control-feedback">Interviewdetails sind ausgeblendet. Labels, Signale und Begruendungen werden reduziert.</p>'
        : '';

    panel.innerHTML = `
        <div class="control-center-header">
            <span>Kontrollcenter</span>
            <strong>Personalisierung anpassen</strong>
        </div>
        <div class="control-toggle-list">${optionHtml}</div>
        ${controlHint}
        ${sensitiveButtons}
    `;
    panel.style.display = 'block';
}

function renderGenericShop() {
    applyShopDesign(null, 'generic');
    document.getElementById('topBar').textContent = 'Kostenloser Versand ab 50 EUR | 30 Tage Rueckgaberecht';
    document.getElementById('greeting').textContent = '';
    document.getElementById('heroHeadline').textContent = 'Fruehjahr Kollektion 2026';
    document.getElementById('heroSubtext').textContent = 'Entdecke die neuesten Trends';
    document.getElementById('heroCta').textContent = 'Jetzt shoppen';
    renderHeroPersonalization(null, 'generic');
    document.getElementById('mainNav').innerHTML = ['Neu', 'Bestseller', 'Mode', 'Sport', 'Tech', 'Lifestyle'].map(c => `<span>${c}</span>`).join('');
    renderPersonalizationPanel(null, 'generic');
    renderControlCenter(null, 'generic');
    document.getElementById('shopSections').innerHTML = `
        <section class="recommendations-section">
            <div class="section-header">
                <div><h2 class="section-title-new">Unsere Empfehlungen</h2>
                <p class="section-subtitle-new">Die beliebtesten Produkte dieser Woche</p></div>
                <span class="view-all">Kollektion</span>
            </div>
            <div class="products-grid-new">
                ${GENERIC_PRODUCTS.map((p, index) => renderProductCard(p, 'generic', 0, index)).join('')}
            </div>
        </section>
    `;
    renderGenericTrustBadges();
}

function renderPersonalizedShop(data, stage) {
    const stageKey = getStageKey(stage);
    initializeControlState(data);
    applyShopDesign(data, stage);
    document.getElementById('topBar').textContent = stageValue(data.topBanner, stage, 'Kostenloser Versand ab 50 EUR | 30 Tage Rueckgaberecht');
    document.getElementById('greeting').textContent = stage !== 'generic' ? stageValue(data.greeting, stage, '') : '';
    const hero = data.hero;
    const heroData = typeof hero === 'object' && hero[stageKey] ? hero[stageKey] : hero.generic || hero;
    document.getElementById('heroHeadline').textContent = heroData.headline || 'Fruehjahr Kollektion 2026';
    document.getElementById('heroSubtext').textContent = heroData.subtext || 'Entdecke die neuesten Trends';
    document.getElementById('heroCta').textContent = heroData.cta || 'Jetzt shoppen';
    renderHeroPersonalization(data, stage);

    const nav = data.navCategories;
    const navItems = typeof nav === 'object' && !Array.isArray(nav)
        ? (nav[stageKey] || nav.generic || ['Neu', 'Bestseller', 'Mode'])
        : (nav || ['Neu', 'Bestseller', 'Mode']);
    document.getElementById('mainNav').innerHTML = navItems.map(c => `<span>${escapeHtml(c)}</span>`).join('');
    renderPersonalizationPanel(data, stage);
    renderControlCenter(data, stage);

    const sections = data.sections || [];
    let sectionsHtml = '';
    sections.forEach((section, sectionIndex) => {
        if (!section.products || section.products.length === 0) return;
        const title = stageValue(section.title, stage, '');
        const subtitle = stageValue(section.subtitle, stage, '');
        if (!title) return;
        sectionsHtml += `
            <section class="recommendations-section">
                <div class="section-header">
                    <div><h2 class="section-title-new">${escapeHtml(title)}</h2>
                    ${subtitle ? `<p class="section-subtitle-new">${escapeHtml(subtitle)}</p>` : ''}</div>
                    <span class="view-all">${escapeHtml(data.design?.stageVariants?.[stageKey]?.moodLabel || 'Auswahl')}</span>
                </div>
                <div class="products-grid-new">
                    ${section.products.map((p, productIndex) => renderProductCard(p, stage, sectionIndex, productIndex)).join('')}
                </div>
            </section>
        `;
    });
    document.getElementById('shopSections').innerHTML = sectionsHtml || '<p style="text-align:center;padding:40px;color:#666;">Keine Produkte verfuegbar.</p>';

    if (data.trustBadges && stage !== 'generic') {
        renderCustomTrustBadges(data.trustBadges, stageKey);
    } else {
        renderGenericTrustBadges();
    }
}

function renderGenericTrustBadges() {
    document.getElementById('trustBadges').innerHTML = `
        <div class="trust-badge"><span class="trust-icon">OK</span><div><strong>Schneller Versand</strong><p>1-3 Werktage</p></div></div>
        <div class="trust-badge"><span class="trust-icon">↺</span><div><strong>Einfache Rueckgabe</strong><p>30 Tage kostenlos</p></div></div>
        <div class="trust-badge"><span class="trust-icon">SSL</span><div><strong>Sicherer Kauf</strong><p>SSL verschluesselt</p></div></div>
    `;
}

function renderCustomTrustBadges(badges, stageKey) {
    const icons = { truck: 'OK', return: '↺', lock: 'SSL' };
    document.getElementById('trustBadges').innerHTML = badges.map(b => {
        const title = stageValue(b.title, stageKey, '');
        const text = stageValue(b.text, stageKey, '');
        return `<div class="trust-badge"><span class="trust-icon">${escapeHtml(icons[b.icon] || 'OK')}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div></div>`;
    }).join('');
}

document.addEventListener('change', (event) => {
    const input = event.target.closest('.control-toggle-input');
    if (!input || !shopData || !currentStage || currentStage === 'generic') return;

    controlState[input.dataset.controlId] = input.checked;
    renderPersonalizedShop(shopData, currentStage);
});

async function fetchAndRender() {
    try {
        const res = await fetch(`/api/shop/data?session=${sessionId}`);
        const data = await res.json();
        const stageChanged = data.stage !== currentStage;
        const shopBecameAvailable = !shopData && data.shopData;
        const shopWasRegenerated = shopData && data.shopData && data.shopData.generatedAt && data.shopData.generatedAt !== shopData.generatedAt;
        const profileJson = JSON.stringify(data.profile || {});
        const profileChanged = profileJson !== lastProfileJson;
        if (stageChanged || shopBecameAvailable || shopWasRegenerated || profileChanged) {
            currentStage = data.stage;
            shopData = data.shopData;
            profile = data.profile;
            lastProfileJson = profileJson;
            if (!shopData) renderGenericShop();
            else renderPersonalizedShop(shopData, currentStage);
        }
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

function resetRatings() {
    ratings = {};
    document.querySelectorAll('.rating-scale button').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('submitRatings').disabled = true;
}

document.querySelectorAll('.rating-scale').forEach(scale => {
    const key = scale.dataset.key;
    scale.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            scale.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            ratings[key] = parseInt(btn.dataset.val, 10);
            if (ratings.helpfulness && ratings.comprehensibility && ratings.creepiness && ratings.trust) {
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
            body: JSON.stringify({ session_id: sessionId, stage: currentRatingStage, ratings })
        });
        btn.textContent = 'Gespeichert';
        setTimeout(() => {
            document.getElementById('ratingsOverlay').style.display = 'none';
            btn.textContent = 'Bewertung abschicken';
            resetRatings();
        }, 1200);
    } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Bewertung abschicken';
    }
});

async function checkRatings() {
    try {
        const res = await fetch(`/api/session/status?session=${sessionId}`);
        const data = await res.json();
        if (data.status === 'show_ratings' && document.getElementById('ratingsOverlay').style.display === 'none') {
            currentRatingStage = data.ratingRequestStage || data.stage || currentStage || 'generic';
            resetRatings();
            document.getElementById('ratingsOverlay').style.display = 'flex';
        }
    } catch (err) {}
}

fetchAndRender();
setInterval(fetchAndRender, 2000);
setInterval(checkRatings, 2000);
