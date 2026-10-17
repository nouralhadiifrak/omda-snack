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
  let geo = null;

  const itemIndex = new Map();
  MENU.forEach((cat) => cat.items.forEach((item) => itemIndex.set(item.id, { item, cat })));
  cart = cart.filter((line) => itemIndex.has(line.id));

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
  const lineKey = (l) => [l.id, l.size || "", l.option ?? "", l.sauce || ""].join("|");
  const lineDetails = (line) => {
    const { item } = itemIndex.get(line.id);
    const parts = [];
    if (line.size) parts.push(t("size." + line.size));
    if (line.option != null && item.options) parts.push(name(item.options[line.option]));
    if (line.sauce) {
      const sauce = SAUCES.find((s) => s.id === line.sauce);
      if (sauce) parts.push(`${t("wa.sauce")} ${name(sauce)}`);
    }
    return parts.join(" · ");
  };
  const cartTotal = () =>
    cart.reduce((sum, l) => sum + unitPrice(itemIndex.get(l.id).item, l.size) * l.qty, 0);
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
                  onclick: () => onAdd(item, cat),
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

  // Highlight the chip of the category currently on screen.
  let catObserver;
  function observeCategories() {
    catObserver?.disconnect();
    if (!("IntersectionObserver" in window)) return;
    catObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id.replace("cat-", "");
          $$(".chip").forEach((c) => {
            const active = c.dataset.cat === id;
            c.classList.toggle("is-active", active);
            if (active) c.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    $$(".cat").forEach((s) => catObserver.observe(s));
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
    const map = $("#map");
    const src = `https://maps.google.com/maps?q=${lat},${lng}&z=17&hl=${lang}&output=embed`;
    if (map.src !== src) map.src = src;
  }

  // ---------- Item dialog ----------
  const modal = $("#item-modal");
  let modalState = null;

  function onAdd(item, cat) {
    if (item.prices || item.options || cat.sauces) openItemModal(item, cat);
    else addToCart({ id: item.id, qty: 1 });
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

  function openItemModal(item, cat) {
    modalState = { item, cat, qty: 1 };
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
        radioGroup(
          "sauce",
          t("modal.sauce"),
          [{ value: "", label: t("modal.noSauce") }].concat(
            SAUCES.map((s) => ({ value: s.id, label: name(s), swatch: s.color }))
          ),
          ""
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
      sauce: modalState.cat.sauces ? val("sauce") || undefined : undefined,
      qty: modalState.qty,
    };
  }

  function updateModal() {
    const line = readModal();
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
    if (modal.returnValue === "add" && modalState) addToCart(readModal());
    modalState = null;
  });
  // Close when clicking the backdrop.
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.close("cancel");
  });

  // ---------- Cart ----------
  function addToCart(line) {
    const key = lineKey(line);
    const existing = cart.find((l) => lineKey(l) === key);
    if (existing) existing.qty += line.qty;
    else cart.push(line);
    saveCart();
    const { item, cat } = itemIndex.get(line.id);
    toast(`${t("cart.added")} · ${fullName(item, cat)}`);
    bump();
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
    const countEl = $("#cart-count");
    countEl.textContent = count;
    countEl.hidden = count === 0;
    $("#cart-bar").hidden = count === 0;
    $("#cart-bar-count").textContent = count;
    $("#cart-bar-total").textContent = total;
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
    const delivery = form.elements.type.value === "delivery";
    $(".delivery-only", form).hidden = !delivery;
    form.elements.address.required = delivery;
  }
  form.addEventListener("change", syncType);
  syncType();

  form.addEventListener("input", (e) => e.target.closest(".field")?.classList.remove("has-error"));

  $("#locate").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    if (!navigator.geolocation) {
      btn.textContent = t("order.locateFail");
      return;
    }
    btn.textContent = t("order.locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geo = { lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) };
        btn.textContent = t("order.located");
        btn.dataset.i18n = "order.located";
      },
      () => {
        btn.textContent = t("order.locateFail");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!cart.length) return;
    let firstInvalid = null;
    ["name", "phone", "address"].forEach((f) => {
      const input = form.elements[f];
      const invalid = input.required && !input.value.trim();
      input.closest(".field").classList.toggle("has-error", invalid);
      if (invalid && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) {
      firstInvalid.focus();
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
    const delivery = data.type === "delivery";
    const msg = [
      t("wa.hello"),
      "",
      ...lines,
      "",
      `*${t("wa.total")}: ${money(cartTotal())}*`,
      "",
      `${t("wa.type")}: ${t(delivery ? "order.delivery" : "order.pickup")}`,
      `${t("wa.name")}: ${data.name.trim()}`,
      `${t("wa.phone")}: ${data.phone.trim()}`,
      delivery ? `${t("wa.address")}: ${data.address.trim()}` : null,
      delivery && geo ? `${t("wa.location")}: https://maps.google.com/?q=${geo.lat},${geo.lng}` : null,
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
    renderSauces();
    renderInfo();
    renderStatus();
    renderCart();
  }

  $("#lang-toggle").addEventListener("click", () => {
    lang = lang === "fr" ? "ar" : "fr";
    store.set("lang", lang);
    render();
  });

  $("#year").textContent = new Date().getFullYear();
  render();
  setInterval(renderStatus, 60 * 1000);
})();
