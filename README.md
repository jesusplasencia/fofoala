# FOFOALA (Front. Love. Lines.)
## A Line Away Of Loving Outstanding Frontend (FLL)

---

## 🚀 Quickstart (Arranque Rápido y Build PWA)

Asumiendo que cuentas con **Bun** (o **Node.js 20+**) instalado y el motor backend **[Koloala](https://github.com/jesusplasencia/koloala)** corriendo en `http://127.0.0.1:8000`:

```powershell
# 1. Instalar dependencias a velocidad nativa con Bun
bun install

# 2. Levantar el servidor de desarrollo Vite con Hot-Module Replacement (HMR)
bun run dev

# 3. Compilar para producción (TypeScript Check + Bundle Estático + Service Worker PWA)
bun run build
```

Una vez encendido en `http://localhost:5173`:
- **Resolución Automática de Villa:** Detecta automáticamente el subdominio (`vc1.lasvillas.club` $\rightarrow$ `VC1`, `vc2.lasvillas.club` $\rightarrow$ `VC2`, `vc3.lasvillas.club` $\rightarrow$ `VC3`, o `VC3` por defecto en local).

---

## 🛠️ Stack Tecnológico (State-of-the-Art 2026)

| Tecnología | Propósito en el Proyecto |
| :--- | :--- |
| **React 19 + TypeScript 7** | Interfaz declarativa estrictamente tipada de punta a punta con los contratos de FastAPI. |
| **Vite 8 + Bun** | Empaquetado instantáneo (~160 ms build time) y gestión ultrarrápida de paquetes. |
| **Tailwind CSS v4** | Sistema de diseño Mobile-First de alto contraste (pensado para lectura bajo sol en garita y facilidad de uso en adultos mayores). |
| **TanStack React Query v5** | Sincronización de estado de servidor, caché e invalidación automática. |
| **Vite PWA (`vite-plugin-pwa`)** | Instalable como aplicación nativa en Android / iOS directo desde el navegador sin tiendas de aplicaciones. |
| **`qrcode` + Canvas API** | Generación en cliente de tarjetas PNG descargables y compartibles por WhatsApp (*Boarding Pass* con QR de alta densidad). |
| **`html5-qrcode`** | Escáner de cámara en tiempo real para que el vigilante de garita lea el QR del visitante o conductor en una fracción de segundo. |

---

## 📱💻 Tres Experiencias Camaleónicas en una Sola PWA (`lasvillas.club`)

**Fofoala** es la interfaz oficial de **Las Villas Club**, diseñada con enfoque *Zero-Friction* según el rol del usuario autenticado:

### 1. 🔐 Login Inteligente en 2 Pasos + Activación Just-In-Time por WhatsApp
- El vecino solo ingresa su código de **Manzana y Lote** (ej. `P20`, `P21`).
- **Primer Ingreso (Onboarding sin claves hardcodeadas):** Si el lote fue cargado en el padrón pero nunca ha iniciado sesión (`last_login_at == null`), la aplicación solicita confirmar su número de WhatsApp registrado (`••• 321`) y dispara en vivo su **PIN numérico de 8 dígitos** vía **Evolution API** directo a su teléfono.
- **Sesión Persistente (30 Días):** Una vez autenticado, el vecino no vuelve a escribir su PIN durante 30 días.

### 2. 🏡 Vista Residente (Mobile-First & Minimalista)
- **Pantalla Principal de 1 Toque:** Tres botones gigantes (**Pedir Delivery 45m**, **Viene un Taxi 30m**, **Invitado / Visita 8h**) y nota opcional.
- **Vista Exclusiva de Pase QR Activo:** Al generar un pase, la pantalla se transforma en una tarjeta limpia sin distracciones ni scroll adicional, permitiendo:
  - **Compartir Imagen QR directo por WhatsApp** (`navigator.share` con archivo PNG adjunto).
  - **Guardar el QR en la galería del teléfono** (PNG de alta resolución con cabecera de la Villa, Casa, QR y código de respaldo).

### 3. 🛡️ Vista Garita para Vigilantes (Modo Oscuro de Alto Contraste)
- **Lector QR con Cámara Integrada:** El botón `ESCANEAR QR CON CÁMARA` lee el QR desde el celular del taxista/repartidor, autocompleta los 6 caracteres del código y salta automáticamente al campo de **DNI**.
- **Semáforo Visual Instantáneo:**
  - 🟢 **VERDE (Autorizado):** Muestra el lote destino y el nombre de la familia propietaria.
  - 🟡 **ÁMBAR (Falta Placa):** Retiene el vehículo sin quemar el código hasta que el guardia digite la placa.
  - 🔴 **ROJO (Denegado):** Alerta inmediata por código vencido, reutilizado o lote en mora.

### 4. 👑 Vista Administrador / Junta Directiva (Desktop & Mobile)
- **Edición Rápida en Línea (`✏️`):** Columna de lápiz en el extremo derecho para editar en vivo `Propietario / Familia` y `Teléfono` presionando `Enter`.
- **Importador Masivo CSV / Excel:** Carga cientos de lotes en un clic (`lote,propietario,telefono,aldia`).
- **Restablecimiento de Acceso Zero-Knowledge:** El Administrador puede restablecer el acceso de cualquier lote sin ver jamás el PIN del vecino en pantalla.
- **Radar Forense de Seguridad:** Monitoreo y desbloqueo de IPs retenidas por fuerza bruta o *Password Spraying*.

---

## 📂 Estructura del Proyecto

```text
D:\Projects\fofoala\
├── src/
│   ├── main.tsx                 # Punto de entrada React 19
│   ├── App.tsx                  # Enrutador camaleónico por rol (RESIDENT, GUARD, ADMIN)
│   ├── index.css                # Tailwind CSS v4 base
│   ├── components/
│   │   ├── LoginView.tsx        # Login en 2 pasos (Lookup -> Activación WhatsApp -> PIN)
│   │   ├── ResidentView.tsx     # Vista minimalista de vecino + tarjeta QR descargable
│   │   ├── GuardView.tsx        # Consola de garita con escáner de cámara y semáforo
│   │   └── AdminView.tsx        # Padrón paginado, edición inline, CSV import y seguridad IP
│   └── lib/
│       ├── api.ts               # Cliente HTTP tipado hacia Koloala + detector de subdominio
│       └── passCard.ts          # Generador Canvas de Boarding Pass PNG + parser QR
├── vite.config.ts               # Configuración de Vite 8 + Tailwind v4 + Manifiesto PWA
├── package.json
└── README.md
```
