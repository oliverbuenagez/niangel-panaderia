/* ═══════════════════════════════════════════════════
   NIANGEL v6.1 — JavaScript Completo
   Secciones:
     0.  PIN de acceso
     1.  Firebase
     2.  Estado global
     3.  Utilidades
     4.  Modales
     5.  Navegación
     6.  Ingredientes
     7.  Recetas
     8.  Producción
     9.  Historial de producción
    10.  Estadísticas
    11.  Clientes
    12.  Ventas multi-pan
    13.  Historial general de ventas
    14.  Rankings y alertas
    15.  Exportar CSV
    16.  Firebase listeners
    17.  Inicialización
═══════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════
// 0. PIN DE ACCESO
// ══════════════════════════════════════════════════
const PIN_CORRECTO = "2812"; // 👈 CAMBIA ESTE NÚMERO POR TU PIN
let pinIngresado = "";

// Si ya se autenticó en esta sesión, no pide el PIN de nuevo
if (sessionStorage.getItem("niangel_auth") === "ok") {
  document.getElementById("login-screen").classList.add("oculto");
}

window.presionarTecla = function (digito) {
  if (pinIngresado.length >= PIN_CORRECTO.length) return;
  pinIngresado += digito;
  _actualizarPuntos();
  if (pinIngresado.length === PIN_CORRECTO.length) _verificarPin();
};

window.borrarTecla = function () {
  pinIngresado = pinIngresado.slice(0, -1);
  _actualizarPuntos();
  const msg = document.getElementById("login-mensaje");
  msg.textContent = "Ingresa tu PIN de 4 dígitos";
  msg.classList.remove("error-txt");
};

function _actualizarPuntos() {
  for (let i = 0; i < PIN_CORRECTO.length; i++) {
    const p = document.getElementById("p" + i);
    if (!p) continue;
    p.classList.remove("lleno", "error");
    if (i < pinIngresado.length) p.classList.add("lleno");
  }
}

function _verificarPin() {
  if (pinIngresado === PIN_CORRECTO) {
    sessionStorage.setItem("niangel_auth", "ok");
    document.getElementById("login-screen").classList.add("oculto");
  } else {
    document.querySelectorAll(".punto").forEach((p) => {
      p.classList.remove("lleno");
      p.classList.add("error");
    });
    const msg = document.getElementById("login-mensaje");
    msg.textContent = "PIN incorrecto. Intenta de nuevo.";
    msg.classList.add("error-txt");
    setTimeout(() => {
      document
        .querySelectorAll(".punto")
        .forEach((p) => p.classList.remove("error"));
      msg.textContent = "Ingresa tu PIN de 4 dígitos";
      msg.classList.remove("error-txt");
      pinIngresado = "";
    }, 1000);
  }
}

// Permite usar el teclado físico del computador también
document.addEventListener("keydown", function (e) {
  if (document.getElementById("login-screen").classList.contains("oculto"))
    return;
  if (e.key >= "0" && e.key <= "9") presionarTecla(e.key);
  if (e.key === "Backspace") borrarTecla();
});

// ══════════════════════════════════════════════════
// 1. FIREBASE
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
// 2. ESTADO GLOBAL
// ══════════════════════════════════════════════════
let ingredientes = [];
let recetas = [];
let historial = [];
let clientes = [];
let filtroHV = "hoy";
let filtroHist = "hoy";
let filtroStatsMes = "";
let filtroHistMes = "";
let filtroHVMes = "";

// ══════════════════════════════════════════════════
// 3. UTILIDADES
// ══════════════════════════════════════════════════
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

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("visible");
  setTimeout(() => t.classList.remove("visible"), 2700);
}

function fechaHoy() {
  return new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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

function hoyParaInput() {
  return new Date().toISOString().split("T")[0];
}

function esMismaFecha(ts, rango) {
  let d;
  if (ts && ts.toDate) d = ts.toDate();
  else if (typeof ts === "number") d = new Date(ts);
  else if (typeof ts === "string") d = new Date(ts + "T00:00:00");
  else d = new Date(ts);
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
  return true;
}

function esMismoMes(ts, mesStr) {
  if (!mesStr) return true;
  let d;
  if (ts && ts.toDate) d = ts.toDate();
  else if (typeof ts === "number") d = new Date(ts);
  else if (typeof ts === "string") d = new Date(ts + "T00:00:00");
  else d = new Date(ts);
  const [y, m] = mesStr.split("-");
  return d.getFullYear() === parseInt(y) && d.getMonth() === parseInt(m) - 1;
}

function generarOpcionesMeses() {
  const mesesSet = new Set();
  historial.forEach((h) => {
    const d =
      typeof h.fecha === "string"
        ? new Date(h.fecha + "T00:00:00")
        : new Date(h.fecha);
    if (!isNaN(d))
      mesesSet.add(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      );
  });
  clientes.forEach((cli) => {
    (cli.ventas || []).forEach((v) => {
      const ts = v.ts || (v.fecha ? new Date(v.fecha).getTime() : 0);
      const d = new Date(ts);
      if (!isNaN(d))
        mesesSet.add(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        );
    });
  });
  const meses = [...mesesSet].sort().reverse();
  const MESES_NOM = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  return meses
    .map((m) => {
      const [y, mo] = m.split("-");
      return `<option value="${m}">${MESES_NOM[parseInt(mo) - 1]} ${y}</option>`;
    })
    .join("");
}

function poblarSelectsMeses() {
  const opts = generarOpcionesMeses();
  ["hist-mes-sel", "stats-mes-sel", "hv-mes-sel"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">📅 Mes específico</option>' + opts;
  });
}

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
  const m = {
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
  return m[tipo] || "👤";
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

window.cerrarModal = () =>
  document.getElementById("modal-overlay").classList.remove("visible");

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

window.cerrarModalEditar = () =>
  document.getElementById("modal-editar-overlay").classList.remove("visible");

window.abrirModalNuevoCli = () =>
  document.getElementById("modal-cli-overlay").classList.add("visible");

window.cerrarModalNuevoCli = () =>
  document.getElementById("modal-cli-overlay").classList.remove("visible");

// ══════════════════════════════════════════════════
// 5. NAVEGACIÓN
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
  if (tab === "historial") dibujarHist(filtroHist);
  if (tab === "estadisticas") dibujarStats("todo");
  if (tab === "clientes") {
    dibujarClis();
    dibujarHistVentas(filtroHV);
  }
};

window.verPanelTab = function (tab, btn) {
  ["venta", "historial", "ranking"].forEach((t) => {
    const el = document.getElementById("panel-" + t);
    if (el) el.style.display = t === tab ? "block" : "none";
  });
  document
    .querySelectorAll(".panel-tab")
    .forEach((b) => b.classList.remove("activo"));
  btn.classList.add("activo");
  if (tab === "historial") dibujarHistVentas(filtroHV);
  if (tab === "ranking") dibujarRankings();
};

// ══════════════════════════════════════════════════
// 6. INGREDIENTES
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
      desc: `"${dup.nombre}" ya está en tu bodega. ¿Quieres editarlo?`,
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
    ["ing-nom", "ing-cant", "ing-uni", "ing-pre"].forEach(
      (id) => (document.getElementById(id).value = ""),
    );
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
      toast("Actualizado ✓");
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
  confirmar({
    icono: enUso.length ? "⚠️" : "🗑️",
    titulo: enUso.length ? "Ingrediente en uso" : `Eliminar "${ing.nombre}"`,
    desc: enUso.length
      ? `"${ing.nombre}" está en: ${enUso.join(", ")}.`
      : "Esta acción no se puede deshacer.",
    accion: async () => {
      syncSync();
      try {
        await deleteDoc(doc(db, "ingredientes", id));
        toast("Eliminado");
        syncOk();
      } catch (e) {
        syncErr();
        toast("Error");
      }
    },
  });
};

function dibujarIngs() {
  document.getElementById("ing-cnt").textContent = ingredientes.length;
  const c = document.getElementById("ing-lista");
  if (!ingredientes.length) {
    c.innerHTML = `<div class="vacio"><div class="vacio-icono">🫙</div><p>La bodega está vacía.</p></div>`;
    return;
  }
  c.innerHTML =
    '<div class="lista">' +
    ingredientes
      .map((ing) => {
        const ppu = (ing.precio / ing.cantidad).toFixed(2);
        return `<div class="item">
      <div class="info">
        <strong>${ing.nombre}</strong>
        <span>${ing.cantidad} ${ing.unidad} — $${ing.precio.toFixed(2)} — $${ppu}/${ing.unidad}</span>
      </div>
      <div class="acciones">
        <button class="btn btn-sm btn-editar" onclick="editarIng('${ing.id}')">✏️</button>
        <button class="btn btn-sm btn-eliminar" onclick="eliminarIng('${ing.id}')">✕</button>
      </div>
    </div>`;
      })
      .join("") +
    "</div>";
}

// ══════════════════════════════════════════════════
// 7. RECETAS
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
    ["rec-nom", "rec-rinde", "rec-precio"].forEach(
      (id) => (document.getElementById(id).value = ""),
    );
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
  confirmar({
    icono: "🗑️",
    titulo: `Eliminar "${rec.nombre}"`,
    desc: "Se eliminará la receta y sus ingredientes asociados.",
    accion: async () => {
      syncSync();
      try {
        await deleteDoc(doc(db, "recetas", id));
        toast("Receta eliminada");
        syncOk();
      } catch (e) {
        syncErr();
        toast("Error");
      }
    },
  });
};

window.toggleRec = (id) => {
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
  syncSync();
  try {
    await setDoc(
      doc(db, "recetas", recId),
      { ings: [...rec.ings, { ingId, cantidad }] },
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
    titulo: `Quitar "${ing?.nombre || "ingrediente"}"`,
    desc: "Se quitará de esta receta.",
    accion: async () => {
      const rec = recetas.find((r) => r.id === recId);
      syncSync();
      try {
        await setDoc(
          doc(db, "recetas", recId),
          { ings: rec.ings.filter((i) => i.ingId !== ingId) },
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
      const precio = rec.precio || 0;

      const filasIng = rec.ings
        .map((ri) => {
          const ing = ingredientes.find((i) => i.id === ri.ingId);
          if (!ing) return "";
          const co = (ing.precio / ing.cantidad) * ri.cantidad;
          return `<div class="ing-fila">
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
             placeholder="Cantidad" step="0.1" min="0" style="max-width:90px">
           <button class="btn btn-oscuro btn-sm" style="width:auto"
             onclick="agregarIngRec('${rec.id}')">+ Agregar</button>
         </div>`
        : `<p style="font-size:.8rem;color:var(--texto-s)">Agrega ingredientes primero.</p>`;

      return `<div class="receta-card">
      <div class="receta-header" id="rh-${rec.id}" onclick="toggleRec('${rec.id}')">
        <div style="flex:1;min-width:0">
          <h3>${rec.nombre}</h3>
          <div class="receta-meta">
            ${rec.ings.length} ingrediente(s) · Rinde: <strong>${rinde} panes</strong> ·
            Costo/pan: <strong>$${(costo / rinde).toFixed(2)}</strong>
          </div>
        </div>
        <div style="display:flex;gap:5px;align-items:center;flex-shrink:0">
          <button class="btn btn-sm btn-editar"
            onclick="event.stopPropagation();editarRec('${rec.id}')">✏️</button>
          <button class="btn btn-sm btn-eliminar"
            onclick="event.stopPropagation();eliminarRec('${rec.id}')">✕</button>
          <span class="receta-chevron">▾</span>
        </div>
      </div>
      <div class="receta-body" id="rb-${rec.id}">
        <div style="background:var(--crema-o);border-radius:9px;padding:9px 12px;
                    margin-bottom:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <div style="flex:1">
            <div style="font-size:.67rem;font-weight:600;color:var(--cafe-mid);
                        text-transform:uppercase;letter-spacing:.7px">Precio de venta</div>
            <div style="font-family:'DM Serif Display',serif;font-size:1.15rem;
                        color:var(--cafe-rico);font-weight:700">$${precio.toFixed(2)}/pan</div>
          </div>
          <div style="font-size:.77rem;color:var(--texto-s)">
            Costo total: <strong>$${costo.toFixed(2)}</strong>
          </div>
        </div>
        ${filasIng || `<p style="font-size:.81rem;color:var(--texto-s);margin-bottom:9px">Sin ingredientes aún.</p>`}
        <div class="divider"></div>
        <p class="nota-sec">Agregar ingrediente</p>
        ${formIng}
      </div>
    </div>`;
    })
    .join("");
}

// ══════════════════════════════════════════════════
// 8. PRODUCCIÓN
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
  const campoPre = document.getElementById("prod-pre");
  if (rec.precio && !campoPre.value) campoPre.value = rec.precio.toFixed(2);

  const rinde = rec.rinde || 1;
  const factor = panes > 0 ? panes / rinde : 1;
  const costoEscalado = costoRec(rec) * factor;

  let html = "";
  if (panes > 0) {
    const vTxt = Number.isInteger(factor)
      ? `${factor}× exactas`
      : `${factor.toFixed(2)}× (≈${Math.ceil(factor)} prep.)`;
    html += `<div class="prod-escala-info">
      🧮 <strong>${panes} panes</strong> ÷ rinde <strong>${rinde}</strong> = repetir <strong>${vTxt}</strong>
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
          extra = ` = ${(cant / 1000).toFixed(3)} kg`;
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

  const fechaTexto = fechaInput ? fechaDeInput(fechaInput) : fechaHoy();
  const fechaTS = fechaInput ? new Date(fechaInput + "T12:00:00") : new Date();
  const rinde = rec.rinde || 1;
  const factor = panes / rinde;
  const costoTotal = costoRec(rec) * factor;
  const totalVenta = panes * precio;
  const ganancia = totalVenta - costoTotal;
  const costoPorPan = costoTotal / panes;
  const gananciaPan = precio - costoPorPan;

  syncSync();
  try {
    await addDoc(collection(db, "historial"), {
      fecha: fechaTS,
      fechaTexto,
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
      return `<tr>
      <td>${ing.nombre}</td>
      <td>${cant.toFixed(2)} ${ing.unidad}</td>
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
        <span class="badge">${panes} panes · ${fechaTexto}</span>
      </div>
      <div class="prod-escala-info">
        🧮 Receta rinde <strong>${rinde}</strong> → para <strong>${panes}</strong> panes = preparar <strong>${vTxt}</strong>
      </div>
      <div class="stats-grid" style="margin-bottom:13px">
        <div class="stat-card sc-cafe"><div class="stat-label">Inversión</div>
          <div class="stat-valor">$${costoTotal.toFixed(2)}</div></div>
        <div class="stat-card sc-azul"><div class="stat-label">Venta total</div>
          <div class="stat-valor">$${totalVenta.toFixed(2)}</div></div>
        <div class="stat-card sc-morado"><div class="stat-label">Costo/pan</div>
          <div class="stat-valor">$${costoPorPan.toFixed(3)}</div></div>
        <div class="stat-card sc-verde"><div class="stat-label">Ganancia</div>
          <div class="stat-valor">${s}$${ganancia.toFixed(2)}</div></div>
      </div>
      <p style="text-align:center;font-size:.82rem;color:var(--texto-s);margin-bottom:15px">
        Ganancia por pan: <strong style="color:${cg}">${s}$${gananciaPan.toFixed(3)}</strong>
      </p>
      <table class="tabla">
        <thead><tr><th>Ingrediente</th><th>Total a usar</th><th style="text-align:right">Costo</th></tr></thead>
        <tbody>${filasTabla}
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

  document.getElementById("prod-rec").value = "";
  document.getElementById("prod-pan").value = "";
  document.getElementById("prod-pre").value = "";
  document.getElementById("prod-fecha").value = hoyParaInput();
  document.getElementById("prod-det").innerHTML =
    `<div class="vacio"><div class="vacio-icono">👆</div><p>Selecciona un pan.</p></div>`;
  toast("Producción guardada ✓");
};

// ══════════════════════════════════════════════════
// 9. HISTORIAL DE PRODUCCIÓN
// ══════════════════════════════════════════════════
window.filtrarHMes = function (mes) {
  filtroHistMes = mes;
  document
    .querySelectorAll("#tab-historial .filtro-btn")
    .forEach((b) => b.classList.remove("activo"));
  dibujarHist(mes ? "mes-especifico" : filtroHist, mes);
};

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
    desc: "Se eliminará este registro de producción.",
    accion: async () => {
      syncSync();
      try {
        await deleteDoc(doc(db, "historial", id));
        toast("Eliminado");
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
  const body = `
    <div class="campo"><label>Panes producidos</label>
      <input type="number" id="mh-panes" value="${h.panes}" min="1"></div>
    <div class="campo"><label>Precio de venta/pan ($)</label>
      <input type="number" id="mh-precio" value="${h.precio || 0}" step="0.01" min="0"></div>`;
  abrirModalEditar("✏️ Editar producción", body, async () => {
    const panes = parseInt(document.getElementById("mh-panes").value);
    const precio = parseFloat(document.getElementById("mh-precio").value);
    if (!panes || panes < 1 || isNaN(precio)) {
      toast("Datos inválidos");
      return;
    }
    const factor = panes / (h.rinde || 1);
    const costoTotal = (h.costoTotal / (h.factor || 1)) * factor;
    const totalVenta = panes * precio;
    const ganancia = totalVenta - costoTotal;
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
        },
        { merge: true },
      );
      cerrarModalEditar();
      toast("Actualizado ✓");
      syncOk();
    } catch (e) {
      syncErr();
      toast("Error");
    }
  });
};

function dibujarHist(rango, mesEsp) {
  const filtrados = (
    rango === "mes-especifico"
      ? historial.filter((h) =>
          esMismoMes(
            typeof h.fecha === "string"
              ? new Date(h.fecha + "T00:00:00").getTime()
              : h.fecha,
            mesEsp,
          ),
        )
      : historial.filter((h) => esMismaFecha(h.fecha, rango))
  ).reverse();
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
      <div class="hist-card"><div class="hist-label">Valor producido</div>
        <div class="hist-valor">$${tV.toFixed(2)}</div></div>
      <div class="hist-card"><div class="hist-label">Ganancia</div>
        <div class="hist-valor">$${tG.toFixed(2)}</div></div>
    </div>`;
  c.innerHTML = filtrados
    .map((h) => {
      const s = h.ganancia >= 0 ? "+" : "";
      return `<div class="hist-item">
      <div>
        <div class="hist-fecha">${h.fechaTexto || "Sin fecha"}</div>
        <div class="hist-pan">${h.recetaNombre}</div>
        <div class="hist-detalle">${h.panes} panes · $${(h.precio || 0).toFixed(2)}/pan</div>
      </div>
      <div style="display:flex;align-items:center;gap:7px">
        <div class="hist-ganancia ${h.ganancia >= 0 ? "pos" : "neg"}">${s}$${(h.ganancia || 0).toFixed(2)}</div>
        <button class="btn btn-sm btn-editar" onclick="editarHist('${h.id}')">✏️</button>
        <button class="btn btn-sm btn-eliminar" onclick="eliminarHist('${h.id}')">✕</button>
      </div>
    </div>`;
    })
    .join("");
}

// ══════════════════════════════════════════════════
// 10. ESTADÍSTICAS
// ══════════════════════════════════════════════════
window.filtrarStats = function (rango, btn) {
  document
    .querySelectorAll("#tab-estadisticas .filtro-btn")
    .forEach((b) => b.classList.remove("activo"));
  btn.classList.add("activo");
  dibujarStats(rango);
};

window.filtrarStatsMes = function (mes) {
  filtroStatsMes = mes;
  document
    .querySelectorAll("#tab-estadisticas .filtro-btn")
    .forEach((b) => b.classList.remove("activo"));
  dibujarStats(mes ? "mes-especifico" : "todo", mes);
};

function dibujarStats(rango = "todo", mesEsp) {
  const c = document.getElementById("stats-con");
  const filtrados =
    rango === "mes-especifico"
      ? historial.filter((h) =>
          esMismoMes(
            typeof h.fecha === "string"
              ? new Date(h.fecha + "T00:00:00").getTime()
              : h.fecha,
            mesEsp,
          ),
        )
      : historial.filter((h) => esMismaFecha(h.fecha, rango));
  if (!filtrados.length) {
    c.innerHTML = `<div class="vacio"><div class="vacio-icono">📊</div>
                   <p>No hay producciones en este periodo.</p></div>`;
    return;
  }
  const tG = filtrados.reduce((t, h) => t + h.ganancia, 0);
  const tV = filtrados.reduce((t, h) => t + h.totalVenta, 0);
  const tP = filtrados.reduce((t, h) => t + h.panes, 0);
  const tI = filtrados.reduce((t, h) => t + h.costoTotal, 0);

  let tCobrado = 0;
  clientes.forEach((cli) => {
    (cli.ventas || []).forEach((v) => {
      const tsV = v.ts || (v.fecha ? new Date(v.fecha).getTime() : 0);
      if (
        rango === "mes-especifico"
          ? !esMismoMes(tsV, mesEsp)
          : !esMismaFecha(tsV, rango)
      )
        return;
      const panes = v.panes || [
        { cantidad: v.cantidad, precioUnit: v.precioUnit },
      ];
      tCobrado += panes.reduce(
        (t, p) => t + (p.cantidad || 0) * (p.precioUnit || 0),
        0,
      );
    });
  });
  const gananciaReal = tCobrado - tI;
  const colorGR = gananciaReal >= 0 ? "var(--verde)" : "var(--rojo)";
  const signoGR = gananciaReal >= 0 ? "+" : "";

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
      const tsV = v.ts || (v.fecha ? new Date(v.fecha).getTime() : 0);
      if (
        rango === "mes-especifico"
          ? !esMismoMes(tsV, mesEsp)
          : !esMismaFecha(tsV, rango)
      )
        return;
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
  const rankTipo = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
  const maxT = rankTipo[0]?.[1] || 1;

  c.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-titulo">💼 Resumen financiero real</div>
      <div class="stats-grid" style="margin-top:10px">
        <div class="stat-card sc-cafe">
          <div class="stat-label">💸 Invertido</div>
          <div class="stat-valor">$${tI.toFixed(2)}</div>
          <div class="stat-sub">en producción</div>
        </div>
        <div class="stat-card sc-azul">
          <div class="stat-label">💰 Cobrado</div>
          <div class="stat-valor">$${tCobrado.toFixed(2)}</div>
          <div class="stat-sub">a clientes</div>
        </div>
        <div class="stat-card" style="border-bottom:3px solid ${colorGR}">
          <div class="stat-label">📈 Ganancia real</div>
          <div class="stat-valor" style="color:${colorGR}">${signoGR}$${gananciaReal.toFixed(2)}</div>
          <div class="stat-sub">cobrado − invertido</div>
        </div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card sc-dorado"><div class="stat-label">Ganancia teórica</div>
        <div class="stat-valor">$${tG.toFixed(2)}</div>
        <div class="stat-sub">precio × panes prod.</div></div>
      <div class="stat-card sc-verde"><div class="stat-label">Total vendido</div>
        <div class="stat-valor">$${tV.toFixed(2)}</div></div>
      <div class="stat-card sc-azul"><div class="stat-label">Panes</div>
        <div class="stat-valor">${tP}</div></div>
      <div class="stat-card sc-cafe"><div class="stat-label">Producciones</div>
        <div class="stat-valor">${filtrados.length}</div></div>
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
      rankTipo.length
        ? `
    <div class="card">
      <div class="card-titulo">👥 Mejores clientes del periodo</div>
      ${(() => {
        const rc = clientes
          .map((cli) => {
            const tot = (cli.ventas || []).reduce((t, v) => {
              const tsV = v.ts || (v.fecha ? new Date(v.fecha).getTime() : 0);
              if (
                rango === "mes-especifico"
                  ? !esMismoMes(tsV, mesEsp)
                  : !esMismaFecha(tsV, rango)
              )
                return t;
              const p = v.panes || [
                { cantidad: v.cantidad, precioUnit: v.precioUnit },
              ];
              return (
                t +
                p.reduce(
                  (s, pp) => s + (pp.cantidad || 0) * (pp.precioUnit || 0),
                  0,
                )
              );
            }, 0);
            return { nombre: cli.nombre, tipo: cli.tipo, tot };
          })
          .filter((c) => c.tot > 0)
          .sort((a, b) => b.tot - a.tot)
          .slice(0, 5);
        const mx = rc[0]?.tot || 1;
        return rc.length
          ? rc
              .map(
                (cl, i) => `
          <div class="ranking-item">
            <div class="ranking-num ${i === 0 ? "oro" : ""}">${i + 1}</div>
            <div class="ranking-info">
              <div class="ranking-nom">${cl.nombre}</div>
              <div class="ranking-det">${TIPOS[cl.tipo] || cl.tipo}</div>
              <div class="barra-wrap"><div class="barra-fill" style="width:${Math.round((cl.tot / mx) * 100)}%"></div></div>
            </div>
            <div class="ranking-tot">$${cl.tot.toFixed(2)}</div>
          </div>`,
              )
              .join("")
          : '<p style="font-size:.82rem;color:var(--texto-s)">Sin ventas en este periodo.</p>';
      })()}
    </div>
    <div class="card">
      <div class="card-titulo">🏪 Ventas por tipo de cliente</div>
      ${rankTipo
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
// 11. CLIENTES
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
      creadoEn: serverTimestamp(),
    });
    ["cli-nom", "cli-tel", "cli-dir"].forEach(
      (id) => (document.getElementById(id).value = ""),
    );
    cerrarModalNuevoCli();
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
  const opTs = Object.entries(TIPOS)
    .map(
      ([val, label]) =>
        `<option value="${val}"${cli.tipo === val ? " selected" : ""}>${label}</option>`,
    )
    .join("");
  const body = `
    <div class="campo"><label>Nombre</label>
      <input type="text" id="mc-nom" value="${cli.nombre}"></div>
    <div class="campo"><label>Tipo</label>
      <div class="select-wrap"><select id="mc-tip">${opTs}</select></div></div>
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
    desc: "Se eliminarán el cliente y todos sus datos.",
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

window.toggleCli = (id) => {
  document.getElementById("ccb-" + id).classList.toggle("abierto");
  document.getElementById("cch-" + id).classList.toggle("abierto");
};

window.verTabCli = function (cliId, tab) {
  ["ventas", "stats"].forEach((t) => {
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
  const elCli = document.getElementById("vta-cli");
  if (elCli) elCli.innerHTML = optsCli;
  document.querySelectorAll(".vf-rec").forEach((sel) => {
    const prev = sel.value;
    sel.innerHTML = optsRec;
    if (prev) sel.value = prev;
  });
}

function dibujarClis() {
  const hoy = new Date();
  const ventasHoy = clientes.reduce(
    (n, c) =>
      n +
      (c.ventas || []).filter((v) => v.ts && esMismaFecha(v.ts, "hoy")).length,
    0,
  );
  const mesTot = clientes.reduce(
    (s, c) =>
      s +
      (c.ventas || [])
        .filter((v) => v.ts && esMismaFecha(v.ts, "mes"))
        .reduce((t, v) => {
          const p = v.panes || [
            { cantidad: v.cantidad, precioUnit: v.precioUnit },
          ];
          return (
            t +
            p.reduce(
              (x, pp) => x + (pp.cantidad || 0) * (pp.precioUnit || 0),
              0,
            )
          );
        }, 0),
    0,
  );

  const _set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  _set("cli-cnt", clientes.length);
  _set("cli-cnt2", clientes.length);
  _set("cli-ventas-hoy", ventasHoy);
  _set("cli-mes-tot", `$${mesTot.toFixed(2)}`);

  const hoy7 = new Date();
  hoy7.setDate(hoy.getDate() - 7);
  const inactivos = clientes.filter((cli) => {
    const ventas = cli.ventas || [];
    if (!ventas.length) return true;
    const ultima = ventas.reduce((max, v) => Math.max(max, v.ts || 0), 0);
    return ultima < hoy7.getTime();
  });
  const banda = document.getElementById("cli-alerta-banda");
  if (inactivos.length) {
    banda.style.display = "flex";
    document.getElementById("cli-alerta-texto").innerHTML =
      `<strong>${inactivos.length} cliente(s) sin comprar +7 días:</strong> ` +
      inactivos
        .map((c) => {
          const ultima = (c.ventas || []).reduce(
            (max, v) => Math.max(max, v.ts || 0),
            0,
          );
          const dias = ultima
            ? `${Math.floor((Date.now() - ultima) / 86400000)}d`
            : "sin compras";
          return `${c.nombre} (${dias})`;
        })
        .join(" · ");
  } else {
    banda.style.display = "none";
  }

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
      const ventaTotal = (cli.ventas || []).reduce((t, v) => {
        const p = v.panes || [
          { cantidad: v.cantidad, precioUnit: v.precioUnit },
        ];
        return (
          t +
          p.reduce((s, pp) => s + (pp.cantidad || 0) * (pp.precioUnit || 0), 0)
        );
      }, 0);
      const panesTotales = (cli.ventas || []).reduce((t, v) => {
        const p = v.panes || [{ cantidad: v.cantidad }];
        return t + p.reduce((s, pp) => s + (pp.cantidad || 0), 0);
      }, 0);
      const esFrecuente =
        (cli.ventas || []).filter((v) => {
          const d = v.ts ? new Date(v.ts) : null;
          if (!d) return false;
          return (
            d.getMonth() === hoy.getMonth() &&
            d.getFullYear() === hoy.getFullYear()
          );
        }).length >= 4;

      let badges = "";
      if (esFrecuente)
        badges += `<span class="badge-estado badge-frecuente">⭐ Frecuente</span>`;
      badges += `<span class="badge-estado badge-al-dia">✅ Al día</span>`;

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
          <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end;flex-shrink:0">
            ${badges}
            <button class="btn btn-sm btn-editar"
              onclick="event.stopPropagation();editarCli('${cli.id}')">✏️</button>
            <button class="btn btn-sm btn-eliminar"
              onclick="event.stopPropagation();eliminarCli('${cli.id}')">✕</button>
            <span style="color:var(--cafe-claro);font-size:.78rem">▾</span>
          </div>
        </div>
        <div class="cliente-body" id="ccb-${cli.id}">
          <div class="cli-mini-stats">
            <div class="cli-mini-stat">
              <div class="cli-mini-label">Total comprado</div>
              <div class="cli-mini-valor">$${ventaTotal.toFixed(0)}</div>
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
            <button class="cli-tab-btn" id="ctb-stats-${cli.id}"
              onclick="verTabCli('${cli.id}','stats')">📊 Stats</button>
          </div>
          <div id="ct-ventas-${cli.id}">${_htmlTabVentas(cli)}</div>
          <div id="ct-stats-${cli.id}" style="display:none">${_htmlTabStats(cli)}</div>
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
    return `<p style="font-size:.82rem;color:var(--texto-s);padding:8px 0">Sin ventas aún.</p>`;
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
        return `<div class="venta-item">
      <div>
        <div class="vi-pan">🍞 ${resumen}</div>
        <div class="vi-det">${v.fecha || ""}${v.nota ? " · " + v.nota : ""}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div class="vi-monto pagado">$${total.toFixed(2)}</div>
        <button class="btn btn-sm btn-editar" style="margin-top:3px"
          onclick="editarVenta('${cli.id}',${v.id})">✏️</button>
        <button class="btn btn-sm btn-eliminar" style="margin-top:3px"
          onclick="eliminarVenta('${cli.id}',${v.id})">✕</button>
      </div>
    </div>`;
      })
      .join("") +
    (ventas.length > 10
      ? `<p style="font-size:.72rem;color:var(--texto-s);text-align:center;padding-top:4px">
    + ${ventas.length - 10} ventas anteriores</p>`
      : "")
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
  return (
    `<p class="nota-sec">Panes favoritos</p>` +
    favs
      .map(
        ([nom, cant]) => `
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px">
        <span style="flex:1;font-size:.83rem;color:var(--cafe-rico)">${nom}</span>
        <div style="width:70px"><div class="barra-wrap">
          <div class="barra-fill" style="width:${Math.round((cant / maxF) * 100)}%"></div>
        </div></div>
        <span style="font-size:.77rem;font-weight:700;color:var(--cafe-mid);min-width:28px;text-align:right">${cant}</span>
      </div>`,
      )
      .join("")
  );
}

// ══════════════════════════════════════════════════
// 12. VENTAS MULTI-PAN
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
      <label style="font-size:.64rem">Pan</label>
      <div class="select-wrap">
        <select class="vf-rec" data-fila="${id}" onchange="onSelRecVenta(${id})">
          <option value="">Tipo de pan</option>${optsRec}
        </select>
      </div>
    </div>
    <div class="campo campo-cant" style="margin-bottom:0">
      <label style="font-size:.64rem">Cantidad</label>
      <input type="number" class="vf-cant" data-fila="${id}"
             placeholder="0" min="1" oninput="recalcularTotal()">
    </div>
    <div class="campo campo-pre" style="margin-bottom:0">
      <label style="font-size:.64rem">Precio/u ($)</label>
      <input type="number" class="vf-pre" data-fila="${id}"
             placeholder="0.00" step="0.01" min="0" oninput="recalcularTotal()">
    </div>
    ${
      id > 0
        ? `<button class="btn btn-sm btn-eliminar" style="align-self:flex-end;width:auto"
           onclick="quitarFilaVenta(${id})">✕</button>`
        : '<div style="width:30px"></div>'
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
    nota,
    fecha: fechaTxt,
    ts: Date.now(),
  };
  const ventas = [...(cli.ventas || []), nuevaVenta];

  syncSync();
  try {
    await setDoc(doc(db, "clientes", cliId), { ventas }, { merge: true });
    document.getElementById("vta-cli").value = "";
    document.getElementById("vta-nota").value = "";
    agregarFilaVentaInicial();
    toast("Venta guardada ✓");
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
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:7px;
                padding:7px;background:var(--crema);border-radius:9px">
      <span style="font-size:.82rem;font-weight:600;color:var(--cafe-rico);flex:2">${p.recetaNombre}</span>
      <input type="number" id="ev-cant-${i}" value="${p.cantidad}" min="1"
             style="width:68px" oninput="evTotal()">
      <span style="font-size:.74rem;color:var(--texto-s)">× $</span>
      <input type="number" id="ev-pre-${i}" value="${p.precioUnit}"
             step="0.01" min="0" style="width:73px" oninput="evTotal()">
    </div>`,
    )
    .join("");
  const body = `${filasHTML}
    <div style="text-align:right;font-size:.87rem;color:var(--texto-s);margin-top:3px">
      Total: <strong id="ev-total">$0</strong></div>`;
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
    const total = nuevosPanes.reduce(
      (t, p) => t + p.cantidad * p.precioUnit,
      0,
    );
    const ventas = (cli.ventas || []).map((v) =>
      v.id === ventaId ? { ...v, panes: nuevosPanes, total } : v,
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
// 13. HISTORIAL GENERAL DE VENTAS
// ══════════════════════════════════════════════════
window.filtrarHistVentas = function (rango, btn) {
  document
    .querySelectorAll(".filtros-compactos .filtro-btn")
    .forEach((b) => b.classList.remove("activo"));
  btn.classList.add("activo");
  filtroHV = rango;
  dibujarHistVentas(rango);
};

window.filtrarHistVentasMes = function (mes) {
  filtroHVMes = mes;
  document
    .querySelectorAll(".filtros-compactos .filtro-btn")
    .forEach((b) => b.classList.remove("activo"));
  dibujarHistVentas(mes ? "mes-especifico" : filtroHV, mes);
};

function dibujarHistVentas(rango, mesEsp) {
  const todasVentas = [];
  clientes.forEach((cli) => {
    (cli.ventas || []).forEach((v) => {
      const tsV = v.ts || (v.fecha ? new Date(v.fecha).getTime() : 0);
      if (
        rango === "mes-especifico"
          ? !esMismoMes(tsV, mesEsp)
          : !esMismaFecha(tsV, rango)
      )
        return;
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
    if (res) res.innerHTML = "";
    if (lst)
      lst.innerHTML = `<div class="vacio"><div class="vacio-icono">🛍️</div>
                            <p>No hay ventas en este periodo.</p></div>`;
    return;
  }
  const tTotal = todasVentas.reduce((t, v) => t + v.total, 0);
  const nVentas = todasVentas.length;

  if (res)
    res.innerHTML = `
    <div class="hv-resumen-wrap" style="grid-template-columns:1fr 1fr">
      <div class="hv-res-card"><div class="hv-res-label">Total cobrado</div>
        <div class="hv-res-valor">$${tTotal.toFixed(2)}</div></div>
      <div class="hv-res-card"><div class="hv-res-label">Ventas</div>
        <div class="hv-res-valor">${nVentas}</div></div>
    </div>`;

  if (lst)
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
          return `<div class="hv-item">
      <div class="hv-header">
        <div>
          <div class="hv-cli">${v.clienteNombre}</div>
          <div class="hv-tipo">${TIPOS[v.clienteTipo] || ""}</div>
        </div>
        <div style="text-align:right">
          <div class="hv-fecha">${v.fecha || ""}</div>
          <div class="hv-total pagado">$${v.total.toFixed(2)}</div>
        </div>
      </div>
      <div style="font-size:.78rem;color:var(--texto-s)">
        🍞 ${resumen}${v.nota ? " · " + v.nota : ""}
      </div>
    </div>`;
        })
        .join("") +
      (todasVentas.length > 30
        ? `<p style="font-size:.72rem;color:var(--texto-s);text-align:center;padding:8px 0">
       Mostrando 30 de ${todasVentas.length} ventas</p>`
        : "");
}

// ══════════════════════════════════════════════════
// 14. RANKINGS Y ALERTAS
// ══════════════════════════════════════════════════
function dibujarRankings() {
  const rankCli = clientes
    .map((cli) => {
      const total = (cli.ventas || []).reduce((t, v) => {
        const p = v.panes || [
          { cantidad: v.cantidad, precioUnit: v.precioUnit },
        ];
        return (
          t +
          p.reduce((s, pp) => s + (pp.cantidad || 0) * (pp.precioUnit || 0), 0)
        );
      }, 0);
      return { nombre: cli.nombre, tipo: cli.tipo, total };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const maxC = rankCli[0]?.total || 1;

  const elRC = document.getElementById("cli-ranking");
  if (elRC)
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
  if (elRP)
    elRP.innerHTML = !rankPan.length
      ? `<div class="vacio"><div class="vacio-icono">🍞</div><p>Registra ventas para ver los favoritos.</p></div>`
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

// ══════════════════════════════════════════════════
// 15. EXPORTAR CSV
// ══════════════════════════════════════════════════
window.exportarCSV = function () {
  const filas = [["Fecha", "Cliente", "Tipo", "Panes", "Total", "Nota"]];
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
// 16. FIREBASE LISTENERS
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

onSnapshot(
  query(collection(db, "historial"), orderBy("fecha", "asc")),
  (snap) => {
    historial = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    poblarSelectsMeses();
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
    poblarSelectsMeses();
    if (document.getElementById("tab-clientes").classList.contains("activa")) {
      dibujarClis();
      dibujarHistVentas(filtroHV);
    }
    syncOk();
  },
  () => syncErr(),
);

// ══════════════════════════════════════════════════
// 17. INICIALIZACIÓN
// ══════════════════════════════════════════════════
const inputFecha = document.getElementById("vta-fecha");
if (inputFecha) inputFecha.value = hoyParaInput();

const inputFechaProd = document.getElementById("prod-fecha");
if (inputFechaProd) inputFechaProd.value = hoyParaInput();

agregarFilaVentaInicial();
