# Panel de contenido CONCRETO

El panel está en `/admin.html`. Permite publicar recursos PDF/enlaces, vídeos y ofertas sin modificar los archivos de la web.

## Uso diario desde celular o computadora

- **Video:** pega un enlace de TikTok, YouTube o Vimeo. El panel intenta completar el título y la portada automáticamente. También puedes subir un MP4/WebM y, si quieres, elegir una portada.
- **Documento:** selecciona un PDF desde el dispositivo o pega un enlace. El título se completa a partir del nombre del archivo y puedes corregirlo antes de publicar.
- **Descuento:** selecciona una, varias o las tres aplicaciones, escribe el porcentaje y elige la fecha final. La web muestra la vigencia y oculta automáticamente la promoción cuando vence.

El botón de una promoción abre WhatsApp automáticamente si no se proporciona otro enlace. Todo el contenido publicado puede editarse o eliminarse desde la lista inferior del panel.

## Activación única en Vercel

1. En el proyecto de Vercel, abre **Storage** y crea un almacén **Blob**. Conéctalo a este proyecto: Vercel añadirá `BLOB_READ_WRITE_TOKEN` automáticamente.
2. En **Settings → Environment Variables**, crea `ADMIN_ACCESS_KEYS` con un arreglo JSON de entre una y cuatro claves largas. Ejemplo:

   ```json
   ["clave-larga-persona-1", "clave-larga-persona-2"]
   ```

3. Haz un nuevo despliegue. Comparte solamente la dirección `/admin.html` y una clave distinta con cada persona autorizada.

Los archivos se guardan en Vercel Blob y el contenido publicado se muestra automáticamente en la página principal. No subas claves a GitHub ni las pongas en el código.

## Estadísticas dentro del panel

Para activar la pestaña **Estadísticas** de `/admin.html`:

1. En Vercel abre tu proyecto, entra a **Analytics** y pulsa **Enable**.
2. Ve a tu avatar → **Account Settings** → **Tokens** → **Create Token**. Copia el token una sola vez.
3. En tu proyecto: **Settings → Environment Variables**, crea estas variables para *Production, Preview y Development*:

   - `VERCEL_ANALYTICS_TOKEN`: el token que acabas de crear.
   - `VERCEL_PROJECT_ID`: el identificador del proyecto que aparece en **Settings → General**.
   - `VERCEL_TEAM_ID`: solo si el proyecto pertenece a un equipo; también aparece en **Settings → General**. Si es tu cuenta personal, no la crees.

4. Haz un nuevo despliegue. Entra en `/admin.html` y abre la pestaña **Estadísticas**.

El token nunca llega al navegador ni se muestra a quienes visitan la web. Sirve solo para que la función privada consulte la API de Analytics de Vercel.


## Detalles Constructivos (16 de octubre de 2026)

La cuarta aplicación usa el identificador `detalles`. Puede seleccionarse para descuentos, videos y fechas desde el panel existente. Las promociones antiguas sin selección explícita siguen aplicándose únicamente a las tres apps originales. La portada se copió sin modificar desde el recurso original de Android a `Fotos/BannerDetallesConstructivos.png`. Su ficha pública es `/detalles`; enlaza a la biblioteca web existente. La distribución del APK se coordina por WhatsApp, igual que en las otras fichas.
