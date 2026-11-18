# 🛒 Despensa: la lista de la compra de la familia

Una web app pensada para el móvil (iPhone y Android) que se puede instalar en la pantalla de inicio como si fuera una app normal.

## 🌐 Ya está publicada

**https://aimarola.github.io/despensa/**

- **Web:** se aloja en GitHub Pages. Cada cambio que se sube a `main` se publica solo (`.github/workflows/deploy.yml`).
- **Base de datos:** el proyecto de Supabase «despensa» (`bbgayvjewrntmhfplqhq`, en Frankfurt) ya tiene cargado el esquema de `supabase/schema.sql`.
- **Inicio de sesión:** la confirmación por email está desactivada. La dirección principal (Site URL) es la de GitHub Pages.

Las secciones de abajo explican cómo montarla desde cero, por si algún día hay que repetirlo.

## Qué hace

- **Lista compartida en tiempo real.** Cualquier miembro de la familia apunta lo que falta y los demás lo ven al momento en su móvil.
- **Apuntar rápido.** Escribes «lech…», tocas la sugerencia y queda apuntado. Si no está en el catálogo, se crea en ese momento.
- **Código de barras.** Escaneas con la cámara:
  - si el producto ya está en vuestro catálogo, se apunta directamente;
  - si es nuevo, la app lo busca en Open Food Facts (alimentación, droguería y cosmética) y rellena nombre, marca, foto y **categoría**;
  - **asigna el supermercado solo**: por marca propia (Hacendado o Deliplus → Mercadona, Eroski, Milbona → Lidl, Carrefour, Dia…), por el código de barras de la cadena o por las tiendas donde se vende;
  - **busca el precio** en Open Prices (precios reales que suben los usuarios) para cada supermercado vuestro.
- **Categorías** (frutas y verduras, panadería, carne, pescado, lácteos, despensa, limpieza, higiene…), en el orden de los pasillos. La lista y el modo compra se agrupan por categoría, y al escribir un nombre se sugiere la categoría.
- **Precios que se aprenden solos.** Lo que pagáis en cada compra se guarda como precio de ese supermercado, así que la siguiente compra ya sale calculada.
- **Foto de cada producto.** La haces desde la app con la cámara o la eliges de la galería. Se reduce automáticamente para que pese poco.
- **Varios supermercados.** Indicas dónde se compra cada producto (Mercadona, Lidl…) y filtras la lista por supermercado. Si un producto no tiene supermercado asignado, aparece en todos.
- **Modo compra.** Eliges el supermercado y ves solo lo que toca comprar allí, agrupado por pasillo. Al tocar un producto pasa al carro y la lista mengua, con la opción de deshacer. El total se va calculando y la barra **«Finalizar compra»** está siempre a mano. Al finalizar indicas **quién ha ido** y el **total del ticket**:
  - lo comprado sale de la lista y queda registrado;
  - lo que no compraste se queda en la lista para la próxima vez.
  - Si se cierra la web a mitad de la compra, lo que llevabas marcado no se pierde.
- **Historial con tickets.** Gasto del mes y de los últimos 6 meses, y cada compra con quién fue, el total y el precio de cada producto (se puede corregir después).
- **Trazabilidad.** De cada producto ves cuántas veces se ha comprado, cuántas unidades en total, cuándo fue la última vez, cada cuántos días se compra de media y su historial completo (fecha, supermercado y quién lo compró). También hay un historial de cada compra y de los productos que más compráis.

## Cuánto cuesta

Nada. Todo funciona dentro de los planes gratuitos:

