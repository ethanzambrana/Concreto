const validKey = (request) => {
  try {
    const keys = JSON.parse(process.env.ADMIN_ACCESS_KEYS || '[]');
    return Array.isArray(keys) && keys.length > 0 && keys.length <= 4 && keys.every(key => typeof key === 'string' && key.length > 0) && keys.includes(request.headers['x-admin-key']);
  } catch { return false; }
};
export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST' || !validKey(request)) return response.status(401).json({ error: 'No autorizado' });
  return response.status(204).end();
}
