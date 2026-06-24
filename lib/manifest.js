/* Tienda Pino — datos del catálogo. IIFE, sin módulos. Editá libremente. */
(function () {
  "use strict";

  window.__PINO__ = {
    /* ── DATOS DE CONTACTO / PAGO (editar para go-live) ─────────────────── */
    config: {
      whatsapp: "5491100000000",          // código país + número, sin + ni espacios
      alias: "tiendapino.miguez",          // alias de transferencia
      cbu: "0000000000000000000000",       // CBU/CVU real
      moneda: "ARS"
    },

    /* ── CATEGORÍAS (el orden define las pestañas) ──────────────────────── */
    categorias: [
      { id: "todo",        label: "Todo" },
      { id: "prendas",     label: "Prendas" },
      { id: "gorras",      label: "Gorras" },
      { id: "mates",       label: "Mates y bombillas" },
      { id: "accesorios",  label: "Accesorios" }
    ],

    /* ── PRODUCTOS ──────────────────────────────────────────────────────
       badge: "" | "Nuevo" | "Más elegido" | "Edición limitada" | "Sin stock"
       sizes: [] para talle único; precio en number (sin separadores)         */
    productos: [
      {
        id: "jersey-home", cat: "prendas", name: "Camiseta Titular", precio: 28900,
        img: "assets/img/jersey-home.webp", badge: "Más elegido",
        sizes: ["S", "M", "L", "XL", "XXL"],
        desc: "Tejido técnico de juego, escudo bordado y franjas verde institucional."
      },
      {
        id: "jersey-away", cat: "prendas", name: "Camiseta Alternativa", precio: 28900,
        img: "assets/img/jersey-away.webp", badge: "Nuevo",
        sizes: ["S", "M", "L", "XL", "XXL"],
        desc: "El recambio en azul royal y naranja. Misma identidad, otra actitud."
      },
      {
        id: "kit-training", cat: "prendas", name: "Conjunto Entrenamiento", precio: 41500,
        img: "assets/img/kit-training.webp", badge: "",
        sizes: ["S", "M", "L", "XL"],
        desc: "Conjunto liviano y transpirable para las jornadas en el predio."
      },
      {
        id: "cap-mono", cat: "gorras", name: "Gorra Grafito", precio: 15900,
        img: "assets/img/cap-mono.webp", badge: "",
        sizes: [],
        desc: "Lavado vintage y emblema en relieve tono sobre tono. Para todos los días."
      },
      {
        id: "cap-color", cat: "gorras", name: "Gorra Edición Color", precio: 16900,
        img: "assets/img/cap-color.webp", badge: "Edición limitada",
        sizes: [],
        desc: "El pino a todo color sobre algodón envejecido. Pieza de colección."
      },
      {
        id: "mate", cat: "mates", name: "Mate Imperial N.E.C.C.", precio: 19900,
        img: "assets/img/mate.webp", badge: "",
        sizes: [],
        desc: "Mate forrado con la insignia del club. Incluye bombilla de acero."
      },
      {
        id: "bag", cat: "accesorios", name: "Bolso de Club", precio: 23900,
        img: "assets/img/bag.webp", badge: "",
        sizes: [],
        desc: "Compañero de fin de semana. Capacidad real, sigla N.E.C.C. discreta."
      }
    ]
  };
})();
