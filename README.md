# BACord — Prueba de Concepto

Sistema de Batch Record electrónico (GMP farmacéutico). Frontend React/TS/Vite + backend Node/TS/Express/Prisma, con persistencia real en MySQL y autenticación/firma electrónica reales (JWT + bcrypt).

**Arranque limpio**: la base de datos no trae nada precargado salvo el usuario administrador. Todo lo demás (centros, materiales, procesos, formularios, recetas, órdenes, usuarios, batch records) se crea desde la UI.

## Requisitos

- Node.js 18+
- MySQL 8.0 corriendo localmente (o accesible por red)

## 1. Base de datos

Crea una base de datos y un usuario dedicados en MySQL (no reutilices el usuario `root` en producción):

```sql
CREATE DATABASE bacord_poc CHARACTER SET utf8mb4;
CREATE USER 'bacord_app'@'%' IDENTIFIED BY 'una-contraseña-segura';
GRANT ALL PRIVILEGES ON bacord_poc.* TO 'bacord_app'@'%';
```

## 2. Backend

```bash
cd backend
cp .env.example .env
```

Edita `backend/.env`:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión MySQL, ej: `mysql://bacord_app:una-contraseña-segura@127.0.0.1:3306/bacord_poc` |
| `JWT_SECRET` | Cadena aleatoria larga (los tokens de sesión se firman con esto) |
| `PORT` | Puerto del API (por defecto `4000`) |
| `CORS_ORIGIN` | URL del frontend (por defecto `http://localhost:5173`) |
| `SEED_ADMIN_LOGIN` | Login del usuario administrador inicial |
| `SEED_ADMIN_PASSWORD` | Contraseña del usuario administrador inicial — cámbiala después del primer login |

Instala dependencias, aplica el esquema y crea el usuario administrador:

```bash
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

El API queda escuchando en `http://localhost:4000`.

## 3. Frontend

Desde la raíz del proyecto:

```bash
cp .env.example .env
npm install
npm run dev
```

`VITE_API_URL` en `.env` debe apuntar al backend (por defecto `http://localhost:4000/api`).

La app queda en `http://localhost:5173`.

## 4. Primer ingreso

Entra con el login/contraseña definidos en `SEED_ADMIN_LOGIN`/`SEED_ADMIN_PASSWORD`. Desde ahí, como administrador, configura en orden:

1. **Centros**, **Grupos Responsables**, **Materiales**, **Procesos**
2. **Firmas** y **Estrategias de Firma**
3. **Formularios** (Detalles) — pasos del batch record con su schema Form.io
4. **Roles** — qué módulos puede ver cada perfil de usuario, y **Usuarios** — cuentas reales, asignando Centro, Grupo Responsable y Rol (o marcando Administrador)
5. **Recetas Maestras** (con su estructura de procesos/formularios) → **Órdenes de Proceso** → **Fórmulas de Control** → **Batch Records**

## Producción

Para desplegar: `npm run build` en `backend/` y en la raíz genera los artefactos (`backend/dist` y `dist/`). El backend se sirve con `node dist/server.js`; el frontend es un sitio estático (`dist/`) que puede servirse desde cualquier servidor web, apuntando `VITE_API_URL` (en build time) a la URL pública del backend.
