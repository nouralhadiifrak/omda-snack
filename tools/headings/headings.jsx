/*
 * "Fade Letters" for the site's text (headings and body copy), driven by
 * spring-text-engine. Bundled with React + @react-spring/web into
 * js/vendor/headings.js (see tools/headings).
 *
 * window.HeadingFX.mount(el)        animate an element's current content
 * window.HeadingFX.set(el, html)    replace an element's content (and replay the fade)
 * window.HeadingFX.scan(root)       mount every heading and [data-fx] element inside root
 */
import React from "react";
import { createRoot } from "react-dom/client";
import TextEngine from "spring-text-engine";

const roots = new WeakMap();
let version = 0;

// Slower than the original preset (tension 294 / friction 34): each letter
// takes about a second to appear.
const SPRING = { tension: 110, friction: 30 };
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

// Simple inline HTML (text, <em>, <bdi>, <span>, <br>) → React children.
function toChildren(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const walk = (nodes) =>
    Array.from(nodes).map((n, i) => {
      if (n.nodeType === Node.TEXT_NODE) return n.textContent;
      if (n.nodeType !== Node.ELEMENT_NODE) return null;
      const tag = n.tagName.toLowerCase();
      if (tag === "br") return <span key={i} className="te-break" aria-hidden="true" />;
      return React.createElement(tag, { key: i, className: n.getAttribute("class") || undefined }, ...walk(n.childNodes));
    });
  return walk(tpl.content.childNodes).filter((c) => c !== null && c !== "");
}

const clamp = (v, lo, hi) => Math.round(Math.min(hi, Math.max(lo, v)));
function toText(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  return tpl.content.textContent || "";
}

function render(el, html) {
  let root = roots.get(el);
  if (!root) {
    root = createRoot(el);
    roots.set(el, root);
  }
  const style = getComputedStyle(el);
  const centered = style.textAlign === "center";
  el.classList.toggle("te-inline", style.display.startsWith("inline"));
  const text = toText(html);
  // Arabic letters join to their neighbours; splitting them into separate
  // boxes would break the script, so Arabic text fades word by word instead.
  // Long text gets a tighter stagger so a paragraph doesn't take ages.
  // Latin text on an Arabic page: keep its letters left to right (the flex
  // row would otherwise follow the page direction and spell it backwards),
  // and keep block text aligned to the right like the rest of the page.
  const latinInRtl = !ARABIC.test(text) && style.direction === "rtl";
  const layout = { direction: latinInRtl ? "ltr" : undefined };
  if (centered) layout.justifyContent = "center";
  else if (latinInRtl && !style.display.startsWith("inline")) layout.justifyContent = "flex-end";
  let motion;
  if (ARABIC.test(text)) {
    const words = text.split(/\s+/).filter(Boolean).length || 1;
    motion = { wordOut: { opacity: 0 }, wordIn: { opacity: 1 }, wordConfig: SPRING, wordStagger: clamp(2400 / words, 40, 140) };
  } else {
    const letters = text.replace(/\s/g, "").length || 1;
    motion = { letterOut: { opacity: 0 }, letterIn: { opacity: 1 }, letterConfig: SPRING, letterStagger: clamp(1800 / letters, 10, 45) };
  }
  root.render(
    <TextEngine
      key={++version}
      tag="span"
      mode="once"
      className="te-root"
      style={layout}
      {...motion}
    >
      {toChildren(html)}
    </TextEngine>
  );
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const HeadingFX = {
  get enabled() {
    return !reduced();
  },
  mount(el) {
    if (!this.enabled || roots.has(el)) return;
    const html = el.innerHTML;
    el.textContent = "";
    render(el, html);
  },
  set(el, html) {
    if (!this.enabled) {
      el.innerHTML = html;
      return;
    }
    if (!roots.has(el)) el.textContent = "";
    render(el, html);
  },
  scan(root = document) {
    root.querySelectorAll("h1, h2, h3, h4, h5, h6, [data-fx]").forEach((el) => {
      if (!el.closest("[data-no-fx]")) this.mount(el);
    });
  },
  isMounted(el) {
    return roots.has(el);
  },
};

window.HeadingFX = HeadingFX;
document.dispatchEvent(new Event("headingfx:ready"));
