# Despliegue privado y presupuesto

Cloudflare dirige el prefijo `/PlanEstudio/` y las rutas de descubrimiento de OAuth a CloudFront. La distribución lee el sitio desde un bucket privado y sirve las operaciones autenticadas mediante API Gateway HTTP y Lambda. DynamoDB conserva las sesiones, el calendario, los recursos, las actividades y los estados de video con recuperación a un punto en el tiempo. La API accede al catálogo en una clave privada.

## Preparar la publicación

1. Conecta la cuenta AWS y la zona Cloudflare activa de `aisergio.dev`, con un registro DNS con proxy para el dominio. Usa un token limitado a editar rutas de Workers en la zona y scripts en la cuenta.
2. Registra un cliente OAuth web de Google. Su URI de retorno a Google es `https://planestudio-<cuenta-AWS>.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`. Guarda `client_id` y `client_secret` como JSON en AWS Secrets Manager. Marca el secreto con `Project=PlanEstudio`.
3. Usa un archivo de variables en `.private` con `owner_email`, `google_secret_arn`, `cloudflare_account_id`, `cloudflare_zone_id` y, si está listo el PC, el `worker_token_hash` derivado de `PLANESTUDIO_WORKER_TOKEN`. Guarda el token Cloudflare en el entorno del proceso y el estado de Terraform bajo acceso local restringido.
4. Selecciona el perfil AWS autorizado y ejecuta `powershell -File scripts/deploy.ps1 -Config .private/production.tfvars -Apply`. El script construye y publica la web y el catálogo. Sube los recursos versionados antes del HTML y guarda el estado de Terraform en una carpeta privada de la cuenta de destino.
5. Cuando `Project` aparezca en la lista de etiquetas de facturación, configura `activate_cost_tag = true`. Verifica el presupuesto mensual y sus tres avisos en AWS Budgets. AWS puede tardar en listar la etiqueta y actualizar el gasto. [Activación de etiquetas de costos](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/activating-tags.html)

Comprueba el acceso desde un PC y un celular y prueba una cuenta diferente. La sesión de la cuenta autorizada expira a las cuatro horas. API Gateway limita solicitudes y el servidor verifica las credenciales. Si hay abuso en el inicio de sesión, habilita Cloudflare Turnstile antes de iniciar OAuth y valida el resultado en el servidor. Mantén el retorno OAuth y el MCP accesibles al tráfico autenticado. [Validación de Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

## ChatGPT y Bedrock

En ChatGPT web, agrega una app personalizada con `https://aisergio.dev/PlanEstudio/mcp` y selecciona OAuth. Copia la URL exacta de retorno que muestra ChatGPT a `mcp_redirect_uri`, actualiza Terraform y usa `terraform -chdir=infra output -raw mcp_client_id` como identificador del cliente público. El servidor publica los metadatos OAuth con PKCE S256 y delega la autorización en Cognito. El permiso `planestudio/lectura` se emite para el MCP. Revisa que la cuenta o el espacio de trabajo tenga habilitada esta opción. [Conectar un servidor MCP](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)

Las tres consultas usan el calendario y el catálogo de la aplicación. Pide el progreso de la semana y confirma que el total y el objetivo coincidan con la gráfica. Prueba que un token caducado reciba la respuesta 401.

Selecciona Amazon Nova 2 Lite en el entorno de experimentación de Amazon Bedrock en Virginia del Norte y prueba una pregunta sobre la guía. Repite desde el tutor de la web. El perfil de aplicación usa `Converse` y lleva la etiqueta del proyecto. Cada solicitud reserva uno de los 500 turnos mensuales. El modelo puede devolver 512 tokens por turno. El límite teórico usado para estimar el costo de entrada es de 4.000 tokens por llamada. [Amazon Nova 2 Lite](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-2-lite.html)

## Estimación mensual en USD

El escenario supone 2 GB de descarga, 50.000 solicitudes de API, DynamoDB bajo demanda con respaldo y un secreto de Google. El cálculo usa US$0,33 por millón de tokens de entrada y US$2,75 por millón de salida para Nova 2 Lite en el perfil EE. UU. [Tarifa del modelo en el ejemplo de AWS](https://github.com/aws-samples/ocr-with-aws-ai-services#bedrock-models)

| Concepto | Uso mensual | Estimación |
|---|---|---:|
| Secrets Manager | Un secreto | US$0,40 |
| S3, API Gateway y DynamoDB | Catálogo, solicitudes y respaldo | US$0,10 |
| CloudFront, Lambda, CloudWatch y Cognito | Con las cuotas disponibles | US$0,00 |
| Bedrock | 200 turnos de 2.400 tokens de entrada y 350 de salida en promedio | US$0,35 |
| **Total previsto** | Antes de impuestos | **US$0,85** |

Con 500 turnos de 4.000 tokens de entrada y 512 de salida, el modelo suma US$1,36 y la proyección total es US$1,86. Si se agotan las cuotas compartidas, el escenario del plan proyecta US$2,38. La cifra supone el dominio y las licencias existentes. Los MP4 se guardan en el PC y se suben a YouTube. Mide las horas de render y el consumo eléctrico en el piloto.

AWS Budgets avisa al superar US$6, US$8 y US$10 del gasto registrado. El cupo del tutor limita las solicitudes de Bedrock desde la aplicación. [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)
