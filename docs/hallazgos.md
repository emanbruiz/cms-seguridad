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

## Fase 2

El 409 al registrar un correo existente permite enumerar usuarios.
La protección CSRF depende solo de SameSite=Strict y de CORS restringido, sin token CSRF.
Los tokens duran 30 minutos y no se pueden revocar antes.
El límite de intentos es por IP y vive en memoria, así que se reinicia con el servidor.

## Fase 3

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

## Fase 8A: contenedores (Docker Compose)

Controles aplicados:

- MongoDB y la API no publican puertos: viven en una red interna sin salida a internet. Solo `web` escucha, y únicamente en 127.0.0.1:8080. La ruta `/health` de la API ya no queda expuesta (cierra el hallazgo de la Fase 1).
- API y web corren sin root, con sistema de archivos de solo lectura, `cap_drop: ALL`, `no-new-privileges`, `tmpfs` para temporales y límites de memoria y de procesos. Verificado con `id`, `touch` y `CapEff`.
- Imagen de la API en dos etapas: las herramientas de compilación (python3, make, g++) solo existen en la etapa de construcción. La imagen final trae solo dependencias de producción (`npm ci --omit=dev`) y se verifica que `argon2` carga.
- `.dockerignore` evita que `.env` y `node_modules` entren a las imágenes. Los secretos del compose están en un `.env` ignorado por Git y se generan aleatorios.
- Healthchecks y orden de arranque (la API espera a la base, la web espera a la API).
- `trust proxy` configurable para que el límite de intentos y la auditoría vean la IP real del cliente detrás de Nginx. Nginx oculta su versión y limita el cuerpo a 3 MB.

Riesgos residuales:

- Los secretos viajan como variables de entorno y se pueden ver con `docker inspect`. En producción se usarían Docker secrets o un gestor de secretos (KMS).
- El contenedor de MongoDB arranca como root por el entrypoint oficial (luego baja a `mongodb`) y no se le quitan capacidades para no romper ese arranque.
- Las imágenes usan etiquetas flotantes (`mongo:8`, `stable-alpine`). En producción se fijarían por digest.
- Sin TLS todavía y con cookie `Secure` desactivada (HTTP en local). Se resuelve en la 8B.
- El volumen de `uploads` no está cifrado y las imágenes base pueden traer CVEs (se escanean con Trivy en la etapa 10).

## Fase 8B: WAF, TLS y cabeceras

Controles aplicados:

- WAF ModSecurity con las reglas OWASP CRS 4 como única puerta de entrada (127.0.0.1:8443), en modo bloqueo con paranoia 1 y umbral de anomalía 5. Verificado: SQLi, XSS, path traversal, escáner (sqlmap) y método TRACE devuelven 403.
- TLS en el borde (certificado autofirmado generado al primer arranque). La cookie de sesión ahora es HttpOnly, Secure y SameSite Strict (cierra el hallazgo de la Fase 4).
- CSP estricta, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP y HSTS para el frontend, configuradas en Nginx.
- Cadena de proxies confiable: la API usa `trust proxy` con 2 saltos, así que el límite de intentos y la auditoría ven la IP real del cliente.
- Métodos HTTP permitidos acotados (GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS). Defensa en profundidad: la inyección NoSQL en el login la detiene el WAF o la validación Zod de la API.
- Escaneo de imágenes con Trivy y de Dockerfiles con Checkov (resultados en `docs/evidencias`).

Riesgos residuales:

