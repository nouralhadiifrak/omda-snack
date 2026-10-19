(() => {
  "use strict";

  const { CONFIG, I18N, MENU, SAUCES } = window;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---------- Storage (best effort: private mode can throw) ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem("omda:" + key);
        return v == null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem("omda:" + key, JSON.stringify(value));
      } catch {}
    },
  };

  // ---------- State ----------
  let lang = store.get("lang", "fr") === "ar" ? "ar" : "fr";
  let cart = store.get("cart", []);
  let geo = null; // { lat, lng, km } chosen on the delivery map

  const MAX_SAUCES = 2;
  const itemIndex = new Map();
  MENU.forEach((cat) => cat.items.forEach((item) => itemIndex.set(item.id, { item, cat })));
  cart = cart
    .filter((line) => itemIndex.has(line.id))
    // Carts saved before two sauces were allowed stored a single `sauce`.
    .map(({ sauce, ...line }) => ({ ...line, sauces: line.sauces || (sauce ? [sauce] : []) }));

  // ---------- Helpers ----------
  const t = (key, vars = {}) =>
    (I18N[lang][key] ?? I18N.fr[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  const loc = (obj) => obj[lang] ?? obj.fr;
  const name = (obj) => (lang === "ar" ? obj.ar : obj.fr);
  const money = (n) => `${n} ${loc(CONFIG.currency)}`;
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v === true ? "" : v);
    });
    node.append(...children.flat().filter((c) => c != null && c !== false));
    return node;
  };

  const unitPrice = (item, size) => (item.prices ? item.prices[size] : item.price);
  const fullName = (item, cat) => {
    const base = name(item);
    return cat.prefix ? `${name(cat.prefix)} ${base}` : base;
  };
  const lineKey = (l) => [l.id, l.size || "", l.option ?? "", [...(l.sauces || [])].sort().join("+")].join("|");
  const lineDetails = (line) => {
    const { item } = itemIndex.get(line.id);
    const parts = [];
    if (line.size) parts.push(t("size." + line.size));
    if (line.option != null && item.options) parts.push(name(item.options[line.option]));
    const sauces = (line.sauces || [])
      .map((id) => SAUCES.find((s) => s.id === id))
      .filter(Boolean)
      .map(name);
    if (sauces.length) parts.push(`${t("wa.sauce")} ${sauces.join(" + ")}`);
    return parts.join(" · ");
  };
  const cartSubtotal = () =>
    cart.reduce((sum, l) => sum + unitPrice(itemIndex.get(l.id).item, l.size) * l.qty, 0);
  const isDelivery = () => $("#checkout").elements.type.value === "delivery";
  const deliveryFee = () => (isDelivery() ? CONFIG.delivery.fee : 0);
  const cartTotal = () => cartSubtotal() + deliveryFee();
  const cartCount = () => cart.reduce((sum, l) => sum + l.qty, 0);

  // ---------- Opening hours ----------
  function isOpenNow() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: CONFIG.timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const h = +parts.find((p) => p.type === "hour").value;
    const m = +parts.find((p) => p.type === "minute").value;
    const toMin = (s) => s.split(":").reduce((a, b) => a * 60 + +b);
    const now = h * 60 + m;
    const open = toMin(CONFIG.hours.open);
    const close = toMin(CONFIG.hours.close);
    return close > open ? now >= open && now < close : now >= open || now < close;
  }

  function renderStatus() {
    const open = isOpenNow();
    const status = $("#status");
    status.classList.toggle("is-open", open);
    $(".status__label", status).textContent = t(open ? "status.open" : "status.closed");
    $(".status__hours", status).textContent = t("status.hours", CONFIG.hours);
    $("#closed-warn").hidden = open;
  }

  // ---------- Static text ----------
  // Headings (h1–h6) fade in letter by letter through js/vendor/headings.js;
  // their text must go through setHeading so the animation owns their content.
  const isHeading = (n) => /^H[1-6]$/.test(n.tagName);
  const isFx = isHeading;
  const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  function setHeading(n, html) {
    if (window.HeadingFX && window.HeadingFX.enabled) window.HeadingFX.set(n, html);
    else n.innerHTML = html;
  }

  function applyI18n() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    $$("[data-i18n]").forEach((n) => {
      const text = t(n.dataset.i18n);
      if (isFx(n)) setHeading(n, escapeHtml(text));
      else n.textContent = text;
    });
    $$("[data-i18n-html]").forEach((n) => {
      const html = t(n.dataset.i18nHtml);
      if (isFx(n)) setHeading(n, html);
      else n.innerHTML = html;
    });
    $$("[data-i18n-ph]").forEach((n) => (n.placeholder = t(n.dataset.i18nPh)));
    $$("[data-i18n-aria]").forEach((n) => n.setAttribute("aria-label", t(n.dataset.i18nAria)));
    $("#cart-open").setAttribute("aria-label", t("cart.open"));
  }

  // ---------- Menu ----------
  function priceLabel(item) {
    if (item.prices) {
      return el(
        "span",
        { class: "price price--sizes" },
        Object.entries(item.prices).map(([size, p]) =>
          el("span", {}, el("small", {}, size), " ", money(p))
        )
      );
    }
    return el(
      "span",
      { class: "price" },
      money(item.price),
      item.unit === "pc" ? el("small", {}, " " + t("menu.perPiece")) : null
    );
  }

  function categoryMedia(cat) {
    if (cat.image) {
      return el("img", { class: "cat__img", src: cat.image, alt: name(cat), loading: "lazy" });
    }
    return el(
      "div",
      { class: "cat__placeholder", "aria-hidden": "true" },
      cat.icon ? el("img", { class: "cat__icon", src: cat.icon, alt: "", loading: "lazy" }) : el("span", { class: "cat__emoji" }, cat.emoji),
      el("span", { class: "cat__soon" }, t("menu.photoSoon"))
    );
  }

  function renderMenu() {
    const chips = $("#chips");
    const list = $("#menu-list");
    chips.replaceChildren(
      ...MENU.map((cat) =>
        el("a", { class: "chip", href: "#cat-" + cat.id, dataset: { cat: cat.id } }, name(cat))
      )
    );

    list.replaceChildren(
      ...MENU.map((cat) => {
        const items = el(
          "ul",
          { class: "items" },
          cat.items.map((item) =>
            el(
              "li",
              { class: "item" },
              el(
                "div",
                { class: "item__text" },
                el(
                  "span",
                  { class: "item__name" },
                  item.emoji ? el("span", { class: "item__emoji", "aria-hidden": "true" }, item.emoji) : null,
                  name(item)
                ),
                item.descFr ? el("span", { class: "item__desc" }, lang === "ar" ? item.descAr : item.descFr) : null
              ),
              priceLabel(item),
              el(
                "button",
                {
                  class: "add-btn",
                  type: "button",
                  "aria-label": `${t("menu.add")} ${fullName(item, cat)}`,
                  onclick: (e) => onAdd(item, cat, e.currentTarget),
                },
                "+"
              )
            )
          )
        );

        return el(
          "section",
          {
            class: "cat" + (cat.featured ? " cat--featured" : "") + (cat.compact ? " cat--compact" : ""),
            id: "cat-" + cat.id,
            "aria-labelledby": "cat-title-" + cat.id,
          },
          cat.compact ? null : el("div", { class: "cat__media" }, categoryMedia(cat)),
          el(
            "div",
            { class: "cat__body" },
            el(
              "header",
              { class: "cat__head" },
              el("h3", { class: "cat__title", id: "cat-title-" + cat.id }, name(cat)),
              cat.featured ? el("span", { class: "badge" }, t("menu.signature")) : null,
              cat.sauces ? el("a", { class: "badge badge--ghost", href: "#sauces" }, t("nav.sauces")) : null
            ),
            items
          )
        );
      })
    );
    window.HeadingFX?.scan(list);
    observeCategories();
  }

  // Mark a chip active and centre it in the chip bar. Only the bar scrolls
  // sideways: scrollIntoView here would cancel the page's own smooth scroll.
  function setActiveChip(id) {
    const bar = $("#chips");
    $$(".chip", bar).forEach((c) => {
      const active = c.dataset.cat === id;
      c.classList.toggle("is-active", active);
      if (!active) return;
      const chipBox = c.getBoundingClientRect();
      const barBox = bar.getBoundingClientRect();
      const delta = chipBox.left + chipBox.width / 2 - (barBox.left + barBox.width / 2);
      bar.scrollBy({ left: delta, behavior: "smooth" });
    });
  }

  // While a chip click is scrolling the page, the scroll spy waits until the
  // page reaches the target (or the visitor scrolls by hand), so categories
  // passed on the way don't steal the highlight.
  let spyTarget = null;
  let spyDeadline = 0;
  const releaseSpy = () => (spyTarget = null);
  ["wheel", "touchstart", "keydown"].forEach((ev) =>
    window.addEventListener(ev, releaseSpy, { passive: true })
  );

  function scrollToCategory(id) {
    const target = document.getElementById("cat-" + id);
    if (!target) return;
    const offset = $("#header").offsetHeight + $(".chips-wrap").offsetHeight + 16;
    const maxTop = document.documentElement.scrollHeight - window.innerHeight;
    const top = Math.max(0, Math.min(maxTop, target.getBoundingClientRect().top + window.scrollY - offset));
    setActiveChip(id);
    spyTarget = top;
    spyDeadline = performance.now() + 3000;
    window.scrollTo({ top, behavior: "smooth" });
    history.replaceState(null, "", "#cat-" + id);
  }

  $("#chips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    e.preventDefault();
    scrollToCategory(chip.dataset.cat);
  });

  // Highlight the chip of the category under the sticky bars. On wide screens
  // two categories share a row, so keep the current one while it is still there.
  function spyCategories() {
    if (spyTarget !== null) {
      if (Math.abs(window.scrollY - spyTarget) < 2 || performance.now() > spyDeadline) {
        spyTarget = null;
        // The bar's own smooth scroll can be cut short by the page's; centre
        // the active chip again now that the page has arrived.
        const active = $(".chip.is-active");
        if (active) setActiveChip(active.dataset.cat);
      }
      return;
    }
    const line = $("#header").offsetHeight + $(".chips-wrap").offsetHeight + 40;
    const here = $$(".cat").filter((c) => {
      const box = c.getBoundingClientRect();
      return box.top <= line && box.bottom > line;
    });
    if (!here.length) return;
    const current = $(".chip.is-active")?.dataset.cat;
    if (here.some((c) => c.id === "cat-" + current)) return;
    setActiveChip(here[0].id.replace("cat-", ""));
  }

  let spyFrame = 0;
  window.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(spyFrame);
      spyFrame = requestAnimationFrame(spyCategories);
    },
    { passive: true }
  );

  function observeCategories() {
    spyCategories();
  }

  // Scrolling text bands under the hero. The list is doubled so the loop is seamless.
  function renderBands() {
    $$("[data-band]").forEach((track) => {
      const words = t(track.dataset.band).split("|");
      const half = () =>
        el("div", { class: "band__group" }, [...words, ...words].map((w) => el("span", { class: "band__item" }, w)));
      track.replaceChildren(half(), half());
    });
  }

  function renderSauces() {
    $("#sauce-list").replaceChildren(
      ...SAUCES.map((s) =>
        el(
          "li",
          { class: "sauce" },
          el("span", { class: "sauce__bowl", style: `--sauce:${s.color}`, "aria-hidden": "true" }),
          el("span", {}, name(s))
        )
      )
    );
  }

  function renderInfo() {
    const { lat, lng } = CONFIG.location;
    $("#info-address").textContent = loc(CONFIG.address);
    // The listing has its own "Itinéraire" button; directions to bare coordinates get
    // labelled with whichever business Google finds nearest.
    $("#info-directions").href =
      CONFIG.googleMapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    $("#info-hours").textContent = `${CONFIG.hours.open} – ${CONFIG.hours.close}`;
    const phone = $("#info-phone");
    phone.href = "tel:" + CONFIG.phoneIntl;
    phone.textContent = CONFIG.phone.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4");
    const ig = $("#info-instagram");
    ig.href = CONFIG.instagram;
    ig.textContent = "Instagram · " + CONFIG.instagramHandle;
    $("#hero-location").href =
      CONFIG.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const fab = $("#ig-fab");
    fab.href = CONFIG.instagram;
    fab.setAttribute("aria-label", "Instagram " + CONFIG.instagramHandle);
    const map = $("#map");
    const src = `https://maps.google.com/maps?q=${lat},${lng}&z=17&hl=${lang}&output=embed`;
    if (map.src !== src) map.src = src;
  }

  // ---------- Item dialog ----------
  const modal = $("#item-modal");
  let modalState = null;

  function onAdd(item, cat, button) {
    if (item.prices || item.options || cat.sauces) openItemModal(item, cat, button);
    else addToCart({ id: item.id, qty: 1, sauces: [] }, button);
  }

  function checkboxGroup(groupName, legend, options) {
    return el(
      "fieldset",
      { class: "field" },
      el("legend", { class: "field__label" }, legend),
      el(
        "div",
        { class: "pills" },
        options.map((o) =>
          el(
            "label",
            { class: "pill" },
            el("input", { type: "checkbox", name: groupName, value: o.value }),
            el("span", {}, el("i", { class: "pill__swatch", style: `--sauce:${o.swatch}` }), o.label)
          )
        )
      )
    );
  }

  function radioGroup(groupName, legend, options, checkedValue) {
    return el(
      "fieldset",
      { class: "field" },
      el("legend", { class: "field__label" }, legend),
      el(
        "div",
        { class: "pills" },
        options.map((o) =>
          el(
            "label",
            { class: "pill" },
            el("input", {
              type: "radio",
              name: groupName,
              value: o.value,
              checked: String(o.value) === String(checkedValue),
            }),
            el("span", {}, o.swatch ? el("i", { class: "pill__swatch", style: `--sauce:${o.swatch}` }) : null, o.label)
          )
        )
      )
    );
  }

  function openItemModal(item, cat, button) {
    modalState = { item, cat, qty: 1, button };
    setHeading($("#modal-title"), escapeHtml(fullName(item, cat)));
    const desc = lang === "ar" ? item.descAr : item.descFr;
    $("#modal-desc").textContent = desc || "";
    $("#modal-desc").hidden = !desc;

    const fields = [];
    if (item.prices) {
      fields.push(
        radioGroup(
          "size",
          t("modal.size"),
          Object.entries(item.prices).map(([size, p]) => ({
            value: size,
            label: `${t("size." + size)} · ${money(p)}`,
          })),
          "M"
        )
      );
    }
    if (item.options) {
      fields.push(
        radioGroup(
          "option",
          t("modal.choice"),
          item.options.map((o, i) => ({ value: i, label: name(o) })),
          0
        )
      );
    }
    if (cat.sauces) {
      fields.push(
        checkboxGroup(
          "sauce",
          t("modal.sauce"),
          SAUCES.map((s) => ({ value: s.id, label: name(s), swatch: s.color }))
        )
      );
    }
    $("#modal-fields").replaceChildren(...fields);
    updateModal();
    modal.returnValue = "";
    modal.showModal();
  }

  function readModal() {
    const form = $("#item-form");
    const val = (n) => form.elements[n]?.value;
    return {
      id: modalState.item.id,
      size: modalState.item.prices ? val("size") : undefined,
      option: modalState.item.options ? +val("option") : undefined,
      sauces: $$('input[name="sauce"]:checked', form).map((i) => i.value),
      qty: modalState.qty,
    };
  }

  function updateModal() {
    const line = readModal();
    // At most two sauces: lock the other boxes once two are ticked.
    const full = line.sauces.length >= MAX_SAUCES;
    $$('input[name="sauce"]', modal).forEach((box) => {
      box.disabled = full && !box.checked;
    });
    roll($("#modal-qty"), modalState.qty);
    $('#item-modal .qty__btn[data-step="-1"]').disabled = modalState.qty <= 1;
    setMoney($("#modal-price"), unitPrice(modalState.item, line.size) * modalState.qty);
  }

  $("#item-form").addEventListener("change", updateModal);
  $$(".qty__btn", modal).forEach((b) =>
    b.addEventListener("click", () => {
      modalState.qty = Math.max(1, Math.min(50, modalState.qty + +b.dataset.step));
      updateModal();
    })
  );
  modal.addEventListener("close", () => {
    if (modal.returnValue === "add" && modalState) addToCart(readModal(), modalState.button);
    modalState = null;
  });
  // Close when clicking the backdrop.
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.close("cancel");
  });

  // ---------- Cart ----------
  function addToCart(line, origin) {
    const key = lineKey(line);
    const existing = cart.find((l) => lineKey(l) === key);
    if (existing) existing.qty += line.qty;
    else cart.push(line);
    saveCart();
    const { item, cat } = itemIndex.get(line.id);
    toast(`${t("cart.added")} · ${fullName(item, cat)}`);
    emojiSpree(origin, item.emoji ? { emoji: item.emoji } : cat.icon ? { src: cat.icon } : { emoji: cat.emoji });
  }

  // Emoji spree: a burst of the dish's emoji (or illustration) sprays out of the "+" button,
  // spinning and falling under gravity, then the cart bumps.
  function emojiSpree(origin, { emoji, src }) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!origin || reduce || !origin.isConnected || !Element.prototype.animate) {
      bump();
      return;
    }
    const box = origin.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const count = 12;
    const gravity = 900; // px/s²

    origin.animate(
      [{ transform: "scale(1)" }, { transform: "scale(0.82)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }],
      { duration: 380, easing: "ease-out" }
    );

    for (let i = 0; i < count; i++) {
      const node = src
        ? el("img", { class: "spree spree--img", src, alt: "", "aria-hidden": "true" })
        : el("span", { class: "spree", "aria-hidden": "true" }, emoji);
      node.style.left = `${cx}px`;
      node.style.top = `${cy}px`;
      document.body.append(node);

      // Mostly upward, fanned out to both sides.
      const angle = (-90 + (Math.random() * 2 - 1) * 70) * (Math.PI / 180);
      const speed = 260 + Math.random() * 260; // px/s
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const spin = (Math.random() * 2 - 1) * 540;
      const size = 0.7 + Math.random() * 0.7;
      const duration = 900 + Math.random() * 500;
      const secs = duration / 1000;

      const frames = [];
      for (let f = 0; f <= 10; f++) {
        const p = f / 10;
        const time = secs * p;
        const x = vx * time;
        const y = vy * time + 0.5 * gravity * time * time;
        const grow = p < 0.15 ? 0.3 + (p / 0.15) * 0.7 : 1;
        frames.push({
          transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${spin * p}deg) scale(${size * grow})`,
          opacity: p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3,
          offset: p,
        });
      }
      node
        .animate(frames, { duration, easing: "linear", delay: i * 12, fill: "forwards" })
        .finished.then(() => node.remove());
    }
    setTimeout(bump, 260);
  }

  // Odometer-style number: changed digits slide out and the new ones roll in,
  // upwards when the number grows and downwards when it shrinks.
  function roll(node, value, from) {
    const next = String(value);
    if (from != null && node.dataset.v == null) setDigits(node, String(from));
    const prev = node.dataset.v;
    if (prev === next) return;
    node.dataset.v = next;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dir = prev == null || reduce || !Element.prototype.animate ? 0 : Number(next) >= Number(prev) ? 1 : -1;
    const old = [...node.children].map((c) => c.dataset.ch);
    const cells = [...next].map((ch, i) => {
      const before = old[old.length - next.length + i];
      const cell = el("span", { class: "roll__cell", dataset: { ch } }, el("span", { class: "roll__ch" }, ch));
      if (dir && before !== ch) {
        const delay = (next.length - 1 - i) * 40;
        if (before != null) {
          const out = el("span", { class: "roll__ch roll__ch--out" }, before);
          cell.append(out);
          out
            .animate(
              [
                { transform: "translateY(0)", opacity: 1, filter: "blur(0)" },
                { transform: `translateY(${-dir * 100}%)`, opacity: 0, filter: "blur(3px)" },
              ],
              { duration: 320, delay, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }
            )
            .finished.then(() => out.remove());
        }
        cell.firstChild.animate(
          [
            { transform: `translateY(${dir * 100}%)`, opacity: 0, filter: "blur(3px)" },
            { transform: "translateY(0)", opacity: 1, filter: "blur(0)" },
          ],
          { duration: 520, delay, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "backwards" }
        );
      }
      return cell;
    });
    node.replaceChildren(...cells);
  }

  function setDigits(node, text) {
    node.dataset.v = text;
    node.replaceChildren(
      ...[...text].map((ch) => el("span", { class: "roll__cell", dataset: { ch } }, el("span", { class: "roll__ch" }, ch)))
    );
  }

  // "65 DH" with a rolling number and a static currency.
  function setMoney(node, amount, from) {
    let num = $(".roll", node);
    let cur = $(".money__cur", node);
    if (!num) {
      num = el("span", { class: "roll" });
      cur = el("span", { class: "money__cur" });
      node.replaceChildren(num, "\u00a0", cur);
    }
    cur.textContent = loc(CONFIG.currency);
    roll(num, amount, from);
  }

  function setQty(key, qty) {
    const line = cart.find((l) => lineKey(l) === key);
    if (!line) return;
    line.qty = qty;
    if (line.qty <= 0) cart = cart.filter((l) => l !== line);
    saveCart();
  }

  function saveCart() {
    store.set("cart", cart);
    renderCart();
  }

  function renderCart() {
    const count = cartCount();
    const fee = deliveryFee();
    setMoney($("#cart-subtotal"), cartSubtotal());
    $("#fee-row").hidden = !fee;
    setMoney($("#cart-fee"), fee);
    $('[data-i18n="order.deliveryFee"]').textContent = t("order.deliveryFee", { fee: money(CONFIG.delivery.fee) });
    $('[data-i18n="order.deliveryHint"]').textContent = t("order.deliveryHint", { max: CONFIG.delivery.maxKm });
    const countEl = $("#cart-count");
    roll(countEl, count);
    countEl.hidden = count === 0;
    $("#cart-bar").hidden = count === 0;
    document.body.classList.toggle("has-cart", count > 0);
    roll($("#cart-bar-count"), count);
    setMoney($("#cart-bar-total"), cartSubtotal());
    setMoney($("#cart-total"), cartTotal());
    $("#cart-empty").hidden = count > 0;
    $("#checkout").hidden = count === 0;
    $("#cart-foot").hidden = count === 0;

    // Lines are rebuilt on every change; remember the old numbers so they can roll.
    const before = new Map(
      $$(".cart-line").map((li) => [li.dataset.key, { qty: li.dataset.qty, price: li.dataset.price }])
    );
    $("#cart-lines").replaceChildren(
      ...cart.map((line) => {
        const { item, cat } = itemIndex.get(line.id);
        const key = lineKey(line);
        const details = lineDetails(line);
        const price = unitPrice(item, line.size) * line.qty;
        const prev = before.get(key);
        const qtyOut = el("output", { class: "roll" });
        const priceOut = el("span", { class: "cart-line__price money" });
        roll(qtyOut, line.qty, prev?.qty);
        setMoney(priceOut, price, prev?.price);
        return el(
          "li",
          { class: "cart-line", dataset: { key, qty: line.qty, price } },
          el(
            "div",
            { class: "cart-line__text" },
            el("strong", {}, fullName(item, cat)),
            details ? el("small", {}, details) : null,
            priceOut
          ),
          el(
            "div",
            { class: "qty qty--small" },
            el("button", {
              type: "button",
              class: "qty__btn",
              "aria-label": line.qty === 1 ? t("cart.remove") : "−",
              onclick: () => setQty(key, line.qty - 1),
            }, line.qty === 1 ? "🗑" : "−"),
            qtyOut,
            el("button", {
              type: "button",
              class: "qty__btn",
              "aria-label": "+",
              onclick: () => setQty(key, line.qty + 1),
            }, "+")
          )
        );
      })
    );
  }

  function bump() {
    const btn = $("#cart-open");
    btn.classList.remove("bump");
    void btn.offsetWidth;
    btn.classList.add("bump");
  }

  let toastTimer;
  function toast(msg) {
    const node = $("#toast");
    node.textContent = msg;
    node.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("is-visible"), 2200);
  }

  // ---------- Drawer ----------
  const drawer = $("#cart");
  let lastFocus = null;
  function openCart() {
    lastFocus = document.activeElement;
    drawer.classList.add("is-open");
    $("#toast").classList.remove("is-visible");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    $(".drawer__panel .icon-btn", drawer).focus();
  }
  function closeCart() {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
    lastFocus?.focus();
  }
  $("#cart-open").addEventListener("click", openCart);
  $("#cart-bar").addEventListener("click", openCart);
  $$("[data-close]", drawer).forEach((n) => n.addEventListener("click", closeCart));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) closeCart();
  });

  // ---------- Checkout ----------
  const form = $("#checkout");
  const saved = store.get("customer", {});
  ["name", "phone", "address"].forEach((f) => {
    if (saved[f]) form.elements[f].value = saved[f];
  });
  if (saved.type === "delivery") form.elements.type.value = "delivery";

  function syncType() {
    const delivery = isDelivery();
    $$(".delivery-only", form).forEach((n) => (n.hidden = !delivery));
    form.elements.address.required = delivery;
    $("#send").disabled = delivery && !!geo && !inRange();
    renderCart();
    if (delivery) ensureMap();
  }
  form.addEventListener("change", (e) => {
    if (e.target.name === "type") syncType();
  });

  form.addEventListener("input", (e) => e.target.closest(".field")?.classList.remove("has-error"));

  // ---------- Delivery map ----------
  const SHOP = CONFIG.location;
  let map = null;
  let pin = null;

  // Straight-line distance in km (haversine).
  function distanceKm(a, b) {
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  }
  const formatKm = (km) => km.toFixed(1).replace(".", lang === "fr" ? "," : ".");
  const inRange = () => geo && geo.km <= CONFIG.delivery.maxKm;

  function renderGeoStatus() {
    const status = $("#geo-status");
    if (!geo) {
      status.hidden = true;
      return;
    }
    const ok = inRange();
    status.hidden = false;
    status.classList.toggle("is-error", !ok);
    status.textContent = t(ok ? "order.inRange" : "order.outOfRange", {
      km: formatKm(geo.km),
      max: CONFIG.delivery.maxKm,
    });
    $("#geo-field").classList.remove("has-error");
    $("#send").disabled = isDelivery() && !ok;
  }

  function setGeo(lat, lng, { pan = false } = {}) {
    geo = { lat, lng, km: distanceKm(SHOP, { lat, lng }) };
    if (map) {
      const ok = inRange();
      if (!pin) {
        pin = L.marker([lat, lng], { draggable: true, icon: pinIcon(ok) }).addTo(map);
        pin.on("dragend", () => {
          const p = pin.getLatLng();
          setGeo(p.lat, p.lng);
        });
      } else {
        pin.setLatLng([lat, lng]);
        pin.setIcon(pinIcon(ok));
      }
      if (pan) map.setView([lat, lng], 16);
    }
    renderGeoStatus();
  }

  function pinIcon(ok) {
    return L.divIcon({
      className: "",
      html: `<span class="map-pin${ok ? "" : " is-out"}"></span>`,
      iconSize: [30, 40],
      iconAnchor: [15, 38],
    });
  }

  function ensureMap() {
    if (map) {
      requestAnimationFrame(() => map.invalidateSize());
      return;
    }
    if (!window.L) {
      $("#delivery-map").hidden = true; // map library unavailable: GPS button still works
      return;
    }
    map = L.map("delivery-map", { zoomControl: true, attributionControl: true }).setView([SHOP.lat, SHOP.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    L.circle([SHOP.lat, SHOP.lng], {
      radius: CONFIG.delivery.maxKm * 1000,
      color: "#d00000",
      weight: 2,
      fillColor: "#d00000",
      fillOpacity: 0.08,
    }).addTo(map);
    L.marker([SHOP.lat, SHOP.lng], {
      icon: L.icon({ iconUrl: "assets/logo.png", iconSize: [46, 46], iconAnchor: [23, 23] }),
      keyboard: false,
      interactive: false,
    }).addTo(map);
    map.on("click", (e) => setGeo(e.latlng.lat, e.latlng.lng));
    // The map can be created while hidden (cart closed, or delivery restored
    // from a previous visit), at zero size. Redraw it whenever it gets a size.
    if ("ResizeObserver" in window) {
      let wasHidden = true;
      new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        if (!width || !height) {
          wasHidden = true;
          return;
        }
        map.invalidateSize();
        if (wasHidden) map.setView(geo ? [geo.lat, geo.lng] : [SHOP.lat, SHOP.lng], geo ? 16 : 14, { animate: false });
        wasHidden = false;
      }).observe($("#delivery-map"));
    }
    if (geo) setGeo(geo.lat, geo.lng, { pan: true });
    requestAnimationFrame(() => map.invalidateSize());
  }

  $("#locate").addEventListener("click", () => {
    const label = $("#locate-label");
    const fail = () => {
      label.textContent = t("order.locate");
      const status = $("#geo-status");
      status.hidden = false;
      status.classList.add("is-error");
      status.textContent = t("order.locateFail");
    };
    if (!navigator.geolocation) return fail();
    label.textContent = t("order.locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        label.textContent = t("order.locate");
        setGeo(pos.coords.latitude, pos.coords.longitude, { pan: true });
      },
      fail,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!cart.length) return;
    const delivery = isDelivery();
    let firstInvalid = null;
    ["name", "phone", "address"].forEach((f) => {
      const input = form.elements[f];
      const invalid = input.required && !input.value.trim();
      input.closest(".field").classList.toggle("has-error", invalid);
      if (invalid && !firstInvalid) firstInvalid = input;
    });
    if (delivery && !geo) {
      $("#geo-field").classList.add("has-error");
      firstInvalid = firstInvalid || $("#locate");
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }
    if (delivery && !inRange()) {
      renderGeoStatus();
      $("#geo-status").scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    store.set("customer", { name: data.name, phone: data.phone, address: data.address, type: data.type });

    const lines = cart.map((line) => {
      const { item, cat } = itemIndex.get(line.id);
      const details = lineDetails(line);
      return `• ${line.qty} × ${fullName(item, cat)}${details ? ` (${details})` : ""} — ${money(
        unitPrice(item, line.size) * line.qty
      )}`;
    });
    const msg = [
      t("wa.hello"),
      "",
      ...lines,
      "",
      delivery ? `${t("wa.subtotal")}: ${money(cartSubtotal())}` : null,
      delivery ? `${t("wa.deliveryFee")}: ${money(deliveryFee())}` : null,
      `*${t("wa.total")}: ${money(cartTotal())}*`,
      "",
      `${t("wa.type")}: ${t(delivery ? "order.delivery" : "order.pickup")}`,
      `${t("wa.name")}: ${data.name.trim()}`,
      `${t("wa.phone")}: ${data.phone.trim()}`,
      delivery ? `${t("wa.address")}: ${data.address.trim()}` : null,
      delivery
        ? `${t("wa.location")}: https://maps.google.com/?q=${geo.lat.toFixed(6)},${geo.lng.toFixed(6)} (${formatKm(geo.km)} km)`
        : null,
      data.notes.trim() ? `${t("wa.notes")}: ${data.notes.trim()}` : null,
    ]
      .filter((l) => l !== null)
      .join("\n");

    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  });

  // ---------- Language ----------
  function render() {
    applyI18n();
    renderMenu();
    renderBands();
    renderSauces();
    renderInfo();
    renderStatus();
    renderCart();
  }

  $("#lang-toggle").addEventListener("click", () => {
    lang = lang === "fr" ? "ar" : "fr";
    store.set("lang", lang);
    render();
    renderGeoStatus();
  });

  // Hero video: stays on its first frame for visitors who ask for less motion.
  const heroVideo = $("#hero-video");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    heroVideo.removeAttribute("autoplay");
    heroVideo.pause();
  }

  // Hero photo (optional): replaces the video when set in config.js.
  if (CONFIG.heroImage) {
    const photo = $("#hero-photo");
    photo.src = CONFIG.heroImage;
    photo.hidden = false;
    $("#hero").classList.add("has-photo");
  }

  // Solid header once the page leaves the hero.
  const header = $("#header");
  const syncHeader = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  window.addEventListener("scroll", syncHeader, { passive: true });
  syncHeader();

  $("#year").textContent = new Date().getFullYear();
  render();
  syncType();

  // Opening the page on a category link (e.g. shared #cat-pizza) lands below the sticky bars.
  const initial = window.location.hash.match(/^#cat-(.+)$/);
  if (initial) requestAnimationFrame(() => scrollToCategory(initial[1]));
  setInterval(renderStatus, 60 * 1000);

  // ---------- Moving gradient buttons ----------
  // Turns the light trail around every visible button (see "Moving gradient
  // buttons" in style.css). Off for visitors who ask for reduced motion: the
  // trail then stays still.
  (function movingButtons() {
    const SEL = ".btn, .add-btn, .cart-btn, .lang-btn, .cart-bar";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const visible = new Set();
    const io = new IntersectionObserver((entries) =>
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)))
    );
    const each = (node, fn) => {
      if (node.nodeType !== 1) return;
      if (node.matches(SEL)) fn(node);
      node.querySelectorAll(SEL).forEach(fn);
    };
    each(document.body, (b) => io.observe(b));
    new MutationObserver((muts) =>
      muts.forEach((m) => {
        m.addedNodes.forEach((n) => each(n, (b) => io.observe(b)));
        m.removedNodes.forEach((n) =>
          each(n, (b) => {
            io.unobserve(b);
            visible.delete(b);
          })
        );
      })
    ).observe(document.body, { childList: true, subtree: true });

    const DEG_PER_SEC = 31.68; // Originkit "step" movement at speed 22: 0.88 × 36°/s
    let angle = 0;
    let last = 0;
    const tick = (now) => {
      if (last && !document.hidden) angle = (angle + (DEG_PER_SEC * (now - last)) / 1000) % 360;
      last = now;
      const value = angle.toFixed(1) + "deg";
      visible.forEach((b) => b.style.setProperty("--mg-a", value));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })();

  // ---------- Intro animation ----------
  // Yellow screen: the hat and moustache (photo 1) pop in, the name plate
  // crashes in from the right between them, the tassel wiggles, then the
  // finished logo glides into its place in the header.
  const splash = $("#splash");
  const stage = $("#intro");
  const part = (n) => $(`.intro__${n}`, stage);
  const hatEl = part("hatgroup");
  const tasselEl = part("tassel");
  const plateEl = part("plate");
  const moustacheEl = part("moustache");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pageLoaded = new Promise((r) =>
    document.readyState === "complete" ? r() : window.addEventListener("load", r, { once: true })
  );

  // Photo-1 pose of each layer, relative to its final place in the logo.
  const HAT_START = "translate(-1.35%, 25.9%) scale(1.2048)";
  const MOUSTACHE_START = "translate(0, -45.8%) scale(1.111)";

  function finishIntro() {
    if (!splash.isConnected) return;
    document.body.classList.remove("is-loading");
    splash.remove();
    // The hero headline faded in behind the intro; play it again now it shows.
    const heroTitle = $(".hero__title");
    if (heroTitle && window.HeadingFX && window.HeadingFX.enabled) setHeading(heroTitle, t("hero.title"));
    // Start the hero video from its first shot once the page is revealed.
    if (!heroVideo.paused) {
      heroVideo.currentTime = 0;
      heroVideo.play().catch(() => {});
    }
  }

  async function playIntro() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const images = $$("img", stage);
    const ready = Promise.all(images.map((img) => img.decode().catch(() => {})));
    // Never hold the page back for long if the pictures are slow.
    const loadedInTime = await Promise.race([ready.then(() => true), wait(2500).then(() => false)]);
    if (!loadedInTime || reduce || !Element.prototype.animate) {
      await pageLoaded;
      splash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }).finished.then(finishIntro);
      return;
    }

    const anim = (node, frames, opts) => node.animate(frames, { fill: "both", ...opts }).finished;
    const spring = "cubic-bezier(.34,1.56,.64,1)";

    // 1. Photo 1 pops in.
    const pop = (node, base, delay) =>
      anim(
        node,
        [
          { opacity: 0, transform: `${base} translateY(-6%) scale(0.6)` },
          { opacity: 1, transform: `${base} translateY(0) scale(1.06)`, offset: 0.7 },
          { opacity: 1, transform: `${base} scale(1)` },
        ],
        { duration: 560, delay, easing: "ease-out" }
      );
    pop(hatEl, HAT_START, 0);
    await pop(moustacheEl, MOUSTACHE_START, 90);
    await wait(250);

    // 2. The name plate shoots in from the right...
    const offRight = window.innerWidth;
    await anim(
      plateEl,
      [
        { opacity: 1, transform: `translateX(${offRight}px) rotate(-8deg) scaleX(1.15)` },
        { opacity: 1, transform: "translateX(0) rotate(0) scaleX(1)" },
      ],
      { duration: 280, easing: "cubic-bezier(.55,0,1,.45)" }
    );

    // ...and crashes in: hat knocked up, moustache pushed down, plate squashes, screen shakes.
    const knock = (node, from, lift) =>
      anim(
        node,
        [
          { opacity: 1, transform: from },
          { opacity: 1, transform: `translateY(${lift}%) rotate(${lift < 0 ? -7 : 4}deg)`, offset: 0.35 },
          { opacity: 1, transform: "translateY(0) rotate(0)" },
        ],
        { duration: 520, easing: spring }
      );
    knock(hatEl, HAT_START, -10);
    knock(moustacheEl, MOUSTACHE_START, 14);
    anim(
      plateEl,
      [
        { opacity: 1, transform: "scale(0.88, 1.14)" },
        { opacity: 1, transform: "scale(1.06, 0.94)", offset: 0.4 },
        { opacity: 1, transform: "scale(0.98, 1.02)", offset: 0.7 },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: 420, easing: "ease-out" }
    );
    splash.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: "translate(-14px, 6px)" },
        { transform: "translate(12px, -5px)" },
        { transform: "translate(-8px, 3px)" },
        { transform: "translate(5px, -2px)" },
        { transform: "translate(0, 0)" },
      ],
      { duration: 380, easing: "ease-out" }
    );
    sparks();

    // 3. On the same frame as the crash, the jolt sets the tassel swinging
    //    from its knob; it settles while the hat and moustache bounce back.
    stage.classList.add("is-wiggling");
    await anim(
      tasselEl,
      [
        { transform: "rotate(0)" },
        { transform: "rotate(-26deg)", offset: 0.12 },
        { transform: "rotate(19deg)", offset: 0.3 },
        { transform: "rotate(-12deg)", offset: 0.48 },
        { transform: "rotate(7deg)", offset: 0.65 },
        { transform: "rotate(-3deg)", offset: 0.82 },
        { transform: "rotate(0)" },
      ],
      { duration: 1100, easing: "ease-out" }
    );
    stage.classList.remove("is-wiggling");
    await wait(200);

    // 4. The finished logo glides into the header.
    await pageLoaded;
    const target = $(".brand img").getBoundingClientRect();
    const box = stage.getBoundingClientRect();
    // The artwork fills 95.5% × 96.5% of the stage, centred; the stage scales from its top-left corner.
    const scale = Math.min(target.width / (box.width * 0.955), target.height / (box.height * 0.965));
    const tx = target.left + target.width / 2 - (box.left + (box.width * 0.5) * scale);
    const ty = target.top + target.height / 2 - (box.top + (box.height * 0.5) * scale);
    splash.querySelector(".splash__bg").animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 650,
      delay: 120,
      easing: "ease-in",
      fill: "forwards",
    });
    await anim(
      stage,
      [
        { transform: "translate(0, 0) scale(1)" },
        { transform: `translate(${tx * 0.5}px, ${ty * 0.5 - 40}px) scale(${(1 + scale) / 2}) rotate(-6deg)`, offset: 0.55 },
        { transform: `translate(${tx}px, ${ty}px) scale(${scale})` },
      ],
      { duration: 820, easing: "cubic-bezier(.6,0,.25,1)" }
    );
    document.body.classList.remove("is-loading"); // header logo fades in under the landed one
    await anim(stage, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 });
    finishIntro();
  }

  // A few black streaks burst out where the plate hits the hat and moustache.
  function sparks() {
    const spots = [
      [20, 46, -150], [35, 45, -110], [65, 45, -70], [80, 46, -30],
      [18, 79, 150], [40, 80, 110], [60, 80, 70], [82, 79, 30],
    ];
    spots.forEach(([x, y, deg]) => {
      const s = el("span", { class: "intro__spark" });
      s.style.left = `${x}%`;
      s.style.top = `${y}%`;
      stage.append(s);
      const rad = (deg * Math.PI) / 180;
      const dist = 60 + Math.random() * 40;
      s.animate(
        [
          { transform: `rotate(${deg}deg) scaleX(0.3)`, opacity: 1 },
          {
            transform: `translate(${Math.cos(rad) * dist}px, ${Math.sin(rad) * dist}px) rotate(${deg}deg) scaleX(1.4)`,
            opacity: 0,
          },
        ],
        { duration: 420, easing: "ease-out", fill: "forwards" }
      ).finished.then(() => s.remove());
    });
  }

  playIntro().catch(finishIntro);
  setTimeout(finishIntro, 9000); // safety net: never leave the page covered
})();
