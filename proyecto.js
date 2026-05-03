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

// ── Helpers del historial mejorado ──────────────────
function _fechaTS(h) {
  if (h.fecha && h.fecha.toDate) return h.fecha.toDate();
  if (typeof h.fecha === "string") return new Date(h.fecha + "T00:00:00");
  if (typeof h.fecha === "number") return new Date(h.fecha);
  return new Date(h.fecha);
}

function _clavesDia(lista) {
  // Agrupa por día, retorna objeto { 'YYYY-MM-DD': [registros] }
  const grupos = {};
  lista.forEach((h) => {
    const d = _fechaTS(h);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(h);
  });
  return grupos;
}

function _nombrePeriodoAnterior(rango) {
  if (rango === "hoy") return "ayer";
  if (rango === "semana") return "semana pasada";
  if (rango === "mes") return "mes pasado";
  return null;
}

function _filtradoAnterior(rango) {
  const hoy = new Date();
  return historial.filter((h) => {
    const d = _fechaTS(h);
    if (rango === "hoy") {
      const ayer = new Date();
      ayer.setDate(hoy.getDate() - 1);
      return d.toDateString() === ayer.toDateString();
    }
    if (rango === "semana") {
      const ini = new Date();
      ini.setDate(hoy.getDate() - 14);
      const fin = new Date();
      fin.setDate(hoy.getDate() - 7);
      return d >= ini && d < fin;
    }
    if (rango === "mes") {
      const mes = hoy.getMonth() === 0 ? 11 : hoy.getMonth() - 1;
      const anio =
        hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
      return d.getMonth() === mes && d.getFullYear() === anio;
    }
    return false;
  });
}

function _fmt(n) {
  return "$" + Math.round(n || 0).toLocaleString("es-CO");
}

function _delta(actual, anterior) {
  if (!anterior || anterior === 0) return { txt: "nuevo", cls: "delta-igual" };
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  if (Math.abs(pct) < 1) return { txt: "= igual", cls: "delta-igual" };
  const signo = pct > 0 ? "▲" : "▼";
  const cls = pct > 0 ? "delta-sube" : "delta-baja";
  return { txt: `${signo} ${Math.abs(pct).toFixed(0)}%`, cls };
}

