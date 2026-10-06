El contenido se guarda en Markdown crudo, y si el frontend lo muestra sin sanitizar hay riesgo de XSS almacenado. Se mitiga en la Fase 4 con DOMPurify y la CSP.
El 403 en un post ajeno confirma que el ID existe. Es un riesgo bajo porque son ObjectId no secuenciales.
No hay límite general de peticiones: el listado público se puede recorrer completo con paginación, y no hay freno contra spam al crear posts. Es un buen candidato para el WAF y el rate limit de la Fase 6.
Los intentos de acceso a posts ajenos quedan registrados en el log (evidencia para el SIEM).
