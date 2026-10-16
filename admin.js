import { upload } from 'https://esm.sh/@vercel/blob@2.8.0/client';

const PRODUCT_NAMES = { prediseno: 'Prediseño de Edificios', elementos: 'Calculadora de Elementos', muro: 'Muro de Contención', detalles: 'Detalles Constructivos' };
const DEFAULT_SETTINGS = { products: { prediseno: { price: '', updatedAt: '2026-09-24' }, elementos: { price: '', updatedAt: '2026-09-24' }, muro: { price: '', updatedAt: '2026-09-24' }, detalles: { price: '', updatedAt: '2026-10-16' } }, bundlePrice: '' };
const BUTTON_LABELS = { resources: 'Publicar documento', videos: 'Publicar video', offers: 'Publicar descuento' };
const login = document.querySelector('#login');
const dashboard = document.querySelector('#dashboard');
const loginError = document.querySelector('#login-error');
const items = document.querySelector('#items');
const count = document.querySelector('#count');
const template = document.querySelector('#item-template');
const toast = document.querySelector('#toast');
const videoForm = document.querySelector('form[data-kind="videos"]');
const offerForm = document.querySelector('form[data-kind="offers"]');
const pricingForm = document.querySelector('#pricing-settings');
let key = sessionStorage.getItem('concreto-admin-key') || '';
let content = { resources: [], videos: [], offers: [], settings: DEFAULT_SETTINGS };
let editing = null;
let detectedVideoMeta = null;
let previewTimer = null;
let previewController = null;
let toastTimer = null;

const headers = () => ({ 'Content-Type': 'application/json', 'x-admin-key': key });
const number = new Intl.NumberFormat('es-BO');
const formatDate = (value) => value ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' }).format(new Date(value)) : '';
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const cloneContent = () => JSON.parse(JSON.stringify(content));
const plainFileName = (name = '') => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
const getSelectedProducts = () => [...offerForm.querySelectorAll('[name="products"]:checked')].map(input => input.value);
const showToast = (message) => { clearTimeout(toastTimer); toast.textContent = message; toast.hidden = false; toastTimer = setTimeout(() => { toast.hidden = true; }, 3500); };

const showTab = (name) => {
  document.querySelectorAll('.tabs button').forEach(button => button.classList.toggle('active', button.dataset.tab === name));
  document.querySelectorAll('.form-panel').forEach(panel => { panel.hidden = panel.id !== `${name}-form`; });
  if (name === 'analytics') loadAnalytics();
};

const setProgress = (form, visible, percent = 10, label = 'Preparando…') => {
  const box = form.querySelector('.upload-progress');
  if (!box) return;
  box.hidden = !visible;
  box.querySelector('span').style.width = `${percent}%`;
  box.querySelector('strong').textContent = label;
};

const uploadFile = async (file, form, label) => {
  setProgress(form, true, 18, `Subiendo ${label}…`);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const blob = await upload(`concreto/${Date.now()}-${safeName}`, file, { access: 'public', handleUploadUrl: '/api/upload', clientPayload: key });
  setProgress(form, true, 82, `${label} subido. Guardando…`);
  return blob.url;
};

const updateOfferSummary = () => {
  const products = getSelectedProducts();
  const discount = Number(offerForm.elements.discountPercent.value || 0);
  const endDate = offerForm.elements.endsAt.value;
  const box = document.querySelector('#offer-summary');
  if (!products.length) { box.textContent = 'Selecciona al menos una aplicación para ver el resumen.'; return; }
  const names = products.map(id => PRODUCT_NAMES[id]);
  const productText = names.length === Object.keys(PRODUCT_NAMES).length ? 'las 4 aplicaciones' : names.join(' y ');
  const dateText = endDate ? ` hasta el ${formatDate(`${endDate}T12:00:00-04:00`)}` : '';
  box.textContent = discount ? `${discount}% de descuento en ${productText}${dateText}.` : `Descuento para ${productText}${dateText}.`;
};