// ── Función principal ────────────────────────────────
function dibujarHist(rango, mesEsp) {
  // Datos del periodo actual
  const filtrados =
    rango === "mes-especifico"
      ? historial.filter((h) => esMismoMes(_fechaTS(h).getTime(), mesEsp))
      : historial.filter((h) => esMismaFecha(h.fecha, rango));

  // Vacío total
  const BLOQUES = [
    "hist-tarjetas",
    "hist-comparativa",
    "hist-grafica",
    "hist-indicadores",
    "hist-panes",
  ];
  const c = document.getElementById("hist-lista");

  if (!filtrados.length) {
    BLOQUES.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });
    c.innerHTML = `<div class="vacio"><div class="vacio-icono">📅</div>
                   <p>No hay registros en este periodo.</p></div>`;
    return;
  }

  // ── Métricas base ──
  const tI = filtrados.reduce((t, h) => t + (h.costoTotal || 0), 0);
  const tV = filtrados.reduce((t, h) => t + (h.totalVenta || 0), 0);
  const tG = filtrados.reduce((t, h) => t + (h.ganancia || 0), 0);
  const tP = filtrados.reduce((t, h) => t + (h.panes || 0), 0);
  const nProd = filtrados.length;

  // ═══════════════════════════════════════
  // BLOQUE 2 — Tarjetas grandes
  // ═══════════════════════════════════════
  const ganCls = tG >= 0 ? "positivo htc-verde" : "negativo htc-rojo";
  document.getElementById("hist-tarjetas").innerHTML = `
    <div class="hist-tarjetas-grid" style="margin-bottom:14px">
      <div class="hist-tcard htc-dorado">
        <div class="hist-tcard-ico">💸</div>
        <div class="hist-tcard-label">Invertido</div>
        <div class="hist-tcard-val">${_fmt(tI)}</div>
        <div class="hist-tcard-sub">costo de producción</div>
      </div>
      <div class="hist-tcard ${tG >= 0 ? "htc-verde" : "htc-rojo"}">
        <div class="hist-tcard-ico">${tG >= 0 ? "💰" : "⚠️"}</div>
        <div class="hist-tcard-label">Ganancia</div>
        <div class="hist-tcard-val ${tG >= 0 ? "positivo" : "negativo"}">${tG >= 0 ? "+" : ""}${_fmt(tG)}</div>
        <div class="hist-tcard-sub">${tG >= 0 ? "¡Vas bien!" : "Revisa costos"}</div>
      </div>
      <div class="hist-tcard htc-azul">
        <div class="hist-tcard-ico">🍞</div>
        <div class="hist-tcard-label">Panes</div>
        <div class="hist-tcard-val">${tP}</div>
        <div class="hist-tcard-sub">unidades producidas</div>
      </div>
      <div class="hist-tcard htc-cafe">
        <div class="hist-tcard-ico">📦</div>
        <div class="hist-tcard-label">Producciones</div>
        <div class="hist-tcard-val">${nProd}</div>
        <div class="hist-tcard-sub">registros del periodo</div>
      </div>
    </div>`;

  // ═══════════════════════════════════════
  // BLOQUE 3 — Comparativa
  // ═══════════════════════════════════════
  const nomAnterior = _nombrePeriodoAnterior(rango);
  const elComp = document.getElementById("hist-comparativa");
  if (nomAnterior) {
    const ant = _filtradoAnterior(rango);
    const aI = ant.reduce((t, h) => t + (h.costoTotal || 0), 0);
    const aG = ant.reduce((t, h) => t + (h.ganancia || 0), 0);
    const aP = ant.reduce((t, h) => t + (h.panes || 0), 0);
    const dI = _delta(tI, aI);
    const dG = _delta(tG, aG);
    const dP = _delta(tP, aP);
    elComp.innerHTML = `
      <div class="hist-comparativa-card" style="margin-bottom:14px">
        <div class="hist-comp-titulo">🔄 Esta ${rango === "hoy" ? "día" : rango} vs ${nomAnterior}</div>
        <div class="hist-comp-grid">
          <div class="hist-comp-item">
            <div class="hist-comp-label">💸 Inversión</div>
            <div class="hist-comp-actual">${_fmt(tI)}</div>
            <div class="hist-comp-anterior">ant: ${_fmt(aI)}</div>
            <span class="hist-comp-delta ${dI.cls}">${dI.txt}</span>
          </div>
          <div class="hist-comp-item">
            <div class="hist-comp-label">💰 Ganancia</div>
            <div class="hist-comp-actual">${_fmt(tG)}</div>
            <div class="hist-comp-anterior">ant: ${_fmt(aG)}</div>
            <span class="hist-comp-delta ${dG.cls}">${dG.txt}</span>
          </div>
          <div class="hist-comp-item">
            <div class="hist-comp-label">🍞 Panes</div>
            <div class="hist-comp-actual">${tP}</div>
            <div class="hist-comp-anterior">ant: ${aP}</div>
            <span class="hist-comp-delta ${dP.cls}">${dP.txt}</span>
          </div>
        </div>
      </div>`;
  } else {
    elComp.innerHTML = "";
  }

  // ═══════════════════════════════════════
  // BLOQUE 4 — Gráfica de barras por día
  // ═══════════════════════════════════════
  const grupos = _clavesDia(filtrados);
  const diasOrdenados = Object.keys(grupos).sort();
  const maxBarVal = Math.max(
    ...diasOrdenados.map((k) => {
      const g = grupos[k];
      return Math.max(
        g.reduce((t, h) => t + (h.costoTotal || 0), 0),
        Math.abs(g.reduce((t, h) => t + (h.ganancia || 0), 0)),
      );
    }),
    1,
  );
  const ALTURA_MAX = 120;

  const MESES_CORTOS = [
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
  const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  const barrasHTML = diasOrdenados
    .map((key) => {
      const regs = grupos[key];
      const inv = regs.reduce((t, h) => t + (h.costoTotal || 0), 0);
      const gan = regs.reduce((t, h) => t + (h.ganancia || 0), 0);
      const hInv = Math.max(Math.round((inv / maxBarVal) * ALTURA_MAX), 3);
      const hGan = Math.max(
        Math.round((Math.abs(gan) / maxBarVal) * ALTURA_MAX),
        3,
      );
      const ganNeg = gan < 0;
      const [y, m, d] = key.split("-");
      const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      const etq =
        diasOrdenados.length <= 7 ? DIAS_SEMANA[fecha.getDay()] : `${d}/${m}`;
      return `
      <div class="barra-grupo">
        <div class="barras-cols">
          <div class="barra-inv" style="height:${hInv}px">
            <div class="barra-tooltip">💸 ${_fmt(inv)}<br>📅 ${d} ${MESES_CORTOS[parseInt(m) - 1]}</div>
          </div>
          <div class="barra-gan${ganNeg ? " negativa" : ""}" style="height:${hGan}px">
            <div class="barra-tooltip">${ganNeg ? "⚠️" : "💰"} ${_fmt(gan)}<br>📅 ${d} ${MESES_CORTOS[parseInt(m) - 1]}</div>
          </div>
        </div>
        <div class="barra-etiqueta">${etq}</div>
      </div>`;
    })
    .join("");

  document.getElementById("hist-grafica").innerHTML = `
    <div class="hist-grafica-card" style="margin-bottom:14px">
      <div class="hist-grafica-titulo">📈 Producción por día</div>
      <div class="hist-grafica-leyenda">
        <div class="leyenda-item">
          <div class="leyenda-color" style="background:var(--dorado)"></div> Inversión
        </div>
        <div class="leyenda-item">
          <div class="leyenda-color" style="background:var(--verde)"></div> Ganancia
        </div>
      </div>
      <div class="grafica-contenedor">
        <div class="grafica-barras">${barrasHTML}</div>
      </div>
      <div class="grafica-base"></div>
    </div>`;

  // ═══════════════════════════════════════
  // BLOQUE 5 — Indicadores inteligentes
  // ═══════════════════════════════════════
  // Mejor día
  let mejorDiaKey = "",
    mejorDiaGan = -Infinity;
  diasOrdenados.forEach((key) => {
    const g = grupos[key].reduce((t, h) => t + (h.ganancia || 0), 0);
    if (g > mejorDiaGan) {
      mejorDiaGan = g;
      mejorDiaKey = key;
    }
  });
  const [my, mm, md] = mejorDiaKey.split("-");
  const mejorDiaTxt = `${md} ${MESES_CORTOS[parseInt(mm) - 1]}`;

  // Pan más producido
  const porPanU = {};
  filtrados.forEach((h) => {
    if (!porPanU[h.recetaNombre]) porPanU[h.recetaNombre] = 0;
    porPanU[h.recetaNombre] += h.panes || 0;
  });
  const panEstrella = Object.entries(porPanU).sort((a, b) => b[1] - a[1])[0];

  // Promedio diario
  const promDiario = diasOrdenados.length > 0 ? tG / diasOrdenados.length : 0;

  document.getElementById("hist-indicadores").innerHTML = `
    <div class="hist-indicadores-card" style="margin-bottom:14px">
      <div class="hist-ind-titulo">💡 Datos clave del periodo</div>
      <div class="hist-ind-grid">
        <div class="hist-ind-item">
          <div class="hist-ind-ico">🏆</div>
          <div class="hist-ind-info">
            <div class="hist-ind-label">Mejor día</div>
            <div class="hist-ind-val">${mejorDiaTxt}</div>
            <div class="hist-ind-sub">${_fmt(mejorDiaGan)} de ganancia</div>
          </div>
        </div>
        <div class="hist-ind-item">
          <div class="hist-ind-ico">⭐</div>
          <div class="hist-ind-info">
            <div class="hist-ind-label">Pan estrella</div>
            <div class="hist-ind-val">${panEstrella?.[0] || "—"}</div>
            <div class="hist-ind-sub">${panEstrella?.[1] || 0} unidades</div>
          </div>
        </div>
        <div class="hist-ind-item">
          <div class="hist-ind-ico">📊</div>
          <div class="hist-ind-info">
            <div class="hist-ind-label">Promedio/día</div>
            <div class="hist-ind-val">${_fmt(promDiario)}</div>
            <div class="hist-ind-sub">de ganancia diaria</div>
          </div>
        </div>
      </div>
    </div>`;

  // ═══════════════════════════════════════
  // BLOQUE 6 — Desglose por tipo de pan
  // ═══════════════════════════════════════
  const porPan = {};
  filtrados.forEach((h) => {
    if (!porPan[h.recetaNombre])
      porPan[h.recetaNombre] = { gan: 0, inv: 0, panes: 0, veces: 0 };
    porPan[h.recetaNombre].gan += h.ganancia || 0;
    porPan[h.recetaNombre].inv += h.costoTotal || 0;
    porPan[h.recetaNombre].panes += h.panes || 0;
    porPan[h.recetaNombre].veces++;
  });
  const rankPan = Object.entries(porPan).sort((a, b) => b[1].gan - a[1].gan);
  const maxPanGan = Math.max(...rankPan.map(([, d]) => Math.abs(d.gan)), 1);

  document.getElementById("hist-panes").innerHTML = `
    <div class="hist-panes-card" style="margin-bottom:14px">
      <div class="hist-sec-titulo" style="margin-bottom:14px">🍞 Desglose por tipo de pan</div>
      ${rankPan
        .map(([nom, data], i) => {
          const s = data.gan >= 0 ? "+" : "";
          const cls = data.gan >= 0 ? "pos" : "neg";
          const pct = Math.round((Math.abs(data.gan) / maxPanGan) * 100);
          return `
        <div class="hist-pan-item">
          <div class="hist-pan-num ${i === 0 ? "oro" : ""}">${i + 1}</div>
          <div class="hist-pan-info">
            <div class="hist-pan-nom">${nom}</div>
            <div class="hist-pan-det">${data.panes} panes · ${data.veces} prod. · inv. ${_fmt(data.inv)}</div>
            <div class="hist-pan-barra-wrap">
              <div class="hist-pan-barra-fill" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="hist-pan-gan ${cls}">${s}${_fmt(data.gan)}</div>
        </div>`;
        })
        .join("")}
    </div>`;

  // ═══════════════════════════════════════
  // BLOQUE 7 — Lista agrupada por día
  // ═══════════════════════════════════════
  const hoyStr = new Date().toISOString().split("T")[0];
  c.innerHTML =
    `
    <div class="hist-sec-titulo" style="margin-bottom:12px">📅 Registros por día</div>` +
    [...diasOrdenados]
      .reverse()
      .map((key) => {
        const regs = grupos[key];
        const diaGan = regs.reduce((t, h) => t + (h.ganancia || 0), 0);
        const diaInv = regs.reduce((t, h) => t + (h.costoTotal || 0), 0);
        const diaPanes = regs.reduce((t, h) => t + (h.panes || 0), 0);
        const [y, m, d] = key.split("-");
        const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const nomDia = DIAS_SEMANA[fecha.getDay()];
        const esHoy = key === hoyStr;
        const ganCls = diaGan >= 0 ? "pos" : "neg";
        const s = diaGan >= 0 ? "+" : "";
        const abierto = esHoy ? "abierto" : "";

        const prodsHTML = regs
          .map((h) => {
            const sg = h.ganancia >= 0 ? "+" : "";
            return `
        <div class="hist-dia-prod">
          <div>
            <div class="hist-dia-prod-nom">${h.recetaNombre}</div>
            <div class="hist-dia-prod-det">
              ${h.panes} panes · ${_fmt(h.precio || 0)}/pan · inv. ${_fmt(h.costoTotal || 0)}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <div class="hist-dia-prod-gan ${h.ganancia >= 0 ? "pos" : "neg"}">
              ${sg}${_fmt(h.ganancia || 0)}
            </div>
            <div class="hist-dia-acciones">
              <button class="btn btn-sm btn-editar" onclick="editarHist('${h.id}')">✏️</button>
              <button class="btn btn-sm btn-eliminar" onclick="eliminarHist('${h.id}')">✕</button>
            </div>
          </div>
        </div>`;
          })
          .join("");

        return `
      <div class="hist-dia-grupo">
        <div class="hist-dia-header ${abierto}" onclick="toggleDiaHist(this)">
          <div>
            <div class="hist-dia-fecha">${nomDia} ${d} de ${MESES_CORTOS[parseInt(m) - 1]}${esHoy ? " · Hoy" : ""}</div>
            <div class="hist-dia-meta">${regs.length} producción(es) · ${diaPanes} panes · inv. ${_fmt(diaInv)}</div>
          </div>
          <div class="hist-dia-resumen">
            <div class="hist-dia-total ${ganCls}">${s}${_fmt(diaGan)}</div>
            <div class="hist-dia-chevron">▾</div>
          </div>
        </div>
        <div class="hist-dia-body ${abierto}">${prodsHTML}</div>
      </div>`;
      })
      .join("");
}

