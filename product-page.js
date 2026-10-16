(() => {
  const WHATSAPP_NUMBER = '59173447992';
  const id = document.body.dataset.product;
  const productName = document.body.dataset.productName || 'Aplicación CONCRETO';
  const whatsappUrl = (label) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hola, me interesa: ${label}. Quisiera conocer el precio y el proceso de activación.`)}`;
  document.querySelectorAll('[data-product-whatsapp]').forEach((link) => { link.href = whatsappUrl(productName); });
  fetch('/api/content', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((content) => {
    const product = content?.settings?.products?.[id] || {};
    document.querySelectorAll('[data-product-price]').forEach((element) => { element.textContent = product.price || 'Consultar precio'; });
    if (product.updatedAt) {
      const date = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' }).format(new Date(`${product.updatedAt}T12:00:00-04:00`));
      document.querySelectorAll('[data-product-updated]').forEach((element) => { element.textContent = `Última actualización: ${date}`; });
    }
  }).catch(() => {});
})();

