# Sistema de diseño — CriptoMapa Venezuela

> **Regla de oro:** Ninguna página, componente o template nuevo se diseña "a lo loco".
> Todo cambio visual debe usar los tokens, tipografía y patrones definidos aquí.
> Si algo no está cubierto, se extiende este documento **antes** de implementar.

Las páginas de referencia canónicas son:
- **App / mapa:** `docs/index.html` (vista inmersiva del mapa)
- **Páginas de contenido:** `docs/quienes-somos.html` (patrón para blog, FAQ, legales)

---

## 1. Marca

- **Nombre:** CriptoMapa Venezuela (nunca "MapaCripto"). En el logo el texto es **CriptoMapa**.
- **Identidad:** cruce de la bandera de Venezuela (amarillo/azul/rojo) con el naranja de Bitcoin.
- **Logo:** SVG de la bandera de Venezuela (26×17, con las 8 estrellas) seguido del texto
  "CriptoMapa" en peso 800. **Nunca usar un emoji (🗺️) como logo.**

```html
<a class="logo" href="/">
  <svg width="26" height="17" viewBox="0 0 26 17" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;flex-shrink:0">
    <rect width="26" height="5.67" fill="#CF9B00"/>
    <rect y="5.67" width="26" height="5.67" fill="#003893"/>
    <rect y="11.33" width="26" height="5.67" fill="#CF142B"/>
    <circle cx="2.8"  cy="8.8"  r="0.72" fill="white"/>
    <circle cx="5.7"  cy="7.9"  r="0.72" fill="white"/>
    <circle cx="8.6"  cy="7.3"  r="0.72" fill="white"/>
    <circle cx="11.5" cy="7.0"  r="0.72" fill="white"/>
    <circle cx="14.5" cy="7.0"  r="0.72" fill="white"/>
    <circle cx="17.4" cy="7.3"  r="0.72" fill="white"/>
    <circle cx="20.3" cy="7.9"  r="0.72" fill="white"/>
    <circle cx="23.2" cy="8.8"  r="0.72" fill="white"/>
  </svg>
  CriptoMapa
</a>
```

---

## 2. Colores (tokens)

Todas las páginas declaran sus colores como variables CSS en `:root`. **Usar siempre el token,
nunca el hex directo** en el cuerpo del CSS.

### Paleta de marca (constante en todo el sitio)

| Token        | Hex        | Uso                                              |
|--------------|------------|--------------------------------------------------|
| `--primary`  | `#CF142B`  | Rojo Venezuela. Acentos de marca, marcadores.    |
| `--accent`   | `#F7931A`  | Naranja Bitcoin. **Color de acción principal.**  |
| `--blue`     | `#003893`  | Azul Venezuela. Acento secundario.               |
| `#CF9B00`    | `#CF9B00`  | Amarillo bandera (solo logo/bordes tricolor).    |
| `--success`  | `#22C55E`  | Verde. Estados positivos, descuentos, checks.    |
| `--error`    | `#EF4444`  | Rojo error.                                      |

### Superficies — páginas de contenido (blog, FAQ, legales, quiénes-somos)

> Esta es la paleta canónica de contenido. `theme-color` del sitio = `#0F1117`.

| Token        | Hex        |
|--------------|------------|
| `--bg`       | `#0F1117`  |
| `--surface`  | `#1C1F26`  |
| `--surface2` | `#252930`  |
| `--border`   | `#2E3340`  |
| `--text`     | `#E8EAED`  |
| `--muted`    | `#9AA0AC`  |

### Superficies — app / mapa (`index.html`)

La vista del mapa usa un fondo ligeramente más oscuro e inmersivo. **No mezclar estas con las de contenido.**

| Token        | Hex        |
|--------------|------------|
| `--bg`       | `#0A0C10`  |
| `--surface`  | `#111318`  |
| `--surface2` | `#1A1D24`  |
| `--surface3` | `#21252E`  |
| `--border`   | `#252830`  |
| `--text`     | `#E8EAED`  |
| `--text-2`   | `#C4C7CE`  |
| `--muted`    | `#7D8390`  |

❌ **Prohibido:** paletas slate de Tailwind (`#0f172a`, `#1e293b`, `#334155`, `#64748b`, etc.).
Ese fue el error del primer blog. Si ves esos hex, está fuera de marca.

---

## 3. Tipografía

- **Fuente única:** `Inter` (Google Fonts), fallback `sans-serif`.
  - Páginas de contenido cargan pesos `400;500;600;700;800;900`.
- **Headings:** peso 800–900, `letter-spacing` negativo (`-.02em` a `-.03em`), `line-height` 1.1–1.2.
- **Body:** peso 400, `line-height` 1.7–1.8, color `--muted` para párrafos largos, `--text` para énfasis.
- **Tamaños fluidos** con `clamp()`:
  - H1 hero: `clamp(38px, 7vw, 68px)`
  - H2 sección: `clamp(26px, 4vw, 36px)`
  - Body: `16px`

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

- **Iconos:** Font Awesome 6.5.1 (`fa-solid`). El logo de X (Twitter) va como SVG inline.

---

## 4. Patrones de layout (páginas de contenido)

Anchura de contenido: **`max-width: 900px`**, centrado, padding lateral `24px` (`20px` en móvil).