// Toggle de grupo por día
window.toggleDiaHist = function (header) {
  const body = header.nextElementSibling;
  header.classList.toggle("abierto");
  body.classList.toggle("abierto");
};

// ══════════════════════════════════════════════════
// 10. ESTADÍSTICAS MEJORADAS
// ══════════════════════════════════════════════════
window.filtrarStats = function (rango, btn) {
  document
    .querySelectorAll("#tab-estadisticas .filtro-btn")
    .forEach((b) => b.classList.remove("activo"));
  btn.classList.add("activo");
  filtroStatsMes = "";
  const sel = document.getElementById("stats-mes-sel");
  if (sel) sel.value = "";
  dibujarStats(rango);
};

window.filtrarStatsMes = function (mes) {
  filtroStatsMes = mes;
  document
    .querySelectorAll("#tab-estadisticas .filtro-btn")
    .forEach((b) => b.classList.remove("activo"));
  dibujarStats(mes ? "mes-especifico" : "todo", mes);
};

function esMismoAnio(ts) {
  let d;
  if (ts && ts.toDate) d = ts.toDate();
  else if (typeof ts === "number") d = new Date(ts);
  else if (typeof ts === "string") d = new Date(ts + "T00:00:00");
  else d = new Date(ts);
  return d.getFullYear() === new Date().getFullYear();
}

