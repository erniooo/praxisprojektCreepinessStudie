const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');
if (!sessionId) window.location.href = '/';

let currentStage = null;
let shopData = null;
let profile = null;
let currentRatingStage = 'generic';
let ratings = {};

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

function getShopLevel(data) {
    return Number(data?.level || data?.stageMetadata?.level || 1);
}

function getSignalValue(data, key) {
    return (data?.usedSignals || []).find(signal => signal.key === key)?.value || '';
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
    const shouldShowHyperSignals = stage !== 'generic' && level >= 4;
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

    const contextItems = [
        getSignalValue(data, 'city'),
        getSignalValue(data, 'interests'),
        getSignalValue(data, 'price_sensitivity'),
        level >= 5 ? data?.creepyMoment?.signal : ''
    ].filter(Boolean).slice(0, 4);

    contextRow.innerHTML = contextItems
        .map(item => `<span class="hero-context-chip">${escapeHtml(item)}</span>`)
        .join('');
    contextRow.style.display = contextItems.length ? 'flex' : 'none';
    renderHeroProductStrip(data, stage);
}

async function track(type, payload = {}) {
    try {
        await fetch('/api/interaction/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, type, payload })
        });
    } catch (err) {}
}

function getImageHtml(product) {
    const hasImage = product.image && product.image.startsWith('http');
    if (!hasImage) return '<div class="product-img-placeholder">Box</div>';
    const imageSrc = `/api/image/proxy?url=${encodeURIComponent(product.image)}`;
    return `<img src="${imageSrc}" alt="${escapeHtml(product.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<div class=product-img-placeholder>Box</div>'">`;
}

function getProductByIndex(sectionIndex, productIndex) {
    const section = shopData?.sections?.[sectionIndex];
    return section?.products?.[productIndex] || null;
}

