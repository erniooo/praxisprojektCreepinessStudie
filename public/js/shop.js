const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');
if (!sessionId) window.location.href = '/';

let currentStage = null;
let shopData = null;
let profile = null;
let currentRatingStage = 'generic';
let ratings = {};
let renderedSections = [];

const GENERIC_PRODUCTS = [
    { name: 'Classic T-Shirt', price: '29,99 EUR', image: '', shop: 'NOVA', rating: 4.5, reviews: 124 },
    { name: 'Wireless Kopfhörer', price: '79,99 EUR', image: '', shop: 'NOVA', rating: 4.7, reviews: 203 },
    { name: 'Fitness Tracker', price: '49,99 EUR', image: '', shop: 'NOVA', rating: 4.3, reviews: 89 },
    { name: 'Küchenwaage Premium', price: '24,99 EUR', image: '', shop: 'NOVA', rating: 4.6, reviews: 156 },
    { name: 'Pflegeset Natural', price: '39,99 EUR', image: '', shop: 'NOVA', rating: 4.4, reviews: 67 },
    { name: 'Bestseller des Monats', price: '16,99 EUR', image: '', shop: 'NOVA', rating: 4.8, reviews: 312 },
    { name: 'Trinkflasche 750ml', price: '22,99 EUR', image: '', shop: 'NOVA', rating: 4.5, reviews: 178 },
    { name: 'Leder Geldbörse', price: '44,99 EUR', image: '', shop: 'NOVA', rating: 4.6, reviews: 95 },
    { name: 'Sneaker Classic Low', price: '59,99 EUR', image: '', shop: 'NOVA', rating: 4.4, reviews: 168 },
    { name: 'Rucksack 20L', price: '44,99 EUR', image: '', shop: 'NOVA', rating: 4.7, reviews: 251 },
    { name: 'Powerbank 20.000 mAh', price: '29,99 EUR', image: '', shop: 'NOVA', rating: 4.5, reviews: 188 },
    { name: 'Yogamatte rutschfest', price: '27,99 EUR', image: '', shop: 'NOVA', rating: 4.6, reviews: 154 }
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

function collectHeroProducts(data, sections) {
    const products = [];
    (sections || []).forEach(section => {
        (section.products || []).forEach(product => {
            if (product.image && product.image.startsWith('http') && products.length < 3) {
                products.push(product);
            }
        });
    });
    return products;
}

function renderHeroProductStrip(data, stage, sections) {
    const strip = document.getElementById('heroProductStrip');
    const banner = document.getElementById('heroBanner');
    if (!strip || !banner) return;

    const products = stage !== 'generic' ? collectHeroProducts(data, sections) : [];
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

function renderHeroPersonalization(data, stage, sections) {
    const banner = document.getElementById('heroBanner');
    const kicker = document.getElementById('heroPersonalKicker');
    const contextRow = document.getElementById('heroContextRow');
    if (!banner || !kicker || !contextRow) return;

    const personalized = stage !== 'generic';
    banner.classList.toggle('hero-personalized', personalized);
    banner.classList.toggle('hero-hyper', personalized && getShopLevel(data) >= 4);

    // Profil-Auflistung (Stadt, Interessen, beiläufige Details) wird bewusst NICHT
    // mehr angezeigt - die Personalisierung soll sich durch die Produkte zeigen,
    // nicht durch eine explizite Aufzählung des Profils.
    contextRow.style.display = 'none';
    contextRow.innerHTML = '';

    if (!personalized) {
        kicker.style.display = 'none';
        kicker.textContent = '';
        renderHeroProductStrip(data, stage, sections);
        return;
    }

    const name = getProfileName(data);
    kicker.textContent = name ? `Hallo ${name}` : 'Hallo';
    kicker.style.display = 'inline-flex';
    renderHeroProductStrip(data, stage, sections);
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
    const section = renderedSections?.[sectionIndex];
    return section?.products?.[productIndex] || null;
}

function renderProductCard(product, stage, sectionIndex = 0, productIndex = 0) {
    const imageHtml = getImageHtml(product);
    const shouldPersonalize = stage !== 'generic';
    const badgeText = stage === 'transparent' ? 'Empfohlen' : 'Für Sie';
    const badge = product.personalLabel && shouldPersonalize
        ? `<div class="product-badge">${escapeHtml(badgeText)}</div>`
        : '';
    const personalMsg = product.personalLabel && shouldPersonalize
        ? `<div class="personalized-message">${escapeHtml(product.personalLabel)}</div>`
        : '';
    // Transparente Hinweise nur in der transparenten Ansicht.
    const transparency = product.transparencyReason && stage === 'transparent'
        ? `<div class="transparency-box"><strong>Warum diese Empfehlung?</strong>${escapeHtml(product.transparencyReason)}</div>`
        : '';
    const ratingValue = Math.max(0, Math.min(5, Math.round(product.rating || 0)));
    const rating = product.rating
        ? `<div class="product-rating">${'★'.repeat(ratingValue)}${'☆'.repeat(5 - ratingValue)} <span>(${escapeHtml(product.reviews || '')})</span></div>`
        : '';
    // Pro-Produkt-Kontrolle (Kontrollcenter pro Karte) nur in der transparenten Ansicht.
    const stimulusActions = stage === 'transparent'
        ? `<div class="product-stimulus-actions">
            <button type="button" class="why-btn" data-section="${sectionIndex}" data-product="${productIndex}">Warum sehe ich diese Empfehlung?</button>
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

// Das Personalisierungsprofil ("Edit"-Panel, das auflistet welches Profil vorliegt)
// wird in KEINER Ansicht mehr angezeigt.
function renderPersonalizationPanel() {
    const panel = document.getElementById('personalizationPanel');
    if (panel) {
        panel.style.display = 'none';
        panel.innerHTML = '';
    }
}

// Kontrollcenter: nur in der transparenten Ansicht sichtbar.
function renderControlCenter(data, stage) {
    const panel = document.getElementById('controlCenterPanel');
    if (!panel || stage !== 'transparent' || !data) {
        if (panel) {
            panel.style.display = 'none';
            panel.innerHTML = '';
        }
        return;
    }

    const options = data.controlOptions || [];
    const optionHtml = options.map(option => `
        <label class="control-toggle">
            <input type="checkbox" ${option.enabled ? 'checked' : ''} data-control-id="${escapeHtml(option.id)}">
            <span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.description)}</small></span>
        </label>
    `).join('');

    const actions = data.controlActions || [];
    const actionHtml = actions.length
        ? `<div class="modal-action-row">${actions.map(action => `<button type="button" class="modal-secondary-btn" data-control-action="${escapeHtml(action.id)}" title="${escapeHtml(action.description || '')}">${escapeHtml(action.label)}</button>`).join('')}</div>`
        : '';

    panel.innerHTML = `
        <div class="control-center-header">
            <span>Kontrollcenter</span>
            <strong>Personalisierung anpassen</strong>
        </div>
        <p>Lege fest, welche Informationen der Shop für deine Empfehlungen verwenden darf.</p>
        <div class="control-toggle-list">${optionHtml}</div>
        ${actionHtml}
    `;
    panel.style.display = 'block';
}

function renderGenericShop() {
    document.getElementById('topBar').textContent = 'Kostenloser Versand ab 50 EUR | 30 Tage Rückgaberecht';
    document.getElementById('greeting').textContent = '';
    document.getElementById('heroHeadline').textContent = 'Frühjahr Kollektion 2026';
    document.getElementById('heroSubtext').textContent = 'Entdecke die neuesten Trends';
    document.getElementById('heroCta').textContent = 'Jetzt shoppen';
    renderHeroPersonalization(null, 'generic', []);
    document.getElementById('mainNav').innerHTML = ['Neu', 'Bestseller', 'Mode', 'Sport', 'Tech', 'Lifestyle'].map(c => `<a href="#">${c}</a>`).join('');
    renderPersonalizationPanel();
    renderControlCenter(null, 'generic');
    renderedSections = [{ id: 'generic_fallback', products: GENERIC_PRODUCTS }];
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

    // Generic-Ansicht zeigt einen ANDEREN, neutralen Produktsatz als die
    // personalisierte Ansicht (sofern vorhanden).
    let sections;
    if (stage === 'generic' && Array.isArray(data.genericSections) && data.genericSections.length) {
        sections = data.genericSections;
    } else {
        sections = data.sections || [];
    }
    renderedSections = sections;

    const banner = data.topBanner;
    document.getElementById('topBar').textContent = typeof banner === 'object' ? (banner[stageKey] || banner.generic) : banner;
    const greet = data.greeting;
    document.getElementById('greeting').textContent = stage !== 'generic' ? (typeof greet === 'object' ? (greet.personalized || '') : greet) : '';
    const hero = data.hero;
    const heroData = typeof hero === 'object' && hero[stageKey] ? hero[stageKey] : hero.generic || hero;
    document.getElementById('heroHeadline').textContent = heroData.headline || 'Frühjahr Kollektion 2026';
    document.getElementById('heroSubtext').textContent = heroData.subtext || 'Entdecke die neuesten Trends';
    document.getElementById('heroCta').textContent = heroData.cta || 'Jetzt shoppen';
    renderHeroPersonalization(data, stage, sections);

    const nav = data.navCategories;
    const navItems = typeof nav === 'object' && !Array.isArray(nav)
        ? (nav[stageKey] || nav.generic || ['Neu', 'Bestseller', 'Mode'])
        : (nav || ['Neu', 'Bestseller', 'Mode']);
    document.getElementById('mainNav').innerHTML = navItems.map(c => `<a href="#">${escapeHtml(c)}</a>`).join('');
    renderPersonalizationPanel();
    renderControlCenter(data, stage);

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
    document.getElementById('shopSections').innerHTML = sectionsHtml || '<p style="text-align:center;padding:40px;color:#666;">Keine Produkte verfügbar.</p>';

    if (data.trustBadges && stage !== 'generic') {
        renderCustomTrustBadges(data.trustBadges, stageKey);
    } else {
        renderGenericTrustBadges();
    }
}

function renderGenericTrustBadges() {
    document.getElementById('trustBadges').innerHTML = `
        <div class="trust-badge"><span class="trust-icon">OK</span><div><strong>Schneller Versand</strong><p>1-3 Werktage</p></div></div>
        <div class="trust-badge"><span class="trust-icon">↺</span><div><strong>Einfache Rückgabe</strong><p>30 Tage kostenlos</p></div></div>
        <div class="trust-badge"><span class="trust-icon">SSL</span><div><strong>Sicherer Kauf</strong><p>SSL verschlüsselt</p></div></div>
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

// Pro-Produkt-Erklärung + Kontrollcenter: transparente Erklärung plus die
// Möglichkeit, mehr Kontrolle auszuüben (einzelne Infos ausschließen,
// Datenquellen steuern, weitere Kontroll-Aktionen).
function showWhyModal(product, sectionIndex, productIndex) {
    track('why_click', { sectionIndex, productIndex, productName: product.name });

    const reason = product.whyDetails || product.transparencyReason
        || 'Diese Empfehlung basiert auf deinem Interviewprofil und den daraus abgeleiteten Suchbegriffen.';

    const signals = shopData?.usedSignals || [];
    const signalControls = signals.length
        ? signals.map(signal => `<button type="button" class="reject-signal-btn" data-signal="${escapeHtml(signal.key)}">Diese Information nicht verwenden: ${escapeHtml(signal.label)}</button>`).join('')
        : '<p style="font-size:13px;color:#666;margin:0;">Für dieses Produkt sind keine einzelnen Signale hinterlegt.</p>';

    const options = shopData?.controlOptions || [];
    const optionHtml = options.map(option => `
        <label class="control-toggle">
            <input type="checkbox" ${option.enabled ? 'checked' : ''} data-control-id="${escapeHtml(option.id)}">
            <span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.description)}</small></span>
        </label>
    `).join('');

    const actions = shopData?.controlActions || [];
    const actionHtml = actions.length
        ? `<div class="modal-action-row">${actions.map(action => `<button type="button" class="modal-secondary-btn" data-control-action="${escapeHtml(action.id)}" title="${escapeHtml(action.description || '')}">${escapeHtml(action.label)}</button>`).join('')}</div>`
        : '';

    openModal(`
        <h2>Warum sehe ich diese Empfehlung?</h2>
        <p class="modal-why-reason">${escapeHtml(reason)}</p>
        <div class="modal-control-section">
            <strong>Diese Daten werden hierfür genutzt</strong>
            <p>Du kannst einzelne Informationen von der Personalisierung ausschließen.</p>
            <div class="modal-signal-controls">${signalControls}</div>
        </div>
        <div class="modal-control-section">
            <strong>Personalisierung steuern</strong>
            <p>Lege fest, welche Datenquellen der Shop verwenden darf.</p>
            <div class="modal-control-list">${optionHtml}</div>
            ${actionHtml}
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
                <p>${escapeHtml(product.whyDetails || 'Dieses Produkt stammt aus echten Shopping-Ergebnissen und wurde in den Shop aufgenommen.')}</p>
                ${currentStage === 'transparent' ? `<button type="button" class="modal-secondary-btn" data-modal-action="why" data-section="${sectionIndex}" data-product="${productIndex}">Warum sehe ich diese Empfehlung?</button>` : ''}
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
    const controlAction = event.target.closest('[data-control-action]');
    if (controlAction) {
        track('control_action_click', { id: controlAction.dataset.controlAction });
        controlAction.textContent = 'Vermerkt';
        controlAction.disabled = true;
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