function dibujarStats(rango = "todo", mesEsp) {
  // ── Filtrar historial ──
  const filtrados =
    rango === "mes-especifico"
      ? historial.filter((h) => esMismoMes(_fechaTS(h).getTime(), mesEsp))
      : rango === "anio"
        ? historial.filter((h) => esMismoAnio(h.fecha))
        : historial.filter((h) => esMismaFecha(h.fecha, rango));

  // ── Vacío ──
  const BLOQUES = [
    "stats-resumen",
    "stats-grafica",
    "stats-panes",
    "stats-clientes",
    "stats-tipos",
  ];
  if (!filtrados.length) {
    BLOQUES.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });
    document.getElementById("stats-con").innerHTML =
      `<div class="vacio"><div class="vacio-icono">📊</div>
       <p>No hay producciones en este periodo.</p></div>`;
    return;
  }
  document.getElementById("stats-con").innerHTML = "";

  // ── Métricas de producción ──
  const tI = filtrados.reduce((t, h) => t + (h.costoTotal || 0), 0);
  const tV = filtrados.reduce((t, h) => t + (h.totalVenta || 0), 0);
  const tG = filtrados.reduce((t, h) => t + (h.ganancia || 0), 0);
  const tP = filtrados.reduce((t, h) => t + (h.panes || 0), 0);

  // ── Cobrado real a clientes ──
  const _ventaEnPeriodo = (v) => {
    const tsV = v.ts || (v.fecha ? new Date(v.fecha).getTime() : 0);
    if (rango === "mes-especifico") return esMismoMes(tsV, mesEsp);
    if (rango === "anio") return esMismoAnio(tsV);
    return esMismaFecha(tsV, rango);
  };

  let tCobrado = 0;
  let nVentas = 0;
  clientes.forEach((cli) => {
    (cli.ventas || []).forEach((v) => {
      if (!_ventaEnPeriodo(v)) return;
      const panes = v.panes || [
        { cantidad: v.cantidad, precioUnit: v.precioUnit },
      ];
      tCobrado += panes.reduce(
        (t, p) => t + (p.cantidad || 0) * (p.precioUnit || 0),
        0,
      );
      nVentas++;
    });
  });

  const gananciaReal = tCobrado - tI;
  const grPos = gananciaReal >= 0;

  // ══════════════════════════════════
  // BLOQUE 2 — Resumen financiero
  // ══════════════════════════════════
  document.getElementById("stats-resumen").innerHTML = `
    <div class="stats-fin-grid" style="margin-bottom:10px">
      <div class="stats-fin-card sfc-dorado">
        <div class="stats-fin-ico">💸</div>
        <div class="stats-fin-label">Invertido</div>
        <div class="stats-fin-val">${_fmt(tI)}</div>
        <div class="stats-fin-sub">en producción</div>
      </div>
      <div class="stats-fin-card sfc-azul">
        <div class="stats-fin-ico">💰</div>
        <div class="stats-fin-label">Cobrado</div>
        <div class="stats-fin-val">${_fmt(tCobrado)}</div>
        <div class="stats-fin-sub">a clientes · ${nVentas} ventas</div>
      </div>
      <div class="stats-fin-card ${grPos ? "sfc-verde" : "sfc-rojo"}">
        <div class="stats-fin-ico">${grPos ? "📈" : "⚠️"}</div>
        <div class="stats-fin-label">Ganancia real</div>
        <div class="stats-fin-val ${grPos ? "gan-pos" : "gan-neg"}">${grPos ? "+" : ""}${_fmt(gananciaReal)}</div>
        <div class="stats-fin-sub">cobrado − invertido</div>
      </div>
    </div>
    <div class="stats-mini-grid" style="margin-bottom:14px">
      <div class="stats-mini-card smc-dorado">
        <div class="stats-mini-label">Gan. teórica</div>
        <div class="stats-mini-val">${_fmt(tG)}</div>
        <div class="stats-mini-sub">precio × panes</div>
      </div>
      <div class="stats-mini-card smc-verde">
        <div class="stats-mini-label">Valor prod.</div>
        <div class="stats-mini-val">${_fmt(tV)}</div>
        <div class="stats-mini-sub">si se vende todo</div>
      </div>
      <div class="stats-mini-card smc-azul">
        <div class="stats-mini-label">Panes</div>
        <div class="stats-mini-val">${tP}</div>
        <div class="stats-mini-sub">producidos</div>
      </div>
      <div class="stats-mini-card smc-cafe">
        <div class="stats-mini-label">Producciones</div>
        <div class="stats-mini-val">${filtrados.length}</div>
        <div class="stats-mini-sub">registros</div>
      </div>
    </div>`;

  // ══════════════════════════════════
  // BLOQUE 3 — Gráfica producido vs cobrado
  // ══════════════════════════════════
  const gruposDia = _clavesDia(filtrados);
  const diasOrden = Object.keys(gruposDia).sort();

  // Cobrado por día
  const cobradoPorDia = {};
  clientes.forEach((cli) => {
    (cli.ventas || []).forEach((v) => {
      if (!_ventaEnPeriodo(v)) return;
      const tsV = v.ts || (v.fecha ? new Date(v.fecha).getTime() : 0);
      const dv = new Date(tsV);
      const key = `${dv.getFullYear()}-${String(dv.getMonth() + 1).padStart(2, "0")}-${String(dv.getDate()).padStart(2, "0")}`;
      const panes = v.panes || [
        { cantidad: v.cantidad, precioUnit: v.precioUnit },
      ];
      const tot = panes.reduce(
        (t, p) => t + (p.cantidad || 0) * (p.precioUnit || 0),
        0,
      );
      cobradoPorDia[key] = (cobradoPorDia[key] || 0) + tot;
    });
  });

  const MESES_C = [
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
  const DIAS_C = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const ALTURA_G = 110;

  const todasClaves = [
    ...new Set([...diasOrden, ...Object.keys(cobradoPorDia)]),
  ].sort();
  const maxGVal = Math.max(
    ...todasClaves.map((k) => {
      const prod = (gruposDia[k] || []).reduce(
        (t, h) => t + (h.totalVenta || 0),
        0,
      );
      const cob = cobradoPorDia[k] || 0;
      return Math.max(prod, cob);
    }),
    1,
  );

  const barrasG = todasClaves
    .map((key) => {
      const regs = gruposDia[key] || [];
      const prod = regs.reduce((t, h) => t + (h.totalVenta || 0), 0);
      const cob = cobradoPorDia[key] || 0;
      const hP = Math.max(
        Math.round((prod / maxGVal) * ALTURA_G),
        prod > 0 ? 3 : 0,
      );
      const hC = Math.max(
        Math.round((cob / maxGVal) * ALTURA_G),
        cob > 0 ? 3 : 0,
      );
      const [y, m, d] = key.split("-");
      const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      const etq =
        todasClaves.length <= 7 ? DIAS_C[fecha.getDay()] : `${d}/${m}`;
      return `
      <div class="barra-grupo">
        <div class="barras-cols">
          <div class="barra-inv" style="height:${hP}px;background:linear-gradient(180deg,var(--dorado-b),var(--dorado))">
            <div class="barra-tooltip">📦 Prod: ${_fmt(prod)}<br>📅 ${d} ${MESES_C[parseInt(m) - 1]}</div>
          </div>
          <div class="barra-gan" style="height:${hC}px;background:linear-gradient(180deg,#5dd892,var(--verde))">
            <div class="barra-tooltip">💰 Cobrado: ${_fmt(cob)}<br>📅 ${d} ${MESES_C[parseInt(m) - 1]}</div>
          </div>
        </div>
        <div class="barra-etiqueta">${etq}</div>
      </div>`;
    })
    .join("");

  document.getElementById("stats-grafica").innerHTML = `
    <div class="stats-grafica-card" style="margin-bottom:14px">
      <div class="stats-grafica-titulo">📊 Valor producido vs Cobrado a clientes</div>
      <div class="stats-leyenda">
        <div class="stats-leyenda-item">
          <div class="stats-leyenda-color" style="background:var(--dorado)"></div> Valor producido
        </div>
        <div class="stats-leyenda-item">
          <div class="stats-leyenda-color" style="background:var(--verde)"></div> Cobrado real
        </div>
      </div>
      <div class="grafica-contenedor">
        <div class="grafica-barras">${barrasG}</div>
      </div>
      <div class="grafica-base"></div>
      <p style="font-size:.7rem;color:var(--texto-s);margin-top:10px;text-align:center">
        ${
          tCobrado < tV
            ? `⚠️ Hay ${_fmt(tV - tCobrado)} producidos sin cobrar registrado`
            : `✅ Todo lo producido tiene venta registrada`
        }
      </p>
    </div>`;

  // ══════════════════════════════════
  // BLOQUE 4 — Panes: vendidos vs rentables
  // ══════════════════════════════════
  const porPanVendido = {};
  const porPanRentable = {};

  // Vendidos (desde ventas de clientes)
  clientes.forEach((cli) => {
    (cli.ventas || []).forEach((v) => {
      if (!_ventaEnPeriodo(v)) return;
      const panes = v.panes || [
        { recetaNombre: v.recetaNombre, cantidad: v.cantidad },
      ];
      panes.forEach((p) => {
        if (!p.recetaNombre) return;
        if (!porPanVendido[p.recetaNombre]) porPanVendido[p.recetaNombre] = 0;
        porPanVendido[p.recetaNombre] += p.cantidad || 0;
      });
    });
  });

  // Rentables (desde historial de producción)
  filtrados.forEach((h) => {
    if (!porPanRentable[h.recetaNombre])
      porPanRentable[h.recetaNombre] = { gan: 0, panes: 0 };
    porPanRentable[h.recetaNombre].gan += h.ganancia || 0;
    porPanRentable[h.recetaNombre].panes += h.panes || 0;
  });

  const rankVendidos = Object.entries(porPanVendido)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const rankRentables = Object.entries(porPanRentable)
    .sort((a, b) => b[1].gan - a[1].gan)
    .slice(0, 6);
  const maxV = rankVendidos[0]?.[1] || 1;
  const maxR = Math.max(...rankRentables.map(([, d]) => Math.abs(d.gan)), 1);

  const htmlVendidos = rankVendidos.length
    ? rankVendidos
        .map(
          ([nom, cant], i) => `
        <div class="stats-pan-item">
          <div class="stats-pan-num ${i === 0 ? "oro" : ""}">${i + 1}</div>
          <div class="stats-pan-info">
            <div class="stats-pan-nom">${nom}</div>
            <div class="stats-pan-barra-wrap">
              <div class="stats-pan-barra-fill fill-dorado" style="width:${Math.round((cant / maxV) * 100)}%"></div>
            </div>
          </div>
          <div class="stats-pan-val" style="color:var(--cafe-rico)">${cant} u</div>
        </div>`,
        )
        .join("")
    : '<p style="font-size:.8rem;color:var(--texto-s)">Sin ventas registradas.</p>';

  const htmlRentables = rankRentables
    .map(([nom, data], i) => {
      const pos = data.gan >= 0;
      return `
      <div class="stats-pan-item">
        <div class="stats-pan-num ${i === 0 ? "oro" : ""}">${i + 1}</div>
        <div class="stats-pan-info">
          <div class="stats-pan-nom">${nom}</div>
          <div class="stats-pan-det">${data.panes} panes prod.</div>
          <div class="stats-pan-barra-wrap">
            <div class="stats-pan-barra-fill ${pos ? "fill-verde" : "fill-rojo"}"
                 style="width:${Math.round((Math.abs(data.gan) / maxR) * 100)}%"></div>
          </div>
        </div>
        <div class="stats-pan-val ${pos ? "pos" : "neg"}">${pos ? "+" : ""}${_fmt(data.gan)}</div>
      </div>`;
    })
    .join("");

  document.getElementById("stats-panes").innerHTML = `
    <div class="stats-panes-grid" style="margin-bottom:14px">
      <div class="stats-panes-col">
        <div class="stats-panes-titulo">🛍️ Más vendidos</div>
        ${htmlVendidos}
      </div>
      <div class="stats-panes-col">
        <div class="stats-panes-titulo">💰 Más rentables</div>
        ${htmlRentables}
      </div>
    </div>`;

  // ══════════════════════════════════
  // BLOQUE 5 — Mejores clientes
  // ══════════════════════════════════
  const rankCli = clientes
    .map((cli) => {
      let tot = 0;
      let nC = 0;
      (cli.ventas || []).forEach((v) => {
        if (!_ventaEnPeriodo(v)) return;
        const panes = v.panes || [
          { cantidad: v.cantidad, precioUnit: v.precioUnit },
        ];
        tot += panes.reduce(
          (t, p) => t + (p.cantidad || 0) * (p.precioUnit || 0),
          0,
        );
        nC++;
      });
      return { nombre: cli.nombre, tipo: cli.tipo, tot, nC };
    })
    .filter((c) => c.tot > 0)
    .sort((a, b) => b.tot - a.tot)
    .slice(0, 8);

  const maxCli = rankCli[0]?.tot || 1;
  const totalCli = rankCli.reduce((t, c) => t + c.tot, 0) || 1;

  const COLOR_TIPO = {
    tienda: "#2563a8",
    fruver: "#2e7d52",
    restaurante: "#b83232",
    cafeteria: "#92400e",
    ambulante: "#7c3aed",
    panaderia: "#c9993a",
    vecino: "#0e7490",
    mayorista: "#374151",
    otro: "#6b5340",
  };

  document.getElementById("stats-clientes").innerHTML = rankCli.length
    ? `
    <div class="stats-cli-card" style="margin-bottom:14px">
      <div class="stats-cli-titulo">👥 Mejores clientes del periodo</div>
      ${rankCli
        .map(
          (cl, i) => `
        <div class="stats-cli-item">
          <div class="stats-cli-pos ${i === 0 ? "oro" : ""}">${i + 1}</div>
          <div class="stats-cli-avatar" style="background:${COLOR_TIPO[cl.tipo] || "#6b5340"}22;border:2px solid ${COLOR_TIPO[cl.tipo] || "#6b5340"}44">
            ${emojiTipo(cl.tipo)}
          </div>
          <div class="stats-cli-info">
            <div class="stats-cli-nom">${cl.nombre}</div>
            <div class="stats-cli-det">${TIPOS[cl.tipo] || cl.tipo} · ${cl.nC} compra(s) · ${Math.round((cl.tot / totalCli) * 100)}% del total</div>
            <div class="stats-cli-barra-wrap">
              <div class="stats-cli-barra-fill" style="width:${Math.round((cl.tot / maxCli) * 100)}%"></div>
            </div>
          </div>
          <div class="stats-cli-total">${_fmt(cl.tot)}</div>
        </div>`,
        )
        .join("")}
    </div>`
    : "";

  // ══════════════════════════════════
  // BLOQUE 6 — Por tipo de cliente con %
  // ══════════════════════════════════
  const porTipo = {};
  let nCliPorTipo = {};
  clientes.forEach((cli) => {
    let hayVenta = false;
    (cli.ventas || []).forEach((v) => {
      if (!_ventaEnPeriodo(v)) return;
      const panes = v.panes || [
        { cantidad: v.cantidad, precioUnit: v.precioUnit },
      ];
      const tot = panes.reduce(
        (t, p) => t + (p.cantidad || 0) * (p.precioUnit || 0),
        0,
      );
      if (!porTipo[cli.tipo]) porTipo[cli.tipo] = 0;
      porTipo[cli.tipo] += tot;
      hayVenta = true;
    });
    if (hayVenta) {
      if (!nCliPorTipo[cli.tipo]) nCliPorTipo[cli.tipo] = 0;
      nCliPorTipo[cli.tipo]++;
    }
  });

  const rankTipo = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
  const maxTipo = rankTipo[0]?.[1] || 1;
  const totalTipo = rankTipo.reduce((t, [, v]) => t + v, 0) || 1;

  const EMOJI_TIPO = {
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

  document.getElementById("stats-tipos").innerHTML = rankTipo.length
    ? `
    <div class="stats-cli-card">
      <div class="stats-cli-titulo">🏪 Ventas por tipo de cliente</div>
      ${rankTipo
        .map(
          ([tipo, total]) => `
        <div class="stats-tipo-item">
          <div class="stats-tipo-ico">${EMOJI_TIPO[tipo] || "👤"}</div>
          <div class="stats-tipo-info">
            <div class="stats-tipo-nom">${TIPOS[tipo] || tipo}
              <span style="font-size:.68rem;font-weight:400;color:var(--texto-s)">
                · ${nCliPorTipo[tipo] || 0} cliente(s)
              </span>
            </div>
            <div class="stats-tipo-barra-wrap">
              <div class="stats-tipo-barra-fill" style="width:${Math.round((total / maxTipo) * 100)}%"></div>
            </div>
          </div>
          <div class="stats-tipo-datos">
            <div class="stats-tipo-monto">${_fmt(total)}</div>
            <div class="stats-tipo-pct">${Math.round((total / totalTipo) * 100)}% del total</div>
          </div>
        </div>`,
        )
        .join("")}
    </div>`
    : "";
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
    toast("Venta guardada ✓");
    syncOk();
  } catch (e) {
    syncErr();
    toast("Error");
  }
};

