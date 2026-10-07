# PRIVACY 21719 Dental

Plataforma web para que clínicas y consultas dentales gestionen y **demuestren** su cumplimiento de la
Ley 21.719 de Protección de Datos Personales (vigencia general: 1 de diciembre de 2026).

> PRIVACY 21719 organiza y documenta el programa de cumplimiento. No certifica cumplimiento ni reemplaza la
> asesoría jurídica. Las referencias a artículos son orientativas y deben ser validadas por un abogado.

---

## 1. Qué incluye

| Módulo | Qué hace |
|---|---|
| **Panel** | Indicadores calculados en vivo desde la base de datos: avance, riesgo, plazos, tareas, incidentes, software clínico. |
| **Diagnóstico** | 16 preguntas con artículo de referencia. Cada respuesta genera una recomendación con plazo y un ranking de prioridades. Genera tareas automáticamente. |
| **Plan de acción** | Tareas obligación → riesgo → control → responsable → evidencia. Subida real de archivos con huella SHA-256. Búsqueda y filtros. |
| **Inventario de datos** | Registro de tratamientos con copiloto de reglas (biometría, fotos, menores, IA, transferencias…) que sugiere riesgo y evaluación de impacto. |
| **Solicitudes de pacientes** | Folio correlativo, vencimiento a 30 días corridos, prórroga única, verificación de identidad, historial, vínculo con el paciente del software clínico y obtención de datos para acceso/portabilidad. |
| **Formulario público** | `/p/<clinica>`: los pacientes envían solicitudes sin cuenta; reciben folio y fecha de respuesta. Protegido con límite de envíos y trampa anti-bots. |
| **Incidentes** | Expediente con pasos; con datos de salud exige notificar a la Agencia y a los titulares antes de cerrar. |
| **Proveedores** | Encargados de tratamiento, estado del contrato, ubicación de datos; riesgo recalculado automáticamente. |
| **Documentos** | 6 plantillas que se completan con los datos de la clínica, edición, versiones y **aprobación humana obligatoria**. |
| **Software clínico** | Conexión con Dentalink/Medilink (o datos de prueba), sincronización, pacientes, profesionales y agenda. |
| **Usuarios** | Roles Administrador, Responsable de privacidad, Recepción y Solo lectura. Contraseñas temporales con cambio obligatorio. |
| **Auditoría** | Registro de quién hizo qué. La base de datos impide modificarlo o borrarlo. |

---

## 2. Requisitos