### Header (sticky, con blur)
```css
header {
  background: rgba(15,17,23,.85);
  backdrop-filter: blur(12px);
  position: sticky; top: 0; z-index: 100;
  border-bottom: 1px solid var(--border);
}
.header-inner { max-width: 900px; margin: 0 auto; padding: 0 24px; height: 60px; display:flex; align-items:center; gap:12px; }
```
- A la izquierda: logo (bandera + CriptoMapa).
- A la derecha: botón "Volver al mapa" con borde (`.back-btn`), o navegación contextual.

### Border tricolor (solo en el header del mapa)
El header de `index.html` lleva una línea inferior con el gradiente de la bandera:
```css
background: linear-gradient(to right, #CF9B00 33.33%, #003893 33.33% 66.66%, #CF142B 66.66%);
```

### Hero / cabecera de página
- `padding: 100px 24px 80px` (centrado).
- **Glow:** dos `radial-gradient` superpuestos — naranja `rgba(247,147,26,.13)` y azul `rgba(0,56,147,.1)`.
- **Badge pill:** borde naranja translúcido, texto naranja, uppercase, con punto pulsante.
- **H1** con una o dos palabras en `<span class="grad">` con gradiente naranja→amarillo→naranja.

### Pills de sección
Etiqueta sobre cada sección: borde, `--surface2`, uppercase, `letter-spacing:.1em`, con icono FA.
```html
<div class="section-pill"><i class="fa-solid fa-bullseye"></i> Nuestra misión</div>
```

### H2 con acento
Resaltar palabras clave del H2 en naranja:
```html
<h2>¿Por qué existe <span>CriptoMapa</span>?</h2>  <!-- .section h2 span { color: var(--accent); } -->
```

### Cards
`--surface` bg, `border: 1px solid var(--border)`, `border-radius: 16px`, padding `24px 20px`.
Hover: `border-color: rgba(247,147,26,.4)` + `transform: translateY(-2px)`.
Icono en chip `44×44`, `--surface2`, icono naranja.

### Listas (con check verde)
Las listas de beneficios usan bullets custom: círculo verde translúcido con un check SVG
(ver `.section li::before` en `quienes-somos.html`).

### CTA box
Caja final de conversión:
```css
background: linear-gradient(135deg, rgba(247,147,26,.08) 0%, rgba(0,56,147,.06) 100%);
border: 1px solid rgba(247,147,26,.2);
border-radius: 20px;
padding: 56px 40px;
```
Botón naranja sólido, texto blanco, `border-radius: 12px`.

### Footer
`--surface` bg, centrado, `12px`, `--muted`. Links separados por `·`, hover → `--text`.
```html
<footer>
  <p>© 2025 CriptoMapa Venezuela · <a href="/faq.html">FAQ</a> · <a href="/terms.html">Términos</a> · <a href="/privacy.html">Privacidad</a></p>
</footer>
```

---

## 5. Botones y acciones

| Tipo            | Estilo                                                            |
|-----------------|-------------------------------------------------------------------|
| **Primario**    | `background: var(--accent)`, texto `#fff`, `border-radius: 12px`, peso 700. Hover: `opacity:.9` + `translateY(-1px)` (o `background:#e8840f`). |
| **Secundario**  | Borde `var(--border)`, texto `--muted`/`--text`. Hover: `border-color: var(--accent)`. |

La acción principal del sitio siempre es **naranja Bitcoin**. El rojo/azul son acentos de marca, no botones.

---

## 6. Radios y espaciado

- Radios: `8px` (sm) · `12px` (md) · `16px` (lg) · `20px` (cards grandes/CTA) · `100px` (pills).
- Transiciones: `.15s`–`.2s` en `border-color`, `background`, `transform`, `opacity`.
- Secciones separadas por `margin-bottom: 80px` (`56px` móvil).

---

## 7. SEO (obligatorio en toda página pública)

- `<title>` con sufijo `… | CriptoMapa Venezuela` o `… – CriptoMapa Venezuela`.
- `<meta name="description">` 150–160 caracteres.
- `<link rel="canonical">`.
- Open Graph completo (`og:title`, `og:description`, `og:url`, `og:type`, `og:image`).
- Twitter Card (`@criptomapavzla`).
- `theme-color = #0F1117`.
- JSON-LD según el tipo (`Article`, `FAQPage`, `LocalBusiness`).
- Añadir la URL al `docs/sitemap.xml`.

---

## 8. Contacto y datos fijos

- **Único email del proyecto:** `criptomapavenezuela@proton.me`.
  ❌ No inventar `hola@…` ni ningún otro correo.
- **X / Twitter:** `@criptomapavzla` → https://x.com/criptomapavzla
- **Dominio:** https://criptomapavenezuela.com
- **Criptos aceptadas:** Bitcoin (BTC), Tether (USDT), USD Coin (USDC), Binance Pay, otras.

---

## 9. Checklist antes de publicar una página nueva

- [ ] Usa la fuente Inter y los tokens de color correctos (contenido = familia `#0F1117`).
- [ ] Logo = bandera SVG + "CriptoMapa" (sin emojis).
- [ ] Header sticky con blur + footer estándar.
- [ ] `max-width: 900px` en el contenido.
- [ ] Acción principal en naranja `--accent`.
- [ ] Sin colores slate de Tailwind.
- [ ] Bloque SEO completo (título, description, canonical, OG, JSON-LD, sitemap).
- [ ] Responsive verificado en móvil (`max-width: 600px`).
- [ ] Email/redes correctos.
