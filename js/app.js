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
  function applyI18n() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    $$("[data-i18n]").forEach((n) => (n.textContent = t(n.dataset.i18n)));
    $$("[data-i18n-html]").forEach((n) => (n.innerHTML = t(n.dataset.i18nHtml)));
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
      el("span", { class: "cat__emoji" }, cat.emoji),
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
                el("span", { class: "item__name" }, name(item)),
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
      if (Math.abs(window.scrollY - spyTarget) < 2 || performance.now() > spyDeadline) spyTarget = null;
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
    $("#info-directions").href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    $("#info-hours").textContent = `${CONFIG.hours.open} – ${CONFIG.hours.close}`;
    const phone = $("#info-phone");
    phone.href = "tel:" + CONFIG.phoneIntl;
    phone.textContent = CONFIG.phone.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4");
    const ig = $("#info-instagram");
    ig.href = CONFIG.instagram;
    ig.textContent = "Instagram · " + CONFIG.instagramHandle;
    $("#hero-location").href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
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
    $("#modal-title").textContent = fullName(item, cat);
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
    $("#modal-qty").textContent = modalState.qty;
    $("#modal-add").textContent = t("modal.add", {
      price: money(unitPrice(modalState.item, line.size) * modalState.qty),
    });
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
    flyToCart(origin, cat.emoji);
  }

  // The dish's icon pops out of the "+" button and flies in an arc to the cart.
  function flyToCart(origin, emoji) {
    const target = $("#cart-open");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!origin || reduce || !origin.isConnected || !Element.prototype.animate) {
      bump();
      return;
    }
    const from = origin.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);

    // Outer element moves sideways at a steady pace, inner one rises then
    // drops: together they trace a curve.
    const outer = el("div", { class: "fly", "aria-hidden": "true" });
    const inner = el("span", { class: "fly__icon" }, emoji);
    outer.append(inner);
    outer.style.left = `${from.left + from.width / 2}px`;
    outer.style.top = `${from.top + from.height / 2}px`;
    document.body.append(outer);

    const duration = 850;
    const lift = Math.min(160, Math.max(70, Math.abs(dy) * 0.35));
    inner.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0 },
        { transform: "translate(-50%, -50%) scale(1.5)", opacity: 1, offset: 0.18 },
        { transform: "translate(-50%, -50%) scale(1.2)", offset: 0.3 },
        { transform: "translate(-50%, -50%) scale(0.45)", opacity: 0.9 },
      ],
      { duration, easing: "ease-out", fill: "forwards" }
    );
    outer.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: `translate(${dx * 0.06}px, ${-lift * 0.5}px)`, offset: 0.18 },
        { transform: `translate(${dx * 0.45}px, ${Math.min(0, dy) - lift}px)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px)` },
      ],
      { duration, easing: "cubic-bezier(.45,.05,.55,.95)", fill: "forwards" }
    ).finished.then(() => {
      outer.remove();
      bump();
    });
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
    const total = money(cartTotal());
    const fee = deliveryFee();
    $("#cart-subtotal").textContent = money(cartSubtotal());
    $("#fee-row").hidden = !fee;
    $("#cart-fee").textContent = money(fee);
    $('[data-i18n="order.deliveryFee"]').textContent = t("order.deliveryFee", { fee: money(CONFIG.delivery.fee) });
    $('[data-i18n="order.deliveryHint"]').textContent = t("order.deliveryHint", { max: CONFIG.delivery.maxKm });
    const countEl = $("#cart-count");
    countEl.textContent = count;
    countEl.hidden = count === 0;
    $("#cart-bar").hidden = count === 0;
    document.body.classList.toggle("has-cart", count > 0);
    $("#cart-bar-count").textContent = count;
    $("#cart-bar-total").textContent = money(cartSubtotal());
    $("#cart-total").textContent = total;
    $("#cart-empty").hidden = count > 0;
    $("#checkout").hidden = count === 0;
    $("#cart-foot").hidden = count === 0;

    $("#cart-lines").replaceChildren(
      ...cart.map((line) => {
        const { item, cat } = itemIndex.get(line.id);
        const key = lineKey(line);
        const details = lineDetails(line);
        return el(
          "li",
          { class: "cart-line" },
          el(
            "div",
            { class: "cart-line__text" },
            el("strong", {}, fullName(item, cat)),
            details ? el("small", {}, details) : null,
            el("span", { class: "cart-line__price" }, money(unitPrice(item, line.size) * line.qty))
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
            el("output", {}, line.qty),
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
      color: "#f6c21c",
      weight: 2,
      fillColor: "#f6c21c",
      fillOpacity: 0.08,
    }).addTo(map);
    L.marker([SHOP.lat, SHOP.lng], {
      icon: L.icon({ iconUrl: "assets/logo.png", iconSize: [46, 46], iconAnchor: [23, 23] }),
      keyboard: false,
      interactive: false,
    }).addTo(map);
    map.on("click", (e) => setGeo(e.latlng.lat, e.latlng.lng));
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

  // Hero photo (optional): replaces the logo artwork when set in config.js.
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

  // ---------- Intro animation ----------
  // Shown at least long enough to play once, removed as soon as the page is ready.
  const splash = $("#splash");
  const started = performance.now();
  let splashHidden = false;
  const hideSplash = () => {
    if (splashHidden) return;
    splashHidden = true;
    const wait = Math.max(0, 1600 - (performance.now() - started));
    setTimeout(() => {
      splash.classList.add("is-done");
      document.body.classList.remove("is-loading");
      setTimeout(() => splash.remove(), 700);
    }, wait);
  };
  if (document.readyState === "complete") hideSplash();
  else window.addEventListener("load", hideSplash, { once: true });
  setTimeout(hideSplash, 4000); // never block the page on a slow asset
})();