// ══════════════════════════════════════════════════
// 18. DESCARGAS - Filtros y Funciones de Exportación
// ══════════════════════════════════════════════════

let periodoDescargas = "todo";
let mesDescargasEspecifico = "";

window.filtrarDescargas = function (rango, btn) {
  periodoDescargas = rango;
  mesDescargasEspecifico = "";
  document
    .querySelectorAll("#tab-descargas .filtro-btn")
    .forEach((b) => b.classList.remove("activo"));
  if (btn) btn.classList.add("activo");

  if (rango === "mes-especifico") {
    document.getElementById("desc-mes-selector").classList.add("visible");
    llenarSelectMeses();
  } else {
    document.getElementById("desc-mes-selector").classList.remove("visible");
  }
};

window.actualizarMesDescargas = function (mes) {
  mesDescargasEspecifico = mes;
};

function _parseFecha(f) {
  if (!f) return new Date();
  if (f && f.toDate) return f.toDate();
  if (typeof f === "number") return new Date(f);
  return new Date(f + "T00:00:00");
}

function filtrarPorPeriodo(items, campoFecha) {
  const hoy = new Date();
  const semanaAgo = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);

  return items.filter((item) => {
    const f = item[campoFecha];
    const fecha = _parseFecha(f);

    if (periodoDescargas === "hoy")
      return fecha.toDateString() === hoy.toDateString();
    if (periodoDescargas === "semana") return fecha >= semanaAgo;
    if (periodoDescargas === "mes")
      return (
        fecha.getMonth() === hoy.getMonth() &&
        fecha.getFullYear() === hoy.getFullYear()
      );
    if (periodoDescargas === "mes-especifico" && mesDescargasEspecifico) {
      const [y, m] = mesDescargasEspecifico.split("-");
      return (
        fecha.getFullYear() === parseInt(y) &&
        fecha.getMonth() === parseInt(m) - 1
      );
    }
    return true;
  });
}

