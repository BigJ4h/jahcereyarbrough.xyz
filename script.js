// script.js
// script.js
// Single-screen controller for Yarbrough Group: navigation, metrics, motion guards.
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const noop = () => {};
const frame = qs(".frame");
const panels = qsa(".panel");
const navButtons = qsa(".nav-btn");
const anchorPills = qsa('.pill[href^="#"]');
const nav = qs(".nav");
const metrics = qsa(".metric");
const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
const dataQuery = matchMedia("(prefers-reduced-data: reduce)");
const coarsePointer = matchMedia("(pointer: coarse)");
const state = {
activeId: panels.find((p) => p.classList.contains("active"))?.id || panels[0]?.id,
reduceMotion: motionQuery.matches,
reduceData: dataQuery.matches,
parallaxEnabled: false,
animatedOnce: new Set(),
};
const TRANSITION_MS = 520;
const ripples = new WeakSet();
const prefersReducedMotion = () => motionQuery.matches;
const prefersReducedData = () => dataQuery.matches;
if (frame) {
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
}
function init() {
setReduceMotionClass(prefersReducedMotion());
setupLiveRegions();
setupPanels();
bindNav();
bindPills();
bindKeyboard();
prepareMetrics();
observePanels();
handleHash(location.hash);
window.addEventListener("hashchange", () => handleHash(location.hash));
lazyDecor();
motionQuery.addEventListener("change", onMotionChange);
dataQuery.addEventListener("change", onDataChange);
}
function setupPanels() {
panels.forEach((panel) => {
const isActive = panel.id === state.activeId;
panel.setAttribute("aria-hidden", String(!isActive));
if (!isActive) panel.classList.remove("active");
if (isActive) {
panel.classList.add("active");
panel.dataset.observed = "true";
requestAnimationFrame(() => panel.classList.add("entering"));
}
});
}
function setReduceMotionClass(flag) {
document.body.classList.toggle("reduce-motion", flag);
}
function setupLiveRegions() {
const live = document.createElement("div");
live.className = "visually-hidden a11y-live";
live.setAttribute("aria-live", "polite");
live.setAttribute("aria-atomic", "true");
frame?.appendChild(live);
state.liveRegion = live;
const help = document.createElement("p");
help.id = "interaction-help";
help.className = "visually-hidden help-hint";
help.textContent = "Use tab to reach navigation, left and right arrows to change panels, and escape to return home.";
frame?.appendChild(help);
nav?.setAttribute("aria-describedby", "interaction-help");
}
function bindNav() {
navButtons.forEach((btn) => {
btn.setAttribute("aria-controls", btn.dataset.target);
btn.setAttribute("aria-current", btn.dataset.target === state.activeId ? "page" : "false");
btn.addEventListener("click", (evt) => {
evt.preventDefault();
setPanel(btn.dataset.target, { updateHash: true, source: "nav" });
});
addRipple(btn);
});
}
function bindPills() {
anchorPills.forEach((pill) => {
addRipple(pill);
pill.addEventListener("click", (evt) => {
const targetId = pill.getAttribute("href")?.replace("#", "");
if (targetId && panels.some((p) => p.id === targetId)) {
evt.preventDefault();
setPanel(targetId, { updateHash: true, source: "pill" });
}
});
});
}
function bindKeyboard() {
document.addEventListener("keydown", (evt) => {
if (evt.defaultPrevented) return;
const focusable = /input|textarea|select/.test(evt.target.tagName.toLowerCase());
if (focusable) return;
if (evt.key === "ArrowRight") {
evt.preventDefault();
cyclePanel(1);
} else if (evt.key === "ArrowLeft") {
evt.preventDefault();
cyclePanel(-1);
} else if (evt.key === "Escape") {
evt.preventDefault();
setPanel("home", { updateHash: true });
}
});
}
function cyclePanel(delta) {
const ids = panels.map((p) => p.id);
const idx = ids.indexOf(state.activeId);
const next = ids[(idx + delta + ids.length) % ids.length];
setPanel(next, { updateHash: true });
}
function setPanel(targetId, opts = {}) {
const nextPanel = panels.find((panel) => panel.id === targetId);
const currentPanel = panels.find((panel) => panel.id === state.activeId);
if (!nextPanel || nextPanel === currentPanel) return false;
state.activeId = targetId;
frame?.classList.add("is-transitioning");
togglePanelState(currentPanel, nextPanel);
navButtons.forEach((btn) => {
const isActive = btn.dataset.target === targetId;
btn.classList.toggle("active", isActive);
btn.setAttribute("aria-current", isActive ? "page" : "false");
});
panels.forEach((panel) => panel.setAttribute("aria-hidden", String(panel !== nextPanel)));
nextPanel.dataset.observed = "true";
if (opts.updateHash !== false) {
history.replaceState(null, "", `#${targetId}`);
}
if (!state.reduceMotion) {
setTimeout(() => frame?.classList.remove("is-transitioning"), TRANSITION_MS);
} else {
frame?.classList.remove("is-transitioning");
}
if (!state.reduceMotion) {
requestAnimationFrame(() => nextPanel.classList.add("entering"));
} else {
nextPanel.classList.add("entering");
}
runMetricSequence(nextPanel);
focusPanel(nextPanel);
announcePanel(nextPanel);
return true;
}
function togglePanelState(currentPanel, nextPanel) {
const done = () => {
currentPanel?.classList.remove("active", "leaving", "entering");
nextPanel.classList.add("active");
nextPanel.classList.remove("leaving");
nextPanel.style.willChange = "";
currentPanel && (currentPanel.style.willChange = "");
};
if (currentPanel) {
currentPanel.classList.add("leaving");
currentPanel.style.willChange = "opacity, transform";
}
nextPanel.classList.remove("entering", "leaving");
nextPanel.style.willChange = "opacity, transform";
if (state.reduceMotion) {
done();
} else {
setTimeout(done, TRANSITION_MS);
}
}
function focusPanel(panel) {
if (!panel) return;
const target = panel.querySelector("h1, h2, h3, a, button, [tabindex]:not([tabindex='-1'])");
if (target) {
target.focus({ preventScroll: true });
} else {
panel.setAttribute("tabindex", "-1");
panel.focus({ preventScroll: true });
}
}
function announcePanel(panel) {
if (!state.liveRegion || !panel) return;
const heading = panel.querySelector("h1, h2, h3");
const text = heading?.textContent?.trim() || panel.id;
state.liveRegion.textContent = `View switched to ${text}`;
}
function prepareMetrics() {
metrics.forEach((metric) => {
const valueEl = metric.querySelector(".value");
if (!valueEl) return;
const numericText = valueEl.textContent || "";
const numericValue = Number.parseFloat(numericText);
metric.dataset.targetValue = Number.isFinite(numericValue) ? numericValue : (Number(metric.dataset.max) || 0);
metric.dataset.initialized = "false";
const unitSpan = valueEl.querySelector("span");
metric.dataset.unit = metric.dataset.unit || unitSpan?.textContent?.trim() || "";
const min = Number(metric.dataset.min) || 0;
valueEl.childNodes[0].textContent = `${min}`;
if (unitSpan) unitSpan.textContent = metric.dataset.unit;
const fill = metric.querySelector(".fill");
if (fill) fill.style.transform = "scaleX(0)";
});
}
function runMetricSequence(panel) {
if (!panel) return;
const panelMetrics = qsa(".metric", panel);
if (!panelMetrics.length) return;
panelMetrics.forEach((metric) => animateMetric(metric));
}
function animateMetric(metric) {
const valueEl = metric.querySelector(".value");
const fill = metric.querySelector(".fill");
if (!valueEl || !fill) return;
const min = Number(metric.dataset.min) || 0;
const max = Number(metric.dataset.max) || min;
const target = Number(metric.dataset.targetValue) || max;
const unit = metric.dataset.unit || "";
const duration = state.reduceMotion || state.reduceData ? 0 : 820;
const start = performance.now();
const update = (now) => {
const progress = duration ? Math.min(1, (now - start) / duration) : 1;
const eased = duration ? easeOutCubic(progress) : 1;
const current = min + (target - min) * eased;
valueEl.childNodes[0].textContent = formatValue(current, unit);
fill.style.transform = `scaleX(${normalize(current, min, max)})`;
if (duration && progress < 1) {
requestAnimationFrame(update);
} else {
announceMetric(metric, current, unit);
}
};
requestAnimationFrame(update);
}
function formatValue(value, unit) {
if (unit === "%") return value.toFixed(2);
if (unit === "ms") return Math.round(value).toString();
if (unit.includes("/")) return Math.round(value).toString();
return value.toFixed(1);
}
function normalize(value, min, max) {
if (max === min) return 1;
return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
function announceMetric(metric, value, unit) {
if (!state.liveRegion) return;
const label = metric.dataset.label || metric.querySelector(".label")?.textContent?.trim() || "Metric";
state.liveRegion.textContent = `${label}: ${formatValue(value, unit)} ${unit}`;
}
function observePanels() {
const viewport = qs(".viewport") || frame;
if (!viewport || typeof IntersectionObserver === "undefined") return;
const observer = new IntersectionObserver(
(entries) => {
entries.forEach((entry) => {
if (entry.isIntersecting) {
entry.target.dataset.observed = "true";
observer.unobserve(entry.target);
}
});
},
{ root: viewport, threshold: 0.3 }
);
panels.forEach((panel) => observer.observe(panel));
}
function handleHash(hash) {
if (!hash) return;
const id = hash.replace("#", "");
if (panels.some((panel) => panel.id === id)) {
setPanel(id, { updateHash: false });
}
}
function lazyDecor() {
const idle = window.requestIdleCallback || ((cb) => setTimeout(() => cb({ didTimeout: false }), 200));
idle(() => {
document.body.classList.add("grain-ready");
enableParallaxIfAppropriate();
});
}
function enableParallaxIfAppropriate() {
if (!frame) return;
const allow = !state.reduceMotion && !state.reduceData && !coarsePointer.matches && window.innerWidth >= 1024;
if (!allow) {
disableParallax();
return;
}
if (state.parallaxEnabled) return;
state.parallaxEnabled = true;
frame.dataset.parallax = "on";
frame.addEventListener("pointermove", onPointerMove);
frame.addEventListener("pointerleave", resetParallax);
}
function disableParallax() {
if (!state.parallaxEnabled || !frame) return;
state.parallaxEnabled = false;
frame.removeAttribute("data-parallax");
frame.style.transform = "";
frame.style.boxShadow = "";
frame.removeEventListener("pointermove", onPointerMove);
frame.removeEventListener("pointerleave", resetParallax);
}
const parallaxState = { raf: null, tiltX: 0, tiltY: 0 };
function onPointerMove(evt) {
const rect = frame.getBoundingClientRect();
const relX = (evt.clientX - rect.left) / rect.width - 0.5;
const relY = (evt.clientY - rect.top) / rect.height - 0.5;
parallaxState.tiltX = relY * -6;
parallaxState.tiltY = relX * 6;
if (!parallaxState.raf) {
parallaxState.raf = requestAnimationFrame(applyParallax);
}
}
function applyParallax() {
parallaxState.raf = null;
frame.style.transform = `perspective(1200px) rotateX(${parallaxState.tiltX}deg) rotateY(${parallaxState.tiltY}deg)`;
frame.style.boxShadow = `0 ${30 - parallaxState.tiltX * 2}px ${80 + parallaxState.tiltY * 2}px rgba(0,0,0,0.6)`;
}
function resetParallax() {
frame.style.transform = "";
frame.style.boxShadow = "";
}
function addRipple(el) {
if (ripples.has(el)) return;
ripples.add(el);
el.addEventListener("pointerdown", (evt) => {
const rect = el.getBoundingClientRect();
const x = ((evt.clientX - rect.left) / rect.width) * 100;
const y = ((evt.clientY - rect.top) / rect.height) * 100;
el.style.setProperty("--ripple-x", `${x}%`);
el.style.setProperty("--ripple-y", `${y}%`);
});
}
function onMotionChange(event) {
state.reduceMotion = event.matches;
setReduceMotionClass(event.matches);
if (event.matches) {
disableParallax();
} else {
enableParallaxIfAppropriate();
}
}
function onDataChange(event) {
state.reduceData = event.matches;
if (event.matches) {
disableParallax();
} else {
enableParallaxIfAppropriate();
}
}
function easeOutCubic(t) {
return 1 - Math.pow(1 - t, 3);
}
