/*
 * Writes the restaurant's structured data (schema.org Restaurant + menu) into
 * index.html, between the <!-- jsonld --> markers. Run after changing the menu,
 * prices, hours or contact details:
 *
 *   node tools/seo/jsonld.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "../..");
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["js/config.js", "js/menu-data.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
}
const { CONFIG, MENU } = ctx.window;

const SITE = "https://al-omda.ma/";

const offer = (price, name) => ({
  "@type": "Offer",
  ...(name ? { name } : {}),
  price: String(price),
  priceCurrency: "MAD",
});
const prices = MENU.flatMap((c) => c.items.flatMap((i) => (i.prices ? Object.values(i.prices) : [i.price])));
// "00:00" closing means midnight; schema.org wants a time within the day.
const closes = CONFIG.hours.close === "00:00" ? "23:59" : CONFIG.hours.close;

const data = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "@id": SITE + "#restaurant",
  name: "AL OMDA",
  alternateName: ["العمدة", "AL OMDA FAST FOOD"],
  url: SITE,
  logo: SITE + "assets/logo.png",
  image: [SITE + "assets/photos/shawarma.jpg", SITE + "assets/photos/tacos.jpg", SITE + "assets/photos/burgers.jpg"],
  telephone: CONFIG.phoneIntl,
  priceRange: `${Math.min(...prices)}–${Math.max(...prices)} MAD`,
  servesCuisine: ["Shawarma", "Fast-food", "Tacos", "Burgers", "Pizza"],
  acceptsReservations: false,
  address: {
    "@type": "PostalAddress",
    streetAddress: "HFRX+VMX, Anassi",
    addressLocality: "Casablanca",
    addressRegion: "Casablanca-Settat",
    addressCountry: "MA",
  },
  geo: { "@type": "GeoCoordinates", latitude: CONFIG.location.lat, longitude: CONFIG.location.lng },
  hasMap: CONFIG.googleMapsUrl,
  openingHoursSpecification: [{
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    opens: CONFIG.hours.open,
    closes,
  }],
  sameAs: [CONFIG.instagram, CONFIG.googleMapsUrl].filter(Boolean),
  hasMenu: {
    "@type": "Menu",
    url: SITE + "#menu",
    inLanguage: ["fr", "ar"],
    hasMenuSection: MENU.map((cat) => ({
      "@type": "MenuSection",
      name: cat.fr,
      ...(cat.image ? { image: SITE + cat.image } : {}),
      hasMenuItem: cat.items.map((item) => ({
        "@type": "MenuItem",
        name: cat.prefix ? `${cat.prefix.fr} ${item.fr}` : item.fr,
        ...(item.descFr ? { description: item.descFr } : {}),
        offers: item.prices
          ? Object.entries(item.prices).map(([size, p]) => offer(p, size))
          : offer(item.price),
      })),
    })),
  },
};

const file = path.join(root, "index.html");
const html = fs.readFileSync(file, "utf8");
const block = `<!-- jsonld -->\n  <script type="application/ld+json">\n${JSON.stringify(data, null, 2)
  .split("\n").map((l) => "  " + l).join("\n")}\n  </script>\n  <!-- /jsonld -->`;
const out = html.replace(/<!-- jsonld -->[\s\S]*<!-- \/jsonld -->/, block);
if (out === html && !html.includes("<!-- jsonld -->")) throw new Error("index.html has no <!-- jsonld --> markers");
fs.writeFileSync(file, out);
console.log(`Structured data: ${MENU.length} sections, ${prices.length} prices.`);
