# AL-OMDA · العمدة

One-page website for AL-OMDA, a shawarma and snack restaurant in Hay Anassi, Casablanca.
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

## Publishing on GitHub Pages

In the repository settings, open **Pages** and deploy from the branch that holds the site, at the `/` (root) folder.
A custom domain can be added there later.