| Pieza | Servicio gratuito | Para qué |
|---|---|---|
| Base de datos, usuarios, fotos, tiempo real | [Supabase](https://supabase.com) (plan Free) | Guardar y sincronizar los datos de la familia |
| Hosting de la web | [Vercel](https://vercel.com) o [Netlify](https://netlify.com) | Publicar la web con https |
| Datos de productos | [Open Food Facts](https://world.openfoodfacts.org) | Identificar códigos de barras |

> Supabase pausa los proyectos gratuitos que pasan **una semana sin uso**. Usándolo cada pocos días no ocurre, y si pasa, se reactiva con un clic desde su panel. El plan gratuito incluye 1 GB para fotos, suficiente para miles de productos (cada foto ocupa unos 50 KB).

---

## Puesta en marcha (unos 15 minutos, una sola vez)

### 1. Crear la base de datos en Supabase

1. Crea una cuenta en https://supabase.com y pulsa **New project**. Ponle un nombre (por ejemplo, «despensa»), una contraseña y la región **Europe (Frankfurt o Paris)**.
2. Cuando esté listo, entra en **SQL Editor → New query**, pega el contenido completo de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Debe aparecer «Success». Repite lo mismo con [`supabase/v2_categorias_precios.sql`](supabase/v2_categorias_precios.sql).
3. Entra en **Project Settings → API** y copia dos valores:
   - **Project URL**, por ejemplo `https://abcdxyz.supabase.co`;
   - la clave **anon / public**. Es pública y puede ir en la web; la seguridad la ponen las reglas de la base de datos.

### 2. Publicar la web (opción recomendada: GitHub + Vercel)

1. Sube esta carpeta a un repositorio nuevo de GitHub (puede ser privado).
2. En https://vercel.com, entra con tu cuenta de GitHub, pulsa **Add New → Project** e importa el repositorio. Vercel detecta Vite solo.
3. Antes de pulsar Deploy, abre **Environment Variables** y añade:
   - `VITE_SUPABASE_URL` = tu Project URL
   - `VITE_SUPABASE_ANON_KEY` = tu clave anon
4. Pulsa **Deploy**. En un minuto tendrás una dirección como `https://despensa-tunombre.vercel.app`.

Desde entonces, cada cambio que subas a GitHub se publica solo.

**Alternativa con Netlify:** importa el repositorio en https://app.netlify.com y añade las mismas dos variables en *Site configuration → Environment variables*. El archivo `netlify.toml` ya incluye la configuración.

### 3. Decirle a Supabase cuál es tu web

En Supabase, entra en **Authentication → URL Configuration**:
- En **Site URL** pon la dirección de tu web (la de Vercel).
- En **Redirect URLs** añade esa misma dirección seguida de `/**`.

Esto hace que los enlaces de los emails (confirmar la cuenta o entrar sin contraseña) lleven a tu app.

> **Opcional, para que sea más cómodo:** en **Authentication → Sign In / Providers → Email** puedes desactivar **Confirm email**. Así cada miembro de la familia entra nada más crear la cuenta, sin tener que confirmar el email.

### 4. Empezar a usarla

1. Abre la web en tu móvil, crea tu cuenta y pulsa **Crear familia**.
2. Entra en **Ajustes → Supermercados** y añade los tuyos.
3. En **Ajustes → Invitar**, envía el enlace por WhatsApp. Quien lo abra solo tiene que crear su cuenta y entra directamente en vuestra familia. También puede escribir el código de 6 letras a mano.
4. **Instálala en la pantalla de inicio:**
   - **iPhone (Safari):** botón Compartir → *Añadir a pantalla de inicio*.
   - **Android (Chrome):** menú ⋮ → *Instalar aplicación* o *Añadir a pantalla de inicio*.

---

## Desarrollo en tu ordenador (opcional)

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
cp .env.example .env      # y rellena tus dos valores de Supabase
npm install
npm run dev -- --host     # abre en el móvil la dirección "Network" que aparece
```

> La cámara del móvil solo funciona con **https** o en `localhost`. Para probar el escáner desde el móvil, usa la web ya publicada. Desde la red local la app funciona, pero el escáner no puede usar la cámara; en ese caso puedes escribir el código a mano.

`npm run build` genera la versión de producción en `dist/`.

## Cómo está hecha

- **Frontend:** React + TypeScript + Vite, instalable como PWA (`vite-plugin-pwa`). Usa `HashRouter`, así que funciona en cualquier hosting estático sin configuración extra.
- **Escáner:** usa el lector nativo del navegador cuando existe (Chrome en Android). En iPhone usa ZXing compilado a WebAssembly (`barcode-detector`), que va incluido en la propia web. Lee EAN-13, EAN-8, UPC, Code 128, Code 39 e ITF. Tiene botón de linterna si el móvil lo permite y un campo para escribir el código a mano.
- **Backend:** Supabase (Postgres). El esquema completo está en `supabase/schema.sql`. Se puede ejecutar varias veces sin romper nada.
  - `households` / `members`: familias y quién pertenece a cada una (el acceso es por código de invitación).
  - `supermarkets`, `products`, `product_supermarkets`: el catálogo.
  - `list_items`: lo que falta (`pending`) y su historia (`bought` o `removed`), con quién lo apuntó y cuándo.
  - `trips` + `purchases`: cada compra y cada producto comprado. De aquí sale la trazabilidad.
  - Vista `product_stats`: veces comprado, unidades, primera y última compra, media de días entre compras.
  - Funciones: `add_to_list` (si el producto ya está apuntado, suma la cantidad), `complete_shopping` (cierra la compra en una sola operación), `create_household`, `join_household`, `regenerate_invite_code`.
  - **Seguridad:** Row Level Security en todas las tablas. Cada familia solo puede leer y escribir sus propios datos.
- **Fotos:** se comprimen en el móvil (640 px, JPEG) y se guardan en el bucket `product-images`, en una carpeta por familia. El bucket es de lectura pública con direcciones imposibles de adivinar, pero solo los miembros de la familia pueden subir o borrar fotos.

## Ideas para más adelante

- Funcionar sin conexión dentro del supermercado (guardar los cambios y enviarlos al recuperar la señal).
- Avisar cuando «toca» comprar algo según su frecuencia habitual. El cálculo ya existe en la ficha de cada producto.
- Precios por supermercado y gasto mensual.
- Notificaciones push cuando alguien apunta algo.
