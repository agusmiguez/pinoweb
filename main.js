/* Tienda Pino — catálogo dinámico (Excel via /api/catalogo) + carrito + panel admin
   (/api/admin-data). IIFE + delegación de eventos. Sin módulos. */
(function () {
  "use strict";

  var DATA = window.__PINO__ || {};
  var CFG = DATA.config || {};
  var CATS = DATA.categorias || [{ id: "todo", label: "Todo" }];
  var BADGE_CLS = { "Nuevo": "b-green", "Más vendido": "b-blue", "Limitado": "b-orange", "Últimos": "b-red", "Hot": "b-orange", "Agotado": "b-red" };
  var CAT_ICONS = { prendas: "👕", gorras: "🧢", mates: "🧉", accesorios: "🎒" };

  var PRODUCTS = [], STOCK = [], cart = [], adminEdits = {};
  var activeCat = "todo";
  var adminLoggedIn = false, adminPass = "";
  var curTags = [], curImgs = [], curEditId = "";

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var fmt = function (n) { return "$" + new Intl.NumberFormat("es-AR").format(n || 0); };

  function guessCat(name) {
    var n = (name || "").toLowerCase();
    if (n.indexOf("gorra") >= 0 || n.indexOf("bucket") >= 0 || n.indexOf("cap") >= 0) return "gorras";
    if (n.indexOf("mate") >= 0 || n.indexOf("bombilla") >= 0 || n.indexOf("termo") >= 0) return "mates";
    if (n.indexOf("riñon") >= 0 || n.indexOf("bolso") >= 0 || n.indexOf("mochil") >= 0 || n.indexOf("sticker") >= 0) return "accesorios";
    return "prendas";
  }
  function getDisp(key, talle) {
    var s = STOCK.find(function (x) { return x.producto.toLowerCase() === key.toLowerCase() && x.talle === talle; });
    return s ? s.stock_inicio - s.vendidos : null;
  }
  function getTotalDisp(key) {
    return STOCK.filter(function (x) { return x.producto.toLowerCase() === key.toLowerCase(); })
      .reduce(function (a, s) { return a + (s.stock_inicio - s.vendidos); }, 0);
  }
  function hasStock(key) { return STOCK.some(function (x) { return x.producto.toLowerCase() === key.toLowerCase(); }); }
  function firstImg(img) { return Array.isArray(img) ? img[0] : img; }

  function toast(msg, type) {
    var w = $("[data-toasts]"); if (!w) return;
    var t = document.createElement("div");
    t.className = "toast " + (type === "err" ? "err" : "ok");
    t.textContent = msg;
    w.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.remove(); }, 300); }, 2600);
  }

  /* ── API ────────────────────────────────────────────────────────────── */
  function fetchAdminData() {
    return fetch("/api/admin-data")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.ok && j.data) adminEdits = j.data; })
      .catch(function (e) { console.warn("admin-data:", e.message); });
  }
  // Sube al Blob cualquier imagen base64 que quede en adminEdits y la reemplaza por su URL.
  // Evita que el JSON de admin-data se infle con fotos (rompía el límite de tamaño).
  function migrateBase64Images() {
    var jobs = [];
    Object.keys(adminEdits).forEach(function (key) {
      var e = adminEdits[key];
      if (!e || !e.img) return;
      if (Array.isArray(e.img)) {
        e.img.forEach(function (im, idx) {
          if (typeof im === "string" && im.indexOf("data:image/") === 0) {
            jobs.push(uploadImage(im).then(function (url) { e.img[idx] = url; }));
          }
        });
      } else if (typeof e.img === "string" && e.img.indexOf("data:image/") === 0) {
        jobs.push(uploadImage(e.img).then(function (url) { e.img = url; }));
      }
    });
    return Promise.all(jobs);
  }

  function pushAdminData() {
    return migrateBase64Images().then(function () {
      return fetch("/api/admin-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pass: adminPass, data: adminEdits })
      }).then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); });
    });
  }

  var lastSource = null; // "excel" | "cache"
  function loadCatalog(force) {
    var grid = $("[data-grid]");
    if (grid) grid.innerHTML = '<div class="loading"><div class="sp"></div><div>Cargando catálogo…</div></div>';
    // Si force=true, agrego un query único para saltarme el cache del CDN
    var url = "/api/catalogo" + (force ? ("?fresh=" + Date.now()) : "");
    var catP = fetch(url, force ? { cache: "no-store" } : {}).then(function (r) { if (!r.ok) throw new Error("Error " + r.status); return r.json(); });
    return Promise.all([fetchAdminData(), catP])
      .then(function (arr) {
        var data = arr[1];
        if (!data.ok) throw new Error(data.error || "Error desconocido");
        lastSource = data.source || null;
        STOCK = data.stock || [];
        PRODUCTS = (data.products || []).map(function (p, i) {
          var key = p.name;
          var edit = adminEdits[key] || {};
          var hasEdit = Object.prototype.hasOwnProperty.call(adminEdits, key);
          var cat = edit.cat || guessCat(p.name);
          var sizes = edit.sizes || (function () {
            var set = [];
            STOCK.forEach(function (s) {
              if (s.producto.toLowerCase() === key.toLowerCase() && s.talle !== "Único" && set.indexOf(s.talle) < 0) set.push(s.talle);
            });
            return set;
          })();
          return {
            id: i + 1, excelKey: key,
            name: edit.name || p.name, cat: cat,
            description: edit.description || "",
            price: edit.price || p.price || 0,
            cost: p.cost || 0,
            sizes: sizes,
            badge: edit.badge || null,
            img: edit.img || null,
            hidden: hasEdit ? (edit.hidden === true) : true
          };
        });
        renderGrid();
        if (adminLoggedIn) { renderDash(); renderProds(); renderStock(""); }
      })
      .catch(function (e) {
        if (grid) grid.innerHTML = '<div class="empty"><div class="ei">⚠️</div>No se pudo cargar el catálogo.<br><small>' +
          esc(e.message) + '</small><br><button class="btn btn-primary sm" data-act="reload" style="margin-top:14px">Reintentar</button></div>';
      });
  }

  // Botón "Actualizar desde Excel" del panel admin
  function refreshFromExcel() {
    var btn = $("[data-refresh-excel]");
    if (btn) { btn.disabled = true; btn.textContent = "Actualizando…"; }
    loadCatalog(true).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = "🔄 Actualizar desde Excel"; }
      if (lastSource === "excel") {
        toast("✓ Datos actualizados desde el Excel", "ok");
      } else if (lastSource === "cache") {
        toast("⚠️ Mostrando copia guardada. El token de Microsoft venció — renovalo.", "err");
      } else {
        toast("Datos recargados", "ok");
      }
    });
  }

  /* ── Tabs ───────────────────────────────────────────────────────────── */
  function renderTabs() {
    var html = CATS.map(function (c) {
      return '<button class="tab' + (c.id === activeCat ? " is-active" : "") + '" data-act="tab" data-cat="' + c.id + '">' + esc(c.label) + "</button>";
    }).join("");
    var d = $("[data-tabs]"), m = $("[data-tabs-mobile]");
    if (d) d.innerHTML = html;
    if (m) m.innerHTML = html;
  }
  function setCat(cat) {
    activeCat = cat;
    $all("[data-act='tab']").forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-cat") === cat); });
    renderGrid();
  }

  /* ── Catálogo ───────────────────────────────────────────────────────── */
  function renderGrid() {
    var grid = $("[data-grid]"); if (!grid) return;
    var visible = PRODUCTS.filter(function (p) { return !p.hidden && (activeCat === "todo" || p.cat === activeCat); });
    if (!visible.length) { grid.innerHTML = '<div class="empty"><div class="ei">📦</div>No hay productos en esta categoría todavía.</div>'; return; }

    // Categorías a mostrar como secciones (en "todo" todas; si hay tab, solo esa)
    var cats = CATS.filter(function (c) { return c.id !== "todo"; })
      .filter(function (c) { return activeCat === "todo" || c.id === activeCat; });

    grid.innerHTML = cats.map(function (c) {
      var items = visible.filter(function (p) { return p.cat === c.id; });
      if (!items.length) return "";
      var head = activeCat === "todo" ? '<h2 class="cat-title">' + esc(c.label) + "</h2>" : "";
      return '<section class="cat-block">' + head +
        '<div class="product-grid">' + items.map(cardHTML).join("") + "</div></section>";
    }).join("");
    revealCards();
  }

  function setCarousel(id, idx) {
    var car = document.querySelector('.carousel[data-id="' + id + '"]');
    if (!car) return;
    var len = parseInt(car.getAttribute("data-len"), 10);
    if (idx < 0) idx = len - 1;
    if (idx >= len) idx = 0;
    car.setAttribute("data-idx", idx);
    car.querySelectorAll(".cslide").forEach(function (s, i) { s.classList.toggle("is-active", i === idx); });
    car.querySelectorAll(".cdot").forEach(function (d, i) { d.classList.toggle("is-active", i === idx); });
  }
  function moveCarousel(id, dir) {
    var car = document.querySelector('.carousel[data-id="' + id + '"]');
    if (!car) return;
    var idx = parseInt(car.getAttribute("data-idx"), 10) || 0;
    setCarousel(id, idx + dir);
  }

  function cardHTML(p) {
      var catLabel = (CATS.filter(function (c) { return c.id === p.cat; })[0] || {}).label || "";
      var total = getTotalDisp(p.excelKey);
      var hs = hasStock(p.excelKey);
      var soldOut = hs && total === 0;

      var imgs = Array.isArray(p.img) ? p.img.slice() : (p.img ? [p.img] : []);
      imgs = imgs.filter(function (u) { return u; });
      var media = imgs.length
        ? '<img src="' + esc(imgs[0]) + '" alt="' + esc(p.name) + '" loading="lazy" />'
        : '<div class="card-logo"><img src="assets/img/logo.svg" alt="" /></div>';
      // Contador de fotos si hay más de una
      var imgCount = imgs.length > 1 ? '<span class="img-count">📷 ' + imgs.length + '</span>' : "";
      var badge = p.badge ? '<span class="badge ' + (BADGE_CLS[p.badge] || "b-green") + '">' + esc(p.badge) + "</span>" : "";
      var soldBadge = soldOut ? '<span class="badge b-out card-soldout">Sin stock</span>' : "";

      // Toda la card lleva al detalle
      return '<article class="card card-clickable" data-act="open-product" data-id="' + p.id + '">' +
        '<div class="card-media">' + badge + soldBadge + imgCount + media + "</div>" +
        '<div class="card-body">' +
          '<span class="card-cat">' + esc(catLabel) + "</span>" +
          '<h3 class="card-name">' + esc(p.name) + "</h3>" +
          '<div class="card-foot"><span class="price">' + fmt(p.price) + "</span>" +
            '<span class="card-more">Ver más →</span>' +
          "</div>" +
        "</div>" +
      "</article>";
  }

  // ── Página de detalle del producto ──
  function openProduct(id) {
    var p = PRODUCTS.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var catLabel = (CATS.filter(function (c) { return c.id === p.cat; })[0] || {}).label || "";
    var total = getTotalDisp(p.excelKey);
    var hs = hasStock(p.excelKey);
    var soldOut = hs && total === 0;
    var dotCls = "d-ok", stockTxt = "";
    if (hs && total === 0) { dotCls = "d-out"; stockTxt = "Sin stock"; }
    else if (hs && total <= 3) { dotCls = "d-low"; stockTxt = "¡Últimas " + total + " unidades!"; }
    else if (hs) { stockTxt = total + " disponibles"; }

    var imgs = Array.isArray(p.img) ? p.img.slice() : (p.img ? [p.img] : []);
    imgs = imgs.filter(function (u) { return u; });

    // Galería: imagen principal grande + miniaturas
    var gallery;
    if (imgs.length) {
      var mainImg = '<div class="pd-main"><img src="' + esc(imgs[0]) + '" alt="' + esc(p.name) + '" data-pd-main />' +
        (p.badge ? '<span class="badge ' + (BADGE_CLS[p.badge] || "b-green") + '">' + esc(p.badge) + "</span>" : "") + '</div>';
      var thumbs = imgs.length > 1
        ? '<div class="pd-thumbs">' + imgs.map(function (u, i) {
            return '<button class="pd-thumb' + (i === 0 ? " is-active" : "") + '" data-act="pd-thumb" data-src="' + esc(u) + '"><img src="' + esc(u) + '" alt="" /></button>';
          }).join("") + '</div>'
        : "";
      gallery = '<div class="pd-gallery">' + mainImg + thumbs + '</div>';
    } else {
      gallery = '<div class="pd-gallery"><div class="pd-main pd-nologo"><img src="assets/img/logo.svg" alt="" /></div></div>';
    }

    // Selector de talles
    var sizes = "";
    if (p.sizes && p.sizes.length) {
      sizes = '<div class="pd-sizes-lbl">Talle</div><div class="pd-sizes" data-pd-sizes>' + p.sizes.map(function (s) {
        var d = getDisp(p.excelKey, s);
        var out = (d !== null && d <= 0);
        return '<button class="pd-size' + (out ? " out" : "") + '"' + (out ? " disabled" : ' data-act="pd-size"') + ' data-size="' + esc(s) + '">' + esc(s) + "</button>";
      }).join("") + '</div><p class="pd-size-hint" data-pd-hint></p>';
    }

    var html =
      gallery +
      '<div class="pd-info">' +
        '<span class="pd-cat">' + esc(catLabel) + "</span>" +
        '<h1 class="pd-name">' + esc(p.name) + "</h1>" +
        '<div class="pd-price">' + fmt(p.price) + "</div>" +
        (stockTxt ? '<div class="stock-row"><span class="stock-dot ' + dotCls + '"></span>' + stockTxt + "</div>" : "") +
        (p.description ? '<p class="pd-desc">' + esc(p.description) + "</p>" : '<p class="pd-desc pd-desc-empty">Consultanos por más info de este producto.</p>') +
        sizes +
        '<div class="pd-actions">' +
          (soldOut
            ? '<button class="btn btn-primary pd-add" disabled>Sin stock</button>'
            : '<button class="btn btn-primary pd-add" data-act="pd-add" data-id="' + p.id + '">Agregar al pedido +</button>') +
        "</div>" +
      "</div>";

    var box = $("[data-product-detail]");
    if (box) box.innerHTML = html;
    pdSelectedSize = null;
    pdCurrentId = id;

    // Mostrar la página, ocultar el resto
    var main = $("#top"); if (main) main.hidden = true;
    var ftr = document.querySelector(".footer"); if (ftr) ftr.style.display = "none";
    var pp = $("[data-product-page]"); if (pp) pp.hidden = false;
    // URL con hash para poder compartir/volver
    if (location.hash !== "#p" + id) history.pushState({ product: id }, "", "#p" + id);
    window.scrollTo(0, 0);
  }

  function closeProduct() {
    var pp = $("[data-product-page]"); if (pp) pp.hidden = true;
    var main = $("#top"); if (main) main.hidden = false;
    var ftr = document.querySelector(".footer"); if (ftr) ftr.style.display = "";
    pdCurrentId = null;
    if (location.hash.indexOf("#p") === 0) history.pushState({}, "", location.pathname);
    window.scrollTo(0, 0);
  }

  var pdSelectedSize = null;
  var pdCurrentId = null;

  function pdSelectSize(btn) {
    $all(".pd-size").forEach(function (b) { b.classList.remove("is-sel"); });
    btn.classList.add("is-sel");
    pdSelectedSize = btn.getAttribute("data-size");
    var hint = $("[data-pd-hint]"); if (hint) hint.textContent = "";
  }

  function pdSetMainImg(src, btn) {
    var main = $("[data-pd-main]"); if (main) main.src = src;
    $all(".pd-thumb").forEach(function (b) { b.classList.remove("is-active"); });
    if (btn) btn.classList.add("is-active");
  }

  function pdAdd(id) {
    var p = PRODUCTS.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var multi = p.sizes && p.sizes.filter(function (s) { var d = getDisp(p.excelKey, s); return !(d !== null && d <= 0); }).length > 1;
    if (multi && !pdSelectedSize) {
      var hint = $("[data-pd-hint]"); if (hint) hint.textContent = "⚠️ Elegí un talle primero.";
      $all(".pd-size:not(.out)").forEach(function (b) { b.style.borderColor = "#f0a500"; setTimeout(function () { b.style.borderColor = ""; }, 900); });
      return;
    }
    var size = pdSelectedSize || (p.sizes && p.sizes[0]) || "Único";
    addToCartSized(p, size);
    toast("✓ " + p.name + (size !== "Único" ? " (" + size + ")" : "") + " agregado", "ok");
  }
  function revealCards() {
    var cards = $all(".card");
    if (!("IntersectionObserver" in window)) { cards.forEach(function (c) { c.classList.add("is-visible"); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
    }, { threshold: 0.04, rootMargin: "0px 0px -2% 0px" });
    cards.forEach(function (c) { io.observe(c); });
    setTimeout(function () { $all(".card:not(.is-visible)").forEach(function (c) { c.classList.add("is-visible"); }); }, 6000);
  }

  /* ── Carrito ────────────────────────────────────────────────────────── */
  function addToCart(id) {
    var p = PRODUCTS.find(function (x) { return x.id === id; }); if (!p) return;
    var card = $('.card[data-id="' + id + '"]');
    var size = "Único";
    if (p.sizes && p.sizes.length) {
      var selBtn = card && $(".size.is-sel", card);
      if (!selBtn) {
        var hint = card && $("[data-hint]", card);
        if (hint) hint.classList.add("show");
        return;
      }
      size = selBtn.getAttribute("data-size");
    }
    var d = getDisp(p.excelKey, size);
    if (d !== null && d <= 0) { toast("Sin stock para ese talle", "err"); return; }

    var key = p.id + "_" + size;
    var line = cart.find(function (l) { return l.key === key; });
    if (line) line.qty += 1;
    else cart.push({ key: key, id: p.id, size: size, qty: 1 });
    renderCart(); openCart();
    toast("✓ " + p.name + (size !== "Único" ? " (" + size + ")" : "") + " agregado", "ok");
  }
  // Agrega directamente con talle ya elegido (usado desde la página de detalle)
  function addToCartSized(p, size) {
    var d = getDisp(p.excelKey, size);
    if (d !== null && d <= 0) { toast("Sin stock para ese talle", "err"); return; }
    var key = p.id + "_" + size;
    var line = cart.find(function (l) { return l.key === key; });
    if (line) line.qty += 1;
    else cart.push({ key: key, id: p.id, size: size, qty: 1 });
    renderCart(); openCart();
  }
  function changeQty(key, delta) {
    var line = cart.find(function (l) { return l.key === key; }); if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) cart = cart.filter(function (l) { return l !== line; });
    renderCart();
  }
  function removeLine(key) { cart = cart.filter(function (l) { return l.key !== key; }); renderCart(); }
  function cartTotal() { return cart.reduce(function (s, l) { var p = PRODUCTS.find(function (x) { return x.id === l.id; }); return s + (p ? p.price * l.qty : 0); }, 0); }
  function cartCount() { return cart.reduce(function (n, l) { return n + l.qty; }, 0); }

  function renderCart() {
    var wrap = $("[data-cart-items]"), empty = $("[data-cart-empty]"), foot = $("[data-cart-foot]");
    var count = cartCount(), badge = $("[data-cart-count]");
    if (badge) { badge.textContent = count; badge.classList.toggle("has-items", count > 0); }
    if (!cart.length) { if (wrap) wrap.innerHTML = ""; if (empty) empty.style.display = ""; if (foot) foot.hidden = true; return; }
    if (empty) empty.style.display = "none";
    if (foot) foot.hidden = false;
    if (wrap) wrap.innerHTML = cart.map(function (l) {
      var p = PRODUCTS.find(function (x) { return x.id === l.id; }); if (!p) return "";
      var img = firstImg(p.img);
      var thumb = img ? '<img src="' + esc(img) + '" alt="" />' : '<div class="ci-logo"><img src="assets/img/logo.svg" alt=""/></div>';
      return '<div class="ci"><div class="ci-thumb">' + thumb + "</div>" +
        '<div class="ci-info"><div class="ci-name">' + esc(p.name) + "</div>" +
        '<div class="ci-meta">' + (l.size !== "Único" ? "Talle " + esc(l.size) + " · " : "") + fmt(p.price) + "</div>" +
        '<div class="ci-price">' + fmt(p.price * l.qty) + "</div>" +
        '<button class="ci-remove" data-act="cart-rm" data-key="' + l.key + '">Quitar</button></div>' +
        '<div class="ci-qty"><button class="qty-btn" data-act="qty-dec" data-key="' + l.key + '">−</button>' +
        "<span>" + l.qty + "</span><button class=\"qty-btn\" data-act=\"qty-inc\" data-key=\"" + l.key + "\">+</button></div></div>";
    }).join("");
    var totalEl = $("[data-cart-total]"); if (totalEl) totalEl.textContent = fmt(cartTotal());
  }

  function openCart() { var c = $("[data-cart]"), o = $("[data-cart-overlay]"); if (o) { o.hidden = false; requestAnimationFrame(function () { o.classList.add("show"); }); } if (c) { c.classList.add("is-open"); c.setAttribute("aria-hidden", "false"); } document.body.style.overflow = "hidden"; }
  function closeCart() { var c = $("[data-cart]"), o = $("[data-cart-overlay]"); if (c) { c.classList.remove("is-open"); c.setAttribute("aria-hidden", "true"); } if (o) { o.classList.remove("show"); setTimeout(function () { o.hidden = true; }, 350); } document.body.style.overflow = ""; }

  function renderCheckout() {
    var wrap = $("[data-checkout-items]");
    if (wrap) wrap.innerHTML = cart.map(function (l) {
      var p = PRODUCTS.find(function (x) { return x.id === l.id; }); if (!p) return "";
      var sz = l.size !== "Único" ? " · Talle " + esc(l.size) : "";
      var img = firstImg(p.img);
      var thumb = img ? '<img class="co-thumb" src="' + esc(img) + '" alt="" />'
                      : '<div class="co-thumb co-logo"><img src="assets/img/logo.svg" alt="" /></div>';
      return '<div class="co-item">' + thumb +
        '<div class="co-info"><div class="co-name">' + esc(p.name) + "</div>" +
        '<div class="co-sub">x' + l.qty + sz + "</div></div>" +
        '<div class="co-price">' + fmt(p.price * l.qty) + "</div></div>";
    }).join("");
    var t = $("[data-checkout-total]"); if (t) t.textContent = fmt(cartTotal());
  }
  function openCheckout() {
    if (!cart.length) return;
    renderCheckout();
    closeCart();
    var pg = $("[data-checkout-page]"); if (pg) pg.hidden = false;
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);
  }
  function closeCheckout() { var pg = $("[data-checkout-page]"); if (pg) pg.hidden = true; document.body.style.overflow = ""; }
  function backToCart() { closeCheckout(); openCart(); }

  function sendReceipt() {
    if (!cart.length) return;
    var lines = cart.map(function (l) {
      var p = PRODUCTS.find(function (x) { return x.id === l.id; });
      return "• " + p.name + (l.size !== "Único" ? " (Talle " + l.size + ")" : "") + " x" + l.qty + " — " + fmt(p.price * l.qty);
    });
    var msg = "¡Hola Tienda Pino! Quiero confirmar este pedido:\n\n" + lines.join("\n") +
      "\n\n*Total: " + fmt(cartTotal()) + "*\n\nAdjunto el comprobante de transferencia.";
    window.open("https://wa.me/" + (CFG.whatsapp || "") + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
    cart = []; renderCart(); closeCheckout();
    toast("✓ Pedido enviado por WhatsApp", "ok");
  }
  function copyPay(which, btn) {
    var val = which === "cbu" ? CFG.cbu : CFG.alias;
    var done = function () {
      if (btn) { var t = btn.textContent; btn.textContent = "Copiado ✓"; btn.classList.add("copied"); setTimeout(function () { btn.textContent = t; btn.classList.remove("copied"); }, 1400); }
      else toast("✓ Copiado", "ok");
    };
    if (navigator.clipboard) navigator.clipboard.writeText(val).then(done).catch(function () { toast("No se pudo copiar", "err"); });
  }

  /* ── Admin: login / panel ───────────────────────────────────────────── */
  function openAdminLogin() {
    if (adminLoggedIn) { openPanel(); return; }
    var o = $("[data-admin-overlay]"), m = $("[data-admin-login]");
    if (o) o.hidden = false; if (m) m.hidden = false;
    var pw = $("[data-admin-pw]"); if (pw) { pw.value = ""; setTimeout(function () { pw.focus(); }, 60); }
    var err = $("[data-admin-err]"); if (err) err.hidden = true;
  }
  function closeAdminLogin() { var o = $("[data-admin-overlay]"), m = $("[data-admin-login]"); if (o) o.hidden = true; if (m) m.hidden = true; }
  function doLogin() {
    var pw = $("[data-admin-pw]"); var val = pw ? pw.value : "";
    if (!val) return;
    adminPass = val;
    var btn = $("[data-admin-login-btn]"); if (btn) { btn.disabled = true; btn.textContent = "Entrando…"; }
    // Verificación liviana: manda solo la pass con data vacía (no migra imágenes ni manda fotos)
    fetch("/api/admin-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pass: adminPass, verifyOnly: true })
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
    .then(function (res) {
      if (btn) { btn.disabled = false; btn.textContent = "Entrar"; }
      if (res.status === 401) { adminPass = ""; var err = $("[data-admin-err]"); if (err) err.hidden = false; return; }
      adminLoggedIn = true;
      closeAdminLogin(); openPanel();
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = "Entrar"; }
      toast("Error de conexión", "err");
    });
  }
  function openPanel() { var p = $("[data-admin-panel]"); if (p) p.hidden = false; document.body.style.overflow = "hidden"; switchAdmTab("dash"); renderDash(); renderProds(); renderStock(""); }
  function closePanel() { var p = $("[data-admin-panel]"); if (p) p.hidden = true; document.body.style.overflow = ""; }
  function logout() { adminLoggedIn = false; adminPass = ""; closePanel(); }
  function switchAdmTab(tab) {
    $all("[data-adm-tab]").forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-adm-tab") === tab); });
    $all("[data-adm-view]").forEach(function (v) { v.hidden = v.getAttribute("data-adm-view") !== tab; });
  }

  function renderDash() {
    var pub = PRODUCTS.filter(function (p) { return !p.hidden; }).length;
    var tStock = STOCK.reduce(function (a, s) { return a + (s.stock_inicio - s.vendidos); }, 0);
    var low = STOCK.filter(function (s) { var d = s.stock_inicio - s.vendidos; return d > 0 && d <= 2; }).length;
    var out = STOCK.filter(function (s) { return (s.stock_inicio - s.vendidos) <= 0; }).length;
    var cards = $("[data-dash-cards]");
    if (cards) cards.innerHTML =
      dashCard(pub, "Productos publicados") + dashCard(tStock, "Unidades en stock") +
      dashCard(low, "Bajo stock (≤2)") + dashCard(out, "Agotados");
    var alerts = STOCK.filter(function (s) { var d = s.stock_inicio - s.vendidos; return d <= 2; });
    var al = $("[data-dash-alerts]");
    if (al) al.innerHTML = alerts.length
      ? '<div class="alerts-title">⚠️ Alertas de stock</div>' + alerts.map(function (s) {
          var d = s.stock_inicio - s.vendidos;
          return '<div class="alert-row"><span>' + esc(s.producto) + " · " + esc(s.talle) + '</span><span class="badge-sm ' +
            (d <= 0 ? "b-red" : "b-orange") + '">' + (d <= 0 ? "Agotado" : d + " u.") + "</span></div>";
        }).join("")
      : '<div class="alerts-title ok">✓ Todo el stock en niveles normales</div>';
  }
  function dashCard(n, l) { return '<div class="dash-card"><strong>' + n + "</strong><span>" + esc(l) + "</span></div>"; }

  function renderProds() {
    var t = $("[data-prods-table]"); if (!t) return;
    var note = $("[data-prods-note]");
    if (note) note.textContent = PRODUCTS.length + " productos del Excel · " + PRODUCTS.filter(function (p) { return !p.hidden; }).length + " publicados";
    t.innerHTML = "<thead><tr><th>Producto</th><th>Cat.</th><th>Precio</th><th>Badge</th><th>Disp.</th><th></th></tr></thead><tbody>" +
      PRODUCTS.map(function (p) {
        var td = getTotalDisp(p.excelKey);
        var sb = !hasStock(p.excelKey) ? '<span class="badge-sm">—</span>'
          : td <= 0 ? '<span class="badge-sm b-red">Agotado</span>'
          : td <= 3 ? '<span class="badge-sm b-orange">' + td + " u.</span>"
          : '<span class="badge-sm b-green">' + td + " u.</span>";
        return "<tr><td><strong>" + esc(p.name) + "</strong>" + (p.hidden ? ' <span class="badge-sm b-red">Oculto</span>' : "") + "</td>" +
          "<td>" + (CAT_ICONS[p.cat] || "") + " " + esc(p.cat) + "</td>" +
          "<td>" + fmt(p.price) + "</td>" +
          "<td>" + (p.badge ? '<span class="badge-sm ' + (BADGE_CLS[p.badge] || "b-green") + '">' + esc(p.badge) + "</span>" : "—") + "</td>" +
          "<td>" + sb + "</td>" +
          '<td class="row-actions">' +
            '<button class="mini" data-act="edit-prod" data-id="' + p.id + '">Editar</button>' +
            '<button class="mini" data-act="toggle-prod" data-id="' + p.id + '">' + (p.hidden ? "Publicar" : "Ocultar") + "</button>" +
            '<button class="mini danger" data-act="del-prod" data-id="' + p.id + '">Eliminar</button>' +
          "</td></tr>";
      }).join("") + "</tbody>";
  }
  function toggleHidden(id) {
    var p = PRODUCTS.find(function (x) { return x.id === id; }); if (!p) return;
    p.hidden = !p.hidden;
    persist(p);
    pushAdminData().then(function (res) {
      if (res.status === 401) { toast("Sesión inválida", "err"); return; }
      renderProds(); renderGrid(); renderDash();
      toast(p.hidden ? "Producto oculto" : "Producto publicado", "ok");
    });
  }

  function renderStock(q) {
    var t = $("[data-stock-table]"); if (!t) return;
    q = (q || "").toLowerCase();
    var rows = STOCK.filter(function (s) { return !q || s.producto.toLowerCase().indexOf(q) >= 0 || String(s.talle).toLowerCase().indexOf(q) >= 0; });
    t.innerHTML = "<thead><tr><th>Producto</th><th>Talle</th><th>Inicial</th><th>Vendidos</th><th>Disp.</th></tr></thead><tbody>" +
      rows.map(function (s) {
        var d = s.stock_inicio - s.vendidos;
        var sb = d <= 0 ? '<span class="badge-sm b-red">Agotado</span>' : d <= 2 ? '<span class="badge-sm b-orange">Bajo (' + d + ")</span>" : '<span class="badge-sm b-green">' + d + " u.</span>";
        return "<tr><td><strong>" + esc(s.producto) + "</strong></td><td>" + esc(s.talle) + "</td><td>" + s.stock_inicio + "</td><td>" + (s.vendidos || 0) + "</td><td>" + sb + "</td></tr>";
      }).join("") + "</tbody>";
  }

  /* ── Admin: editor de producto ──────────────────────────────────────── */
  function persist(p) {
    if (!p.excelKey) return;
    adminEdits[p.excelKey] = { name: p.name, cat: p.cat, description: p.description, price: p.price, sizes: p.sizes, badge: p.badge, img: p.img, hidden: p.hidden === true };
  }
  function openProdModal(id) {
    var p = id ? PRODUCTS.find(function (x) { return x.id === id; }) : null;
    curEditId = p ? String(p.id) : "";
    curTags = p && p.sizes ? p.sizes.slice() : [];
    curImgs = p && p.img ? (Array.isArray(p.img) ? p.img.slice() : [p.img]) : [];
    $("[data-prod-title]").textContent = p ? "Editar producto" : "Nuevo producto";
    $("[data-p-name]").value = p ? p.name : "";
    $("[data-p-cat]").value = p ? p.cat : "prendas";
    $("[data-p-desc]").value = p ? p.description : "";
    $("[data-p-price]").value = p ? p.price : "";
    $("[data-p-cost]").value = p ? p.cost : "";
    $("[data-p-badge]").value = p && p.badge ? p.badge : "";
    var names = []; STOCK.forEach(function (s) { if (names.indexOf(s.producto) < 0) names.push(s.producto); }); names.sort();
    $("[data-p-excelkey]").innerHTML = '<option value="">— Seleccionar —</option>' + names.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + "</option>"; }).join("");
    $("[data-p-excelkey]").value = p ? p.excelKey : "";
    renderTags(); renderGallery();
    $("[data-prod-overlay]").hidden = false; $("[data-prod-modal]").hidden = false;
  }
  function closeProdModal() { $("[data-prod-overlay]").hidden = true; $("[data-prod-modal]").hidden = true; }
  function onExcelKeyChange() {
    var key = $("[data-p-excelkey]").value; if (!key) return;
    if (!$("[data-p-name]").value.trim()) $("[data-p-name]").value = key;
    if (!curTags.length) {
      STOCK.forEach(function (s) { if (s.producto.toLowerCase() === key.toLowerCase() && s.talle !== "Único" && curTags.indexOf(s.talle) < 0) curTags.push(s.talle); });
      renderTags();
    }
    var cur = $("[data-p-cat]").value;
    if (!cur || cur === "prendas") $("[data-p-cat]").value = guessCat(key);
  }
  function saveProd() {
    var name = $("[data-p-name]").value.trim();
    var priceRaw = $("[data-p-price]").value.trim();
    var price = parseFloat(priceRaw);
    if (!name) { toast("El nombre es obligatorio", "err"); return; }
    if (priceRaw === "" || isNaN(price)) { toast("Precio inválido", "err"); return; }

    var btn = $("[data-prod-save]"); if (btn) { btn.disabled = true; btn.textContent = "Guardando…"; }

    // Subir al Blob cualquier imagen que todavía sea base64 (fotos viejas o recién agregadas sin subir)
    var uploads = curImgs.map(function (im) {
      if (typeof im === "string" && im.indexOf("data:image/") === 0) {
        return uploadImage(im); // devuelve URL
      }
      return Promise.resolve(im); // ya es URL
    });

    Promise.all(uploads).then(function (urls) {
      curImgs = urls;
      var excelKey = $("[data-p-excelkey]").value || name;
      var img = curImgs.length ? (curImgs.length === 1 ? curImgs[0] : curImgs.slice()) : null;
      var existing = curEditId ? PRODUCTS.find(function (x) { return x.id === parseInt(curEditId, 10); }) : null;
      var prod = {
        id: existing ? existing.id : (PRODUCTS.length ? Math.max.apply(null, PRODUCTS.map(function (p) { return p.id; })) + 1 : 1),
        excelKey: excelKey, name: name, cat: $("[data-p-cat]").value,
        description: $("[data-p-desc]").value, price: price,
        cost: parseFloat($("[data-p-cost]").value) || 0,
        sizes: curTags.slice(), badge: $("[data-p-badge]").value || null,
        img: img, hidden: existing ? existing.hidden === true : false
      };
      if (existing) { var i = PRODUCTS.indexOf(existing); PRODUCTS[i] = prod; } else PRODUCTS.push(prod);
      persist(prod);
      return pushAdminData();
    }).then(function (res) {
      if (btn) { btn.disabled = false; btn.textContent = "Guardar producto"; }
      if (res.status === 401) { toast("Sesión inválida, reingresá", "err"); return; }
      if (!res.j.ok) { toast("Error servidor: " + (res.j.error || res.status), "err"); return; }
      closeProdModal(); renderProds(); renderGrid(); renderDash();
      toast("✓ Producto guardado", "ok");
    }).catch(function (e) {
      if (btn) { btn.disabled = false; btn.textContent = "Guardar producto"; }
      toast("Error al guardar: " + (e.message || e), "err");
    });
  }
  var pendingDelId = null;
  function askDelete(id) {
    var p = PRODUCTS.find(function (x) { return x.id === id; }); if (!p) return;
    pendingDelId = id;
    $("[data-confirm-msg]").textContent = '¿Eliminar "' + p.name + '"? Se quita la presentación (el Excel no se toca).';
    $("[data-confirm-overlay]").hidden = false; $("[data-confirm]").hidden = false;
  }
  function closeConfirm() { $("[data-confirm-overlay]").hidden = true; $("[data-confirm]").hidden = true; pendingDelId = null; }
  function doDelete() {
    var p = PRODUCTS.find(function (x) { return x.id === pendingDelId; });
    if (p) { if (p.excelKey && adminEdits[p.excelKey]) delete adminEdits[p.excelKey]; PRODUCTS = PRODUCTS.filter(function (x) { return x.id !== p.id; }); }
    pushAdminData().then(function (res) {
      closeConfirm();
      if (res.status === 401) { toast("Sesión inválida", "err"); return; }
      renderProds(); renderGrid(); renderDash(); toast("Producto eliminado", "ok");
    });
  }

  /* ── Tags (talles) ──────────────────────────────────────────────────── */
  function renderTags() {
    var w = $("[data-p-tags]"); if (!w) return;
    w.innerHTML = curTags.length ? curTags.map(function (t) {
      return '<span class="tag">' + esc(t) + '<button data-act="tag-rm" data-tag="' + esc(t) + '">×</button></span>';
    }).join("") : '<span class="muted sm">Sin talles (producto de talle único).</span>';
  }
  function addTag(v) { v = (v || "").trim(); if (v && curTags.indexOf(v) < 0) { curTags.push(v); renderTags(); } }
  function removeTag(v) { curTags = curTags.filter(function (t) { return t !== v; }); renderTags(); }

  /* ── Imágenes ───────────────────────────────────────────────────────── */
  function renderGallery() {
    var g = $("[data-p-gallery]"); if (!g) return;
    g.innerHTML = curImgs.map(function (src, i) {
      return '<div class="img-item' + (i === 0 ? " main" : "") + '">' +
        '<img src="' + esc(src) + '" alt="" data-act="img-main" data-i="' + i + '" />' +
        '<button class="img-rm" data-act="img-rm" data-i="' + i + '">✕</button>' +
        (i === 0 ? '<span class="img-tag">Principal</span>' : "") + "</div>";
    }).join("");
  }
  function setMainImg(i) { if (i === 0) return; var m = curImgs.splice(i, 1)[0]; curImgs.unshift(m); renderGallery(); }
  function removeImg(i) { curImgs.splice(i, 1); renderGallery(); }
  function handleFiles(input) {
    var files = Array.prototype.slice.call(input.files || []);
    if (!files.length) return;
    var done = 0;
    files.forEach(function (file) {
      if (file.size > 10 * 1024 * 1024) { toast('"' + file.name + '" pesa más de 10MB', "err"); return; }
      // Comprimir → subir al Blob → guardar la URL (no el base64)
      compress(file)
        .then(function (dataUrl) {
          toast("Subiendo imagen…", "ok");
          return uploadImage(dataUrl);
        })
        .then(function (url) { curImgs.push(url); renderGallery(); toast("✓ Imagen subida", "ok"); })
        .catch(function (e) { toast("Error con " + file.name + ": " + (e.message || e), "err"); })
        .then(function () { done++; if (done === files.length) input.value = ""; });
    });
  }
  // Sube una imagen (dataUrl base64) al Blob y devuelve su URL pública
  function uploadImage(dataUrl) {
    return fetch("/api/upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl: dataUrl, pass: adminPass })
    }).then(function (r) {
      return r.text().then(function (txt) {
        var j;
        try { j = JSON.parse(txt); } catch (e) { throw new Error("Respuesta no válida (" + r.status + ")"); }
        if (!r.ok || !j.ok) throw new Error(j.error || ("HTTP " + r.status));
        return j.url;
      });
    });
  }
  function compress(file, maxW, q) {
    maxW = maxW || 1400; q = q || 0.85;
    return new Promise(function (res, rej) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var sc = Math.min(1, maxW / img.width);
          var c = document.createElement("canvas");
          c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL("image/jpeg", q));
        };
        img.onerror = function () { rej(new Error("img")); };
        img.src = e.target.result;
      };
      reader.onerror = function () { rej(new Error("read")); };
      reader.readAsDataURL(file);
    });
  }

  /* ── Splash + delegación + binds estáticos ──────────────────────────── */
  function initSplash() {
    var s = $("[data-splash]"); if (!s) return;
    var hide = function () { if (s.classList.contains("is-out")) return; s.classList.add("is-out"); setTimeout(function () { s.classList.add("is-gone"); }, 800); };
    if (document.readyState === "complete") setTimeout(hide, 450);
    else window.addEventListener("load", function () { setTimeout(hide, 300); });
    setTimeout(hide, 4000);
  }

  function onClick(e) {
    var sizeBtn = e.target.closest('[data-act="size"]');
    if (sizeBtn) {
      var box = sizeBtn.closest("[data-sizes]");
      if (box) { $all(".size", box).forEach(function (b) { b.classList.remove("is-sel"); }); sizeBtn.classList.add("is-sel"); var h = sizeBtn.closest(".card") && $("[data-hint]", sizeBtn.closest(".card")); if (h) h.classList.remove("show"); }
      return;
    }
    var el = e.target.closest("[data-act]"); if (!el) return;
    var act = el.getAttribute("data-act");
    var id = el.getAttribute("data-id") ? parseInt(el.getAttribute("data-id"), 10) : null;
    var key = el.getAttribute("data-key");
    switch (act) {
      case "reload": loadCatalog(); break;
      case "tab": setCat(el.getAttribute("data-cat")); break;
      case "add": addToCart(id); break;
      case "cart-open": openCart(); break;
      case "cart-close": closeCart(); break;
      case "checkout": openCheckout(); break;
      case "checkout-back": backToCart(); break;
      case "send-receipt": sendReceipt(); break;
      case "copy": copyPay(el.getAttribute("data-copy"), el); break;
      case "qty-inc": changeQty(key, 1); break;
      case "qty-dec": changeQty(key, -1); break;
      case "cart-rm": removeLine(key); break;
      // admin
      case "admin-open": openAdminLogin(); break;
      case "admin-cancel": closeAdminLogin(); break;
      case "admin-login": doLogin(); break;
      case "admin-close": closePanel(); break;
      case "admin-logout": logout(); break;
      case "refresh-excel": refreshFromExcel(); break;
      case "open-product": openProduct(id); break;
      case "product-back": closeProduct(); break;
      case "pd-size": pdSelectSize(el); break;
      case "pd-thumb": pdSetMainImg(el.getAttribute("data-src"), el); break;
      case "pd-add": pdAdd(id); break;
      case "adm-tab": switchAdmTab(el.getAttribute("data-adm-tab")); break;
      case "new-prod": openProdModal(null); break;
      case "edit-prod": openProdModal(id); break;
      case "toggle-prod": toggleHidden(id); break;
      case "del-prod": askDelete(id); break;
      case "prod-close": case "prod-cancel": closeProdModal(); break;
      case "prod-save": saveProd(); break;
      case "tag-add": addTag($("[data-p-tag-input]").value); $("[data-p-tag-input]").value = ""; break;
      case "tag-rm": removeTag(el.getAttribute("data-tag")); break;
      case "img-main": setMainImg(parseInt(el.getAttribute("data-i"), 10)); break;
      case "img-rm": removeImg(parseInt(el.getAttribute("data-i"), 10)); break;
      case "confirm-cancel": closeConfirm(); break;
      case "confirm-ok": doDelete(); break;
    }
  }

  function bindStatic() {
    // mapear data-* sin data-act a acciones (botones del HTML fijo)
    var map = [
      ["[data-cart-open]", "cart-open"], ["[data-cart-close]", "cart-close"], ["[data-cart-overlay]", "cart-close"],
      ["[data-checkout]", "checkout"], ["[data-checkout-back]", "checkout-back"], ["[data-send-receipt]", "send-receipt"],
      ["[data-admin-open]", "admin-open"], ["[data-admin-cancel]", "admin-cancel"],
      ["[data-admin-overlay]", "admin-cancel"], ["[data-admin-login-btn]", "admin-login"], ["[data-admin-close]", "admin-close"],
      ["[data-admin-logout]", "admin-logout"], ["[data-new-prod]", "new-prod"], ["[data-prod-close]", "prod-close"],
      ["[data-refresh-excel]", "refresh-excel"],
      ["[data-product-back]", "product-back"],
      ["[data-prod-cancel]", "prod-cancel"], ["[data-prod-overlay]", "prod-cancel"], ["[data-prod-save]", "prod-save"],
      ["[data-tag-add]", "tag-add"], ["[data-confirm-cancel]", "confirm-cancel"], ["[data-confirm-overlay]", "confirm-cancel"], ["[data-confirm-ok]", "confirm-ok"]
    ];
    map.forEach(function (m) { var el = $(m[0]); if (el && !el.getAttribute("data-act")) el.setAttribute("data-act", m[1]); });
    $all("[data-adm-tab]").forEach(function (b) { b.setAttribute("data-act", "adm-tab"); });
    $all("[data-copy]").forEach(function (b) { b.setAttribute("data-act", "copy"); });

    document.addEventListener("click", onClick);
    // Spotlight: el brillo de la card sigue el cursor (solo en dispositivos con hover)
    if (!matchMedia("(hover: none)").matches) {
      document.addEventListener("mousemove", function (e) {
        var t = e.target;
        var card = t && t.closest ? t.closest(".card") : null;
        if (!card) return;
        var m = card.querySelector(".card-media"); if (!m) return;
        var r = m.getBoundingClientRect();
        card.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
      }, { passive: true });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeCart(); closeCheckout(); closeAdminLogin(); closeProdModal(); closeConfirm(); }
    });
    var pw = $("[data-admin-pw]"); if (pw) pw.addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
    var ti = $("[data-p-tag-input]"); if (ti) ti.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addTag(ti.value); ti.value = ""; } });
    var ek = $("[data-p-excelkey]"); if (ek) ek.addEventListener("change", onExcelKeyChange);
    var ss = $("[data-stock-search]"); if (ss) ss.addEventListener("input", function () { renderStock(ss.value); });
    var fi = $("[data-p-imgs]"); if (fi) fi.addEventListener("change", function () { handleFiles(fi); });
  }

  function initYear() { var y = $("[data-year]"); if (y) y.textContent = new Date().getFullYear(); }

  function boot() {
    try { initSplash(); } catch (e) { console.warn(e); }
    var alias = $("[data-alias]"); if (alias) alias.textContent = CFG.alias || "—";
    $all("[data-cbu]").forEach(function (e) { e.textContent = CFG.cbu || "—"; });
    $all("[data-alias]").forEach(function (e) { e.textContent = CFG.alias || "—"; });
    var tit = $("[data-titular]"); if (tit) tit.textContent = CFG.titular || "—";
    renderTabs(); bindStatic(); initYear();
    // Botón atrás del navegador: cierra la página de producto
    window.addEventListener("popstate", function () {
      var pp = $("[data-product-page]");
      if (location.hash.indexOf("#p") === 0) {
        var pid = parseInt(location.hash.slice(2), 10);
        if (pid) openProduct(pid);
      } else if (pp && !pp.hidden) {
        pp.hidden = true;
        var main = $("#top"); if (main) main.hidden = false;
        var ftr = document.querySelector(".footer"); if (ftr) ftr.style.display = "";
        pdCurrentId = null;
      }
    });
    loadCatalog().then(function () {
      // Deep-link: si la URL trae #pN, abrir ese producto directo
      if (location.hash.indexOf("#p") === 0) {
        var pid = parseInt(location.hash.slice(2), 10);
        if (pid) openProduct(pid);
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
