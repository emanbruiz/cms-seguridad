# Arquitectura de seguridad en la nube

Diseño objetivo en AWS del CMS. Se escribe como código en `infra/terraform` y no se despliega.

## Flujo de datos

1. El usuario entra por HTTPS (TLS 1.3) al Application Load Balancer, protegido por AWS WAF (reglas administradas OWASP y límite de tasa por IP).
2. El balanceador reenvía el tráfico por HTTP interno (puerto 8080) a ECS Fargate, en la subred privada: un contenedor `web` (Nginx) y uno `api` (Node.js).
3. La API consulta Amazon DocumentDB en la subred de datos por el puerto 27017 con TLS, solo desde el grupo de seguridad de la aplicación.
4. Las imágenes subidas van a un bucket S3 privado con cifrado SSE-KMS. Los secretos (JWT, clave MFA y cadena de conexión) se leen de Secrets Manager.
5. Los registros del WAF, del balanceador, de la VPC (flow logs), de la aplicación y de la auditoría de DocumentDB van a CloudWatch Logs, cifrados con KMS, y de ahí al SIEM.

## Zonas de confianza

| Zona            | Recursos          | Quién puede entrar                              |
| --------------- | ----------------- | ----------------------------------------------- |
| Internet        | Usuarios          | Solo al ALB por el puerto 443                   |
| Subred pública  | ALB con WAF y NAT | Internet (443)                                  |
| Subred privada  | ECS Fargate       | Solo el ALB (8080). La salida va por el NAT     |
| Subred de datos | DocumentDB        | Solo la aplicación (27017). Sin ruta a internet |

## Menor privilegio (IAM)

| Rol                   | Permisos                                                                                 | Alcance                             |
| --------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------- |
| Ejecución de la tarea | Descargar imágenes de ECR, escribir logs, leer un secreto y descifrar con la CMK         | Solo esos recursos                  |
| Tarea (aplicación)    | `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `kms:GenerateDataKey` y `kms:Decrypt` | Solo el bucket de imágenes y la CMK |
| Flow logs             | Escribir en su grupo de logs                                                             | Solo ese grupo                      |
| Personas              | Sin claves de acceso de larga duración. Acceso con MFA y roles temporales                | Menor privilegio                    |

## Estrategia de cifrado

| Dato             | En tránsito                                                          | En reposo                                                                          |
| ---------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Navegador a ALB  | TLS 1.3 (política `ELBSecurityPolicy-TLS13-1-3-2021-06`)             | No aplica                                                                          |
| ALB a ECS        | HTTP interno dentro de la VPC (riesgo aceptado, puede pasar a HTTPS) | No aplica                                                                          |
| ECS a DocumentDB | TLS obligatorio (parámetro `tls`)                                    | AES-256 con CMK de KMS                                                             |
| Imágenes (S3)    | Solo TLS (política que niega `aws:SecureTransport=false`)            | AES-256 con SSE-KMS                                                                |
| Secretos         | TLS (API de AWS)                                                     | AES-256 con CMK. La semilla MFA además va cifrada en la aplicación con AES-256-GCM |
| Logs             | TLS                                                                  | CloudWatch Logs cifrado con CMK                                                    |

## Equivalencia entre lo local y AWS

| Control local (Docker)    | Equivalente en AWS                      |
| ------------------------- | --------------------------------------- |
| ModSecurity con OWASP CRS | AWS WAF con reglas administradas        |
| Nginx con TLS             | ALB con certificado ACM y TLS 1.3       |
| Red interna de Docker     | Subredes privadas y grupos de seguridad |
| Archivo `.env`            | Secrets Manager con CMK                 |
| MongoDB en contenedor     | Amazon DocumentDB                       |
| Volumen `uploads`         | Bucket S3 privado cifrado               |
| Logs y auditoría          | CloudWatch Logs, flow logs y SIEM       |
| Escaneo con Trivy         | Escaneo de imágenes en ECR              |

## Decisiones de diseño

- Puerta de entrada: ALB con WAF en vez de API Gateway, porque la aplicación ya trae su propio límite de peticiones y el balanceador soporta contenedores, TLS 1.3 y WAF. API Gateway con VPC Link queda como alternativa si hiciera falta gestionar claves de API o cuotas por cliente.
- No se incluye CloudFront (CDN): exige dominio y certificado en us-east-1 y no cambia el alcance del análisis. Queda como mejora.
- Base de datos: DocumentDB (administrada y dentro de la VPC) en vez de Atlas, para mantener todo el tráfico de datos privado.

## Cambios necesarios en la aplicación para migrar

- Guardar las imágenes en S3 (hoy van al disco local).
- Conectar a DocumentDB con TLS y su bundle de CA, y con `retryWrites=false`.
- Cambiar el destino de Nginx de `api:4000` a `127.0.0.1:4000` (mismo task de ECS).
- Crear un usuario de aplicación con rol `readWrite` en vez de usar el usuario maestro.
- Ajustar `TRUST_PROXY` al número real de saltos detrás del balanceador.
