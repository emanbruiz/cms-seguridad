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