const renderAnalyticsList = (selector, rows, field) => {
  const list = document.querySelector(selector);
  list.innerHTML = rows.length ? rows.map(row => `<li><span>${String(row[field] || 'Sin datos')}</span><strong>${number.format(row.visitors || row.pageviews || 0)}</strong></li>`).join('') : '<li><span>Aún no hay datos</span></li>';
};

async function loadAnalytics() {
  const refresh = document.querySelector('#refresh-analytics');
  const errorBox = document.querySelector('#analytics-error');
  const view = document.querySelector('#analytics-content');
  refresh.disabled = true; refresh.textContent = 'Cargando…'; errorBox.textContent = '';
  try {
    const response = await fetch('/api/analytics', { headers: headers(), cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || 'Las estadísticas no están disponibles en esta vista previa. En la web publicada seguirán conectadas a Vercel.');
    document.querySelector('#metric-views').textContent = number.format(data.total.pageviews || 0);
    document.querySelector('#metric-visitors').textContent = number.format(data.total.visitors || 0);
    document.querySelector('#analytics-period').textContent = data.period;
    renderAnalyticsList('#analytics-pages', data.pages, 'requestPath');
    renderAnalyticsList('#analytics-countries', data.countries, 'country');
    renderAnalyticsList('#analytics-devices', data.devices, 'deviceType');
    view.hidden = false;
  } catch (reason) { errorBox.textContent = reason.message || 'No se pudieron cargar las estadísticas. Intenta actualizar en unos momentos.'; view.hidden = true; }
  finally { refresh.disabled = false; refresh.textContent = 'Actualizar'; }
}

const resetEditor = (kind) => {
  editing = null;
  detectedVideoMeta = null;
  const form = document.querySelector(`form[data-kind="${kind}"]`);
  form.reset();
  form.querySelector('button[type="submit"]').textContent = BUTTON_LABELS[kind];
  form.querySelector('.cancel-edit').hidden = true;
  setProgress(form, false);
  if (kind === 'videos') { document.querySelector('#video-preview').hidden = true; document.querySelector('#link-status').hidden = true; }
  if (kind === 'offers') setDefaultOfferDate();
};

const openEditor = (kind, index) => {
  const item = content[kind][index];
  editing = { kind, index };
  showTab(kind);
  const form = document.querySelector(`form[data-kind="${kind}"]`);
  form.reset();
  ['title', 'description', 'category', 'button', 'url', 'discountPercent'].forEach(name => { if (form.elements[name]) form.elements[name].value = item[name] || ''; });
  if (kind === 'offers') {
    const products = item.products?.length ? item.products : ['prediseno', 'elementos', 'muro'];
    form.querySelectorAll('[name="products"]').forEach(input => { input.checked = products.includes(input.value); });
    form.elements.endsAt.value = item.endsAt ? item.endsAt.slice(0, 10) : '';
    updateOfferSummary();
  }
  if (kind === 'videos') detectedVideoMeta = { title: item.title, thumbnail: item.thumbnail, platform: item.platform || 'VIDEO' };
  form.querySelector('button[type="submit"]').textContent = 'Guardar cambios';
  form.querySelector('.cancel-edit').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const render = () => {
  items.innerHTML = '';
  const entries = ['videos', 'resources', 'offers'].flatMap((kind) => content[kind].map((item, index) => ({ kind, item, index })));
  count.textContent = `${entries.length} ${entries.length === 1 ? 'elemento' : 'elementos'}`;
  if (!entries.length) items.innerHTML = '<p class="hint">Aún no hay contenido agregado desde este panel.</p>';
  entries.forEach(({ kind, item, index }) => {
    const node = template.content.cloneNode(true);
    node.querySelector('.tag').textContent = kind === 'resources' ? 'DOCUMENTO' : kind === 'videos' ? 'VIDEO' : 'DESCUENTO';
    node.querySelector('h3').textContent = item.title || 'Sin título';
    node.querySelector('p').textContent = item.description || '';
    const meta = node.querySelector('.item-meta');
    if (kind === 'offers') {
      const products = item.products?.length ? item.products : ['prediseno', 'elementos', 'muro'];
      const chips = [`${item.discountPercent || '—'}%`, ...products.map(id => PRODUCT_NAMES[id] || id), item.endsAt ? `Hasta ${formatDate(item.endsAt)}` : 'Sin vencimiento'];
      chips.forEach(text => { const chip = document.createElement('span'); chip.textContent = text; meta.append(chip); });
    } else if (item.category) { const chip = document.createElement('span'); chip.textContent = item.category; meta.append(chip); }
    const link = node.querySelector('.item-link');
    if (item.url) link.href = item.url; else link.hidden = true;
    const orderButtons = node.querySelectorAll('.order-action');
    orderButtons.forEach((button) => { button.hidden = kind !== 'videos'; });
    const move = async (targetIndex, message) => {
      if (targetIndex === index || targetIndex < 0 || targetIndex >= content[kind].length) return;
      const next = cloneContent();
      const [moved] = next[kind].splice(index, 1);
      next[kind].splice(targetIndex, 0, moved);
      try { await save(next); showToast(message); } catch (reason) { alert(reason.message); }
    };
    const topButton = node.querySelector('.move-top');
    const upButton = node.querySelector('.move-up');
    const downButton = node.querySelector('.move-down');
    topButton.disabled = index === 0; upButton.disabled = index === 0; downButton.disabled = index === content[kind].length - 1;
    topButton.addEventListener('click', () => move(0, 'Video colocado primero.'));
    upButton.addEventListener('click', () => move(index - 1, 'Video movido hacia arriba.'));
    downButton.addEventListener('click', () => move(index + 1, 'Video movido hacia abajo.'));
    node.querySelector('.edit').addEventListener('click', () => openEditor(kind, index));
    node.querySelector('.delete').addEventListener('click', async () => {
      if (!window.confirm(`¿Eliminar “${item.title}”? Esta acción no se puede deshacer.`)) return;
      const next = cloneContent(); next[kind].splice(index, 1);
      try { await save(next); showToast('Contenido eliminado.'); } catch (reason) { alert(reason.message); }
    });
    items.append(node);
  });
};

const save = async (nextContent) => {
  const response = await fetch('/api/content', { method: 'PUT', headers: headers(), body: JSON.stringify(nextContent) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudo guardar. Revisa la conexión y la clave.');
  content = { resources: [], videos: [], offers: [], settings: DEFAULT_SETTINGS, ...result, settings: { ...DEFAULT_SETTINGS, ...(result.settings || {}), products: { ...DEFAULT_SETTINGS.products, ...(result.settings?.products || {}) } } };
  render();
  populatePricing();
};

const populatePricing = () => {
  const settings = content.settings || DEFAULT_SETTINGS;
  Object.keys(PRODUCT_NAMES).forEach((id) => {
    const product = settings.products?.[id] || DEFAULT_SETTINGS.products[id];
    pricingForm.elements[`${id}Price`].value = product.price || '';
    pricingForm.elements[`${id}UpdatedAt`].value = product.updatedAt || '';
  });
  pricingForm.elements.bundlePrice.value = settings.bundlePrice || '';
};

const start = async () => {
  const response = await fetch('/api/content', { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo cargar el contenido.');
  const loaded = await response.json();
  content = { resources: [], videos: [], offers: [], settings: DEFAULT_SETTINGS, ...loaded, settings: { ...DEFAULT_SETTINGS, ...(loaded.settings || {}), products: { ...DEFAULT_SETTINGS.products, ...(loaded.settings?.products || {}) } } };
  login.hidden = true; dashboard.hidden = false; render(); populatePricing(); setDefaultOfferDate();
};

const setDefaultOfferDate = () => {
  const input = offerForm.elements.endsAt;
  const today = new Date();
  const minimum = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const suggested = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const toInput = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  input.min = toInput(minimum);
  if (!input.value) input.value = toInput(suggested);
  updateOfferSummary();
};

const showVideoPreview = (meta) => {
  const preview = document.querySelector('#video-preview');
  if (!meta?.thumbnail) { preview.hidden = true; return; }
  preview.querySelector('img').src = meta.thumbnail;
  preview.querySelector('.preview-platform').textContent = meta.platform || 'VIDEO';
  preview.querySelector('.preview-title').textContent = meta.title || 'Video detectado';
  preview.hidden = false;
};

const inspectVideoLink = async () => {
  const url = videoForm.elements.url.value.trim();
  const status = document.querySelector('#link-status');
  clearTimeout(previewTimer); previewController?.abort(); detectedVideoMeta = null;
  if (!url) { status.hidden = true; document.querySelector('#video-preview').hidden = true; return; }
  try { new URL(url); } catch { status.textContent = 'El enlace todavía no está completo.'; status.hidden = false; return; }
  status.textContent = 'Reconociendo el video y preparando la portada…'; status.hidden = false;
  previewController = new AbortController();
  try {
    const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { headers: headers(), signal: previewController.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    detectedVideoMeta = data;
    if (!videoForm.elements.title.value.trim() && data.title) videoForm.elements.title.value = data.title;
    showVideoPreview(data);
    status.textContent = data.thumbnail ? `${data.platform} reconocido. La portada se añadirá automáticamente.` : `${data.platform} reconocido. Puedes completar el título y publicar.`;
  } catch (reason) {
    if (reason.name === 'AbortError') return;
    status.textContent = 'Puedes publicar este enlace; completa el título para continuar.';
  }
};

document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); key = document.querySelector('#access-key').value.trim(); loginError.textContent = '';
  const response = await fetch('/api/auth', { method: 'POST', headers: headers() });
  if (!response.ok) { loginError.textContent = 'Clave incorrecta o el panel aún no fue configurado.'; return; }
  sessionStorage.setItem('concreto-admin-key', key);
  try { await start(); } catch { loginError.textContent = 'La clave es correcta, pero no se pudo cargar el contenido.'; }
});
document.querySelector('#logout').addEventListener('click', () => { sessionStorage.removeItem('concreto-admin-key'); location.reload(); });
document.querySelectorAll('.tabs button').forEach(button => button.addEventListener('click', () => showTab(button.dataset.tab)));
document.querySelector('#refresh-analytics').addEventListener('click', loadAnalytics);
document.querySelectorAll('.cancel-edit').forEach(button => button.addEventListener('click', () => resetEditor(button.closest('form').dataset.kind)));
document.querySelector('#select-all-products').addEventListener('click', () => { offerForm.querySelectorAll('[name="products"]').forEach(input => { input.checked = true; }); updateOfferSummary(); });
offerForm.addEventListener('input', updateOfferSummary);
pricingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = pricingForm.querySelector('button[type="submit"]');
  submit.disabled = true; submit.textContent = 'Guardando…';
  try {
    const data = new FormData(pricingForm);
    const next = cloneContent();
    next.settings = { products: {}, bundlePrice: String(data.get('bundlePrice') || '').trim() };
    Object.keys(PRODUCT_NAMES).forEach((id) => {
      next.settings.products[id] = { price: String(data.get(`${id}Price`) || '').trim(), updatedAt: String(data.get(`${id}UpdatedAt`) || '') };
    });
    await save(next); showToast('Precios y fechas actualizados.');
  } catch (reason) { alert(reason.message || 'No se pudieron guardar los precios.'); }
  finally { submit.disabled = false; submit.textContent = 'Guardar precios'; }
});
videoForm.elements.url.addEventListener('input', () => { clearTimeout(previewTimer); previewTimer = setTimeout(inspectVideoLink, 650); });
videoForm.elements.media.addEventListener('change', () => { const file = videoForm.elements.media.files[0]; if (file && !videoForm.elements.title.value.trim()) videoForm.elements.title.value = plainFileName(file.name); });
document.querySelector('form[data-kind="resources"] [name="document"]').addEventListener('change', event => { const file = event.target.files[0]; const title = event.target.form.elements.title; if (file && !title.value.trim()) title.value = plainFileName(file.name); });

document.querySelectorAll('.form-panel form[data-kind]').forEach(form => form.addEventListener('submit', async event => {
  event.preventDefault();
  const kind = form.dataset.kind;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true; submit.textContent = 'Publicando…';
  try {
    const data = new FormData(form);
    const current = editing?.kind === kind ? content[kind][editing.index] : null;
    let item;
    if (kind === 'resources') {
      const file = data.get('document');
      const externalUrl = String(data.get('url') || '').trim();
      const uploadedUrl = file?.size ? await uploadFile(file, form, 'el PDF') : '';
      const url = uploadedUrl || externalUrl || current?.url || '';
      if (!url) throw new Error('Selecciona un PDF o pega un enlace.');
      item = { ...current, id: current?.id || uid(), title: String(data.get('title')).trim(), description: String(data.get('description')).trim(), category: String(data.get('category')).trim(), url, kind: uploadedUrl ? 'PDF' : (current?.kind || 'LINK'), published: true };
    } else if (kind === 'videos') {
      const media = data.get('media'); const cover = data.get('cover'); const externalUrl = String(data.get('url') || '').trim();
      const mediaUrl = media?.size ? await uploadFile(media, form, 'el video') : '';
      const coverUrl = cover?.size ? await uploadFile(cover, form, 'la portada') : '';
      const url = mediaUrl || externalUrl || current?.url || '';
      if (!url) throw new Error('Pega un enlace o selecciona un video.');
      item = { ...current, id: current?.id || uid(), title: String(data.get('title')).trim(), description: String(data.get('description')).trim(), category: String(data.get('category')).trim(), url, thumbnail: coverUrl || (!mediaUrl ? detectedVideoMeta?.thumbnail : '') || current?.thumbnail || '', platform: mediaUrl ? 'VIDEO' : (detectedVideoMeta?.platform || current?.platform || 'VIDEO'), mediaType: mediaUrl ? 'upload' : 'link', published: true };
    } else {
      const products = getSelectedProducts(); const discountPercent = Number(data.get('discountPercent')); const endDate = String(data.get('endsAt'));
      if (!products.length) throw new Error('Selecciona al menos una aplicación.');
      if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 100) throw new Error('El descuento debe estar entre 1% y 100%.');
      if (!endDate) throw new Error('Elige hasta qué fecha será válido el descuento.');
      const names = products.map(id => PRODUCT_NAMES[id]); const productText = products.length === Object.keys(PRODUCT_NAMES).length ? 'las 4 aplicaciones' : names.join(' y ');
      const endsAt = `${endDate}T23:59:59-04:00`;
      item = { ...current, id: current?.id || uid(), title: String(data.get('title')).trim() || `${discountPercent}% de descuento en ${productText}`, description: String(data.get('description')).trim() || `Promoción válida hasta el ${formatDate(endsAt)}.`, products, discountPercent, endsAt, button: String(data.get('button')).trim() || 'Solicitar descuento', url: String(data.get('url')).trim(), published: true };
    }
    const next = cloneContent();
    if (current) next[kind][editing.index] = item; else next[kind].unshift(item);
    await save(next); resetEditor(kind); showToast(current ? 'Cambios guardados correctamente.' : 'Contenido publicado correctamente.');
  } catch (reason) { alert(reason.message || 'No se pudo publicar el contenido.'); }
  finally { submit.disabled = false; submit.textContent = editing?.kind === kind ? 'Guardar cambios' : BUTTON_LABELS[kind]; setProgress(form, false); }
}));

if (key) start().catch(() => { sessionStorage.removeItem('concreto-admin-key'); key = ''; });