function generarFechaHoy() {
  return new Date().toISOString().split("T")[0];
}

function descargarCSV(nombre, contenido) {
  const csv = contenido.map((fila) => fila.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `niangel-${nombre}-${generarFechaHoy()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

window.descargarResumenContable = function () {
  const filas = [
    ["Mes", "Invertido", "Cobrado", "Ganancia Real", "Producciones"],
  ];
  const mesesData = {};

  filtrarPorPeriodo(historial, "fecha").forEach((h) => {
    const d = _parseFecha(h.fecha);
    const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!mesesData[mesKey])
      mesesData[mesKey] = { invertido: 0, cobrado: 0, prod: 0 };
    mesesData[mesKey].invertido += h.costoTotal || 0;
    mesesData[mesKey].prod++;
  });

  clientes.forEach((cli) => {
    (cli.ventas || []).forEach((v) => {
      const d = _parseFecha(v.fecha);
      const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!filtrarPorPeriodo([v], "fecha").length) return;
      if (!mesesData[mesKey])
        mesesData[mesKey] = { invertido: 0, cobrado: 0, prod: 0 };
      const panes = v.panes || [
        { cantidad: v.cantidad, precioUnit: v.precioUnit },
      ];
      mesesData[mesKey].cobrado += panes.reduce(
        (t, p) => t + (p.cantidad || 0) * (p.precioUnit || 0),
        0,
      );
    });
  });

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
  Object.entries(mesesData)
    .sort()
    .reverse()
    .forEach(([mesKey, data]) => {
      const [y, m] = mesKey.split("-");
      const ganancia = data.cobrado - data.invertido;
      filas.push([
        `${MESES_NOM[parseInt(m) - 1]} ${y}`,
        data.invertido.toFixed(2),
        data.cobrado.toFixed(2),
        ganancia.toFixed(2),
        data.prod,
      ]);
    });

  descargarCSV("resumen-contable", filas);
  toast("Resumen contable descargado");
};

window.descargarProduccion = function () {
  const filas = [
    [
      "Fecha",
      "Pan",
      "Panes",
      "Precio",
      "Costo Total",
      "Venta Total",
      "Ganancia",
    ],
  ];

  filtrarPorPeriodo(historial, "fecha")
    .slice()
    .reverse()
    .forEach((h) => {
      filas.push([
        h.fechaTexto || h.fecha || "",
        h.recetaNombre || "",
        h.panes || "",
        (h.precio || 0).toFixed(2),
        (h.costoTotal || 0).toFixed(2),
        (h.totalVenta || 0).toFixed(2),
        (h.ganancia || 0).toFixed(2),
      ]);
    });

  descargarCSV("produccion", filas);
  toast("Historial de producción descargado");
};

window.descargarRecetas = function () {
  const filas = [
    [
      "Nombre Pan",
      "Rinde",
      "Precio Venta",
      "Costo Total",
      "Costo/Pan",
      "Ganancia/Pan",
    ],
  ];

  recetas.forEach((rec) => {
    const costo = (rec.ings || []).reduce((t, ri) => {
      const ing = ingredientes.find((i) => i.id === ri.ingId);
      return ing ? t + (ing.precio / ing.cantidad) * ri.cantidad : t;
    }, 0);
    const rinde = rec.rinde || 1;
    const precio = rec.precio || 0;
    const costoPan = costo / rinde;
    const ganancia = precio - costoPan;

    filas.push([
      rec.nombre,
      rinde,
      precio.toFixed(2),
      costo.toFixed(2),
      costoPan.toFixed(3),
      ganancia.toFixed(2),
    ]);
  });

  descargarCSV("recetas", filas);
  toast("Recetas descargadas");
};

window.descargarBodega = function () {
  const filas = [
    ["Ingrediente", "Cantidad", "Unidad", "Precio Total", "Precio/Unidad"],
  ];

  ingredientes.forEach((ing) => {
    const ppu = ing.cantidad > 0 ? (ing.precio / ing.cantidad).toFixed(3) : "0";
    filas.push([
      ing.nombre,
      ing.cantidad,
      ing.unidad,
      (ing.precio || 0).toFixed(2),
      ppu,
    ]);
  });

  descargarCSV("bodega", filas);
  toast("Bodega descargada");
};

window.descargarClientes = function () {
  const filas = [["Cliente", "Tipo", "Teléfono", "Total Comprado", "Compras"]];

  clientes.forEach((cli) => {
    const totalCompras = (cli.ventas || []).reduce((t, v) => {
      const panes = v.panes || [
        { cantidad: v.cantidad, precioUnit: v.precioUnit },
      ];
      return (
        t +
        panes.reduce((s, p) => s + (p.cantidad || 0) * (p.precioUnit || 0), 0)
      );
    }, 0);
    const nCompras = (cli.ventas || []).length;

    filas.push([
      cli.nombre,
      cli.tipo || "",
      cli.tel || "",
      totalCompras.toFixed(2),
      nCompras,
    ]);
  });

  descargarCSV("clientes", filas);
  toast("Clientes descargados");
};

window.descargarVentas = function () {
  const filas = [["Fecha", "Cliente", "Tipo", "Panes", "Total"]];

  clientes.forEach((cli) => {
    (cli.ventas || []).forEach((v) => {
      if (!filtrarPorPeriodo([v], "fecha").length) return;
      const panes = v.panes || [
        { recetaNombre: v.recetaNombre, cantidad: v.cantidad },
      ];
      const resumen = panes
        .map((p) => `${p.cantidad}x${p.recetaNombre}`)
        .join("; ");
      filas.push([
        v.fecha || "",
        cli.nombre,
        cli.tipo || "",
        resumen,
        (v.total || 0).toFixed(2),
      ]);
    });
  });

  descargarCSV("ventas", filas);
  toast("Ventas descargadas");
};

window.descargarTodo = function () {
  toast("Iniciando descarga de reportes...");
  setTimeout(() => {
    descargarResumenContable();
    setTimeout(() => {
      descargarProduccion();
      setTimeout(() => {
        descargarRecetas();
        setTimeout(() => {
          descargarBodega();
          setTimeout(() => {
            descargarClientes();
            setTimeout(() => {
              descargarVentas();
            }, 300);
          }, 300);
        }, 300);
      }, 300);
    }, 300);
  }, 300);
};

function llenarSelectMeses() {
  const mesesSet = new Set();
  historial.forEach((h) => {
    const d = _parseFecha(h.fecha);
    if (!isNaN(d))
      mesesSet.add(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      );
  });
  clientes.forEach((cli) => {
    (cli.ventas || []).forEach((v) => {
      const d = _parseFecha(v.fecha);
      if (!isNaN(d))
        mesesSet.add(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        );
    });
  });
  const meses = [...mesesSet].sort().reverse();
  const sel = document.getElementById("desc-mes-sel");
  if (sel) {
    sel.innerHTML =
      '<option value="">Selecciona mes</option>' +
      meses
        .map((m) => {
          const [y, mo] = m.split("-");
          return `<option value="${m}">Mes ${mo}/${y}</option>`;
        })
        .join("");
  }
}

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
