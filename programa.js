/* ═══════════════════════════════════════════════════
     NIANGEL v6 — JavaScript
     Estructura:
       1.  Firebase — inicialización y conexión
       2.  Estado global (arrays en memoria)
       3.  Utilidades (toast, sync, fecha, filtros)
       4.  Modales (confirmación y edición)
       5.  Navegación entre tabs
       6.  Módulo: Ingredientes
       7.  Módulo: Recetas
       8.  Módulo: Producción  ← fecha manual aquí
       9.  Módulo: Historial de Producción
      10.  Módulo: Estadísticas
      11.  Módulo: Clientes — formularios y listas
      12.  Módulo: Ventas multi-pan
      13.  Módulo: Pedidos regulares
      14.  Módulo: Deudas
      15.  Módulo: Historial general de ventas
      16.  Módulo: Rankings y alertas
      17.  Exportar CSV
      18.  Listeners de Firebase (onSnapshot)
      19.  Inicialización al cargar
  ═══════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════
// 1. FIREBASE — Inicialización
// ══════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyARYT5Jk3OqmkPOUuLHRsQJfYrx9J8i9uQ",
  authDomain: "niangel2812.firebaseapp.com",
  projectId: "niangel2812",
  storageBucket: "niangel2812.firebasestorage.app",
  messagingSenderId: "136583322326",
  appId: "1:136583322326:web:58133846dcfdab2c0fc777",
});

const db = getFirestore(app);

// ══════════════════════════════════════════════════
// 2. ESTADO GLOBAL — Arrays en memoria
// ══════════════════════════════════════════════════
let ingredientes = []; // [ { id, nombre, cantidad, unidad, precio } ]
let recetas = []; // [ { id, nombre, rinde, precio, ings: [{ingId, cantidad}] } ]
let historial = []; // [ { id, recetaNombre, panes, precio, costoTotal, ganancia, fecha } ]
let clientes = []; // [ { id, nombre, tipo, tel, dir, ventas:[], deudas:[], pedidosReg:[] } ]

// Filtro activo del historial de ventas
let filtroHV = "hoy";

// ══════════════════════════════════════════════════
// 3. UTILIDADES
// ══════════════════════════════════════════════════

// — Sincronización visual —
function syncOk() {
  _dot("ok", "En la nube");
}
function syncSync() {
  _dot("syncing", "Guardando...");
}
function syncErr() {
  _dot("err", "Sin conexión");
}

function _dot(cls, txt) {
  document.getElementById("sync-dot").className = cls;
  document.getElementById("sync-txt").textContent = txt;
}

// — Toast —
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("visible");
  setTimeout(() => t.classList.remove("visible"), 2700);
}

// — Fecha formateada (hoy) —
function fechaHoy() {
  return new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Convierte input date (YYYY-MM-DD) a texto legible
function fechaDeInput(valor) {
  if (!valor) return fechaHoy();
  const [y, m, d] = valor.split("-");
  const meses = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return `${d} ${meses[parseInt(m) - 1]} ${y}`;
}

// Fecha por defecto para input type="date" (hoy en YYYY-MM-DD)
function hoyParaInput() {
  return new Date().toISOString().split("T")[0];
}

// — Filtro por rango de fecha —
// Acepta Firestore Timestamp, número (ms), Date o string (YYYY-MM-DD)
function esMismaFecha(ts, rango) {
  let d;
  if (ts && ts.toDate) {
    d = ts.toDate();
  } else if (ts instanceof Date) {
    d = ts;
  } else if (typeof ts === "number") {
    d = new Date(ts);
  } else if (typeof ts === "string") {
    d = new Date(ts + "T00:00:00");
  } else {
    d = new Date(ts);
  }
  const hoy = new Date();
  if (rango === "hoy") return d.toDateString() === hoy.toDateString();
  if (rango === "semana") {
    const h7 = new Date();
    h7.setDate(hoy.getDate() - 7);
    return d >= h7;
  }
  if (rango === "mes")
    return (
      d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear()
    );
  return true; // 'todo'
}

// Días de la semana
const DIAS_NOM = {
  lun: "Lun",
  mar: "Mar",
  mie: "Mié",
  jue: "Jue",
  vie: "Vie",
  sab: "Sáb",
  dom: "Dom",
};
const DIA_IDX = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

// Tipos de establecimiento
const TIPOS = {
  tienda: "🏪 Tienda",
  fruver: "🥬 Fruver",
  restaurante: "🍽️ Restaurante",
  cafeteria: "☕ Cafetería",
  ambulante: "🛒 Ambulante",
  panaderia: "🍞 Panadería",
  vecino: "🏠 Vecino/Particular",
  mayorista: "📦 Mayorista",
  otro: "👤 Otro",
};

function emojiTipo(tipo) {
  const mapa = {
    tienda: "🏪",
    fruver: "🥬",
    restaurante: "🍽️",
    cafeteria: "☕",
    ambulante: "🛒",
    panaderia: "🍞",
    vecino: "🏠",
    mayorista: "📦",
    otro: "👤",
  };
  return mapa[tipo] || "👤";
}

// ══════════════════════════════════════════════════
// 4. MODALES
// ══════════════════════════════════════════════════

function confirmar({
  icono = "⚠️",
  titulo,
  desc,
  btnTxt = "Confirmar",
  btnCls = "btn-eliminar",
  accion,
}) {
  document.getElementById("modal-icono").textContent = icono;
  document.getElementById("modal-titulo").textContent = titulo;
  document.getElementById("modal-desc").textContent = desc;
  const btn = document.getElementById("modal-btn-confirmar");
  btn.className = `btn ${btnCls}`;
  btn.textContent = btnTxt;
  btn.onclick = () => {
    cerrarModal();
    accion();
  };
  document.getElementById("modal-overlay").classList.add("visible");
}

window.cerrarModal = function () {
  document.getElementById("modal-overlay").classList.remove("visible");
};

function abrirModalEditar(
  titulo,
  bodyHTML,
  onGuardar,
  btnTxt = "Guardar cambios",
) {
  document.getElementById("modal-editar-titulo").textContent = titulo;
  document.getElementById("modal-editar-body").innerHTML = bodyHTML;
  const btn = document.getElementById("modal-editar-btn");
  btn.textContent = btnTxt;
  btn.onclick = onGuardar;
  document.getElementById("modal-editar-overlay").classList.add("visible");
}

window.cerrarModalEditar = function () {
  document.getElementById("modal-editar-overlay").classList.remove("visible");
};

// ══════════════════════════════════════════════════
// 5. NAVEGACIÓN ENTRE TABS
// ══════════════════════════════════════════════════
window.irTab = function (tab, btn) {
  document
    .querySelectorAll(".seccion")
    .forEach((s) => s.classList.remove("activa"));
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("activa");
  btn.classList.add("active");

  if (tab === "recetas") dibujarRecs();
  if (tab === "produccion") cargarSelRec();
  if (tab === "historial") dibujarHist("hoy");
  if (tab === "estadisticas") dibujarStats("todo");
  if (tab === "clientes") dibujarClis();
};

// ══════════════════════════════════════════════════
// 6. MÓDULO: INGREDIENTES
// ══════════════════════════════════════════════════

window.agregarIng = async function () {
  const nombre = document.getElementById("ing-nom").value.trim();
  const cantidad = parseFloat(document.getElementById("ing-cant").value);
  const unidad = document.getElementById("ing-uni").value.trim();
  const precio = parseFloat(document.getElementById("ing-pre").value);

  if (!nombre) {
    toast("Escribe el nombre");
    return;
  }
  if (isNaN(cantidad)) {
    toast("Escribe la cantidad");
    return;
  }
  if (!unidad) {
    toast("Escribe la unidad");
    return;
  }
  if (isNaN(precio)) {
    toast("Escribe el precio");
    return;
  }

  const dup = ingredientes.find(
    (i) => i.nombre.toLowerCase() === nombre.toLowerCase(),
  );
  if (dup) {
    confirmar({
      icono: "⚠️",
      titulo: "Ya existe este ingrediente",
      desc: `"${dup.nombre}" ya está en tu bodega. ¿Quieres editar el existente?`,
      btnTxt: "Editar existente",
      btnCls: "btn-editar",
      accion: () => editarIng(dup.id),
    });
    return;
  }

  syncSync();
  try {
    await addDoc(collection(db, "ingredientes"), {
      nombre,
      cantidad,
      unidad,
      precio,
      creadoEn: serverTimestamp(),
    });
    document.getElementById("ing-nom").value = "";
    document.getElementById("ing-cant").value = "";
    document.getElementById("ing-uni").value = "";
    document.getElementById("ing-pre").value = "";
    toast("Ingrediente guardado ✓");
    syncOk();
  } catch (e) {
    syncErr();
    toast("Error al guardar");
  }
};

window.editarIng = function (id) {
  const ing = ingredientes.find((i) => i.id === id);
  if (!ing) return;
  const body = `
    <div class="campo"><label>Nombre</label>
      <input type="text" id="me-nom" value="${ing.nombre}"></div>
    <div class="fila">
      <div class="campo"><label>Cantidad</label>
        <input type="number" id="me-cant" value="${ing.cantidad}" step="any" min="0"></div>
      <div class="campo"><label>Unidad</label>
        <input type="text" id="me-uni" value="${ing.unidad}"></div>
    </div>
    <div class="campo"><label>Precio ($)</label>
      <input type="number" id="me-pre" value="${ing.precio}" step="0.01" min="0"></div>`;

  abrirModalEditar(`✏️ Editar: ${ing.nombre}`, body, async () => {
    const nombre = document.getElementById("me-nom").value.trim();
    const cantidad = parseFloat(document.getElementById("me-cant").value);
    const unidad = document.getElementById("me-uni").value.trim();
    const precio = parseFloat(document.getElementById("me-pre").value);
    if (!nombre || isNaN(cantidad) || !unidad || isNaN(precio)) {
      toast("Completa todos los campos");
      return;
    }
    syncSync();
    try {
      await setDoc(
        doc(db, "ingredientes", id),
        { nombre, cantidad, unidad, precio },
        { merge: true },
      );
      cerrarModalEditar();
      toast("Ingrediente actualizado ✓");
      syncOk();
    } catch (e) {
      syncErr();
      toast("Error");
    }
  });
};

window.eliminarIng = function (id) {
  const ing = ingredientes.find((i) => i.id === id);
  const enUso = recetas
    .filter((r) => r.ings.some((ri) => ri.ingId === id))
    .map((r) => r.nombre);
  if (enUso.length) {
    confirmar({
      icono: "⚠️",
      titulo: "Ingrediente en uso",
      desc: `"${ing.nombre}" está en: ${enUso.join(", ")}. Si lo eliminas, esas recetas perderán este ingrediente.`,
      btnTxt: "Eliminar de todos modos",
      btnCls: "btn-eliminar",
      accion: () => _borrarIng(id),
    });
  } else {
    confirmar({
      icono: "🗑️",
      titulo: `Eliminar "${ing.nombre}"`,
      desc: "Esta acción no se puede deshacer.",
      accion: () => _borrarIng(id),
    });
  }
};

async function _borrarIng(id) {
  syncSync();
  try {
    await deleteDoc(doc(db, "ingredientes", id));
    toast("Eliminado");
    syncOk();
  } catch (e) {
    syncErr();
    toast("Error");
  }
}

function dibujarIngs() {
  document.getElementById("ing-cnt").textContent = ingredientes.length;
  const c = document.getElementById("ing-lista");
  if (!ingredientes.length) {
    c.innerHTML = `<div class="vacio"><div class="vacio-icono">🫙</div>
                     <p>La bodega está vacía.<br>Agrega tu primer ingrediente.</p></div>`;
    return;
  }
  c.innerHTML =
    '<div class="lista">' +
    ingredientes
      .map((ing) => {
        const ppu = (ing.precio / ing.cantidad).toFixed(4);
        return `
        <div class="item">
          <div class="info">
            <strong>${ing.nombre}</strong>
            <span>${ing.cantidad} ${ing.unidad} — $${ing.precio.toFixed(2)} — $${ppu}/${ing.unidad}</span>
          </div>
          <div class="acciones">
            <button class="btn btn-sm btn-editar"   onclick="editarIng('${ing.id}')">✏️</button>
            <button class="btn btn-sm btn-eliminar" onclick="eliminarIng('${ing.id}')">✕</button>
          </div>
        </div>`;
      })
      .join("") +
    "</div>";
}

// ══════════════════════════════════════════════════
// 7. MÓDULO: RECETAS
// ══════════════════════════════════════════════════

function costoRec(rec) {
  return rec.ings.reduce((t, ri) => {
    const ing = ingredientes.find((i) => i.id === ri.ingId);
    return ing ? t + (ing.precio / ing.cantidad) * ri.cantidad : t;
  }, 0);
}

window.crearRec = async function () {
  const nombre = document.getElementById("rec-nom").value.trim();
  const rinde = parseInt(document.getElementById("rec-rinde").value);
  const precio = parseFloat(document.getElementById("rec-precio").value);
  if (!nombre) {
    toast("Escribe el nombre del pan");
    return;
  }
  if (!rinde || rinde < 1) {
    toast("¿Cuántos panes rinde?");
    return;
  }
  if (isNaN(precio) || precio <= 0) {
    toast("Escribe el precio de venta");
    return;
  }
  syncSync();
  try {
    await addDoc(collection(db, "recetas"), {
      nombre,
      rinde,
      precio,
      ings: [],
      creadoEn: serverTimestamp(),
    });
    document.getElementById("rec-nom").value = "";
    document.getElementById("rec-rinde").value = "";
    document.getElementById("rec-precio").value = "";
    toast("Receta creada ✓");
    syncOk();
  } catch (e) {
    syncErr();
    toast("Error");
  }
};

window.editarRec = function (id) {
  const rec = recetas.find((r) => r.id === id);
  if (!rec) return;
  const body = `
    <div class="campo"><label>Nombre del pan</label>
      <input type="text" id="mr-nom" value="${rec.nombre}"></div>
    <div class="fila">
      <div class="campo"><label>Rinde (panes)</label>
        <input type="number" id="mr-rinde" value="${rec.rinde}" min="1" step="1"></div>
      <div class="campo"><label>Precio venta/pan ($)</label>
        <input type="number" id="mr-precio" value="${rec.precio || ""}" step="0.01" min="0"></div>
    </div>`;
  abrirModalEditar(`✏️ Editar: ${rec.nombre}`, body, async () => {
    const nombre = document.getElementById("mr-nom").value.trim();
    const rinde = parseInt(document.getElementById("mr-rinde").value);
    const precio = parseFloat(document.getElementById("mr-precio").value);
    if (!nombre || !rinde || rinde < 1) {
      toast("Completa los campos");
      return;
    }
    syncSync();
    try {
      await setDoc(
        doc(db, "recetas", id),
        { nombre, rinde, precio: isNaN(precio) ? 0 : precio },
        { merge: true },
      );
      cerrarModalEditar();
      toast("Receta actualizada ✓");
      syncOk();
    } catch (e) {
      syncErr();
      toast("Error");
    }
  });
};

window.eliminarRec = function (id) {
  const rec = recetas.find((r) => r.id === id);
  const tieneVentas = clientes.some((c) =>
    (c.ventas || []).some(
      (v) => v.panes && v.panes.some((p) => p.recetaId === id),
    ),
  );
  if (tieneVentas) {
    confirmar({
      icono: "⚠️",
      titulo: "Receta con ventas",
      desc: `"${rec.nombre}" tiene ventas registradas. Eliminarla no borrará las ventas históricas.`,
      btnTxt: "Eliminar de todos modos",
      btnCls: "btn-eliminar",
      accion: () => _borrarRec(id),
    });
  } else {
    confirmar({
      icono: "🗑️",
      titulo: `Eliminar "${rec.nombre}"`,
      desc: "Se eliminará la receta y sus ingredientes asociados.",
      accion: () => _borrarRec(id),
    });
  }
};

async function _borrarRec(id) {
  syncSync();
  try {
    await deleteDoc(doc(db, "recetas", id));
    toast("Receta eliminada");
    syncOk();
  } catch (e) {
    syncErr();
    toast("Error");
  }
}

window.toggleRec = function (id) {
  document.getElementById("rb-" + id).classList.toggle("abierto");
  document.getElementById("rh-" + id).classList.toggle("abierto");
};

window.agregarIngRec = async function (recId) {
  const ingId = document.getElementById("rai-s-" + recId).value;
  const cantidad = parseFloat(document.getElementById("rai-c-" + recId).value);
  if (!ingId || isNaN(cantidad) || cantidad <= 0) {
    toast("Selecciona ingrediente y cantidad");
    return;
  }
  const rec = recetas.find((r) => r.id === recId);
  if (rec.ings.find((i) => i.ingId === ingId)) {
    toast("Ya está en la receta");
    return;
  }
  const nuevosIngs = [...rec.ings, { ingId, cantidad }];
  syncSync();
  try {
    await setDoc(
      doc(db, "recetas", recId),
      { ings: nuevosIngs },
      { merge: true },
    );
    toast("Ingrediente agregado ✓");
    syncOk();
  } catch (e) {
    syncErr();
    toast("Error");
  }
};

window.quitarIngRec = function (recId, ingId) {
  const ing = ingredientes.find((i) => i.id === ingId);
  confirmar({
    icono: "🗑️",
    titulo: `Quitar "${ing ? ing.nombre : "ingrediente"}"`,
    desc: "Se quitará este ingrediente de la receta.",
    accion: async () => {
      const rec = recetas.find((r) => r.id === recId);
      const nuevosIngs = rec.ings.filter((i) => i.ingId !== ingId);
      syncSync();
      try {
        await setDoc(
          doc(db, "recetas", recId),
          { ings: nuevosIngs },
          { merge: true },
        );
        syncOk();
      } catch (e) {
        syncErr();
      }
    },
  });
};

function dibujarRecs() {
  document.getElementById("rec-cnt").textContent = recetas.length;
  const c = document.getElementById("rec-lista");
  if (!recetas.length) {
    c.innerHTML = `<div class="vacio"><div class="vacio-icono">📋</div><p>No hay recetas aún.</p></div>`;
    return;
  }
  const optsIng = ingredientes
    .map((i) => `<option value="${i.id}">${i.nombre} (${i.unidad})</option>`)
    .join("");

  c.innerHTML = recetas
    .map((rec) => {
      const costo = costoRec(rec);
      const rinde = rec.rinde || 1;
      const costoPan = costo / rinde;
      const precio = rec.precio || 0;
      const ganancia = precio - costoPan;
      const colorG = ganancia >= 0 ? "var(--verde)" : "var(--rojo)";
      const signo = ganancia >= 0 ? "+" : "";

      const filasIng = rec.ings
        .map((ri) => {
          const ing = ingredientes.find((i) => i.id === ri.ingId);
          if (!ing) return "";
          const co = (ing.precio / ing.cantidad) * ri.cantidad;
          return `
        <div class="ing-fila">
          <span class="ing-fila-nom">${ing.nombre}</span>
          <span class="ing-fila-uni">${ri.cantidad} ${ing.unidad}</span>
          <span class="ing-fila-cost">$${co.toFixed(2)}</span>
          <button class="btn btn-sm btn-eliminar"
            onclick="quitarIngRec('${rec.id}','${ri.ingId}')">✕</button>
        </div>`;
        })
        .join("");

      const formIng = ingredientes.length
        ? `<div class="agregar-ing-rec">
           <div class="select-wrap" style="flex:1;min-width:100px">
             <select id="rai-s-${rec.id}">
               <option value="">Selecciona</option>${optsIng}
             </select>
           </div>
           <input type="number" id="rai-c-${rec.id}"
             placeholder="Cantidad" step="0.1" min="0" style="max-width:95px">
           <button class="btn btn-oscuro btn-sm" style="width:auto"
             onclick="agregarIngRec('${rec.id}')">+ Agregar</button>
         </div>`
        : `<p style="font-size:.8rem;color:var(--texto-s)">
           Primero agrega ingredientes en la sección Ingredientes.</p>`;

      return `
      <div class="receta-card">
        <div class="receta-header" id="rh-${rec.id}" onclick="toggleRec('${rec.id}')">
          <div style="flex:1;min-width:0">
            <h3>${rec.nombre}</h3>
            <div class="receta-meta">
              ${rec.ings.length} ingrediente(s) ·
              Rinde: <strong>${rinde} panes</strong> ·
              Costo: $${costo.toFixed(2)} ·
              Ganancia/pan:
              <strong style="color:${colorG}">${signo}$${ganancia.toFixed(3)}</strong>
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
            <button class="btn btn-sm btn-editar"
              onclick="event.stopPropagation();editarRec('${rec.id}')">✏️</button>
            <button class="btn btn-sm btn-eliminar"
              onclick="event.stopPropagation();eliminarRec('${rec.id}')">✕</button>
            <span class="receta-chevron">▾</span>
          </div>
        </div>

        <div class="receta-body" id="rb-${rec.id}">
          <div style="background:var(--crema-o);border-radius:10px;padding:10px 13px;
                      margin-bottom:13px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <div style="flex:1">
              <span style="font-size:.68rem;font-weight:600;color:var(--cafe-mid);
                           text-transform:uppercase;letter-spacing:.8px">Precio de venta</span>
              <div style="font-family:'Cormorant Garamond',serif;font-size:1.2rem;
                           color:var(--cafe-rico);font-weight:700">$${precio.toFixed(2)}/pan</div>
            </div>
            <div style="font-size:.78rem;color:var(--texto-s)">
              Costo/pan: <strong>$${costoPan.toFixed(3)}</strong>
            </div>
          </div>
          ${filasIng || `<p style="font-size:.82rem;color:var(--texto-s);margin-bottom:10px">Sin ingredientes aún.</p>`}
          <div class="divider"></div>
          <p class="nota-sec">Agregar ingrediente a esta receta</p>
          ${formIng}
        </div>
      </div>`;
    })
    .join("");
}

// ══════════════════════════════════════════════════
// 8. MÓDULO: PRODUCCIÓN
//    ✅ Ahora acepta fecha manual (anterior o de hoy)
// ══════════════════════════════════════════════════

window.cargarSelRec = function () {
  const sel = document.getElementById("prod-rec");
  const prev = sel.value;
  sel.innerHTML =
    '<option value="">Selecciona un pan</option>' +
    recetas
      .map(
        (r) =>
          `<option value="${r.id}"${r.id === prev ? " selected" : ""}>${r.nombre}</option>`,
      )
      .join("");
  if (prev) verIngRec();
};

window.verIngRec = function () {
  const recId = document.getElementById("prod-rec").value;
  const panes = parseInt(document.getElementById("prod-pan").value) || 0;
  const c = document.getElementById("prod-det");
  if (!recId) {
    c.innerHTML = `<div class="vacio"><div class="vacio-icono">👆</div><p>Selecciona un pan.</p></div>`;
    return;
  }
  const rec = recetas.find((r) => r.id === recId);
  if (!rec || !rec.ings.length) {
    c.innerHTML = `<div class="vacio"><div class="vacio-icono">⚠️</div><p>Esta receta no tiene ingredientes.</p></div>`;
    return;
  }

  const rinde = rec.rinde || 1;
  const factor = panes > 0 ? panes / rinde : 1;
  const costoEscalado = costoRec(rec) * factor;

  let html = "";
  if (panes > 0) {
    const vecesTexto = Number.isInteger(factor)
      ? `${factor}× exactas`
      : `${factor.toFixed(2)}× (≈${Math.ceil(factor)} preparaciones)`;
    html += `<div class="prod-escala-info">
      🧮 <strong>${panes} panes</strong> ÷ rinde <strong>${rinde}</strong>
      = repetir receta <strong>${vecesTexto}</strong>
    </div>`;
  }

  html +=
    '<div class="lista">' +
    rec.ings
      .map((ri) => {
        const ing = ingredientes.find((i) => i.id === ri.ingId);
        if (!ing) return "";
        const cant = ri.cantidad * factor;
        const co = (ing.precio / ing.cantidad) * cant;
        let extra = "";
        if (ing.unidad === "g" || ing.unidad === "gr")
          extra = ` = ${(cant / 1000).toFixed(3)} kg / ${(cant / 453.592).toFixed(2)} lb`;
        else if (ing.unidad === "ml")
          extra = ` = ${(cant / 1000).toFixed(3)} L`;
        return `<div class="item">
        <div class="info">
          <strong>${ing.nombre}</strong>
          <span>${cant.toFixed(2)} ${ing.unidad}${extra} — $${co.toFixed(2)}</span>
        </div>
      </div>`;
      })
      .join("") +
    "</div>";

  html += `<div class="divider"></div>
    <p style="text-align:center;font-size:.81rem;color:var(--texto-s)">
      Costo total: <strong>$${costoEscalado.toFixed(2)}</strong>
      ${panes > 0 ? ` | Por pan: <strong>$${(costoEscalado / panes).toFixed(3)}</strong>` : ""}
    </p>`;
  c.innerHTML = html;
};

window.calcularProd = async function () {
  const recId = document.getElementById("prod-rec").value;
  const panes = parseInt(document.getElementById("prod-pan").value);
  const precio = parseFloat(document.getElementById("prod-pre").value);

  // ✅ Leer la fecha del input manual
  const fechaInput = document.getElementById("prod-fecha").value;

  if (!recId) {
    toast("Selecciona un tipo de pan");
    return;
  }
  if (!panes || panes < 1) {
    toast("Ingresa cuántos panes");
    return;
  }
  if (!precio || precio <= 0) {
    toast("Ingresa el precio de venta");
    return;
  }

  const rec = recetas.find((r) => r.id === recId);
  if (!rec.ings.length) {
    toast("La receta no tiene ingredientes");
    return;
  }

  const rinde = rec.rinde || 1;
  const factor = panes / rinde;
  const costoBase = costoRec(rec);
  const costoTotal = costoBase * factor;
  const totalVenta = panes * precio;
  const ganancia = totalVenta - costoTotal;
  const costoPorPan = costoTotal / panes;
  const gananciaPan = precio - costoPorPan;

  // ✅ Construir objetos de fecha a partir del input
  //    Si el usuario eligió una fecha, usamos esa.
  //    Si dejó el campo vacío, usamos hoy.
  const fechaObj = fechaInput
    ? new Date(fechaInput + "T12:00:00") // mediodía para evitar desfases de zona horaria
    : new Date();
  const fechaTextoFinal = fechaInput ? fechaDeInput(fechaInput) : fechaHoy();

  syncSync();
  try {
    await addDoc(collection(db, "historial"), {
      // ✅ Se guarda como Date (no serverTimestamp) para permitir fechas pasadas
      fecha: fechaObj,
      fechaTexto: fechaTextoFinal,
      recetaId: rec.id,
      recetaNombre: rec.nombre,
      panes,
      precio,
      rinde,
      factor,
      costoTotal,
      totalVenta,
      ganancia,
      costoPorPan,
      gananciaPan,
    });
    syncOk();
  } catch (e) {
    syncErr();
  }

  // Mostrar resultado
  const s = ganancia >= 0 ? "+" : "";
  const cg = ganancia >= 0 ? "var(--verde)" : "var(--rojo)";
  const vTxt = Number.isInteger(factor)
    ? `${factor}×`
    : `${factor.toFixed(2)}× (≈${Math.ceil(factor)})`;

  const filasTabla = rec.ings
    .map((ri) => {
      const ing = ingredientes.find((i) => i.id === ri.ingId);
      if (!ing) return "";
      const cant = ri.cantidad * factor;
      const co = (ing.precio / ing.cantidad) * cant;
      let extra = "";
      if (ing.unidad === "g" || ing.unidad === "gr")
        extra = ` <span style="opacity:.6;font-size:.85em">= ${(cant / 1000).toFixed(2)}kg</span>`;
      return `<tr>
      <td>${ing.nombre}</td>
      <td>${cant.toFixed(2)} ${ing.unidad}${extra}</td>
      <td style="text-align:right;font-weight:600">$${co.toFixed(2)}</td>
    </tr>`;
    })
    .join("");

  const res = document.getElementById("prod-res");
  res.style.display = "block";
  res.innerHTML = `
    <div class="card" style="border-color:var(--dorado);box-shadow:var(--sombra-d)">
      <div class="card-titulo">
        ✅ Guardado — ${rec.nombre}
        <span class="badge">${panes} panes · ${fechaTextoFinal}</span>
      </div>
      <div class="prod-escala-info">
        🧮 Receta rinde <strong>${rinde}</strong> panes →
        para <strong>${panes}</strong> panes = preparar <strong>${vTxt}</strong>
      </div>
      <div class="stats-grid" style="margin-bottom:14px">
        <div class="stat-card sc-cafe">
          <div class="stat-label">Inversión</div>
          <div class="stat-valor">$${costoTotal.toFixed(2)}</div>
        </div>
        <div class="stat-card sc-azul">
          <div class="stat-label">Venta total</div>
          <div class="stat-valor">$${totalVenta.toFixed(2)}</div>
        </div>
        <div class="stat-card sc-morado">
          <div class="stat-label">Costo/pan</div>
          <div class="stat-valor">$${costoPorPan.toFixed(3)}</div>
        </div>
        <div class="stat-card sc-verde">
          <div class="stat-label">Ganancia</div>
          <div class="stat-valor">${s}$${ganancia.toFixed(2)}</div>
        </div>
      </div>
      <p style="text-align:center;font-size:.82rem;color:var(--texto-s);margin-bottom:16px">
        Ganancia por pan:
        <strong style="color:${cg}">${s}$${gananciaPan.toFixed(3)}</strong>
      </p>
      <table class="tabla">
        <thead>
          <tr>
            <th>Ingrediente</th><th>Total a usar</th>
            <th style="text-align:right">Costo</th>
          </tr>
        </thead>
        <tbody>
          ${filasTabla}
          <tr class="fila-total">
            <td colspan="2">TOTAL INVERTIDO</td>
            <td style="text-align:right">$${costoTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <div class="divider"></div>
      <button class="btn btn-gris"
        onclick="document.getElementById('prod-res').style.display='none'">
        Nueva producción
      </button>
    </div>`;

  // Limpiar formulario y restaurar fecha a hoy
  document.getElementById("prod-rec").value = "";
  document.getElementById("prod-pan").value = "";
  document.getElementById("prod-pre").value = "";
  document.getElementById("prod-fecha").value = hoyParaInput(); // ✅ Restaurar a hoy
  document.getElementById("prod-det").innerHTML =
    `<div class="vacio"><div class="vacio-icono">👆</div><p>Selecciona un pan.</p></div>`;
  toast("Producción guardada en la nube ✓");
};

// ══════════════════════════════════════════════════
// 9. MÓDULO: HISTORIAL DE PRODUCCIÓN
// ══════════════════════════════════════════════════

let filtroHist = "hoy";

window.filtrarH = function (rango, btn) {
  document
    .querySelectorAll("#tab-historial .filtro-btn")
    .forEach((b) => b.classList.remove("activo"));
  btn.classList.add("activo");
  filtroHist = rango;
  dibujarHist(rango);
};

window.eliminarHist = function (id) {
  confirmar({
    icono: "🗑️",
    titulo: "Eliminar registro",
    desc: "Se eliminará este registro de producción. No se puede deshacer.",
    accion: async () => {
      syncSync();
      try {
        await deleteDoc(doc(db, "historial", id));
        toast("Registro eliminado");
        syncOk();
      } catch (e) {
        syncErr();
        toast("Error");
      }
    },
  });
};

window.editarHist = function (id) {
  const h = historial.find((x) => x.id === id);
  if (!h) return;

  // Convertir fecha almacenada a YYYY-MM-DD para el input
  let fechaValorInput = hoyParaInput();
  if (h.fecha) {
    const d = h.fecha.toDate ? h.fecha.toDate() : new Date(h.fecha);
    fechaValorInput = d.toISOString().split("T")[0];
  }

  const body = `
    <div class="campo"><label>Panes producidos</label>
      <input type="number" id="mh-panes" value="${h.panes}" min="1"></div>
    <div class="campo"><label>Precio de venta/pan ($)</label>
      <input type="number" id="mh-precio" value="${h.precio || 0}" step="0.01" min="0"></div>
    <div class="campo"><label>Fecha de producción</label>
      <input type="date" id="mh-fecha" value="${fechaValorInput}">
      <p class="campo-ayuda">Puedes corregir la fecha si fue registrada en un día incorrecto</p>
    </div>`;

  abrirModalEditar("✏️ Editar producción", body, async () => {
    const panes = parseInt(document.getElementById("mh-panes").value);
    const precio = parseFloat(document.getElementById("mh-precio").value);
    const fechaInput = document.getElementById("mh-fecha").value;
    if (!panes || panes < 1 || isNaN(precio)) {
      toast("Datos inválidos");
      return;
    }

    const factor = panes / (h.rinde || 1);
    const costoTotal = (h.costoTotal / (h.factor || 1)) * factor;
    const totalVenta = panes * precio;
    const ganancia = totalVenta - costoTotal;

    // ✅ Convertir fecha editada
    const fechaObj = fechaInput
      ? new Date(fechaInput + "T12:00:00")
      : new Date();
    const fechaTextoFinal = fechaInput ? fechaDeInput(fechaInput) : fechaHoy();

    syncSync();
    try {
      await setDoc(
        doc(db, "historial", id),
        {
          panes,
          precio,
          factor,
          costoTotal,
          totalVenta,
          ganancia,
          costoPorPan: costoTotal / panes,
          gananciaPan: precio - costoTotal / panes,
          fecha: fechaObj,
          fechaTexto: fechaTextoFinal,
        },
        { merge: true },
      );
      cerrarModalEditar();
      toast("Registro actualizado ✓");
      syncOk();
    } catch (e) {
      syncErr();
      toast("Error");
    }
  });
};

function dibujarHist(rango) {
  const filtrados = historial
    .filter((h) => {
      const ts = h.fecha?.toDate
        ? h.fecha.toDate()
        : h.fecha instanceof Date
          ? h.fecha
          : new Date(h.fecha);
      return esMismaFecha(ts, rango);
    })
    .reverse();

  const rt = document.getElementById("hist-resumen");
  const c = document.getElementById("hist-lista");
  if (!filtrados.length) {
    rt.innerHTML = "";
    c.innerHTML = `<div class="vacio"><div class="vacio-icono">📅</div>
                      <p>No hay registros en este periodo.</p></div>`;
    return;
  }
  const tI = filtrados.reduce((t, h) => t + h.costoTotal, 0);
  const tV = filtrados.reduce((t, h) => t + h.totalVenta, 0);
  const tG = filtrados.reduce((t, h) => t + h.ganancia, 0);

  rt.innerHTML = `
    <div class="hist-resumen">
      <div class="hist-card"><div class="hist-label">Inversión</div>
        <div class="hist-valor">$${tI.toFixed(2)}</div></div>
      <div class="hist-card"><div class="hist-label">Ventas</div>
        <div class="hist-valor">$${tV.toFixed(2)}</div></div>
      <div class="hist-card"><div class="hist-label">Ganancia</div>
        <div class="hist-valor">$${tG.toFixed(2)}</div></div>
    </div>`;

  c.innerHTML = filtrados
    .map((h) => {
      const s = h.ganancia >= 0 ? "+" : "";
      return `
      <div class="hist-item">
        <div>
          <div class="hist-fecha">${h.fechaTexto || "Sin fecha"}</div>
          <div class="hist-pan">${h.recetaNombre}</div>
          <div class="hist-detalle">${h.panes} panes · $${(h.precio || 0).toFixed(2)}/pan</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="hist-ganancia ${h.ganancia >= 0 ? "pos" : "neg"}">
            ${s}$${(h.ganancia || 0).toFixed(2)}
          </div>
          <button class="btn btn-sm btn-editar"   onclick="editarHist('${h.id}')">✏️</button>
          <button class="btn btn-sm btn-eliminar" onclick="eliminarHist('${h.id}')">✕</button>
        </div>
      </div>`;
    })
    .join("");
}

// ══════════════════════════════════════════════════
// 10. MÓDULO: ESTADÍSTICAS
// ══════════════════════════════════════════════════

window.filtrarStats = function (rango, btn) {
  document
    .querySelectorAll("#tab-estadisticas .filtro-btn")
    .forEach((b) => b.classList.remove("activo"));
  btn.classList.add("activo");
  dibujarStats(rango);
};

function dibujarStats(rango = "todo") {
  const c = document.getElementById("stats-con");
  const filtrados = historial.filter((h) => {
    const ts = h.fecha?.toDate
      ? h.fecha.toDate()
      : h.fecha instanceof Date
        ? h.fecha
        : new Date(h.fecha);
    return esMismaFecha(ts, rango);
  });
  if (!filtrados.length) {
    c.innerHTML = `<div class="vacio"><div class="vacio-icono">📊</div>
                     <p>No hay producciones en este periodo.</p></div>`;
    return;
  }

  const tG = filtrados.reduce((t, h) => t + h.ganancia, 0);
  const tV = filtrados.reduce((t, h) => t + h.totalVenta, 0);
  const tP = filtrados.reduce((t, h) => t + h.panes, 0);

  const porPan = {};
  filtrados.forEach((h) => {
    if (!porPan[h.recetaNombre])
      porPan[h.recetaNombre] = { ganancia: 0, veces: 0, panes: 0 };
    porPan[h.recetaNombre].ganancia += h.ganancia;
    porPan[h.recetaNombre].veces++;
    porPan[h.recetaNombre].panes += h.panes;
  });
  const ranking = Object.entries(porPan).sort(
    (a, b) => b[1].ganancia - a[1].ganancia,
  );
  const maxG = ranking[0]?.[1].ganancia || 1;

  const porTipo = {};
  clientes.forEach((cli) => {
    (cli.ventas || []).forEach((v) => {
      const panes = v.panes || [
        { cantidad: v.cantidad, precioUnit: v.precioUnit },
      ];
      const total = panes.reduce(
        (t, p) => t + (p.cantidad || 0) * (p.precioUnit || 0),
        0,
      );
      if (!porTipo[cli.tipo]) porTipo[cli.tipo] = 0;
      porTipo[cli.tipo] += total;
    });
  });
  const rankingTipo = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
  const maxT = rankingTipo[0]?.[1] || 1;

  c.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card sc-dorado">
        <div class="stat-label">Ganancia total</div>
        <div class="stat-valor">$${tG.toFixed(2)}</div>
      </div>
      <div class="stat-card sc-verde">
        <div class="stat-label">Total vendido</div>
        <div class="stat-valor">$${tV.toFixed(2)}</div>
      </div>
      <div class="stat-card sc-azul">
        <div class="stat-label">Panes</div>
        <div class="stat-valor">${tP}</div>
      </div>
      <div class="stat-card sc-cafe">
        <div class="stat-label">Producciones</div>
        <div class="stat-valor">${filtrados.length}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-titulo">🏆 Pan más rentable</div>
      ${ranking
        .map(
          ([nom, data], i) => `
        <div class="ranking-item">
          <div class="ranking-num ${i === 0 ? "oro" : ""}">${i + 1}</div>
          <div class="ranking-info">
            <div class="ranking-nom">${nom}</div>
            <div class="ranking-det">${data.veces} producción(es) · ${data.panes} panes</div>
            <div class="barra-wrap">
              <div class="barra-fill" style="width:${Math.round((data.ganancia / maxG) * 100)}%"></div>
            </div>
          </div>
          <div class="ranking-tot">$${data.ganancia.toFixed(2)}</div>
        </div>`,
        )
        .join("")}
    </div>

    ${
      rankingTipo.length
        ? `
    <div class="card">
      <div class="card-titulo">🏪 Ventas por tipo de cliente</div>
      ${rankingTipo
        .map(
          ([tipo, total]) => `
        <div class="ranking-item">
          <div style="flex:1">
            <div class="ranking-nom">${TIPOS[tipo] || tipo}</div>
            <div class="barra-wrap">
              <div class="barra-fill" style="width:${Math.round((total / maxT) * 100)}%"></div>
            </div>
          </div>
          <div class="ranking-tot">$${total.toFixed(2)}</div>
        </div>`,
        )
        .join("")}
    </div>`
        : ""
    }`;
}

// ══════════════════════════════════════════════════
// 11. MÓDULO: CLIENTES
// ══════════════════════════════════════════════════

window.agregarCli = async function () {
  const nombre = document.getElementById("cli-nom").value.trim();
  const tipo = document.getElementById("cli-tip").value;
  const tel = document.getElementById("cli-tel").value.trim();
  const dir = document.getElementById("cli-dir").value.trim();
  if (!nombre) {
    toast("Escribe el nombre");
    return;
  }
  if (clientes.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) {
    toast("Ya existe un cliente con ese nombre");
    return;
  }
  syncSync();
  try {
    await addDoc(collection(db, "clientes"), {
      nombre,
      tipo,
      tel,
      dir,
      ventas: [],
      deudas: [],
      pedidosReg: [],
      creadoEn: serverTimestamp(),
    });
    document.getElementById("cli-nom").value = "";
    document.getElementById("cli-tel").value = "";
    document.getElementById("cli-dir").value = "";
    toast("Cliente agregado ✓");
    syncOk();
  } catch (e) {
    syncErr();
    toast("Error");
  }
};

window.editarCli = function (id) {
  const cli = clientes.find((c) => c.id === id);
  if (!cli) return;
  const opcionsTipo = Object.entries(TIPOS)
    .map(
      ([val, label]) =>
        `<option value="${val}"${cli.tipo === val ? " selected" : ""}>${label}</option>`,
    )
    .join("");
  const body = `
    <div class="campo"><label>Nombre</label>
      <input type="text" id="mc-nom" value="${cli.nombre}"></div>
    <div class="campo"><label>Tipo</label>
      <div class="select-wrap"><select id="mc-tip">${opcionsTipo}</select></div></div>
    <div class="fila">
      <div class="campo"><label>Teléfono</label>
        <input type="text" id="mc-tel" value="${cli.tel || ""}"></div>
      <div class="campo"><label>Dirección</label>
        <input type="text" id="mc-dir" value="${cli.dir || ""}"></div>
    </div>`;
  abrirModalEditar(`✏️ Editar: ${cli.nombre}`, body, async () => {
    const nombre = document.getElementById("mc-nom").value.trim();
    const tipo = document.getElementById("mc-tip").value;
    const tel = document.getElementById("mc-tel").value.trim();
    const dir = document.getElementById("mc-dir").value.trim();
    if (!nombre) {
      toast("Escribe el nombre");
      return;
    }
    syncSync();
    try {
      await setDoc(
        doc(db, "clientes", id),
        { nombre, tipo, tel, dir },
        { merge: true },
      );
      cerrarModalEditar();
      toast("Cliente actualizado ✓");
      syncOk();
    } catch (e) {
      syncErr();
      toast("Error");
    }
  });
};

window.eliminarCli = function (id) {
  const cli = clientes.find((c) => c.id === id);
  confirmar({
    icono: "🗑️",
    titulo: `Eliminar "${cli.nombre}"`,
    desc: "Se eliminarán el cliente y todos sus datos (ventas, deudas, pedidos).",
    accion: async () => {
      syncSync();
      try {
        await deleteDoc(doc(db, "clientes", id));
        toast("Cliente eliminado");
        syncOk();
      } catch (e) {
        syncErr();
        toast("Error");
      }
    },
  });
};

window.toggleCli = function (id) {
  document.getElementById("ccb-" + id).classList.toggle("abierto");
  document.getElementById("cch-" + id).classList.toggle("abierto");
};

window.verTabCli = function (cliId, tab) {
  ["ventas", "deudas", "regulares", "stats"].forEach((t) => {
    const panel = document.getElementById(`ct-${t}-${cliId}`);
    const btn = document.getElementById(`ctb-${t}-${cliId}`);
    if (panel) panel.style.display = t === tab ? "block" : "none";
    if (btn) btn.classList.toggle("activo", t === tab);
  });
};

let busquedaCli = "";
window.buscarCli = function (valor) {
  busquedaCli = valor.toLowerCase();
  dibujarClis();
};

function refrescarSelects() {
  const optsCli =
    '<option value="">Selecciona cliente</option>' +
    clientes
      .map((c) => `<option value="${c.id}">${c.nombre}</option>`)
      .join("");
  const optsRec =
    '<option value="">Selecciona pan</option>' +
    recetas.map((r) => `<option value="${r.id}">${r.nombre}</option>`).join("");

  ["vta-cli", "reg-cli"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = optsCli;
  });
  ["reg-rec"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = optsRec;
  });
  document.querySelectorAll(".vf-rec").forEach((sel) => {
    const prev = sel.value;
    sel.innerHTML = optsRec;
    if (prev) sel.value = prev;
  });
}

function dibujarClis() {
  const totalDeuda = clientes.reduce(
    (s, c) => s + (c.deudas || []).reduce((t, d) => t + d.monto, 0),
    0,
  );
  const diaActual = DIA_IDX[new Date().getDay()];
  let pedHoy = 0,
    panSem = 0;
  clientes.forEach((cli) => {
    (cli.pedidosReg || []).forEach((r) => {
      panSem += r.cantidad * r.dias.length;
      if (r.dias.includes(diaActual)) pedHoy += r.cantidad;
    });
  });

  const _set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  _set("cli-cnt", clientes.length);
  _set("cli-cnt2", clientes.length);
  _set("cli-ped-hoy", pedHoy);
  _set("cli-pan-sem", panSem);
  _set("cli-deuda-tot", `$${totalDeuda.toFixed(2)}`);

  // Panel de alertas (inactivos +7 días)
  const hoy7 = new Date();
  hoy7.setDate(hoy7.getDate() - 7);
  const inactivos = clientes.filter((cli) => {
    const ventas = cli.ventas || [];
    if (!ventas.length) return true;
    const ultima = ventas.reduce((max, v) => Math.max(max, v.ts || 0), 0);
    return ultima < hoy7.getTime();
  });
  const panelAl = document.getElementById("cli-alertas-panel");
  const listaAl = document.getElementById("cli-alertas-lista");
  if (inactivos.length) {
    panelAl.style.display = "block";
    listaAl.innerHTML = inactivos
      .map((cli) => {
        const ventas = cli.ventas || [];
        const ultima = ventas.length
          ? ventas.reduce((max, v) => Math.max(max, v.ts || 0), 0)
          : 0;
        const dias = ultima
          ? Math.floor((Date.now() - ultima) / 86400000)
          : "?";
        return `
        <div class="alerta-item">
          <span class="alerta-nombre">${cli.nombre}</span>
          <span class="alerta-dias">${dias} día(s) sin comprar</span>
        </div>`;
      })
      .join("");
  } else {
    panelAl.style.display = "none";
  }

  // Lista de clientes
  const c = document.getElementById("cli-lista");
  let lista = clientes;
  if (busquedaCli)
    lista = lista.filter((cl) => cl.nombre.toLowerCase().includes(busquedaCli));
  if (!lista.length) {
    c.innerHTML = `<div class="vacio"><div class="vacio-icono">👥</div>
                     <p>${busquedaCli ? "Sin resultados." : "No hay clientes aún."}</p></div>`;
    refrescarSelects();
    dibujarRankings();
    return;
  }

  c.innerHTML = lista
    .map((cli) => {
      const deudaTotal = (cli.deudas || []).reduce((t, d) => t + d.monto, 0);
      const ventaTotal = (cli.ventas || []).reduce((t, v) => {
        const panes = v.panes || [
          { cantidad: v.cantidad, precioUnit: v.precioUnit },
        ];
        return (
          t +
          panes.reduce((s, p) => s + (p.cantidad || 0) * (p.precioUnit || 0), 0)
        );
      }, 0);
      const panesTotales = (cli.ventas || []).reduce((t, v) => {
        const panes = v.panes || [{ cantidad: v.cantidad }];
        return t + panes.reduce((s, p) => s + (p.cantidad || 0), 0);
      }, 0);
      const tieneRegHoy = (cli.pedidosReg || []).some((r) =>
        r.dias.includes(diaActual),
      );
      const esFrecuente =
        (cli.ventas || []).filter((v) => {
          const d = v.ts ? new Date(v.ts) : null;
          if (!d) return false;
          const h = new Date();
          return (
            d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear()
          );
        }).length >= 4;

      let badges = "";
      if (esFrecuente)
        badges += `<span class="badge-estado badge-frecuente">⭐ Frecuente</span>`;
      if (tieneRegHoy)
        badges += `<span class="badge-estado badge-entrega">📦 Entrega hoy</span>`;
      if (deudaTotal > 0)
        badges += `<span class="badge-estado badge-debe">Debe $${deudaTotal.toFixed(2)}</span>`;
      else badges += `<span class="badge-estado badge-al-dia">✅ Al día</span>`;

      const tabVentas = _htmlTabVentas(cli);
      const tabDeudas = _htmlTabDeudas(cli);
      const tabRegulares = _htmlTabRegulares(cli);
      const tabStats = _htmlTabStats(cli);

      return `
      <div class="cliente-card">
        <div class="cliente-header" id="cch-${cli.id}" onclick="toggleCli('${cli.id}')">
          <div class="cliente-info-wrap">
            <div class="cliente-avatar">${emojiTipo(cli.tipo)}</div>
            <div style="min-width:0">
              <div class="cliente-nombre">${cli.nombre}</div>
              <div class="cliente-tipo">${TIPOS[cli.tipo] || cli.tipo}${cli.tel ? " · " + cli.tel : ""}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end;flex-shrink:0">
            ${badges}
            <button class="btn btn-sm btn-editar"
              onclick="event.stopPropagation();editarCli('${cli.id}')">✏️</button>
            <button class="btn btn-sm btn-eliminar"
              onclick="event.stopPropagation();eliminarCli('${cli.id}')">✕</button>
            <span style="color:var(--cafe-claro);font-size:.8rem">▾</span>
          </div>
        </div>

        <div class="cliente-body" id="ccb-${cli.id}">
          <div class="cli-mini-stats">
            <div class="cli-mini-stat">
              <div class="cli-mini-label">Total comprado</div>
              <div class="cli-mini-valor">$${ventaTotal.toFixed(2)}</div>
            </div>
            <div class="cli-mini-stat">
              <div class="cli-mini-label">Panes totales</div>
              <div class="cli-mini-valor">${panesTotales}</div>
            </div>
            <div class="cli-mini-stat">
              <div class="cli-mini-label"># Compras</div>
              <div class="cli-mini-valor">${(cli.ventas || []).length}</div>
            </div>
          </div>

          <div class="cli-tabs">
            <button class="cli-tab-btn activo" id="ctb-ventas-${cli.id}"
              onclick="verTabCli('${cli.id}','ventas')">🛍️ Ventas</button>
            <button class="cli-tab-btn" id="ctb-deudas-${cli.id}"
              onclick="verTabCli('${cli.id}','deudas')">
              💳 Deudas${deudaTotal > 0 ? " ⚠️" : ""}
            </button>
            <button class="cli-tab-btn" id="ctb-regulares-${cli.id}"
              onclick="verTabCli('${cli.id}','regulares')">🔁 Regulares</button>
            <button class="cli-tab-btn" id="ctb-stats-${cli.id}"
              onclick="verTabCli('${cli.id}','stats')">📊 Stats</button>
          </div>

          <div id="ct-ventas-${cli.id}">${tabVentas}</div>
          <div id="ct-deudas-${cli.id}" style="display:none">${tabDeudas}</div>
          <div id="ct-regulares-${cli.id}" style="display:none">${tabRegulares}</div>
          <div id="ct-stats-${cli.id}" style="display:none">${tabStats}</div>
        </div>
      </div>`;
    })
    .join("");

  refrescarSelects();
  dibujarRankings();
}

function _htmlTabVentas(cli) {
  const ventas = (cli.ventas || []).slice().reverse();
  if (!ventas.length)
    return `<p style="font-size:.82rem;color:var(--texto-s);padding:8px 0">Sin ventas registradas aún.</p>`;
  return (
    ventas
      .slice(0, 10)
      .map((v) => {
        const panes = v.panes || [
          {
            cantidad: v.cantidad,
            recetaNombre: v.recetaNombre,
            precioUnit: v.precioUnit,
          },
        ];
        const total = panes.reduce(
          (t, p) => t + (p.cantidad || 0) * (p.precioUnit || 0),
          0,
        );
        const resumen = panes
          .map((p) => `${p.cantidad} × ${p.recetaNombre}`)
          .join(", ");
        return `
      <div class="venta-item">
        <div>
          <div class="vi-pan">🍞 ${resumen}</div>
          <div class="vi-det">${v.fecha || ""}${v.nota ? " · " + v.nota : ""} · $${panes[0]?.precioUnit?.toFixed(2) || "?"}/u</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="vi-monto ${v.pago}">$${total.toFixed(2)}</div>
          <div style="font-size:.67rem;color:var(--texto-s)">${v.pago === "pagado" ? "✅ Pagado" : "⏳ Fiado"}</div>
          <button class="btn btn-sm btn-editar"   style="margin-top:3px" onclick="editarVenta('${cli.id}',${v.id})">✏️</button>
          <button class="btn btn-sm btn-eliminar" style="margin-top:3px" onclick="eliminarVenta('${cli.id}',${v.id})">✕</button>
        </div>
      </div>`;
      })
      .join("") +
    (ventas.length > 10
      ? `<p style="font-size:.73rem;color:var(--texto-s);text-align:center;padding-top:4px">+ ${ventas.length - 10} ventas anteriores</p>`
      : "")
  );
}

function _htmlTabDeudas(cli) {
  const deudas = cli.deudas || [];
  let html = "";
  if (!deudas.length) {
    html += `<p style="font-size:.82rem;color:var(--verde);padding:8px 0">✅ Sin deudas pendientes</p>`;
  } else {
    html += deudas
      .map(
        (d) => `
      <div class="deuda-item">
        <div>
          <div class="deuda-desc">${d.desc}</div>
          <div class="deuda-fecha">${d.fecha}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="deuda-monto">$${d.monto.toFixed(2)}</div>
          <button class="btn btn-sm btn-verde" onclick="pagarDeuda('${cli.id}',${d.id})">✓ Pagó</button>
        </div>
      </div>`,
      )
      .join("");
  }
  html += `
    <div class="divider"></div>
    <p class="nota-sec">Agregar deuda manual</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input type="text"   id="deu-d-${cli.id}" placeholder="Descripción" style="flex:1;min-width:120px">
      <input type="number" id="deu-m-${cli.id}" placeholder="$" step="0.01" min="0" style="max-width:80px">
      <button class="btn btn-oscuro btn-sm" style="width:auto" onclick="agregarDeuda('${cli.id}')">+ Deuda</button>
    </div>`;
  return html;
}

function _htmlTabRegulares(cli) {
  const regs = cli.pedidosReg || [];
  if (!regs.length)
    return `<p style="font-size:.82rem;color:var(--texto-s);padding:8px 0">Sin pedidos regulares. Configúralos abajo.</p>`;
  const totSem = regs.reduce((t, r) => t + r.cantidad * r.dias.length, 0);
  return (
    regs
      .map(
        (r) => `
    <div class="regular-item">
      <div class="reg-info">
        <div class="reg-nombre">🍞 ${r.cantidad} × ${r.recetaNombre}</div>
        <div class="reg-dias-wrap">
          ${r.dias.map((d) => `<span class="dia-badge">${DIAS_NOM[d] || d}</span>`).join("")}
        </div>
      </div>
      <button class="btn btn-sm btn-eliminar" onclick="eliminarReg('${cli.id}',${r.id})">✕</button>
    </div>`,
      )
      .join("") +
    `<p style="font-size:.77rem;color:var(--texto-s);margin-top:7px">📦 Total estimado: <strong>${totSem} panes/semana</strong></p>`
  );
}

function _htmlTabStats(cli) {
  const ventas = cli.ventas || [];
  if (!ventas.length)
    return `<p style="font-size:.82rem;color:var(--texto-s);padding:8px 0">Sin ventas aún.</p>`;

  const porPan = {};
  ventas.forEach((v) => {
    const panes = v.panes || [
      { recetaNombre: v.recetaNombre, cantidad: v.cantidad },
    ];
    panes.forEach((p) => {
      if (!porPan[p.recetaNombre]) porPan[p.recetaNombre] = 0;
      porPan[p.recetaNombre] += p.cantidad || 0;
    });
  });
  const favs = Object.entries(porPan).sort((a, b) => b[1] - a[1]);
  const maxF = favs[0]?.[1] || 1;

  return `
    <p class="nota-sec">Panes favoritos</p>
    ${favs
      .map(
        ([nom, cant]) => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px">
        <span style="flex:1;font-size:.84rem;color:var(--cafe-rico)">${nom}</span>
        <div style="width:80px">
          <div class="barra-wrap">
            <div class="barra-fill" style="width:${Math.round((cant / maxF) * 100)}%"></div>
          </div>
        </div>
        <span style="font-size:.78rem;font-weight:700;color:var(--cafe-mid);min-width:30px;text-align:right">${cant}</span>
      </div>`,
      )
      .join("")}`;
}

// ══════════════════════════════════════════════════
// 12. MÓDULO: VENTAS MULTI-PAN
// ══════════════════════════════════════════════════

let contadorFilas = 0;

function agregarFilaVentaInicial() {
  contadorFilas = 0;
  document.getElementById("vta-filas").innerHTML = "";
  agregarFilaVenta();
}

window.agregarFilaVenta = function () {
  const id = contadorFilas++;
  const optsRec = recetas
    .map((r) => `<option value="${r.id}">${r.nombre}</option>`)
    .join("");
  const fila = document.createElement("div");
  fila.className = "vta-fila";
  fila.id = `vf-${id}`;
  fila.innerHTML = `
    <div class="campo" style="flex:2;margin-bottom:0">
      <label style="font-size:.65rem">Pan</label>
      <div class="select-wrap">
        <select class="vf-rec" data-fila="${id}" onchange="onSelRecVenta(${id})">
          <option value="">Tipo de pan</option>${optsRec}
        </select>
      </div>
    </div>
    <div class="campo campo-cant" style="margin-bottom:0">
      <label style="font-size:.65rem">Cantidad</label>
      <input type="number" class="vf-cant" data-fila="${id}" placeholder="0" min="1" oninput="recalcularTotal()">
    </div>
    <div class="campo campo-pre" style="margin-bottom:0">
      <label style="font-size:.65rem">Precio/u ($)</label>
      <input type="number" class="vf-pre" data-fila="${id}" placeholder="0.00" step="0.01" min="0" oninput="recalcularTotal()">
    </div>
    ${
      id > 0
        ? `<button class="btn btn-sm btn-eliminar" style="align-self:flex-end;width:auto"
           onclick="quitarFilaVenta(${id})">✕</button>`
        : '<div style="width:32px"></div>'
    }`;
  document.getElementById("vta-filas").appendChild(fila);
};

window.onSelRecVenta = function (id) {
  const recId = document.querySelector(`.vf-rec[data-fila="${id}"]`).value;
  const rec = recetas.find((r) => r.id === recId);
  if (rec && rec.precio) {
    document.querySelector(`.vf-pre[data-fila="${id}"]`).value =
      rec.precio.toFixed(2);
    recalcularTotal();
  }
};

window.quitarFilaVenta = function (id) {
  const fila = document.getElementById(`vf-${id}`);
  if (fila) fila.remove();
  recalcularTotal();
};

window.recalcularTotal = function () {
  let total = 0;
  document.querySelectorAll(".vta-fila").forEach((fila) => {
    const cant = parseFloat(fila.querySelector(".vf-cant")?.value) || 0;
    const pre = parseFloat(fila.querySelector(".vf-pre")?.value) || 0;
    total += cant * pre;
  });
  document.getElementById("vta-total-display").textContent =
    `$${total.toFixed(2)}`;
};

window.registrarVenta = async function () {
  const cliId = document.getElementById("vta-cli").value;
  const fecha = document.getElementById("vta-fecha").value;
  const pago = document.getElementById("vta-pago").value;
  const nota = document.getElementById("vta-nota").value.trim();
  if (!cliId) {
    toast("Selecciona un cliente");
    return;
  }

  const panesData = [];
  let valido = true;
  document.querySelectorAll(".vta-fila").forEach((fila) => {
    const recId = fila.querySelector(".vf-rec")?.value;
    const cantidad = parseInt(fila.querySelector(".vf-cant")?.value);
    const precioUnit = parseFloat(fila.querySelector(".vf-pre")?.value);
    if (
      !recId ||
      !cantidad ||
      cantidad < 1 ||
      isNaN(precioUnit) ||
      precioUnit <= 0
    ) {
      valido = false;
      return;
    }
    const rec = recetas.find((r) => r.id === recId);
    panesData.push({
      recetaId: recId,
      recetaNombre: rec?.nombre || "?",
      cantidad,
      precioUnit,
    });
  });
  if (!valido || !panesData.length) {
    toast("Completa todos los panes (tipo, cantidad y precio)");
    return;
  }

  const total = panesData.reduce((t, p) => t + p.cantidad * p.precioUnit, 0);
  const fechaTxt = fechaDeInput(fecha);
  const cli = clientes.find((c) => c.id === cliId);
  const nuevaVenta = {
    id: Date.now(),
    panes: panesData,
    total,
    pago,
    nota,
    fecha: fechaTxt,
    ts: Date.now(),
  };

  const ventas = [...(cli.ventas || []), nuevaVenta];
  let deudas = cli.deudas || [];
  if (pago === "fiado") {
    const descDeuda = panesData
      .map((p) => `${p.cantidad} ${p.recetaNombre}`)
      .join(", ");
    deudas = [
      ...deudas,
      { id: Date.now() + 1, desc: descDeuda, monto: total, fecha: fechaTxt },
    ];
  }

  syncSync();
  try {
    await setDoc(
      doc(db, "clientes", cliId),
      { ventas, deudas },
      { merge: true },
    );
    document.getElementById("vta-cli").value = "";
    document.getElementById("vta-nota").value = "";
    agregarFilaVentaInicial();
    toast(`Venta registrada ✓${pago === "fiado" ? " — Queda fiado" : ""}`);
    syncOk();
  } catch (e) {
    syncErr();
    toast("Error");
  }
};

window.editarVenta = function (cliId, ventaId) {
  const cli = clientes.find((c) => c.id === cliId);
  const venta = (cli.ventas || []).find((v) => v.id === ventaId);
  if (!venta) return;

  const panes = venta.panes || [
    {
      cantidad: venta.cantidad,
      recetaNombre: venta.recetaNombre,
      precioUnit: venta.precioUnit,
    },
  ];

  const filasHTML = panes
    .map(
      (p, i) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;
                padding:8px;background:var(--crema);border-radius:10px">
      <span style="font-size:.82rem;font-weight:600;color:var(--cafe-rico);flex:2">${p.recetaNombre}</span>
      <input type="number" id="ev-cant-${i}" value="${p.cantidad}"    min="1" style="width:70px" oninput="evTotal()">
      <span style="font-size:.75rem;color:var(--texto-s)">× $</span>
      <input type="number" id="ev-pre-${i}"  value="${p.precioUnit}" step="0.01" min="0" style="width:75px" oninput="evTotal()">
    </div>`,
    )
    .join("");

  const body = `
    ${filasHTML}
    <div style="text-align:right;font-size:.88rem;color:var(--texto-s);margin-top:4px">
      Total: <strong id="ev-total">$0</strong>
    </div>
    <div class="campo" style="margin-top:12px">
      <label>Estado de pago</label>
      <div class="select-wrap">
        <select id="ev-pago">
          <option value="pagado"${venta.pago === "pagado" ? " selected" : ""}>✅ Pagado</option>
          <option value="fiado"${venta.pago === "fiado" ? " selected" : ""}>⏳ Fiado</option>
        </select>
      </div>
    </div>`;

  window.evTotal = () => {
    let t = 0;
    panes.forEach((_, i) => {
      t +=
        (parseFloat(document.getElementById(`ev-cant-${i}`)?.value) || 0) *
        (parseFloat(document.getElementById(`ev-pre-${i}`)?.value) || 0);
    });
    const el = document.getElementById("ev-total");
    if (el) el.textContent = `$${t.toFixed(2)}`;
  };

  abrirModalEditar("✏️ Editar venta", body, async () => {
    const nuevosPanes = panes.map((p, i) => ({
      ...p,
      cantidad:
        parseInt(document.getElementById(`ev-cant-${i}`)?.value) || p.cantidad,
      precioUnit:
        parseFloat(document.getElementById(`ev-pre-${i}`)?.value) ||
        p.precioUnit,
    }));
    const pago = document.getElementById("ev-pago").value;
    const total = nuevosPanes.reduce(
      (t, p) => t + p.cantidad * p.precioUnit,
      0,
    );
    const ventas = (cli.ventas || []).map((v) =>
      v.id === ventaId ? { ...v, panes: nuevosPanes, total, pago } : v,
    );
    syncSync();
    try {
      await setDoc(doc(db, "clientes", cliId), { ventas }, { merge: true });
      cerrarModalEditar();
      toast("Venta actualizada ✓");
      syncOk();
    } catch (e) {
      syncErr();
      toast("Error");
    }
  });

  setTimeout(() => window.evTotal(), 50);
};

window.eliminarVenta = function (cliId, ventaId) {
  confirmar({
    icono: "🗑️",
    titulo: "Eliminar venta",
    desc: "Se eliminará esta venta del historial del cliente.",
    accion: async () => {
      const cli = clientes.find((c) => c.id === cliId);
      const ventas = (cli.ventas || []).filter((v) => v.id !== ventaId);
      syncSync();
      try {
        await setDoc(doc(db, "clientes", cliId), { ventas }, { merge: true });
        toast("Venta eliminada");
        syncOk();
      } catch (e) {
        syncErr();
        toast("Error");
      }
    },
  });
};

// ══════════════════════════════════════════════════
// 13. MÓDULO: PEDIDOS REGULARES
// ══════════════════════════════════════════════════

let diasSeleccionados = [];

window.toggleDia = function (btn) {
  const dia = btn.dataset.dia;
  btn.classList.toggle("seleccionado");
  if (diasSeleccionados.includes(dia)) {
    diasSeleccionados = diasSeleccionados.filter((d) => d !== dia);
  } else {
    diasSeleccionados.push(dia);
  }
};

window.guardarPedidoReg = async function () {
  const cliId = document.getElementById("reg-cli").value;
  const recId = document.getElementById("reg-rec").value;
  const cant = parseInt(document.getElementById("reg-cant").value);
  if (!cliId) {
    toast("Selecciona un cliente");
    return;
  }
  if (!recId) {
    toast("Selecciona el tipo de pan");
    return;
  }
  if (!cant || cant < 1) {
    toast("Ingresa la cantidad");
    return;
  }
  if (!diasSeleccionados.length) {
    toast("Selecciona al menos un día");
    return;
  }

  const rec = recetas.find((r) => r.id === recId);
  const cli = clientes.find((c) => c.id === cliId);
  const reg = {
    id: Date.now(),
    recetaId: recId,
    recetaNombre: rec?.nombre || "?",
    cantidad: cant,
    dias: [...diasSeleccionados],
  };
  const regs = [
    ...(cli.pedidosReg || []).filter((r) => r.recetaId !== recId),
    reg,
  ];

  syncSync();
  try {
    await setDoc(
      doc(db, "clientes", cliId),
      { pedidosReg: regs },
      { merge: true },
    );
    document.getElementById("reg-cli").value = "";
    document.getElementById("reg-rec").value = "";
    document.getElementById("reg-cant").value = "";
    diasSeleccionados = [];
    document
      .querySelectorAll(".dia-btn")
      .forEach((b) => b.classList.remove("seleccionado"));
    toast("Pedido regular guardado ✓");
    syncOk();
  } catch (e) {
    syncErr();
    toast("Error");
  }
};

window.eliminarReg = async function (cliId, regId) {
  const cli = clientes.find((c) => c.id === cliId);
  const regs = (cli.pedidosReg || []).filter((r) => r.id !== regId);
  syncSync();
  try {
    await setDoc(
      doc(db, "clientes", cliId),
      { pedidosReg: regs },
      { merge: true },
    );
    syncOk();
  } catch (e) {
    syncErr();
  }
};

// ══════════════════════════════════════════════════
// 14. MÓDULO: DEUDAS
// ══════════════════════════════════════════════════

window.agregarDeuda = async function (cliId) {
  const desc = document.getElementById("deu-d-" + cliId).value.trim();
  const monto = parseFloat(document.getElementById("deu-m-" + cliId).value);
  if (!desc || isNaN(monto) || monto <= 0) {
    toast("Completa descripción y monto");
    return;
  }
  const cli = clientes.find((c) => c.id === cliId);
  const nuevasDeudas = [
    ...(cli.deudas || []),
    { id: Date.now(), desc, monto, fecha: fechaHoy() },
  ];
  syncSync();
  try {
    await setDoc(
      doc(db, "clientes", cliId),
      { deudas: nuevasDeudas },
      { merge: true },
    );
    toast("Deuda registrada ✓");
    syncOk();
  } catch (e) {
    syncErr();
    toast("Error");
  }
};

window.pagarDeuda = function (cliId, deuId) {
  confirmar({
    icono: "✅",
    titulo: "Marcar como pagada",
    desc: "¿Confirmas que este cliente pagó esta deuda?",
    btnTxt: "Sí, pagó",
    btnCls: "btn-verde",
    accion: async () => {
      const cli = clientes.find((c) => c.id === cliId);
      const nuevasDeudas = (cli.deudas || []).filter((d) => d.id !== deuId);
      syncSync();
      try {
        await setDoc(
          doc(db, "clientes", cliId),
          { deudas: nuevasDeudas },
          { merge: true },
        );
        toast("Deuda marcada como pagada ✓");
        syncOk();
      } catch (e) {
        syncErr();
        toast("Error");
      }
    },
  });
};

// ══════════════════════════════════════════════════
// 15. MÓDULO: HISTORIAL GENERAL DE VENTAS
// ══════════════════════════════════════════════════

window.filtrarHistVentas = function (rango, btn) {
  document
    .querySelectorAll(".filtros-compactos .filtro-btn")
    .forEach((b) => b.classList.remove("activo"));
  btn.classList.add("activo");
  filtroHV = rango;
  dibujarHistVentas(rango);
};

function dibujarHistVentas(rango) {
  const todasVentas = [];
  clientes.forEach((cli) => {
    (cli.ventas || []).forEach((v) => {
      const tsVenta = v.ts || (v.fecha ? new Date(v.fecha).getTime() : 0);
      if (!esMismaFecha(tsVenta, rango)) return;
      const panes = v.panes || [
        {
          recetaNombre: v.recetaNombre,
          cantidad: v.cantidad,
          precioUnit: v.precioUnit,
        },
      ];
      const total = panes.reduce(
        (t, p) => t + (p.cantidad || 0) * (p.precioUnit || 0),
        0,
      );
      todasVentas.push({
        ...v,
        total,
        clienteNombre: cli.nombre,
        clienteTipo: cli.tipo,
      });
    });
  });
  todasVentas.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const res = document.getElementById("hv-resumen");
  const lst = document.getElementById("hv-lista");

  if (!todasVentas.length) {
    res.innerHTML = "";
    lst.innerHTML = `<div class="vacio"><div class="vacio-icono">🛍️</div><p>No hay ventas en este periodo.</p></div>`;
    return;
  }

  const tTotal = todasVentas.reduce((t, v) => t + v.total, 0);
  const tPagado = todasVentas
    .filter((v) => v.pago === "pagado")
    .reduce((t, v) => t + v.total, 0);
  const tFiado = todasVentas
    .filter((v) => v.pago === "fiado")
    .reduce((t, v) => t + v.total, 0);

  res.innerHTML = `
    <div class="hv-resumen-wrap">
      <div class="hv-res-card">
        <div class="hv-res-label">Total</div>
        <div class="hv-res-valor">$${tTotal.toFixed(2)}</div>
      </div>
      <div class="hv-res-card">
        <div class="hv-res-label">Pagado</div>
        <div class="hv-res-valor" style="color:var(--verde)">$${tPagado.toFixed(2)}</div>
      </div>
      <div class="hv-res-card">
        <div class="hv-res-label">Fiado</div>
        <div class="hv-res-valor" style="color:var(--rojo)">$${tFiado.toFixed(2)}</div>
      </div>
    </div>`;

  lst.innerHTML =
    todasVentas
      .slice(0, 30)
      .map((v) => {
        const panes = v.panes || [
          { recetaNombre: v.recetaNombre, cantidad: v.cantidad },
        ];
        const resumen = panes
          .map((p) => `${p.cantidad} × ${p.recetaNombre}`)
          .join(", ");
        return `
      <div class="hv-item">
        <div class="hv-header">
          <div>
            <div class="hv-cli">${v.clienteNombre}</div>
            <div class="hv-tipo">${TIPOS[v.clienteTipo] || ""}</div>
          </div>
          <div style="text-align:right">
            <div class="hv-fecha">${v.fecha || ""}</div>
            <div class="hv-total ${v.pago}">$${v.total.toFixed(2)}</div>
          </div>
        </div>
        <div style="font-size:.79rem;color:var(--texto-s)">
          🍞 ${resumen}${v.nota ? " · " + v.nota : ""}
        </div>
      </div>`;
      })
      .join("") +
    (todasVentas.length > 30
      ? `<p style="font-size:.73rem;color:var(--texto-s);text-align:center;padding:8px 0">Mostrando 30 de ${todasVentas.length} ventas</p>`
      : "");
}

// ══════════════════════════════════════════════════
// 16. MÓDULO: RANKINGS Y ALERTAS
// ══════════════════════════════════════════════════

function dibujarRankings() {
  const rankCli = clientes
    .map((cli) => {
      const total = (cli.ventas || []).reduce((t, v) => {
        const panes = v.panes || [
          { cantidad: v.cantidad, precioUnit: v.precioUnit },
        ];
        return (
          t +
          panes.reduce((s, p) => s + (p.cantidad || 0) * (p.precioUnit || 0), 0)
        );
      }, 0);
      return { nombre: cli.nombre, tipo: cli.tipo, total };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const maxC = rankCli[0]?.total || 1;
  const elRC = document.getElementById("cli-ranking");
  if (elRC) {
    elRC.innerHTML = !rankCli.length
      ? `<div class="vacio"><div class="vacio-icono">🏆</div><p>Registra ventas para ver el ranking.</p></div>`
      : rankCli
          .map(
            (cl, i) => `
          <div class="ranking-item">
            <div class="ranking-num ${i === 0 ? "oro" : ""}">${i + 1}</div>
            <div class="ranking-info">
              <div class="ranking-nom">${cl.nombre}</div>
              <div class="ranking-det">${TIPOS[cl.tipo] || cl.tipo}</div>
              <div class="barra-wrap">
                <div class="barra-fill" style="width:${Math.round((cl.total / maxC) * 100)}%"></div>
              </div>
            </div>
            <div class="ranking-tot">$${cl.total.toFixed(2)}</div>
          </div>`,
          )
          .join("");
  }

  const porPan = {};
  clientes.forEach((cli) => {
    (cli.ventas || []).forEach((v) => {
      const panes = v.panes || [
        {
          recetaNombre: v.recetaNombre,
          cantidad: v.cantidad,
          precioUnit: v.precioUnit,
        },
      ];
      panes.forEach((p) => {
        if (!porPan[p.recetaNombre])
          porPan[p.recetaNombre] = { unidades: 0, total: 0 };
        porPan[p.recetaNombre].unidades += p.cantidad || 0;
        porPan[p.recetaNombre].total += (p.cantidad || 0) * (p.precioUnit || 0);
      });
    });
  });
  const rankPan = Object.entries(porPan)
    .sort((a, b) => b[1].unidades - a[1].unidades)
    .slice(0, 8);
  const maxP = rankPan[0]?.[1].unidades || 1;

  const elRP = document.getElementById("cli-panes-ranking");
  if (elRP) {
    elRP.innerHTML = !rankPan.length
      ? `<div class="vacio"><div class="vacio-icono">🍞</div><p>Registra ventas para ver los panes favoritos.</p></div>`
      : rankPan
          .map(
            ([nom, data], i) => `
          <div class="ranking-item">
            <div class="ranking-num ${i === 0 ? "oro" : ""}">${i + 1}</div>
            <div class="ranking-info">
              <div class="ranking-nom">${nom}</div>
              <div class="ranking-det">${data.unidades} unidades · $${data.total.toFixed(2)}</div>
              <div class="barra-wrap">
                <div class="barra-fill" style="width:${Math.round((data.unidades / maxP) * 100)}%"></div>
              </div>
            </div>
          </div>`,
          )
          .join("");
  }
}

// ══════════════════════════════════════════════════
// 17. EXPORTAR CSV
// ══════════════════════════════════════════════════

window.exportarCSV = function () {
  const filas = [
    ["Fecha", "Cliente", "Tipo", "Panes", "Total", "Pago", "Nota"],
  ];
  clientes.forEach((cli) => {
    (cli.ventas || []).forEach((v) => {
      const panes = v.panes || [
        { recetaNombre: v.recetaNombre, cantidad: v.cantidad },
      ];
      const resumen = panes
        .map((p) => `${p.cantidad}x${p.recetaNombre}`)
        .join("; ");
      filas.push([
        v.fecha || "",
        cli.nombre,
        TIPOS[cli.tipo] || cli.tipo,
        `"${resumen}"`,
        (v.total || 0).toFixed(2),
        v.pago,
        v.nota || "",
      ]);
    });
  });
  const csv = filas.map((f) => f.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `niangel-ventas-${hoyParaInput()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast("CSV descargado ✓");
};

// ══════════════════════════════════════════════════
// 18. LISTENERS DE FIREBASE (onSnapshot)
// ══════════════════════════════════════════════════

onSnapshot(
  query(collection(db, "ingredientes"), orderBy("creadoEn", "asc")),
  (snap) => {
    ingredientes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    dibujarIngs();
    if (document.getElementById("tab-recetas").classList.contains("activa"))
      dibujarRecs();
    syncOk();
  },
  () => syncErr(),
);

onSnapshot(
  query(collection(db, "recetas"), orderBy("creadoEn", "asc")),
  (snap) => {
    recetas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (document.getElementById("tab-recetas").classList.contains("activa"))
      dibujarRecs();
    refrescarSelects();
    syncOk();
  },
  () => syncErr(),
);

// ✅ Historial ordenado por fecha (funciona con Date y Timestamp)
onSnapshot(
  query(collection(db, "historial"), orderBy("fecha", "asc")),
  (snap) => {
    historial = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (document.getElementById("tab-historial").classList.contains("activa"))
      dibujarHist(filtroHist);
    syncOk();
  },
  () => syncErr(),
);

onSnapshot(
  query(collection(db, "clientes"), orderBy("creadoEn", "asc")),
  (snap) => {
    clientes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (document.getElementById("tab-clientes").classList.contains("activa")) {
      dibujarClis();
      dibujarHistVentas(filtroHV);
    }
    syncOk();
  },
  () => syncErr(),
);

// ══════════════════════════════════════════════════
// 19. INICIALIZACIÓN AL CARGAR
// ══════════════════════════════════════════════════

// Fecha por defecto en venta de cliente
const inputFecha = document.getElementById("vta-fecha");
if (inputFecha) inputFecha.value = hoyParaInput();

// ✅ Fecha por defecto en producción (hoy, pero editable)
const inputFechaProd = document.getElementById("prod-fecha");
if (inputFechaProd) inputFechaProd.value = hoyParaInput();

// Primera fila de venta multi-pan
agregarFilaVentaInicial();
