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

## Fase 6: subida de imágenes

Controles aplicados:

- El tipo de archivo se valida por su contenido (primeros bytes) con `file-type`, sin confiar en la extensión ni en el `Content-Type` del cliente. Solo PNG, JPG y WEBP; el SVG se rechaza por poder contener scripts.
- Límites: 2 MB, un archivo por petición y 20 subidas por hora por IP. El archivo se valida en memoria y solo se escribe a disco si pasa.
- Los nombres son aleatorios (UUID), la carpeta `uploads/` está fuera del repositorio y la ruta de descarga se valida con una expresión regular (sin path traversal).
- Las imágenes se sirven con `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` y `Cross-Origin-Resource-Policy: same-origin`.
- Solo el dueño o un admin puede borrar una imagen (BOLA verificado con `403`). Las subidas rechazadas y los accesos denegados quedan en el log.
- El renderizador de Markdown solo permite imágenes propias (`/api/media/<uuid>.<ext>`) y bloquea las externas, lo que evita que un post revele la IP del lector.

Riesgos residuales:

- Las imágenes no se re-codifican: pueden llevar metadatos (EXIF/GPS) o archivos políglota que pasan la validación de cabecera.
- No hay análisis antimalware ni cuota de almacenamiento por usuario.
- El disco local no escala. En la nube iría a un bucket privado (S3) detrás de un CDN.
- Las imágenes son públicas por URL no secuencial: quien conozca el enlace puede verla.
- SCA / cadena de suministro: npm avisa que `argon2` ejecuta un script de instalación (`node-gyp rebuild`) que no está aprobado en `allowScripts`. Es el único paquete con script de instalación. Se revisa con `npm install-scripts ls` y se decide su aprobación explícita al armar la imagen Docker (Fase 8).

## Fase 7A: auditoría persistente

Controles aplicados:

- Todas las operaciones de escritura (POST, PUT, PATCH y DELETE) quedan en la colección `AuditLog`: acción, estado HTTP, usuario, IP y user-agent. Incluye los logins fallidos y los accesos rechazados (401, 403 y 429).
- No se guardan cuerpos de petición, contraseñas ni tokens (solo el correo en las rutas de autenticación).
- Retención de 90 días mediante un índice TTL.
- La consulta es solo para admin, con paginación topada a 100 registros.

Riesgos residuales:

- Repudiation: el usuario de la aplicación (`cms_app`) tiene `readWrite`, así que una vulnerabilidad en la app podría alterar o borrar la auditoría. Se mitiga enviando los registros a un SIEM externo o con un usuario de base de datos de solo inserción.
- Las lecturas (GET) y las rutas inexistentes (404) no se auditan, así que el reconocimiento queda sin registrar aquí y lo cubre el WAF/Nginx.
- La IP registrada será la del proxy hasta configurar `trust proxy` detrás de Nginx.
- No hay alertas automáticas, solo consulta manual.

## Fase 7B: MFA (TOTP)

Controles aplicados:

- TOTP estándar (RFC 6238: 6 dígitos, 30 s) con app de autenticación. La semilla se guarda cifrada con AES-256-GCM y la llave (`MFA_ENC_KEY`) vive fuera de la base de datos, así que una filtración de la base no expone las semillas.
- Login en dos pasos: tras la clave se entrega un token temporal de 5 minutos en una cookie aparte con `purpose: mfa`. No sirve como sesión (verificado con `401`, incluso colocándolo en la cookie de sesión).
- MFA obligatorio para el admin: sin MFA verificado no accede a ninguna ruta de admin (`403 MFA_REQUIRED`). Al activar el MFA se reemite la sesión.
- Fuerza bruta: 5 intentos por IP cada 15 minutos y bloqueo de la cuenta por 15 minutos tras 5 fallos (contador atómico en la base).
- Reuso: un código ya usado se rechaza durante 90 segundos.
- Los intentos y bloqueos quedan en la auditoría (`401` y `429` en `/api/auth/mfa/verify`).

Riesgos residuales:

- Sin códigos de recuperación: perder el teléfono exige un reinicio por script con acceso al servidor (`reset-mfa.js`).
- La llave de cifrado está en el mismo servidor que los datos. En producción iría en un gestor de secretos o KMS. Perderla invalida todos los MFA.
- El reuso de código se controla de forma secuencial: dos peticiones simultáneas con el mismo código podrían pasar ambas.
- TOTP es vulnerable a phishing en tiempo real (proxy inverso). WebAuthn/passkeys lo resolvería.
- El bloqueo de cuenta permite un ataque de denegación dirigido contra un usuario conocido.
- No hay opción en la interfaz para desactivar o regenerar el MFA, y no se notifica al usuario cuando se bloquea su cuenta.

- Detección: los intentos de verificación de MFA se atribuyen al usuario en la auditoría (antes aparecían sin identificar), lo que permite correlacionar fallos por cuenta en el SIEM.
- Prueba de reuso: un código ya usado que se presenta de nuevo dentro de 90 s se rechaza con `401`.