- Falso positivo: el WAF bloquea contenido legítimo que incluya HTML ejecutable (por ejemplo, un post que explique `<script>`). Tratamiento: aceptar el riesgo o excluir reglas solo para el campo de contenido.
- Los ataques bloqueados por el WAF no llegan a la auditoría de la aplicación. Su registro está solo en los logs del WAF, y un SIEM debe correlacionar ambos.
- El contenedor del WAF no puede correr con sistema de archivos de solo lectura (esas variantes no se publican). Se compensa con usuario sin privilegios, `cap_drop: ALL`, `no-new-privileges` y límites de recursos.
- La imagen del WAF usa una etiqueta flotante (`nginx-alpine`). En producción se fijaría por versión o digest.
- El certificado es autofirmado: el navegador avisa y no hay validación de identidad. En producción se usaría una CA real (por ejemplo, Let's Encrypt).
- No hay límite de peticiones en el borde (solo los límites de la API). Un `limit_req` en el WAF reforzaría la defensa contra fuerza bruta y denegación de servicio.

Resultados de escaneo (Trivy con `--ignore-unfixed`, solo HIGH y CRITICAL; Checkov sobre los Dockerfiles):

- `cms-web` y WAF (`owasp/modsecurity-crs`): 0 hallazgos.
- `cms-api` antes: 3 CRITICAL y 11 HIGH. Venían de `perl-base` de Debian (con corrección publicada) y de las dependencias del npm incluido en la imagen oficial de Node. Tratamiento (mitigar): `apt-get upgrade` en la imagen final y eliminación de npm, npx y corepack, que el runtime no necesita. Después: 0 hallazgos (`trivy-api-antes.txt` y `trivy-api-despues.txt`).
- `mongo:8`: 1 CRITICAL y 24 HIGH, en `gosu` (librería estándar de Go) y en componentes Node.js internos de la imagen oficial. Tratamiento (aceptar): MongoDB no publica puertos, vive en una red interna sin salida y `gosu` solo corre al arrancar para bajar privilegios. Se re-escanea al actualizar la imagen.
- Checkov: 108 pruebas pasadas y 0 fallidas en los dos Dockerfiles.

Observaciones:

- Docker Desktop entrega todas las peticiones con la IP de la puerta de enlace (172.18.0.1), así que el límite de intentos y la auditoría no distinguen clientes en el entorno local. En producción lo resuelve el balanceador con `X-Forwarded-For`.
- La imagen del WAF agrega cabeceras CORS permisivas por defecto (`Access-Control-Allow-Origin: *` en sus respuestas de bloqueo y `Access-Control-Allow-Headers: *` en la página). Pendiente de tratar en la etapa de pruebas de penetración.
- Path traversal: Nginx rechaza la URL con `400` antes de que intervenga el WAF.
- Los reportes de Trivy generados con Tee-Object quedaron en UTF-16, y se regeneraron en UTF-8.

- Verificación posterior: el reporte `trivy-api-despues.txt` muestra 0 vulnerabilidades HIGH y CRITICAL en Debian y en todos los paquetes de Node, y `npm` ya no existe en la imagen final de la API.

## Etapa 9: infraestructura como código (Terraform en AWS)

Diseño: ALB con AWS WAF (reglas administradas y límite de tasa), ECS Fargate en subredes privadas, DocumentDB en subredes de datos sin ruta a internet, S3 privado cifrado con KMS, Secrets Manager y logs en CloudWatch cifrados con KMS. Se escribe y se escanea; no se despliega. La configuración valida con `terraform validate`.

Primer escaneo con Checkov: 245 pruebas pasadas y 12 fallidas (`checkov-terraform-1.txt`). Tratamiento:

- Mitigar (5): protección contra Log4j (la regla estaba en un bloque dinámico que el escáner no interpreta y se escribió como regla fija, 2 hallazgos), zonas de disponibilidad fijadas en una variable (1) y notificaciones de eventos en los dos buckets de S3 (2).
- Aceptar (7): permisos amplios en la política de la clave KMS, porque la clave exige `kms:*` a la cuenta y el asterisco se refiere a la propia clave (3); rotación automática de secretos, que exige una función Lambda (1); cifrado SSE-S3 en el bucket de logs, porque los logs del balanceador no admiten KMS (1); replicación entre regiones, fuera del alcance (2). Cada aceptación queda escrita en el código con `#checkov:skip` y su justificación.
- Segundo escaneo: `checkov-terraform-2.txt`.

Riesgos residuales:

- El tráfico entre el balanceador y la aplicación va por HTTP dentro de la VPC (el TLS termina en el balanceador).
- Una única NAT Gateway es un punto único de falla. Con dos zonas se usaría una por zona.
- El diseño exige adaptar la aplicación (subida de imágenes a S3, TLS con el bundle de CA de DocumentDB, `retryWrites=false` y el destino de Nginx). Está listado en `docs/arquitectura.md`.
- El secreto de la base de datos pasa por el estado de Terraform. En producción se usaría un backend remoto cifrado con acceso restringido.
- Segundo escaneo (`checkov-terraform-2.txt`): 248 pruebas pasadas, 1 fallida y 7 omitidas con justificación. Tercer escaneo (`checkov-terraform-3.txt`, reglas del WAF reescritas como bloques fijos): el mismo hallazgo, `CKV2_AWS_76` sobre el balanceador. Causa real: la guía de AWS contra Log4j (boletín AWS-2021-006) pide, además de `KnownBadInputs`, el grupo `AnonymousIpList`. Tratamiento (mitigar): se agregó el grupo y el cuarto escaneo (`checkov-terraform-4.txt`) da 0 fallidas.
- Riesgo residual: `AnonymousIpList` bloquea VPN, proxies, Tor y proveedores de hosting, así que puede rechazar usuarios legítimos. Se vigila con las métricas del WAF y, si hace falta, se pasa a modo de conteo con `rule_action_override`.

## Etapa 10: CI/CD DevSecOps (GitHub Actions)

El flujo `.github/workflows/seguridad.yml` corre en cada subida a `main`, en cada pull request y a pedido, en un runner fijado (`ubuntu-24.04`), con permisos de solo lectura y sin guardar credenciales de Git. Cinco trabajos en paralelo, todos bloqueantes:

- Gitleaks: secretos en todo el historial (32 commits revisados, sin fugas).
- Semgrep (SAST): 74 reglas de JavaScript, Node.js y OWASP Top 10 sobre 42 archivos.
- `npm audit` de la API y del frontend (SCA): HIGH o superior.
- Trivy: imágenes propias (HIGH o CRITICAL con corrección). Las imágenes de terceros (WAF y MongoDB) se registran sin bloquear.
- Checkov: Terraform y Dockerfiles.
  Los reportes se guardan como artefactos de cada corrida. Dependabot propone actualizaciones semanales de npm, Docker, GitHub Actions y Terraform, e ignora los saltos de versión mayor de Node y del proveedor de AWS.

Resultados de la primera corrida y su tratamiento:

- Trivy bloqueó la imagen web por una vulnerabilidad nueva (`CVE-2026-4775`, HIGH, en `libtiff` de la imagen base de Nginx), publicada después de nuestro escaneo manual del 8 de octubre. Mitigar: `apk upgrade` en la imagen final. La corrida siguiente quedó en verde.
- Semgrep encontró 2 hallazgos. (1) AES-GCM sin longitud de tag de autenticación en `utils/crypto.js`: mitigar, se fijó en 16 bytes al cifrar y al descifrar y se valida el formato; compatible con los secretos ya guardados. (2) `res.sendFile` con dato del usuario en `routes/media.js`: aceptar como falso positivo, porque el nombre pasa por una expresión regular de UUID con extensión permitida, la carpeta raíz es fija y la prueba de path traversal de la Fase 6 devolvió 404; la justificación está en el código con `nosemgrep`. Con eso Semgrep pasó a bloquear.
- Gitleaks, `npm audit` y Checkov en verde desde la primera corrida.

Aceptados con justificación (imágenes de terceros, informativos en el flujo):

- `owasp/modsecurity-crs:nginx-alpine`: la misma `libtiff`. Se corrige cuando el proyecto publique una imagen nueva.
- `mongo:8`: 60 hallazgos (59 HIGH y 1 CRITICAL) en `gosu`, en las herramientas de Go de la imagen (`mongodump`, `mongoexport` y similares) y en `js-yaml`. MongoDB no publica puertos, vive en una red interna sin salida y esas herramientas no se ejecutan en producción.

Riesgos residuales:

- Las acciones de GitHub están fijadas por versión mayor y no por hash de commit, y las imágenes de Gitleaks, Trivy y Checkov usan `latest`. Una versión comprometida entraría al flujo sin revisión. En producción se fijarían por hash.
- Sin reglas de protección de rama (no exigibles en repositorios privados de plan gratuito), nada obliga a que los trabajos pasen antes de integrar un cambio. El panel de Code Scanning tampoco está disponible sin plan de pago.
- Una excepción `nosemgrep` oculta el hallazgo para siempre. Cada una debe revisarse si cambia el código que la rodea.
- El runner fijado exige revisar la migración de Ubuntu 24.04 a 26 (anunciada para el 19 de octubre de 2026).

## Etapa 12: pruebas de penetración

Alcance: https://localhost:8443 (sistema propio, entorno local). Versión evaluada: v1.0-evaluada; versión corregida: v1.1-remediada. Detalle en `docs/pentest.md`.

- Caja negra: Nmap (solo el 8443 expuesto), ZAP baseline (0 FAIL, 4 WARN), sondeos manuales y 9 de 9 ataques de prueba bloqueados por el WAF.
- Caja gris y abuso: 41 pruebas automatizadas (`pentest/caja-gris.ps1`). En v1.0, 38 en OK y 3 hallazgos: contraseñas comunes aceptadas, token vigente después de cerrar sesión y ausencia de límite global de peticiones.
- Corrección en v1.1: lista de contraseñas comunes, versión de token por usuario revocada al cerrar sesión, límite general de 120 peticiones por minuto, TLS 1.3 exclusivo, CORS acotado y cabeceras COOP, COEP y CORP. Resultado: 41 de 41 en OK.
- El pipeline de CI detectó además avisos nuevos de body-parser, multer y zod (corregidos con npm audit fix) y un falso positivo de Gitleaks (huella en `.gitleaksignore`).

## Mejora v1.2, paso 1: cambio de contraseña y cierre de todas las sesiones

Motivo: el plan de respuesta a incidentes dependía de cambios manuales en la base para reemplazar una contraseña o revocar las sesiones de una cuenta comprometida. Relacionado con las amenazas T-01 (robo de contraseñas) y T-04 (robo de sesión).

Amenazas consideradas con STRIDE:

- Suplantación: una sesión robada cambia la contraseña y se apropia de la cuenta. Control: se exige la contraseña actual.
- Suplantación: fuerza bruta de la contraseña actual desde una sesión robada. Control: 5 fallos cada 15 minutos por usuario, no por IP, para que cambiar de IP no sirva.
- Elevación de privilegios: cambiar la contraseña de otro usuario. Control: la ruta solo usa el usuario de la sesión y el esquema estricto rechaza campos extra como `userId`.
- Repudio: el cambio queda en la auditoría (`POST /api/auth/password`, con usuario, IP y estado) y en el registro de la API.
- Divulgación de información: las contraseñas no se guardan en la auditoría ni en los registros.

Controles implementados:

- `POST /api/auth/password`: sesión obligatoria, límite por usuario, esquema estricto, verificación de la contraseña actual con argon2id, la nueva tiene que ser distinta y pasa la misma política que el registro (mínimo de 10 caracteres y rechazo de contraseñas comunes). Al cambiarla se incrementa `tokenVersion`, lo que revoca todas las demás sesiones; la sesión actual recibe un token nuevo y conserva su estado de MFA.
- `POST /api/auth/logout-all`: sesión obligatoria, sin cuerpo. Incrementa `tokenVersion` y borra las cookies, lo que cierra todas las sesiones, incluida la actual.
- Página Seguridad: formularios de cambio de contraseña (con confirmación) y botón para cerrar todas las sesiones.

Pruebas nuevas en `pentest/caja-gris.ps1` (grupo C): C-01 sin sesión (401), C-02 contraseña actual incorrecta (400), C-03 contraseña común (400), C-04 campo extra `userId` (400), C-05 cambio válido (200), C-06 la sesión actual sigue activa (200), C-07 otra sesión anterior queda revocada (401), C-08 la contraseña anterior ya no sirve (401), C-09 cerrar todas las sesiones (200) y C-10 ningún token anterior vale después (dos 401).

Evidencia: `docs/evidencias/pentest/caja-gris-v1.2-cuentas.txt` (51 de 51 en OK).

## Mejora v1.2, paso 2: MFA con reautenticación y desactivación verificada

Motivo: activar el MFA solo exigía una sesión. Quien robara la sesión de un usuario sin MFA podía enrolar su propio autenticador y dejar fuera al titular. Además no existía forma de desactivarlo sin tocar la base de datos.

Amenazas consideradas con STRIDE:

- Suplantación: enrolar un autenticador ajeno con una sesión robada. Control: activar el MFA exige la contraseña actual.
- Suplantación y denegación de servicio: desactivar el MFA de la víctima para debilitar su cuenta. Control: exige contraseña y un código vigente de la app; el código no se puede reutilizar durante 90 segundos.
- Elevación de privilegios: dejar al administrador sin segundo factor. Control: el administrador no puede desactivar el MFA (403).
- Suplantación: fuerza bruta de la contraseña desde una sesión robada. Control: el mismo límite por usuario del cambio de contraseña (5 fallos cada 15 minutos) protege ambas rutas.
- Repudio: activar y desactivar el MFA queda en la auditoría y en el registro de la API.

Controles implementados:

- `POST /api/auth/mfa/setup`: ahora exige `{ password }`, con esquema estricto y límite por usuario.
- `POST /api/auth/mfa/disable`: exige `{ password, code }`; rechaza al administrador; borra la semilla cifrada y los datos de bloqueo; incrementa `tokenVersion`, lo que cierra las demás sesiones, y entrega un token nuevo a la sesión actual.
- Página Seguridad: pide la contraseña antes de mostrar el código QR y agrega el formulario para desactivar el MFA, que no aparece para el administrador.

Pruebas nuevas en `pentest/caja-gris.ps1` (grupo M), con un usuario de prueba y códigos TOTP calculados por el propio script según RFC 6238: M-01 activar sin contraseña (400), M-02 con contraseña incorrecta (400), M-03 con la correcta (200), M-04 confirmar con el código de la app (200), M-05 desactivar con código incorrecto (400), M-06 desactivar con contraseña incorrecta (400), M-07 desactivar con contraseña y código vigente (200) y M-08 la cuenta queda sin MFA. La restricción del administrador se verifica a mano, porque el script no usa la cuenta de administrador.

Evidencia: `docs/evidencias/pentest/caja-gris-v1.2-mfa.txt` (59 de 59 en OK).

Falso positivo de Gitleaks: al subir el paso 1, el pipeline marcó como posible secreto una contraseña incorrecta escrita a propósito en la prueba C-02 (regla `generic-api-key`). No es un secreto: es el valor que la prueba usa para comprobar el rechazo. Se registró su huella en `.gitleaksignore`, igual que el H-10, y el script ahora genera esa contraseña al azar en cada corrida para que no vuelva a aparecer.

## Mejora v1.2, paso 3: suspensión de cuentas y cierre de sesiones por el administrador

Motivo: ante una cuenta comprometida, el plan de respuesta a incidentes dependía de editar la base de datos a mano (incrementar `tokenVersion`) o de bajar el rol con `set-role.js`. No había forma de suspender una cuenta.

Amenazas consideradas con STRIDE:

- Elevación de privilegios: un editor o lector suspende cuentas o cierra sesiones ajenas. Control: solo el administrador con MFA verificado (`authorize('admin')`).
- Denegación de servicio: un administrador comprometido suspende a los demás administradores. Control: no se puede suspender a otro administrador sin cambiarle antes el rol, ni a uno mismo.
- Divulgación de información: el inicio de sesión revela que una cuenta está suspendida. Control: la cuenta suspendida recibe el mismo 401 que unas credenciales inválidas.
- Suplantación: una sesión abierta antes de la suspensión sigue funcionando. Control: suspender incrementa `tokenVersion` y, además, `authenticate` rechaza toda sesión de una cuenta suspendida.
- Repudio: cada suspensión, reactivación y cierre de sesiones queda en la auditoría (con el administrador que lo hizo) y en el registro de la API.

Controles implementados:

- Campo `suspended` en el usuario. `authenticate`, el inicio de sesión y la verificación de MFA rechazan las cuentas suspendidas.
- `PATCH /api/users/:id/status` con `{ suspended }`: solo admin con MFA, ID validado, esquema estricto; no sobre uno mismo ni sobre otro admin; suspender revoca todas las sesiones.
- `POST /api/users/:id/revoke-sessions`: solo admin con MFA; cierra todas las sesiones de otro usuario.
- Página Usuarios: columna de estado y botones para suspender, reactivar y cerrar sesiones, con confirmación.

Con esto, los escenarios "Fuerza bruta o robo de cuenta" y "Escalada de privilegios" del plan de respuesta a incidentes ya no requieren cambios manuales en la base para cerrar sesiones ni para bloquear una cuenta.

Pruebas nuevas en `pentest/caja-gris.ps1` (grupo X). Siempre se ejecutan: X-01 un editor intenta suspender (403), X-02 un lector intenta cerrar sesiones ajenas (403) y X-03 sin sesión (401). Con una cuenta admin de pruebas con MFA (parámetros `-AdminCorreo`, `-AdminClave` y `-AdminSemilla`, o sus variables de entorno, que nunca se guardan en el repositorio) se ejecutan además: X-04 el admin no puede suspenderse (400), X-05 campos extra (400), X-06 suspender (200), X-07 la sesión abierta deja de valer (401), X-08 el inicio de sesión de la cuenta suspendida da el mismo error que unas credenciales inválidas, X-09 reactivar (200), X-10 la cuenta reactivada inicia sesión (200), X-11 cerrar sus sesiones (200) y X-12 el token anterior deja de valer (401). Con esto, el script también automatiza pruebas del rol administrador con MFA, que antes solo se verificaban a mano (recomendación 9 del informe).

Evidencia: `docs/evidencias/pentest/caja-gris-v1.2-admin.txt` (71 de 71 en OK).

## Mejora v1.2, pasos 4 y 5: bloqueo por cuenta, contraseñas de 15 caracteres y mensajes en español

Motivo: el inicio de sesión solo tenía un límite por IP. Un ataque distribuido desde muchas IP podía probar contraseñas contra una misma cuenta sin freno, y el bloqueo por IP dejaba fuera a todos los usuarios que compartían esa IP (prueba A-02, riesgo T-17). Además, NIST SP 800-63B-4 pide al menos 15 caracteres para las contraseñas que se usan sin segundo factor, y el mínimo era 10. Por último, algunos errores de validación llegaban al usuario con el texto en inglés de Zod.

Amenazas consideradas con STRIDE:

- Suplantación: relleno de credenciales distribuido contra una cuenta. Control: bloqueo progresivo por cuenta, guardado en la base, que no depende de la IP.
- Denegación de servicio: usar el bloqueo para dejar fuera al titular (T-17). Control: el bloqueo es progresivo y corto (1 minuto desde el 5.º fallo seguido, duplicándose hasta un máximo de 15) y se reinicia con un inicio de sesión correcto.
- Divulgación de información: que el bloqueo revele qué correos existen. Control: la cuenta bloqueada recibe el mismo 401 que unas credenciales inválidas y el servidor ejecuta una verificación argon2 falsa para igualar el tiempo de respuesta.
- Suplantación: adivinar la contraseña mientras la cuenta está bloqueada. Control: durante el bloqueo la contraseña ni siquiera se verifica.

Controles implementados:

- Campos `loginFailCount` y `loginLockUntil` (ocultos) en el usuario; bloqueo progresivo en `POST /api/auth/login`.
- El límite por IP del inicio de sesión pasa de 5 a 10 fallos cada 15 minutos. No se debilita la protección: cada cuenta queda protegida por su propio bloqueo desde el 5.º fallo, y el límite por IP sigue frenando el relleno de credenciales contra muchas cuentas. A cambio, un usuario que se equivoca ya no deja fuera tan rápido a los demás usuarios de su misma IP.
- Mínimo de 15 caracteres para las contraseñas nuevas (registro y cambio de contraseña), en el servidor y en los formularios. Las contraseñas existentes siguen sirviendo para iniciar sesión; el mínimo se aplica al crearlas o cambiarlas.
- `middleware/validate.js` traduce al español los mensajes genéricos de Zod (campos faltantes, longitudes, formato, campos no permitidos), sin revelar detalles internos.

Pruebas nuevas en `pentest/caja-gris.ps1`: S-11 contraseña de 14 caracteres en el registro (400); grupo L con un usuario de prueba: L-01 cinco contraseñas incorrectas seguidas (cinco 401), L-02 con la cuenta bloqueada hasta la contraseña correcta recibe 401 y L-03 la respuesta es idéntica a la de unas credenciales inválidas. A-01 ahora usa un correo inexistente, para medir solo el límite por IP sin bloquear cuentas reales. Los usuarios que crea el script usan una clave generada de más de 15 caracteres.

Evidencia: `docs/evidencias/pentest/caja-gris-v1.2-login.txt` (75 de 75 en OK). Etiqueta: `v1.2-cuentas`.

## Mejora v1.3, paso 1: papelera de publicaciones y búsqueda

Motivo: borrar una publicación era definitivo, así que un error o una cuenta de editor comprometida podía destruir contenido sin forma de recuperarlo (riesgo T-25, pérdida de datos). Además, el sitio no tenía búsqueda, una función básica de cualquier CMS.

Amenazas consideradas con STRIDE:

- Manipulación y denegación de servicio: borrar contenido ajeno o propio sin vuelta atrás. Control: el borrado envía a una papelera; se puede restaurar durante 30 días.
- Elevación de privilegios: ver, restaurar o eliminar definitivamente publicaciones ajenas desde la papelera. Control: el mismo control de propietario de siempre; el editor solo ve y gestiona lo suyo y el admin todo.
- Divulgación de información: que lo enviado a la papelera siga visible en el sitio o en la búsqueda. Control: todas las consultas públicas excluyen la papelera.
- Manipulación: que una publicación restaurada reaparezca publicada sin revisión. Control: al restaurarse vuelve como borrador.
- Inyección y denegación de servicio en la búsqueda: inyección NoSQL o expresiones regulares costosas (ReDoS). Control: la búsqueda usa un índice de texto de MongoDB (`$text`), no expresiones regulares; el término se valida con Zod (texto de 2 a 100 caracteres; un arreglo se rechaza) y el operador lo arma el servidor con `mongoose.trusted`, sin datos del usuario como operador.
- Repudio: enviar a la papelera, restaurar y eliminar definitivamente quedan en la auditoría y en el registro de la API, y la publicación guarda quién la envió a la papelera.

Controles implementados:

- Campos `deletedAt` y `deletedBy` en la publicación e índice TTL que la elimina en forma definitiva 30 días después de enviarla a la papelera.
- `DELETE /api/posts/:id` envía a la papelera; `GET /api/posts/trash` la lista; `POST /api/posts/:id/restore` restaura como borrador; `DELETE /api/posts/:id/permanent` elimina definitivamente, solo desde la papelera.
- `GET /api/posts?q=` busca en título y contenido de las publicaciones publicadas, con índice de texto en español y mayor peso para el título.
- Panel: botón Papelera y página nueva con restaurar, eliminar definitivamente y los días que faltan para el borrado automático. Portada: buscador.

Pruebas nuevas en `pentest/caja-gris.ps1` (grupos B y P): B-01 la búsqueda encuentra un post publicado, B-02 un solo carácter (400), B-03 parámetro repetido (400), B-04 más de 100 caracteres (400), B-05 un patrón de regex se busca como texto; P-01 enviar a la papelera, P-02 ya no se ve en la ruta pública (404), P-03 tampoco en la búsqueda, P-04 otro editor no lo ve en su papelera, P-05 y P-06 otro editor no puede restaurarlo ni eliminarlo (403), P-07 un lector no accede a la papelera (403), P-08 no se puede editar desde la papelera (404), P-09 restaurar lo deja como borrador, P-10 y P-11 restaurar o eliminar definitivamente algo que no está en la papelera (404), P-12 eliminación definitiva (200) y P-13 ya no se puede restaurar (404). El grupo espera 61 segundos al inicio para no chocar con el límite general de 120 peticiones por minuto.

Evidencia: `docs/evidencias/pentest/caja-gris-v1.3-papelera.txt` (93 de 93 en OK).

Durante esta mejora, el pipeline bloqueó el pull request por avisos nuevos de Mongoose (versiones 9.0.0 a 9.11.3, severidad alta), publicados después de la versión anterior: sanitizeFilter no aplicado a nivel de conexión (GHSA-gg4r-jv3p-qx3c), contaminación de prototipos y otros. El sistema activa sanitizeFilter de forma global y no por conexión, pero se actualizó igual con npm audit fix y se repitieron las 93 pruebas de caja gris, todas en OK. Es el mismo proceso del hallazgo H-09 y muestra el valor del análisis continuo de dependencias.

## Mejora v1.3, paso 2: categorías, etiquetas, extracto e imagen destacada

Motivo: organizar el contenido como en cualquier CMS (categorías y etiquetas para navegar, extracto y tiempo de lectura en las tarjetas) y permitir una imagen destacada por publicación.

Amenazas consideradas con STRIDE:

- Elevación de privilegios: usar como imagen destacada una imagen de otro usuario (BOLA sobre imágenes). Control: la imagen tiene que existir y pertenecer al autor del post; si no, 403.
- Manipulación: inyectar contenido o estructuras en las categorías o etiquetas. Control: la categoría sale de una lista cerrada; cada etiqueta se valida con Zod (minúsculas, letras, números y guiones, de 2 a 30 caracteres, máximo 8 y sin duplicados). React muestra todo como texto.
- Inyección NoSQL en los filtros públicos `?category=` y `?tag=`. Control: se validan con los mismos esquemas antes de usarse; un arreglo o un valor fuera de la lista da 400.
- Divulgación de información: que la lista pública exponga datos internos de la imagen (dueño, tamaño). Control: la imagen se incluye solo con su nombre de archivo.

Controles implementados:

- Campos `category`, `tags`, `excerpt`, `readingMinutes` y `featuredImage` en la publicación. Si no se escribe un extracto, el servidor lo genera a partir del contenido, sin la sintaxis de Markdown. El tiempo de lectura se calcula en el servidor.
- `GET /api/posts/meta`: categorías disponibles y etiquetas más usadas en lo publicado.
- Filtros públicos `?category=` y `?tag=`, combinables con la búsqueda.
- Formulario: categoría, etiquetas, extracto e imagen destacada con vista previa. Portada: tarjetas con imagen, categoría, extracto, tiempo de lectura y etiquetas, más filtros por categoría y etiqueta. Página del post: imagen, categoría y etiquetas.

Pruebas nuevas en `pentest/caja-gris.ps1` (grupo T): T-01 crear con todos los campos e imagen propia (201), T-02 imagen de otro usuario (403), T-03 categoría fuera de la lista (400), T-04 más de 8 etiquetas (400), T-05 etiqueta con símbolos (400), T-06 y T-07 filtros por categoría y etiqueta, T-08 la imagen se expone solo con su nombre de archivo, T-09 filtro con una categoría inexistente (400) y T-10 extracto automático. El grupo borra al final sus publicaciones e imágenes de prueba.

Evidencia: `docs/evidencias/pentest/caja-gris-v1.3-taxonomia.txt` (103 de 103 en OK).

## Mejora v1.3, paso 3: rediseño de la interfaz, modo oscuro y diálogos propios

Motivo: la interfaz era funcional pero muy básica, y las confirmaciones usaban `window.confirm`, que muestra el diálogo del navegador con el texto "localhost:8443 dice", poco claro para el usuario.

Cambios:

- Diseño nuevo en todas las páginas: barra de navegación fija con enlace activo, tarjetas de publicaciones en cuadrícula con imagen, página de artículo con portada, formularios y tablas con estilos comunes (`card`, `btn`, `input`, `badge`), página 404 y pie de página.
- Modo oscuro con un botón en la barra de navegación. La preferencia ("claro" u "oscuro") se guarda en `localStorage`; no se guarda ningún dato de sesión ni personal, de acuerdo con la regla de no usar `localStorage` para tokens.
- Diálogo de confirmación propio (`role="alertdialog"`, foco en el botón principal, cierre con Escape) y avisos tipo toast con `aria-live`, en lugar de `window.confirm`. Las acciones destructivas usan el botón rojo.

Seguridad: el rediseño no cambia la API ni las reglas de acceso. Se respetan la CSP y la cabecera COEP: no se cargan fuentes, íconos ni imágenes de otros orígenes (los íconos son SVG en línea y la fuente es la del sistema), ni se usan estilos o scripts en línea. Las 103 pruebas de caja gris se repitieron después del rediseño.

Evidencia: `docs/evidencias/pentest/caja-gris-v1.3-diseno.txt` (103 de 103 en OK).

Ajustes posteriores al rediseño: las tarjetas sin imagen destacada muestran un fondo con la inicial de la categoría, para que la cuadrícula se vea pareja; y se agregó `server/scripts/limpiar-pruebas.js`, que borra las cuentas que crea el script de caja gris en cada corrida (solo correos con el patrón de prueba, nunca cuentas admin y solo con `--confirmar`).

## Mejora v1.3, paso 4: comentarios con moderación

Motivo: los comentarios son una función básica de un CMS de contenido, pero en el diseño original se habían descartado por sus riesgos (spam, XSS y moderación). Se reconsideraron haciendo primero el análisis de amenazas y agregando las pruebas correspondientes, como exige la política del proyecto.

Amenazas consideradas con STRIDE:

- Manipulación y XSS almacenado: un comentario con HTML o JavaScript que se ejecuta en el navegador de otros lectores. Control: el comentario es texto plano; React lo muestra como texto (nunca como HTML ni Markdown) y la CSP estricta bloquearía cualquier script en línea. El WAF filtra además los patrones de XSS conocidos.
- Spam y denegación de servicio: publicar comentarios en masa o con enlaces. Control: solo usuarios registrados; límite de 5 comentarios cada 10 minutos por usuario (independiente de la IP), máximo 2 enlaces y 1000 caracteres; y moderación previa, así que nada se publica sin aprobación.
- Elevación de privilegios: aprobarse el propio comentario o moderar los de publicaciones ajenas. Control: el estado lo decide el servidor (el esquema estricto rechaza el campo `status`); solo modera el autor de la publicación o un admin; un lector no puede moderar.
- Elevación de privilegios: borrar comentarios ajenos. Control: solo el autor del comentario, el autor de la publicación o un admin.
- Divulgación de información: exponer el correo de quien comenta, o comentarios de borradores. Control: la lista pública solo devuelve comentarios aprobados de publicaciones publicadas, y del autor solo el nombre.
- Repudio: cada comentario, moderación y borrado queda en la auditoría y en el registro de la API, y el comentario guarda quién lo moderó y cuándo.

Controles implementados:

- Modelo `Comment` (publicación, autor, contenido, estado pendiente, aprobado o rechazado, moderador y fecha de moderación).
- `GET /api/comments?post=` público; `POST /api/comments` con sesión y límite por usuario; `GET /api/comments/moderation` para editores (solo sus publicaciones) y admin (todas); `PATCH /api/comments/:id/status` y `DELETE /api/comments/:id` con verificación de propietario. El borrado definitivo de una publicación borra también sus comentarios.
- Los comentarios del autor de la publicación o de un admin se aprueban solos.
- Página de la publicación: sección de comentarios con contador de caracteres. Panel: página de moderación con pestañas Pendientes, Aprobados y Rechazados, y contador de pendientes en el botón.

Pruebas nuevas en `pentest/caja-gris.ps1` (grupo K): K-01 comentar sin sesión (401), K-02 el comentario de un lector queda pendiente, K-03 no se ve en la lista pública, K-04 no se puede enviar `status` para aprobarse solo (400), K-05 no se puede comentar un borrador (404), K-06 más de 2 enlaces (400), K-07 más de 1000 caracteres (400), K-08 un editor no modera publicaciones ajenas (403), K-09 un lector no modera (403), K-10 el autor aprueba (200), K-11 el aprobado se ve y sin el correo del autor, K-12 un editor no borra comentarios ajenos (403), K-13 el autor borra el suyo (200), K-14 límite de frecuencia (429) y K-15 el borrado definitivo de la publicación elimina sus comentarios.

Evidencia: `docs/evidencias/pentest/caja-gris-v1.3-comentarios.txt` (118 de 118 en OK). En la prueba manual, un comentario con `<script>` fue bloqueado por el WAF antes de llegar a la API.

## Mejora v1.3, paso 5: segmentación de la red de Docker

Motivo: los cuatro contenedores compartían una sola red interna (`backend`). Si se comprometía el WAF o el frontend, el atacante podía conectarse directamente a la API o a MongoDB, saltándose las capas intermedias. Era un riesgo pendiente de la Entrega 1 (R07) y del análisis (movimiento lateral).

Diseño: cuatro redes, una por zona, y cada servicio solo en las que necesita.

| Red | Servicios | Salida a internet |
|---|---|---|
| `edge` | WAF (puerto publicado 127.0.0.1:8443) | Sí |
| `dmz` | WAF y frontend | No |
| `aplicacion` | Frontend y API | No |
| `datos` | API y MongoDB | No |

Así, el WAF solo ve al frontend, el frontend solo a la API, y solo la API ve a MongoDB. Es el mismo principio que el diseño en AWS, donde los grupos de seguridad permiten únicamente ALB hacia ECS y ECS hacia DocumentDB.

Verificación: `pentest/verificar-red.ps1` prueba desde dentro de cada contenedor qué puede alcanzar. R-01 WAF hacia el frontend (alcanzable), R-02 y R-03 WAF hacia la API y MongoDB (no resuelve el nombre), R-04 frontend hacia la API (alcanzable), R-05 frontend hacia MongoDB (no resuelve), R-06 API hacia MongoDB (alcanzable) y R-07 la API no tiene salida a internet. Evidencia: `docs/evidencias/red-segmentada.txt`.

Además, el frontend muestra un mensaje claro cuando el WAF bloquea una solicitud (por ejemplo, un comentario con `<script>`): antes decía "Error de red" porque el WAF responde con una página HTML en lugar de JSON.

## Cierre de la v1.3: dependencias y riesgo residual

Dependencias: Dependabot propuso actualizaciones menores de Express, express-rate-limit, Vite, React Router y ESLint, ninguna por un aviso de seguridad (`npm audit` sin vulnerabilidades en el servidor ni en el cliente). Se integró Express 5.2.1 a 5.3.0 (pull request #13), con el pipeline en verde y las 118 pruebas de caja gris repetidas en OK (`docs/evidencias/pentest/caja-gris-v1.3-final.txt`). Las demás se pospusieron para no mezclar cambios de dependencias con las mejoras y quedaron abiertas: Dependabot y el pipeline siguen vigilando, y un aviso nuevo bloquearía la integración, como ocurrió con Mongoose. La propuesta de Mongoose 9.11.4 se cerró por estar superada por la 9.12.1.

Riesgo residual: la hoja `Mejoras_v1.3` de `docs/analisis-de-riesgos-cms.xlsx` recalcula el residual sin modificar la matriz evaluada en el informe. Bajan T-01 (bloqueo por cuenta y 15 caracteres), T-04 (revocación de sesiones y MFA con verificación), T-17 (bloqueo progresivo), T-21 (red segmentada) y T-25 (papelera), y se agrega la amenaza nueva T-30 (spam en comentarios), mitigada con moderación previa y límites. Resultado: de 0 críticas, 0 altas, 16 medias y 13 bajas en la v1.1, a 0 críticas, 0 altas, 13 medias y 17 bajas en la v1.3.
