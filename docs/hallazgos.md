Fase 2

El 409 al registrar un correo existente permite enumerar usuarios.
La protección CSRF depende solo de SameSite=Strict y de CORS restringido, sin token CSRF.
Los tokens duran 30 minutos y no se pueden revocar antes.
El límite de intentos es por IP y vive en memoria, así que se reinicia con el servidor.

Fase 3

El contenido se guarda como Markdown crudo, y mostrarlo sin sanitizar daría XSS almacenado (se mitiga en la Fase 4).
El 403 en un post ajeno confirma que el ID existe (riesgo bajo, los ID no son secuenciales).
No hay límite general de peticiones, así que se puede recorrer el listado público completo y crear posts en masa.
Los intentos de acceso a posts ajenos quedan en el log (evidencia para el SIEM).
SCA (frontend): @tailwindcss/typography arrastraba postcss-selector-parser con una vulnerabilidad moderada (consumo de CPU, solo en compilación). Tratamiento: eliminar la dependencia y usar CSS propio.
Las imágenes en un post Markdown pueden apuntar a sitios externos y revelar la IP del lector. Se mitiga con la cabecera CSP img-src 'self' en Nginx (Fase 8).

## Fase 1: backend base

Hallazgos:

- `/health` es público y revela si la base de datos está caída (Information Disclosure, bajo).
- Contraseñas de desarrollo cortas y escritas en la terminal (quedan en el historial). En producción se rotan y se usan secretos gestionados (medio).
- En desarrollo no hay TLS hacia la API ni hacia MongoDB. En producción se usa TLS 1.3 (medio).
- `express-mongo-sanitize` es incompatible con Express 5 y no tiene mantenimiento. Se descartó y se reemplazó por Zod + `sanitizeFilter` de Mongoose (SCA, medio).

Controles aplicados:

- MongoDB solo escucha en 127.0.0.1 y la app usa `cms_app` con `readWrite` solo sobre `cms` (menor privilegio).
- La API escucha solo en 127.0.0.1, con CORS limitado a un origen y body JSON de 10 KB como máximo.
- Helmet agrega cabeceras de seguridad y se desactivó `X-Powered-By`.
- Los logs de pino ocultan `authorization` y `cookie`.
- El `.env` está fuera del repositorio y el servidor no arranca si faltan variables o si `JWT_SECRET` tiene menos de 32 caracteres.
- `npm audit` inicial: 0 vulnerabilidades.

## Fase 4: frontend

- El XSS almacenado se mitiga porque `react-markdown` no renderiza HTML crudo y neutraliza URLs `javascript:`. Evidencia: post "Prueba XSS".
- La sesión vive en una cookie `httpOnly` con `SameSite=Strict`. `document.cookie` no la expone y no se usa `localStorage`.
- Los enlaces del contenido solo reciben `href` y `title`, y se abren con `rel="noopener noreferrer"`.
- SCA: `@tailwindcss/typography` arrastraba `postcss-selector-parser` con una vulnerabilidad moderada (solo en compilación). Tratamiento: eliminar la dependencia y usar CSS propio.
- Las imágenes externas en Markdown pueden revelar la IP del lector. Se mitiga con `img-src 'self'` en la CSP de Nginx (Fase 8).
- El proxy de Vite existe solo en desarrollo y en producción lo reemplaza Nginx.
- El frontend todavía no envía CSP propia (se configura en Nginx).
- Mostrar el rol en la interfaz no es control de acceso: la validación real está en el backend.
- ESLint (análisis estático) sin errores y `npm audit` en 0.
- En desarrollo la cookie de sesión no lleva el atributo `Secure` (HTTP). En producción se activa con `NODE_ENV=production` y TLS 1.3 en Nginx.

## Fase 5: panel de administración

- Las rutas del panel se protegen en el frontend solo por experiencia de usuario. El control real está en el backend, verificado con un `403` desde la consola con sesión de lector.
- El cambio de rol es solo para admin, valida el ID y el rol con una lista cerrada, no permite cambiar el propio rol (siempre queda al menos un admin) y queda registrado en el log.
- El rol se lee de la base de datos en cada petición, así que un cambio o una baja de privilegios aplica de inmediato aunque la sesión siga abierta.
- Riesgo: una cuenta admin comprometida puede escalar privilegios a otras cuentas. No hay confirmación adicional ni MFA todavía (Fase 7).
- El borrado de posts es físico, sin papelera, y solo queda traza en el log.
- No hay token CSRF: las operaciones PATCH y DELETE se apoyan en `SameSite=Strict`, en el contenido JSON obligatorio y en CORS restringido.
- El editor de Markdown usa el mismo renderizador seguro que la vista pública (`MarkdownView`), así que la vista previa no abre un camino nuevo de XSS.
