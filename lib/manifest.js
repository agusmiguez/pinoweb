/* Tienda Pino — config pública. Productos/stock vienen del Excel via /api/catalogo.
   La presentación (fotos, nombres, badges, visibilidad) se edita en el panel admin
   y se guarda en /api/admin-data. IIFE, sin módulos. Editá solo contacto/pago. */
(function () {
  "use strict";
  window.__PINO__ = {
    config: {
      whatsapp: "5491122435583",           // código país + número, sin + ni espacios
      alias: "tiendapino.miguez",          // alias de transferencia
      cbu: "0000177500094859315871"        // CBU/CVU
    },
    categorias: [
      { id: "todo",        label: "Todo" },
      { id: "prendas",     label: "Prendas" },
      { id: "gorras",      label: "Gorras" },
      { id: "mates",       label: "Mates y bombillas" },
      { id: "accesorios",  label: "Accesorios" }
    ]
  };
})();