function renderProductCard(product, stage, sectionIndex = 0, productIndex = 0) {
    const imageHtml = getImageHtml(product);
    const shouldPersonalize = stage !== 'generic';
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
    const stimulusActions = shouldPersonalize
        ? `<div class="product-stimulus-actions">
            <button type="button" class="why-btn" data-section="${sectionIndex}" data-product="${productIndex}">Warum sehe ich das?</button>
            ${getShopLevel(shopData) >= 4 ? `<button type="button" class="less-btn" data-section="${sectionIndex}" data-product="${productIndex}">Weniger davon</button>` : ''}
        </div>`
        : '';

    return `
        <div class="product-card-new ${product.isCreepyMoment && shouldPersonalize ? 'creepy-product-card' : ''}">
            <button type="button" class="product-detail-trigger" data-section="${sectionIndex}" data-product="${productIndex}" aria-label="Produktdetails anzeigen">
                <div class="product-image-new">${badge}${imageHtml}</div>
            </button>
            <div class="product-info-new">
                ${personalMsg}
                <h3 class="product-name">${escapeHtml(product.name)}</h3>
                <p class="product-brand">${escapeHtml(product.shop || 'NOVA')}</p>
                ${rating}
                ${transparency}
                <div class="product-price-new"><span class="price-current">${escapeHtml(product.price)}</span></div>
                ${stimulusActions}
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

    const signals = data.usedSignals || [];
    const signalChips = signals.length
        ? signals.map(signal => `<span class="signal-chip ${signal.sensitivity === 'high' ? 'sensitive' : ''}">${escapeHtml(signal.label)}: ${escapeHtml(signal.value)}</span>`).join('')
        : '<span class="signal-chip">Keine sichtbaren Signale</span>';
    const creepyMoment = data.creepyMoment && getShopLevel(data) >= 5
        ? `<div class="creepy-moment-banner"><strong>${escapeHtml(data.creepyMoment.headline)}</strong><p>${escapeHtml(data.creepyMoment.text)}</p></div>`
        : '';
    const transparentInfo = stage === 'transparent'
        ? `<div class="data-basis-box"><strong>${escapeHtml(data.explanationDetails?.transparentIntro || 'Genutzte Signale')}</strong><div class="signal-chip-row">${signalChips}</div></div>`
        : `<div class="signal-chip-row">${signalChips}</div>`;

    panel.innerHTML = `
        <div class="personalization-panel-header">
            <span>${escapeHtml(getStageLabel(stage))}</span>
            <strong>Personalisierungsprofil</strong>
        </div>
        <p>${escapeHtml(data.explanationDetails?.summary || 'Der Shop wurde anhand deines Interviewprofils angepasst.')}</p>
        ${transparentInfo}
        ${creepyMoment}
    `;
    panel.style.display = 'block';
}

function renderControlCenter(data, stage) {
    const panel = document.getElementById('controlCenterPanel');
    if (!panel || stage === 'generic' || !data || getShopLevel(data) < 4) {
        if (panel) panel.style.display = 'none';
        return;
    }

    const options = data.controlOptions || [];
    const optionHtml = options.map(option => `
        <label class="control-toggle">
            <input type="checkbox" ${option.enabled ? 'checked' : ''} data-control-id="${escapeHtml(option.id)}">
            <span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.description)}</small></span>
        </label>
    `).join('');
    const sensitiveSignals = (data.usedSignals || []).filter(signal => signal.sensitivity === 'high');
    const sensitiveButtons = stage === 'transparent' && sensitiveSignals.length
        ? `<div class="sensitive-controls">${sensitiveSignals.map(signal => `<button type="button" class="reject-signal-btn" data-signal="${escapeHtml(signal.key)}">Diese Info nicht verwenden: ${escapeHtml(signal.label)}</button>`).join('')}</div>`
        : '';

    panel.innerHTML = `
        <div class="control-center-header">
            <span>Kontrollcenter</span>
            <strong>Personalisierung anpassen</strong>
        </div>
        <div class="control-toggle-list">${optionHtml}</div>
        ${sensitiveButtons}
    `;
    panel.style.display = 'block';
}

function renderGenericShop() {
    document.getElementById('topBar').textContent = 'Kostenloser Versand ab 50 EUR | 30 Tage Rueckgaberecht';
    document.getElementById('greeting').textContent = '';
    document.getElementById('heroHeadline').textContent = 'Fruehjahr Kollektion 2026';
    document.getElementById('heroSubtext').textContent = 'Entdecke die neuesten Trends';
    document.getElementById('heroCta').textContent = 'Jetzt shoppen';
    renderHeroPersonalization(null, 'generic');
    document.getElementById('mainNav').innerHTML = ['Neu', 'Bestseller', 'Mode', 'Sport', 'Tech', 'Lifestyle'].map(c => `<a href="#">${c}</a>`).join('');
    renderPersonalizationPanel(null, 'generic');
    renderControlCenter(null, 'generic');
    document.getElementById('shopSections').innerHTML = `
        <section class="recommendations-section">
            <div class="section-header">
                <div><h2 class="section-title-new">Unsere Empfehlungen</h2>
                <p class="section-subtitle-new">Die beliebtesten Produkte dieser Woche</p></div>
                <a href="#" class="view-all">Alle ansehen</a>
            </div>
            <div class="products-grid-new">
                ${GENERIC_PRODUCTS.map((p, index) => renderProductCard(p, 'generic', 0, index)).join('')}
            </div>
        </section>
    `;
    renderGenericTrustBadges();
}

function renderPersonalizedShop(data, stage) {
    const stageKey = stage === 'generic' ? 'generic' : 'personalized';
    const banner = data.topBanner;
    document.getElementById('topBar').textContent = typeof banner === 'object' ? (banner[stageKey] || banner.generic) : banner;
    const greet = data.greeting;
    document.getElementById('greeting').textContent = stage !== 'generic' ? (typeof greet === 'object' ? (greet.personalized || '') : greet) : '';
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
    document.getElementById('mainNav').innerHTML = navItems.map(c => `<a href="#">${escapeHtml(c)}</a>`).join('');
    renderPersonalizationPanel(data, stage);
    renderControlCenter(data, stage);

    const sections = data.sections || [];
    let sectionsHtml = '';
    sections.forEach((section, sectionIndex) => {
        if (!section.products || section.products.length === 0) return;
        const title = typeof section.title === 'object' ? (section.title[stageKey] || section.title.generic) : section.title;
        const subtitle = typeof section.subtitle === 'object' ? (section.subtitle[stageKey] || section.subtitle.generic) : section.subtitle;
        if (!title) return;
        sectionsHtml += `
            <section class="recommendations-section">
                <div class="section-header">
                    <div><h2 class="section-title-new">${escapeHtml(title)}</h2>
                    ${subtitle ? `<p class="section-subtitle-new">${escapeHtml(subtitle)}</p>` : ''}</div>
                    <a href="#" class="view-all">Alle ansehen</a>
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
        const title = typeof b.title === 'object' ? (b.title[stageKey] || b.title.generic) : b.title;
        const text = typeof b.text === 'object' ? (b.text[stageKey] || b.text.generic) : b.text;
        return `<div class="trust-badge"><span class="trust-icon">${escapeHtml(icons[b.icon] || 'OK')}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div></div>`;
    }).join('');
}

