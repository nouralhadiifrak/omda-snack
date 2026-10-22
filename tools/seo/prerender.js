/*
 * Writes the menu, sauces and practical info into index.html as plain HTML, so
 * search engines, link previews and assistants that don't run JavaScript still
 * see them. js/app.js renders the same content over it on load. Also refreshes
 * the structured data (jsonld.js). Run after changing the menu, prices, hours,
 * address or phone:
 *
 *   node tools/seo/prerender.js
 *
 * Needs Playwright (npm i -g playwright) and its Chromium.
 */
const fs = require("fs");
const http = require("http");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Playwright is missing: npm i -g playwright (then run with NODE_PATH=$(npm root -g)).");
  process.exit(1);
}

const root = path.join(__dirname, "../..");
const file = path.join(root, "index.html");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".mp4": "video/mp4" };

// Elements whose content is copied as is, between <!-- prerender:id --> markers.
const BLOCKS = ["chips", "menu-list", "sauce-list"];
// Single elements filled by script (text and links): replaced whole, by id.
const LEAVES = ["info-address", "info-directions", "info-hours", "info-phone", "info-instagram", "hero-location"];

(async () => {
  require("./jsonld.js");

  const server = http
    .createServer((req, res) => {
      const url = decodeURIComponent(req.url.split("?")[0]);
      const p = path.join(root, url.endsWith("/") ? url + "index.html" : url);
      if (!p.startsWith(root) || !fs.existsSync(p)) return res.writeHead(404).end();
      res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
      fs.createReadStream(p).pipe(res);
    })
    .listen(0);
  const port = server.address().port;

  const browser = await chromium.launch();
  // Reduced motion: no intro, no letter-by-letter headings, so the markup is plain.
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await page.goto(`http://localhost:${port}/?lang=fr`);
  await page.waitForSelector("#menu-list .cat");

  const snap = await page.evaluate(
    ({ blocks, leaves }) => {
      const clean = (node) => {
        node.querySelectorAll("[style]").forEach((n) => {
          // Drop the moving-button angle the animation loop writes; keep real styles.
          n.style.removeProperty("--mg-a");
          if (!n.getAttribute("style")) n.removeAttribute("style");
        });
        node.querySelectorAll(".is-active").forEach((n) => n.classList.remove("is-active"));
        return node;
      };
      const out = { blocks: {}, leaves: {} };
      blocks.forEach((id) => (out.blocks[id] = clean(document.getElementById(id).cloneNode(true)).innerHTML));
      leaves.forEach((id) => (out.leaves[id] = clean(document.getElementById(id).cloneNode(true)).outerHTML));
      return out;
    },
    { blocks: BLOCKS, leaves: LEAVES }
  );
  await browser.close();
  server.close();

  let html = fs.readFileSync(file, "utf8");
  for (const id of BLOCKS) {
    const re = new RegExp(`<!-- prerender:${id} -->[\\s\\S]*?<!-- /prerender:${id} -->`);
    if (!re.test(html)) throw new Error(`index.html has no prerender:${id} markers`);
    html = html.replace(re, () => `<!-- prerender:${id} -->${snap.blocks[id]}<!-- /prerender:${id} -->`);
  }
  for (const id of LEAVES) {
    const tag = snap.leaves[id].match(/^<(\w+)/)[1];
    const re = new RegExp(`<${tag}\\b[^>]*\\bid="${id}"[^>]*>[\\s\\S]*?</${tag}>`);
    if (!re.test(html)) throw new Error(`index.html has no #${id}`);
    html = html.replace(re, () => snap.leaves[id]);
  }
  fs.writeFileSync(file, html);
  console.log(`Prerendered: ${BLOCKS.join(", ")}, ${LEAVES.length} info fields.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
