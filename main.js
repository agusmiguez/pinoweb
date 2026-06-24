/* Tienda Pino — catálogo + carrito. IIFE, classic defer. Sin backend:
   el pedido se arma client-side y se envía por WhatsApp. */
(function () {
  "use strict";

  var DATA = window.__PINO__ || {};
  var CFG = DATA.config || {};
  var PRODUCTS = DATA.productos || [];
  var CATS = DATA.categorias || [{ id: "todo", label: "Todo" }];
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var state = { cat: "todo", cart: [] }; // cart: [{id, size, qty}]
  var sel = {};                          // selección de talle por producto

  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[" + name + "]", e); } }
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var fmt = new Intl.NumberFormat("es-AR", {
    style: "currency", currency: CFG.moneda || "ARS", maximumFractionDigits: 0
  });
  function price(n) { return fmt.format(n).replace(/\s/g, " "); }
  function prodById(id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return null; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function badgeClass(b) {
    var t = (b || "").toLowerCase();
    if (/nuevo/.test(t)) return "nuevo";
    if (/limit/.test(t)) return "limitada";
    if (/sin\s*stock/.test(t)) return "sinstock";
    return "";
  }

  /* ── Splash ─────────────────────────────────────────────────────────── */
  function initSplash() {
    var s = $("[data-splash]"); if (!s) return;
    var hide = function () {
      if (s.classList.contains("is-out")) return;
      s.classList.add("is-out");
      setTimeout(function () { s.classList.add("is-gone"); }, 800);
    };
    if (document.readyState === "complete") setTimeout(hide, 450);
    else window.addEventListener("load", function () { setTimeout(hide, 300); });
    setTimeout(hide, 4000);
  }

  /* ── Tabs (desktop + mobile) ────────────────────────────────────────── */
  function buildTabs() {
    var desk = $("[data-tabs]"), mob = $("[data-tabs-mobile]");
    function make(container) {
      if (!container) return;
      container.innerHTML = CATS.map(function (c) {
        return '<button class="tab' + (c.id === state.cat ? " is-active" : "") +
          '" data-cat="' + c.id + '">' + esc(c.label) + "</button>";
      }).join("");
    }
    make(desk); make(mob);
    $all("[data-cat]").forEach(function (btn) {
      btn.addEventListener("click", function () { setCat(btn.getAttribute("data-cat")); });
    });
  }
  function setCat(cat) {
    state.cat = cat;
    $all("[data-cat]").forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-cat") === cat); });
    renderGrid();
  }

  /* ── Grid de productos ──────────────────────────────────────────────── */
  function renderGrid() {
    var grid = $("[data-grid]"), empty = $("[data-empty]");
    if (!grid) return;
    var list = PRODUCTS.filter(function (p) { return state.cat === "todo" || p.cat === state.cat; });
    if (empty) empty.hidden = list.length > 0;

    grid.innerHTML = list.map(function (p) {
      var catLabel = (CATS.filter(function (c) { return c.id === p.cat; })[0] || {}).label || "";
      var soldOut = /sin\s*stock/i.test(p.badge || "");
      var sizes = (p.sizes && p.sizes.length)
        ? '<div class="card-sizes" data-sizes="' + p.id + '">' +
            p.sizes.map(function (s) { return '<button class="size" data-size="' + esc(s) + '">' + esc(s) + "</button>"; }).join("") +
          "</div><p class=\"size-hint\" data-hint=\"" + p.id + "\">Elegí un talle primero.</p>"
        : "";
      var badge = p.badge ? '<span class="badge ' + badgeClass(p.badge) + '">' + esc(p.badge) + "</span>" : "";
      return '' +
        '<article class="card" data-card="' + p.id + '">' +
          '<div class="card-media">' + badge +
            '<img src="' + p.img + '" alt="' + esc(p.name) + '" loading="lazy" />' +
          '</div>' +
          '<div class="card-body">' +
            '<span class="card-cat">' + esc(catLabel) + "</span>" +
            '<h3 class="card-name">' + esc(p.name) + "</h3>" +
            '<p class="card-desc">' + esc(p.desc || "") + "</p>" +
            sizes +
            '<div class="card-foot">' +
              '<span class="price">' + price(p.precio) + "</span>" +
              (soldOut
                ? '<button class="add-btn" disabled>Sin stock</button>'
                : '<button class="add-btn" data-add="' + p.id + '">Agregar +</button>') +
            "</div>" +
          "</div>" +
        "</article>";
    }).join("");

    bindCards();
    revealCards();
  }

  function bindCards() {
    $all("[data-sizes]").forEach(function (box) {
      var id = box.getAttribute("data-sizes");
      $all(".size", box).forEach(function (b) {
        b.addEventListener("click", function () {
          $all(".size", box).forEach(function (x) { x.classList.remove("is-sel"); });
          b.classList.add("is-sel"); sel[id] = b.getAttribute("data-size");
          var hint = $('[data-hint="' + id + '"]'); if (hint) hint.classList.remove("show");
        });
      });
    });
    $all("[data-add]").forEach(function (btn) {
      btn.addEventListener("click", function () { addToCart(btn.getAttribute("data-add"), btn); });
    });
  }

  function revealCards() {
    var cards = $all(".card");
    if (!("IntersectionObserver" in window)) { cards.forEach(function (c) { c.classList.add("is-visible"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
    }, { threshold: 0.04, rootMargin: "0px 0px -2% 0px" });
    cards.forEach(function (c) { io.observe(c); });
    setTimeout(function () { $all(".card:not(.is-visible)").forEach(function (c) { c.classList.add("is-visible"); }); }, 6000);
  }

  /* ── Carrito ────────────────────────────────────────────────────────── */
  function addToCart(id, btn) {
    var p = prodById(id); if (!p) return;
    var size = (p.sizes && p.sizes.length) ? sel[id] : "";
    if (p.sizes && p.sizes.length && !size) {
      var hint = $('[data-hint="' + id + '"]'); if (hint) hint.classList.add("show");
      return;
    }
    var line = state.cart.filter(function (l) { return l.id === id && l.size === size; })[0];
    if (line) line.qty += 1;
    else state.cart.push({ id: id, size: size, qty: 1 });

    if (btn) { btn.textContent = "Agregado ✓"; btn.classList.add("added"); setTimeout(function () { btn.textContent = "Agregar +"; btn.classList.remove("added"); }, 1100); }
    renderCart(); openCart();
  }

  function changeQty(id, size, delta) {
    var line = state.cart.filter(function (l) { return l.id === id && l.size === size; })[0];
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) state.cart = state.cart.filter(function (l) { return l !== line; });
    renderCart();
  }
  function removeLine(id, size) {
    state.cart = state.cart.filter(function (l) { return !(l.id === id && l.size === size); });
    renderCart();
  }
  function cartTotal() {
    return state.cart.reduce(function (sum, l) { var p = prodById(l.id); return sum + (p ? p.precio * l.qty : 0); }, 0);
  }
  function cartCount() { return state.cart.reduce(function (n, l) { return n + l.qty; }, 0); }

  function renderCart() {
    var wrap = $("[data-cart-items]"), empty = $("[data-cart-empty]"), foot = $("[data-cart-foot]");
    var count = cartCount();
    var badge = $("[data-cart-count]");
    if (badge) { badge.textContent = count; badge.classList.toggle("has-items", count > 0); }

    if (!state.cart.length) {
      if (wrap) wrap.innerHTML = "";
      if (empty) empty.style.display = "";
      if (foot) foot.hidden = true;
      return;
    }
    if (empty) empty.style.display = "none";
    if (foot) foot.hidden = false;

    if (wrap) wrap.innerHTML = state.cart.map(function (l) {
      var p = prodById(l.id); if (!p) return "";
      return '' +
        '<div class="ci">' +
          '<img class="ci-img" src="' + p.img + '" alt="" />' +
          '<div class="ci-info">' +
            '<div class="ci-name">' + esc(p.name) + "</div>" +
            '<div class="ci-meta">' + (l.size ? "Talle " + esc(l.size) + " · " : "") + price(p.precio) + "</div>" +
            '<div class="ci-price">' + price(p.precio * l.qty) + "</div>" +
            '<button class="ci-remove" data-rm="' + p.id + '|' + esc(l.size) + '">Quitar</button>' +
          "</div>" +
          '<div class="ci-qty">' +
            '<button class="qty-btn" data-dec="' + p.id + '|' + esc(l.size) + '">−</button>' +
            "<span>" + l.qty + "</span>" +
            '<button class="qty-btn" data-inc="' + p.id + '|' + esc(l.size) + '">+</button>' +
          "</div>" +
        "</div>";
    }).join("");

    var totalEl = $("[data-cart-total]"); if (totalEl) totalEl.textContent = price(cartTotal());

    $all("[data-inc]").forEach(function (b) { var k = b.getAttribute("data-inc").split("|"); b.onclick = function () { changeQty(k[0], k[1], 1); }; });
    $all("[data-dec]").forEach(function (b) { var k = b.getAttribute("data-dec").split("|"); b.onclick = function () { changeQty(k[0], k[1], -1); }; });
    $all("[data-rm]").forEach(function (b) { var k = b.getAttribute("data-rm").split("|"); b.onclick = function () { removeLine(k[0], k[1]); }; });
  }

  /* ── Drawer open/close ──────────────────────────────────────────────── */
  function openCart() {
    var c = $("[data-cart]"), ov = $("[data-cart-overlay]");
    if (ov) { ov.hidden = false; requestAnimationFrame(function () { ov.classList.add("show"); }); }
    if (c) { c.classList.add("is-open"); c.setAttribute("aria-hidden", "false"); }
    document.body.style.overflow = "hidden";
  }
  function closeCart() {
    var c = $("[data-cart]"), ov = $("[data-cart-overlay]");
    if (c) { c.classList.remove("is-open"); c.setAttribute("aria-hidden", "true"); }
    if (ov) { ov.classList.remove("show"); setTimeout(function () { ov.hidden = true; }, 350); }
    document.body.style.overflow = "";
  }
  function initCart() {
    var open = $("[data-cart-open]"), close = $("[data-cart-close]"), ov = $("[data-cart-overlay]");
    if (open) open.addEventListener("click", openCart);
    if (close) close.addEventListener("click", closeCart);
    if (ov) ov.addEventListener("click", closeCart);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCart(); });

    var alias = $("[data-alias]"); if (alias) alias.textContent = CFG.alias || "—";
    var cbu = $("[data-cbu]"); if (cbu) cbu.textContent = CFG.cbu || "—";

    var checkout = $("[data-checkout]");
    if (checkout) checkout.addEventListener("click", sendWhatsApp);
    renderCart();
  }

  function sendWhatsApp() {
    if (!state.cart.length) return;
    var lines = state.cart.map(function (l) {
      var p = prodById(l.id);
      return "• " + p.name + (l.size ? " (Talle " + l.size + ")" : "") + " x" + l.qty + " — " + price(p.precio * l.qty);
    });
    var msg = "¡Hola Tienda Pino! Quiero hacer este pedido:\n\n" +
      lines.join("\n") + "\n\nTotal: " + price(cartTotal()) +
      "\n\n¿Coordinamos pago y entrega?";
    var url = "https://wa.me/" + (CFG.whatsapp || "") + "?text=" + encodeURIComponent(msg);
    window.open(url, "_blank", "noopener");
  }

  function initYear() { var y = $("[data-year]"); if (y) y.textContent = new Date().getFullYear(); }

  function boot() {
    safe(initSplash, "initSplash");
    safe(buildTabs, "buildTabs");
    safe(renderGrid, "renderGrid");
    safe(initCart, "initCart");
    safe(initYear, "initYear");
    if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