function openModal(html) {
    document.getElementById('shopModalContent').innerHTML = html;
    document.getElementById('shopModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('shopModal').style.display = 'none';
}

function showWhyModal(product, sectionIndex, productIndex) {
    track('why_click', { sectionIndex, productIndex, productName: product.name });
    const signals = (shopData?.usedSignals || []).map(signal => `<li>${escapeHtml(signal.label)}: ${escapeHtml(signal.value)}</li>`).join('');
    openModal(`
        <h2>Warum sehe ich das?</h2>
        <p>${escapeHtml(product.whyDetails || product.transparencyReason || 'Diese Empfehlung basiert auf deinem Interviewprofil und den abgeleiteten Suchbegriffen.')}</p>
        <div class="modal-signal-box">
            <strong>Genutzte Signale</strong>
            <ul>${signals || '<li>Allgemeine Shop-Signale</li>'}</ul>
        </div>
    `);
}

function showProductModal(product, sectionIndex, productIndex) {
    track('product_detail_open', { sectionIndex, productIndex, productName: product.name });
    openModal(`
        <div class="modal-product-layout">
            <div class="modal-product-image">${getImageHtml(product)}</div>
            <div>
                <p class="product-brand">${escapeHtml(product.shop || 'NOVA')}</p>
                <h2>${escapeHtml(product.name)}</h2>
                <p class="modal-price">${escapeHtml(product.price)}</p>
                <p>${escapeHtml(product.whyDetails || 'Dieses Produkt stammt aus echten Shopping-Ergebnissen und wurde in den Grundshop aufgenommen.')}</p>
                ${currentStage !== 'generic' ? `<button type="button" class="modal-secondary-btn" data-modal-action="why" data-section="${sectionIndex}" data-product="${productIndex}">Warum dieses Produkt?</button>` : ''}
            </div>
        </div>
    `);
}

document.addEventListener('click', (event) => {
    const whyButton = event.target.closest('.why-btn');
    if (whyButton) {
        const product = getProductByIndex(Number(whyButton.dataset.section), Number(whyButton.dataset.product));
        if (product) showWhyModal(product, Number(whyButton.dataset.section), Number(whyButton.dataset.product));
        return;
    }
    const lessButton = event.target.closest('.less-btn');
    if (lessButton) {
        const product = getProductByIndex(Number(lessButton.dataset.section), Number(lessButton.dataset.product));
        track('less_like_this_click', { productName: product?.name || '', sectionIndex: lessButton.dataset.section, productIndex: lessButton.dataset.product });
        lessButton.textContent = 'Vermerkt';
        lessButton.disabled = true;
        return;
    }
    const detailButton = event.target.closest('.product-detail-trigger');
    if (detailButton) {
        const sectionIndex = Number(detailButton.dataset.section);
        const productIndex = Number(detailButton.dataset.product);
        const product = getProductByIndex(sectionIndex, productIndex);
        if (product) showProductModal(product, sectionIndex, productIndex);
        return;
    }
    const rejectSignalButton = event.target.closest('.reject-signal-btn');
    if (rejectSignalButton) {
        track('reject_signal_click', { signal: rejectSignalButton.dataset.signal });
        rejectSignalButton.textContent = 'Info ausgeschlossen';
        rejectSignalButton.disabled = true;
        return;
    }
    const controlInput = event.target.closest('.control-toggle input');
    if (controlInput) {
        track('control_toggle', { id: controlInput.dataset.controlId, enabled: controlInput.checked });
        return;
    }
    const modalWhy = event.target.closest('[data-modal-action="why"]');
    if (modalWhy) {
        const product = getProductByIndex(Number(modalWhy.dataset.section), Number(modalWhy.dataset.product));
        if (product) showWhyModal(product, Number(modalWhy.dataset.section), Number(modalWhy.dataset.product));
    }
});

document.getElementById('shopModalClose').addEventListener('click', closeModal);
document.getElementById('shopModal').addEventListener('click', (event) => {
    if (event.target.id === 'shopModal') closeModal();
});

async function fetchAndRender() {
    try {
        const res = await fetch(`/api/shop/data?session=${sessionId}`);
        const data = await res.json();
        const stageChanged = data.stage !== currentStage;
        const shopBecameAvailable = !shopData && data.shopData;
        const shopWasRegenerated = shopData && data.shopData && data.shopData.generatedAt && data.shopData.generatedAt !== shopData.generatedAt;
        if (stageChanged || shopBecameAvailable || shopWasRegenerated) {
            currentStage = data.stage;
            shopData = data.shopData;
            profile = data.profile;
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
