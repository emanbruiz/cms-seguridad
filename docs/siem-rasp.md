# Detección, monitoreo y respuesta: SIEM, RASP y respuesta a incidentes

Documento de diseño del CMS. El WAF, la auditoría en la aplicación y las pruebas ya existen y están evidenciados. El SIEM y el RASP se presentan como **diseño conceptual** con casos de uso validados contra los eventos reales que generaron las pruebas de penetración.

## 1. Seguridad en profundidad: qué cubre cada control

| Capa | Control | Qué hace | Estado |
|---|---|---|---|
| Borde | WAF (ModSecurity con OWASP CRS) | Bloquea ataques conocidos antes de llegar a la aplicación | Implementado |
| Aplicación | Validación estricta, autorización por rol y dueño, límites de tasa, token revocable | Defensa en el propio código | Implementado |
| Aplicación (en ejecución) | RASP | Observa y bloquea ataques desde dentro del proceso | Diseño |
| Detección | SIEM | Reúne los registros, correlaciona eventos y alerta | Diseño con reglas validadas |
| Respuesta | Plan de respuesta a incidentes | Contiene, erradica y recupera | Documentado |

El WAF mira el tráfico desde afuera y puede equivocarse con contenido legítimo (falsos positivos) o ser evadido; el RASP ve el contexto real de la ejecución (qué consulta se arma, qué archivo se abre); el SIEM junta las dos vistas y detecta lo que ninguna ve sola, como una fuerza bruta distribuida en el tiempo.

## 2. SIEM

### 2.1 Fuentes de registros

| Fuente | Qué registra | Dónde está hoy | Equivalente en AWS |
|---|---|---|---|
| Auditoría de la aplicación | Escrituras, accesos rechazados (401 y 403), fallos de MFA, cambios de rol; usuario, IP y agente | Colección `AuditLog` (90 días) | CloudWatch Logs con KMS |
| Registros de la API (pino) | Cada petición, login fallido, bloqueos de MFA | Salida de los contenedores | CloudWatch Logs |
| WAF | Peticiones bloqueadas, regla y puntaje de anomalía | Registro de ModSecurity del contenedor | Registros de AWS WAF a CloudWatch |
| Proxy y balanceador | Accesos, códigos de estado, TLS | Registro de Nginx | Registros de acceso del ALB a S3 |
| Red | Tráfico aceptado y rechazado | No aplica en local | VPC Flow Logs |
| Cuentas y configuración | Cambios de IAM y de recursos | No aplica en local | CloudTrail y GuardDuty |
| Pipeline | Resultado de Gitleaks, Semgrep, npm audit, Trivy y Checkov | GitHub Actions | GitHub Actions y Security Hub |

### 2.2 Flujo propuesto

1. **Recolectar:** un agente (Promtail o Wazuh en local, el agente de CloudWatch en AWS) lee los registros de los contenedores.
2. **Normalizar:** se unifican los campos (fecha, IP, usuario, ruta, código, regla).
3. **Almacenar fuera de la base de la aplicación**, con retención mínima de 90 días en caliente y 365 en frío. Esto cierra la brecha de la amenaza T-15: hoy la auditoría vive en la misma base que atacaría un intruso.
4. **Correlacionar** con las reglas de la sección 2.3.
5. **Alertar** por correo o mensajería según la severidad.
6. **Responder** según el plan de la sección 4.

Herramienta recomendada para el entorno local: **Wazuh** (SIEM y detección de intrusiones de código abierto) o **Grafana Loki** para una versión más ligera. En la nube: CloudWatch Logs con OpenSearch, GuardDuty y Security Hub.

### 2.3 Casos de uso de detección

Cada caso se apoya en eventos que el sistema ya genera. La columna de evidencia indica la prueba que lo produjo.

| ID | Detección | Fuente | Condición | Severidad | Respuesta | Evidencia |
|---|---|---|---|---|---|---|
| UC-01 | Fuerza bruta de inicio de sesión | AuditLog y API | 5 o más respuestas 401 en `/api/auth/login` desde una IP en 15 minutos | Alta | Bloquear la IP en el WAF; revisar las cuentas atacadas | Prueba A-01: 401, 401, 401 y luego 429 |
| UC-02 | Bloqueo activo de login o MFA | API | Cualquier 429 en login o MFA | Media | Verificar si es el usuario legítimo; si no, tratar como UC-01 | Prueba A-02 |
| UC-03 | Código MFA inválido repetido | AuditLog | 3 o más 401 en `/api/auth/mfa/verify` de un mismo usuario | Alta | Posible contraseña robada: forzar cambio de clave y revisar sesiones | Etapa 7B |
| UC-04 | Cambio de privilegios | AuditLog | `PATCH /api/users/:id/role` con respuesta 200 | Alta | Confirmar con el administrador que fue intencional | Fase 5 |
| UC-05 | Intento de escalada o IDOR | AuditLog | 10 o más 403 de un mismo usuario en 10 minutos | Alta | Suspender la cuenta y revisar sus peticiones | Pruebas Z-01 a Z-09 |
| UC-06 | Ráfaga de bloqueos del WAF | WAF | 20 o más bloqueos de una IP en un minuto | Media | Bloquear la IP; revisar si es un escáner | Escaneo con ZAP |
| UC-07 | Subida sospechosa | AuditLog | 3 o más respuestas 415 o 413 en `/api/media` | Media | Revisar el usuario y los archivos | Pruebas U-01 a U-04 |
| UC-08 | Uso de un token revocado | API | 401 con un token firmado válido pero de versión anterior | Alta | Posible robo de sesión: invalidar las sesiones del usuario | Prueba S-10 |
| UC-09 | Tráfico anormal | API y WAF | 429 del límite general desde una IP | Media | Revisar si es abuso o un cliente mal configurado | Prueba E-05: 429 x139 |
| UC-10 | Fallo del pipeline de seguridad | GitHub Actions | Un trabajo bloqueante en rojo en la rama principal | Media | Corregir antes de integrar más cambios | Corrida #16 |

