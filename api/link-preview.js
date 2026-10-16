const validKey = (request) => {
  try {
    const keys = JSON.parse(process.env.ADMIN_ACCESS_KEYS || '[]');
    const key = request.headers['x-admin-key'];
    return Array.isArray(keys) && keys.length > 0 && keys.length <= 4 && keys.every(value => typeof value === 'string' && value.length > 0) && keys.includes(key);
  } catch { return false; }
};

const youtubeId = (url) => {
  if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
  if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] || '';
  if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || '';
  return url.searchParams.get('v') || '';
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'CONCRETO content manager' } });
    if (!response.ok) throw new Error('No se pudo consultar la plataforma');
    return await response.json();
  } finally { clearTimeout(timer); }
};

export default async function handler(request, response) {
  if (request.method !== 'GET' || !validKey(request)) return response.status(401).json({ error: 'No autorizado' });
  try {
    const target = new URL(String(request.query.url || ''));
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Enlace inválido');
    const host = target.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be' || host.endsWith('youtube.com')) {
      const id = youtubeId(target);
      if (!id) throw new Error('No se reconoce este enlace de YouTube');
      let title = 'Video de YouTube';
      try { title = (await fetchJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(target.href)}&format=json`)).title || title; } catch { /* La miniatura sigue disponible usando el ID. */ }
      return response.status(200).json({ platform: 'YOUTUBE', title, thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` });
    }
    if (host.endsWith('tiktok.com')) {
      const data = await fetchJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(target.href)}`);
      return response.status(200).json({ platform: 'TIKTOK', title: data.title || `Video de ${data.author_name || 'TikTok'}`, thumbnail: data.thumbnail_url || '' });
    }
    if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) {
      const data = await fetchJson(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(target.href)}`);
      return response.status(200).json({ platform: 'VIMEO', title: data.title || 'Video de Vimeo', thumbnail: data.thumbnail_url || '' });
    }
    const platform = host.includes('facebook') ? 'FACEBOOK' : host.includes('instagram') ? 'INSTAGRAM' : 'ENLACE';
    return response.status(200).json({ platform, title: '', thumbnail: '' });
  } catch (error) { return response.status(400).json({ error: error.message || 'No se pudo reconocer el enlace' }); }
}