- **Node.js 22 LTS** (o 20.11+): https://nodejs.org
- **PostgreSQL 14+**. La forma más simple es **Docker Desktop** (https://www.docker.com/products/docker-desktop).
  También sirve un PostgreSQL instalado directamente.

## 3. Instalación y ejecución local (paso a paso)

Los comandos funcionan igual en Windows (PowerShell), macOS y Linux, desde la carpeta del proyecto.

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar la base de datos (Docker)
docker compose up -d

# 3. Crear el archivo de configuración
#    Windows PowerShell:  Copy-Item .env.example .env
#    macOS / Linux:       cp .env.example .env
cp .env.example .env

# 4. Generar la clave de cifrado y pegarla en .env, en INTEGRATION_ENCRYPTION_KEY=
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 5. Crear las tablas y cargar el catálogo (preguntas y plantillas)
npm run setup

# 6. (Opcional) Cargar la clínica de demostración con datos ficticios
npm run db:seed:demo

# 7. Ejecutar en modo desarrollo (API en :4000 y web en :5173)
npm run dev
```

Abra **http://localhost:5173**.

**Usuarios de demostración** (contraseña `Demo21719-clinica`, solo para pruebas locales):

| Rol | Correo |
|---|---|
| Administrador | admin@demo.example |
| Responsable de privacidad | privacidad@demo.example |
| Recepción | recepcion@demo.example |
| Solo lectura | auditor@demo.example |

Formulario público de la demo: http://localhost:5173/p/demo

### Crear una clínica real

```bash
npm run create-admin --workspace server -- --clinic "Clínica Dental Ejemplo" --slug clinica-ejemplo --email admin@clinica.cl --name "Nombre Apellido"
```

Imprime una contraseña temporal. Al ingresar, el sistema obliga a cambiarla. Desde **Usuarios** se crean las demás cuentas.

### Pruebas

```bash
npm test          # 21 pruebas: plazos, RUT, diagnóstico, copiloto, cliente Dentalink/Medilink
npm run typecheck # verificación de tipos de backend y frontend
```

---

## 4. Producción

### Despliegue en Render (configurado)

El archivo `render.yaml` crea en Render la base de datos PostgreSQL y el servicio web (Docker) con HTTPS:

1. Suba este repositorio a GitHub.
2. En Render: **New → Blueprint**, elija el repositorio y presione **Apply**.
3. Render pedirá `DEMO_PASSWORD` (contraseña de los usuarios de demostración, mínimo 12 caracteres).
4. Al terminar, la aplicación queda en `https://<nombre>.onrender.com`. Cada `git push` a `main` vuelve a desplegar.

Al iniciar, el contenedor aplica migraciones, carga el catálogo y, si `SEED_DEMO=true`, crea la clínica de
demostración una sola vez. Los archivos de evidencia se guardan en PostgreSQL, por lo que no se pierden al redesplegar.

**Prueba de la URL pública:** en GitHub → Actions → *Prueba de la URL pública* → Run workflow, indicando la URL.
Requiere el secreto de repositorio `DEMO_PASSWORD`. El resultado aparece en el resumen de la ejecución y las capturas como archivo descargable.

### Otras plataformas

```bash
npm run build                 # compila web (web/dist) y servidor (server/dist)
npm run db:migrate && npm run db:seed
npm start                     # un solo proceso sirve la API y la aplicación web en PORT
```

O con Docker: `docker build -t privacy21719 .` y ejecute el contenedor con las variables de entorno.
El contenedor aplica migraciones y catálogo al iniciar.

Lista de verificación para producción:

- `NODE_ENV=production`, `APP_ORIGIN=https://su-dominio.cl` (el servidor no arranca sin HTTPS ni sin clave de cifrado).
- PostgreSQL administrado **en Chile** si es posible (por ejemplo, región Santiago de Google Cloud), con respaldos automáticos y cifrado en reposo.
- Servir detrás de un proxy HTTPS (Render, Railway, Fly.io, Nginx…). La cookie de sesión pasa a ser `__Host-` y `Secure`.
- **No** ejecutar `db:seed:demo` en producción.

---

## 5. Arquitectura

```
Navegador (React)  ──►  Backend Express /api  ──►  PostgreSQL
                              │
                              └──►  Capa de integración  ──►  API Dentalink / Medilink
                                    (o datos de prueba)
```

- El navegador **solo** habla con `/api`. Nunca recibe tokens de Dentalink/Medilink.
- Cada consulta se filtra por la clínica del usuario (multiempresa con aislamiento por `organization_id`).
- El espejo del software clínico guarda **solo** identificación, profesionales, sucursales y agenda. **No** copia fichas,
  diagnósticos ni imágenes (minimización, art. 3). Los datos para una solicitud de acceso se consultan en el momento.

### Estructura de carpetas

```
privacy21719-app/
├── .env.example              Variables de entorno documentadas
├── docker-compose.yml        PostgreSQL local
├── Dockerfile                Imagen de producción
├── server/                   Backend (Node + TypeScript + Express + Drizzle)
│   ├── drizzle/              Migraciones SQL (incluye el bloqueo del registro de auditoría)
│   ├── mock-data/            ⚠ DATOS DE PRUEBA ficticios del software clínico (separados del código)
│   ├── tests/                Pruebas automatizadas
│   └── src/
│       ├── config/env.ts     Validación de configuración
│       ├── db/               Esquema, migraciones, seeds (catálogo = producto; demo = ficticio)
│       ├── domain/           Reglas de negocio puras (diagnóstico, copiloto, plantillas)
│       ├── integrations/     ⚙ CAPA DE INTEGRACIÓN
│       │   ├── types.ts      Contrato común ClinicSoftwareProvider
│       │   ├── registry.ts   Elige proveedor y credenciales por clínica
│       │   ├── healthatom/   Integración REAL Dentalink/Medilink (cliente, rutas, mapeo)
│       │   └── mock/         Proveedor de PRUEBA (lee mock-data/)
│       ├── middleware/       Sesiones, roles, protección CSRF, errores
│       ├── modules/          Rutas de la API por módulo
│       └── scripts/          create-admin
└── web/                      Frontend (React + Vite + TypeScript)
    └── src/pages/            Una página por módulo
```

---

## 6. Integración con Dentalink / Medilink

### Lo que se sabe y lo que falta verificar

Dentalink y Medilink son productos de **HealthAtom** y ofrecen una **API REST para clientes**, autenticada con un
**token** que se solicita para la cuenta de la clínica. Al construir este MVP **no fue posible abrir la documentación
oficial** para confirmar los detalles, por lo que no se presentan endpoints como confirmados. Todo lo que depende de
esos detalles está en **un solo archivo**:

`server/src/integrations/healthatom/endpoints.ts` → rutas, formato de la cabecera `Authorization`, filtro de fechas y
ruta de prueba, marcado `verified: false`.

`server/src/integrations/healthatom/mappers.ts` → nombres de campos de la respuesta (se prueban varias claves posibles).

Documentación oficial a revisar:

- https://api.dentalink.healthatom.com/docs/
- https://api.medilink.healthatom.com/docs/

Checklist de verificación (una vez con acceso a la documentación):

1. URL base y versión de la API.
2. Formato exacto de la cabecera de autenticación.
3. Ruta de pacientes, profesionales (dentistas), sucursales, citas y citas de un paciente.
4. Cómo se filtra por fecha y cómo se pagina (el cliente soporta `{ data: [...], links: { next } }`; si es distinto, se ajusta en `client.ts`).
5. Nombres de campos de cada recurso.
6. Límite de peticiones (el cliente ya reintenta ante `429` respetando `Retry-After`).
7. Si hay webhooks disponibles (permitirían actualizar en tiempo real en vez de sincronizar).
8. Marcar `verified: true` y ejecutar `npm test`.

### Qué credenciales se necesitan

- **Token de API** de la cuenta Dentalink/Medilink de la clínica. Normalmente lo solicita el administrador de la cuenta
  al soporte del proveedor; puede depender del plan contratado.
- **URL base** indicada en la documentación (si difiere de la que trae `.env.example`).
- Idealmente, un **usuario/token de solo lectura**: esta plataforma no necesita escribir en el software clínico.

### Cómo conectar una clínica

**Opción A, desde la aplicación (recomendada, una o varias clínicas):**
Ingrese como Administrador → **Software clínico → Conexión** → elija Dentalink o Medilink → pegue el token → Guardar →
**Probar conexión** → **Sincronizar ahora**. El token se guarda cifrado (AES-256-GCM con `INTEGRATION_ENCRYPTION_KEY`)
y nunca vuelve al navegador; solo se muestran sus últimos 4 caracteres.

**Opción B, por variables de entorno (instalación de una sola clínica):**

```env
INTEGRATION_ENV_ORG_SLUG=clinica-ejemplo     # la clínica a la que aplican estas credenciales
CLINIC_SOFTWARE_PROVIDER=dentalink
DENTALINK_API_BASE_URL=https://api.dentalink.healthatom.com/api/v1
DENTALINK_API_TOKEN=pegue-aqui-el-token
```

Si una clínica no tiene credenciales, la plataforma usa automáticamente el **proveedor de prueba** (datos ficticios de
`server/mock-data/`) y lo indica en pantalla con la etiqueta "Datos de prueba". Los datos de prueba y los reales se
guardan con un origen distinto y nunca se mezclan en los indicadores.

### Agregar otro software clínico

Cree una clase que implemente `ClinicSoftwareProvider` (`server/src/integrations/types.ts`) y regístrela en
`registry.ts`. El resto de la aplicación no cambia.

---

## 7. Seguridad implementada

- Contraseñas con bcrypt (costo 12), política mínima, bloqueo de 15 min tras 5 intentos, límite de intentos por IP.
- Sesiones en base de datos (solo se guarda el hash del token), cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` en producción), expiración configurable, cierre de otras sesiones al cambiar la contraseña.
- Protección CSRF: verificación de origen y cabecera obligatoria en peticiones que modifican datos.
- Autorización por rol en cada endpoint y aislamiento por clínica en cada consulta (probado: otra clínica recibe 404).
- Validación de todas las entradas con zod (incluye RUT con dígito verificador).
- Cabeceras de seguridad con Helmet (CSP, HSTS en producción, `frame-ancestors 'none'`).
- Archivos de evidencia con tipos permitidos, tamaño máximo, nombre aleatorio en disco, hash SHA-256 y descarga autenticada.
- Credenciales de integración cifradas; el cliente HTTP no sigue enlaces a otros dominios y nunca incluye el token en errores.
- Datos de contacto enmascarados para usuarios de solo lectura.
- Registro de auditoría de solo inserción (bloqueado por un trigger en PostgreSQL).
- Sin datos reales: los datos de demostración y de prueba son ficticios (RUT de prueba y dominio `example.com`).

### Pendiente antes de operar con pacientes reales

- Revisión legal de preguntas, artículos y plantillas.
- Verificar la API de Dentalink/Medilink (sección 6).
- Doble factor (MFA) para administradores y responsables de privacidad.
- Envío de correos (aviso de nuevas solicitudes y vencimientos).
- Respaldos y monitoreo del servidor de producción; prueba de penetración.
