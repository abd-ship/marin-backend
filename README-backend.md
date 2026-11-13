# Marín Digital · Backend

![Estado](https://img.shields.io/badge/Estado-Completo-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-F55036?logoColor=white)

Este es el servidor del proyecto **Marín Digital**. Recibe las solicitudes del formulario de contacto, las guarda en MongoDB, protege el panel de administración y consulta a la inteligencia artificial para generar las recomendaciones.

🔗 **Servicio en producción:** https://marin-backend.onrender.com

🌐 **Página del proyecto:** [abd-ship.github.io/marin-digital](https://abd-ship.github.io/marin-digital/)

---

## Funcionalidades

- **Solicitudes:** recibe el formulario de contacto y lo guarda en la colección `solicitudes`, con estado inicial `nueva`.
- **Panel de administración:** login con usuario y contraseña, y un token que dura 8 horas.
- **Gestión de solicitudes:** lista todas las solicitudes y permite cambiar su estado a `nueva`, `en proceso` o `cerrada`.
- **Recomendación con IA:** genera una recomendación personalizada con Groq. Solo puede sugerir paquetes del catálogo real, así que no inventa precios ni servicios.

## Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/` | Público | Confirma que el servicio está activo. |
| `POST` | `/api/solicitudes` | Público | Guarda una solicitud de contacto. |
| `POST` | `/api/recomendacion` | Público | Genera la recomendación con IA. |
| `POST` | `/api/admin/login` | Público | Valida usuario y contraseña, y devuelve un token. |
| `GET` | `/api/admin/solicitudes` | Token | Lista las solicitudes, de la más reciente a la más antigua. |
| `PATCH` | `/api/admin/solicitudes/:id` | Token | Cambia el estado de una solicitud. |

## Arquitectura

```
Página (GitHub Pages)                 Backend (Render)                 Servicios externos
marin-digital                         marin-backend                    
├── index.html ── solicitudes ─────▶  POST /api/solicitudes ────────▶ MongoDB Atlas (base "marin")
├── index.html ── recomendación ───▶  POST /api/recomendacion ──────▶ Groq (modelos de IA)
└── admin.html ── panel admin ─────▶  /api/admin/... ───────────────▶ MongoDB Atlas
```

- El **token** del panel se firma con HMAC usando la contraseña de administrador, y caduca a las 8 horas.
- La **recomendación** prueba varios modelos de Groq en orden hasta que uno responde, y registra en el log cuál fue el que generó la respuesta.
- Las respuestas de la IA se validan contra el catálogo: si el paquete no existe, la respuesta se descarta.

## Tecnologías

| Capa | Tecnología | Uso |
|---|---|---|
| Entorno | Node.js | Ejecuta el servidor |
| Framework | Express | Rutas y control de solicitudes |
| Base de datos | MongoDB Atlas | Almacenamiento de solicitudes |
| Driver | mongodb | Conexión con la base de datos |
| Inteligencia artificial | Groq | Redacción de la recomendación |
| Seguridad | crypto (HMAC) | Tokens del panel admin |
| Configuración | dotenv | Variables de entorno |
| CORS | cors | Permite solo los orígenes autorizados |
| Hosting | Render | Publicación del servicio |

## Variables de entorno

Estas variables se configuran en **Render → Environment** y, en local, en un archivo `.env` que no se sube a GitHub.

| Variable | Descripción |
|---|---|
| `MONGODB_URI` | Dirección de conexión a MongoDB Atlas. |
| `ADMIN_USER` | Usuario del panel de administración. |
| `ADMIN_PASSWORD` | Contraseña del panel. También firma los tokens. |
| `GROQ_API_KEY` | Clave de la API de Groq. |
| `GROQ_MODEL` | Modelo preferido de Groq (opcional). |
| `PORT` | Puerto del servidor. En Render lo asigna automáticamente. |

## Estructura del repositorio

```
marin-backend/
├── server.js       Código principal del servidor
├── package.json    Dependencias y scripts
├── .gitignore      Archivos que no se suben a GitHub (.env, node_modules)
├── .env.example    Plantilla de variables, sin valores reales
└── README.md       Documentación del backend
```

## Ejecución local

```bash
git clone https://github.com/abd-ship/marin-backend.git
cd marin-backend
npm install
```

Crea un archivo `.env` con tus valores reales, siguiendo `.env.example`, y después ejecuta:

```bash
npm start
```

Si aparece `Servidor listo en puerto 3000`, el servicio está funcionando.

## Despliegue en Render

1. Conecta el repositorio `marin-backend` en Render como **Web Service**.
2. Configura **Build Command** como `npm install` y **Start Command** como `npm start`.
3. Agrega las variables de entorno de la tabla anterior.
4. Espera a que aparezca **Live**.

## Seguridad

- Las contraseñas, la conexión a la base y la clave de la IA solo viven en las variables de entorno.
- El archivo `.env` está excluido en `.gitignore` y nunca se sube al repositorio.
- El panel admin requiere un token válido en cada petición, y el token caduca.

## Estado del proyecto

| Módulo | Estado |
|---|---|
| Recepción y guardado de solicitudes en MongoDB | ✅ Completo |
| Panel de administración con login y estados | ✅ Completo |
| Recomendación con IA y validación del catálogo | ✅ Completo |
| Publicación en Render | ✅ Completo |

---

## Autor

**Carlos Marín**
Desarrollo web · Calistenia · Marketing digital

---

© 2026 Marín Digital. Todos los derechos reservados.