### 2.4 Limitaciones asumidas

- No hay un SIEM desplegado: las reglas se definieron y se validaron contra los eventos reales de las pruebas, pero la alerta automática queda como trabajo futuro.
- En el entorno local, Docker Desktop hace que todas las peticiones lleguen con la misma IP interna, lo que limita las reglas por IP. En AWS el balanceador entrega la IP real del cliente con `X-Forwarded-For` y `TRUST_PROXY` ajustado.

## 3. RASP

**Qué es.** Un agente dentro del proceso de Node.js que instrumenta las funciones peligrosas (consultas a la base de datos, acceso a archivos, ejecución de comandos, resolución de URL) y bloquea una llamada cuando detecta que sigue un patrón de ataque, con el contexto completo de la petición. A diferencia del WAF, no depende de la forma de la petición sino de lo que realmente hace la aplicación.

**Cómo se aplicaría aquí.**

| Función vigilada | Ataque que detiene | Defensa actual equivalente |
|---|---|---|
| Consultas a MongoDB | Inyección NoSQL | Zod estricto, `sanitizeFilter` y regla 942290 del WAF |
| Lectura de archivos (`sendFile`) | Path traversal | Nombre validado con UUID y carpeta fija |
| Procesamiento de archivos subidos | Archivos maliciosos | Tipo por contenido, tamaño y extensión |
| Llamadas salientes | SSRF | La API no hace llamadas salientes |
| Deserialización y evaluación de código | Ejecución de código | Sin `eval` ni `child_process` (Semgrep en 0 hallazgos) |

**Decisión.** No se implementa un agente RASP: el código no tiene las funciones que un RASP vigilaría con más valor (no ejecuta comandos ni hace llamadas salientes) y las defensas equivalentes ya están en el propio código y se verificaron con pruebas. Se recomienda como mejora futura un agente comercial para Node.js de los que se integran al proceso, a evaluar con una prueba de impacto en rendimiento, y enviar sus eventos al mismo SIEM.

## 4. Respuesta a incidentes

Ciclo de NIST SP 800-61: preparación, detección y análisis, contención, erradicación, recuperación y lecciones aprendidas. Rol único: el responsable del proyecto.

| Escenario | Detección | Contención | Erradicación y recuperación |
|---|---|---|---|
| Fuerza bruta o robo de cuenta | UC-01, UC-03 | Bloquear la IP; subir la versión de tokens del usuario (cerrar su sesión); reiniciar el MFA con `reset-mfa.js` | Cambiar la contraseña; revisar la auditoría de lo que hizo la cuenta; revisar la lista de contraseñas comunes |
| Escalada de privilegios | UC-04, UC-05 | Suspender la cuenta; revocar sus tokens | Revertir los cambios de rol; revisar los posts, imágenes y usuarios modificados |
| Fuga de la base de datos | Aviso del SIEM, de GuardDuty o de un tercero | Aislar el contenedor de la base; rotar `JWT_SECRET`, `MFA_ENC_KEY` y la contraseña de la base | Todos los usuarios deben restablecer su contraseña y reenrolar el MFA; restaurar desde el último respaldo limpio |
| Dependencia o imagen comprometida | UC-10 | Detener el despliegue | Actualizar o fijar la versión; reconstruir y escanear |

**Capacidad de recuperación.** El diseño en la nube incluye respaldos de 14 días y protección contra el borrado. En el entorno local **no hay respaldo automatizado**: es el mayor riesgo residual del análisis (T-25) y se baja al implementar y probar un respaldo y su restauración.

## 5. Métricas sugeridas

- Tiempo medio de detección y de contención.
- Cantidad de bloqueos del WAF por día y su proporción de falsos positivos.
- Intentos de inicio de sesión fallidos y bloqueados por día.
- Hallazgos abiertos por severidad (hoja Hallazgos del análisis de riesgos).
- Días entre la publicación de una vulnerabilidad y su corrección.
