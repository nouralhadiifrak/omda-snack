/*
 * "Fade Letters" for every heading (h1–h6), driven by spring-text-engine.
 * Bundled with React + @react-spring/web into js/vendor/headings.js (see tools/headings).
 *
 * window.HeadingFX.mount(el)        animate an existing heading's current content
 * window.HeadingFX.set(el, html)    replace a heading's content (and replay the fade)
 * window.HeadingFX.scan(root)       mount every heading inside root that isn't mounted yet
 */
import React from "react";
import { createRoot } from "react-dom/client";
import TextEngine from "spring-text-engine";

const roots = new WeakMap();
let version = 0;

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

function render(el, html) {
  let root = roots.get(el);
  if (!root) {
    root = createRoot(el);
    roots.set(el, root);
  }
  const arabic = document.documentElement.lang === "ar";
  const centered = getComputedStyle(el).textAlign === "center";
  // Arabic letters join to their neighbours; splitting them into separate
  // boxes would break the script, so Arabic fades word by word instead.
  const motion = arabic
    ? { wordOut: { opacity: 0 }, wordIn: { opacity: 1 }, wordConfig: { tension: 294, friction: 34 }, wordStagger: 90 }
    : { letterOut: { opacity: 0 }, letterIn: { opacity: 1 }, letterConfig: { tension: 294, friction: 34 }, letterStagger: 24 };
  root.render(
    <TextEngine
      key={++version}
      tag="span"
      mode="once"
      className="te-root"
      style={centered ? { justifyContent: "center" } : undefined}
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
    root.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => {
      if (!el.closest("[data-no-fx]")) this.mount(el);
    });
  },
  isMounted(el) {
    return roots.has(el);
  },
};

window.HeadingFX = HeadingFX;
document.dispatchEvent(new Event("headingfx:ready"));
