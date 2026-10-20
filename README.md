# AL-OMDA · العمدة

One-page website for AL-OMDA, a shawarma and snack restaurant in Anassi, Casablanca.
It is plain HTML, CSS and JavaScript, with no build step.

- French and Arabic (right-to-left) with a language toggle
- Full menu with prices in MAD, including pizza sizes (M/L), sauce choice and required options
- Cart, then pickup or delivery, then the order is sent to the restaurant on WhatsApp
- Open/closed status (Casablanca time), map, phone and Instagram

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Where to edit things

| What | File |
| --- | --- |
| Phone, WhatsApp number, hours, address, map location, delivery fee and range | `js/config.js` |
| Menu items, prices, categories | `js/menu-data.js` |
| Interface text (French / Arabic) | `js/i18n.js` |
| Colours and layout | `css/style.css` |
| Logo | `assets/logo.png` |

### Search engines (SEO)

`index.html` carries the restaurant's structured data (schema.org `Restaurant` with the full menu and prices),
which Google reads for its search results. After changing the menu, prices, hours or location, regenerate it:

```sh
node tools/seo/jsonld.js
```

The Arabic page has its own address, `https://al-omda.ma/?lang=ar`, listed in `sitemap.xml`.
Page titles and descriptions per language are the `meta.*` keys in `js/i18n.js`.

### Adding food photos

Each category has a photo in `assets/photos/` (1200×593 JPEG); a category without one shows its illustration. Put the photo in
`assets/photos/` and set the category's `image` field in `js/menu-data.js`:

```js
{
  id: "shawarma",
  ...
  image: "assets/photos/shawarma.jpg",
```

Landscape photos work best (around 1200×600).

### Hero background photo

The top section is built for a full-width food photo (like a shawarma plate shot from above).
Put it in `assets/photos/` (at least 1920px wide) and set `heroImage` in `js/config.js`:

```js
heroImage: "assets/photos/hero.jpg",
```

Until then, the logo is shown in its place.

## Hosting

The site is deployed on Vercel from this repository and served at https://al-omda.ma
(https://omda-snack.vercel.app redirects there, see `vercel.json`; the printed review cards
still use it, so keep it attached to the project).
The domain is registered at Cap Connect; its DNS points to Vercel
(see the project's **Settings → Domains** in Vercel for the records).
