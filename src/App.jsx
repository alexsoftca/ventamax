import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";



const PAY_METHODS = ["Pago Móvil", "Punto de Venta", "Efectivo Bs", "Efectivo $", "Binance", "Zelle"];
const EXPENSE_METHODS = ["Cuenta Bancaria", "Efectivo Bs", "Efectivo $", "Binance", "Zelle"];
const CUADRE_METHODS = ["Cuenta Bancaria", "Efectivo Bs", "Efectivo $", "Binance", "Zelle"];
const USES_BS = new Set(["Pago Móvil", "Punto de Venta", "Efectivo Bs", "Cuenta Bancaria"]);
const BANCO_METHODS = new Set(["Pago Móvil", "Punto de Venta"]);
const PAY_ICONS = { "Pago Móvil": "📲", "Punto de Venta": "💳", "Cuenta Bancaria": "🏦", "Efectivo Bs": "💵", "Efectivo $": "💲", "Binance": "🪙", "Zelle": "⚡" };
const PAY_COLORS = {
  "Pago Móvil": { bg: "#0c4a6e", fg: "#7dd3fc", dot: "#38bdf8" },
  "Punto de Venta": { bg: "#0e4a5c", fg: "#67e8f9", dot: "#22d3ee" },
  "Cuenta Bancaria": { bg: "#0c4a6e", fg: "#7dd3fc", dot: "#38bdf8" },
  "Efectivo Bs": { bg: "#14532d", fg: "#86efac", dot: "#22c55e" },
  "Efectivo $": { bg: "#713f12", fg: "#fde68a", dot: "#eab308" },
  "Binance": { bg: "#78350f", fg: "#fcd34d", dot: "#f59e0b" },
  "Zelle": { bg: "#3b0764", fg: "#d8b4fe", dot: "#a855f7" },
};
function getToday() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

const INIT_SALES = [];
const INIT_EXPENSES = [];
const INIT_CAMBIOS = [];

const fmt = (v, s = "$") => `${s}${Number(v || 0).toFixed(2)}`;
const fmtBs = v => `Bs ${Number(v || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
const getItems = s => s.items || [{ tipo: s.tipo, cantidad: s.cantidad, descripcion: s.descripcion, costo: s.costo, precioVenta: s.precioVenta }];
const getPagos = s => s.pagos || [{ metodo: s.metodoPago, monto: s.pago }];
const saleCosto = s => getItems(s).reduce((a, i) => a + i.costo * i.cantidad, 0);
const saleTotal = s => getItems(s).reduce((a, i) => a + i.precioVenta * i.cantidad, 0);
const getExpPagos = e => e.pagos || [{ metodo: e.metodoPago, monto: e.costo }];

function Badge({ method, small }) {
  const c = PAY_COLORS[method] || { bg: "#333", fg: "#aaa", dot: "#666" };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: small ? "2px 7px 2px 5px" : "3px 10px 3px 8px", borderRadius: 6, fontSize: small ? 10 : 11, fontWeight: 600, background: c.bg + "44", color: c.fg }}><span style={{ width: small ? 5 : 6, height: small ? 5 : 6, borderRadius: "50%", background: c.dot }} />{method}</span>;
}
function TypeBadge({ tipo }) {
  const a = tipo === "Accesorio";
  return <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", background: a ? "#1e3a5f" : "#4a2c17", color: a ? "#93c5fd" : "#fcd34d" }}>{tipo}</span>;
}
function Stat({ label, value, sub, color, icon, hideable }) {
  const [vis, setVis] = useState(true);
  return (
    <div style={{ background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 14, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 14, right: 16, opacity: 0.12, color }}>{icon}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "#6b6b8d", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2 }}>{label}</span>
        {hideable && <button onClick={() => setVis(!vis)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#4a4a6a", display: "flex" }}>{vis ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}</button>}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace" }}>{hideable && !vis ? "••••••" : value}</div>
      {sub && <div style={{ fontSize: 11, color: "#4a4a6a", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
function Modal({ open, onClose, title, children, width }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>
      <div style={{ background: "#151530", border: "1px solid #252545", borderRadius: 18, padding: "24px 26px", width: "100%", maxWidth: width || 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#e2e2f0" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "#1e1e3a", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b6b8d", fontSize: 16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, type = "text", value, onChange, placeholder, highlight, style: sx }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, ...sx }}>
      <label style={{ fontSize: 11, color: highlight ? "#eab308" : "#5a5a7a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} step={type === "number" ? "any" : undefined}
        style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: highlight ? "1.5px solid #eab308" : "1px solid #252545", background: highlight ? "#1a1a0e" : "#0e0e22", color: "#e2e2f0", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "'JetBrains Mono', 'DM Sans', monospace" }} />
    </div>
  );
}
function Btn({ children, onClick, color = "#6366f1", small, ghost, disabled }) {
  return <button onClick={onClick} disabled={disabled} style={{ background: ghost ? "transparent" : color, color: ghost ? "#6b6b8d" : "#fff", border: ghost ? "1px solid #252545" : "none", borderRadius: 9, padding: small ? "7px 14px" : "10px 20px", fontSize: small ? 12 : 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", opacity: disabled ? 0.4 : 1, transition: "all 0.15s", whiteSpace: "nowrap" }}>{children}</button>;
}
function PayBtn({ method, selected, onClick }) {
  const c = PAY_COLORS[method];
  return <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: selected ? `2px solid ${c.dot}` : "1px solid #252545", background: selected ? c.bg + "55" : "#0e0e22", color: selected ? c.fg : "#5a5a7a", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", boxShadow: selected ? `0 0 12px ${c.dot}22` : "none" }}><span style={{ fontSize: 14 }}>{PAY_ICONS[method]}</span>{method.replace("Efectivo ", "").replace("Pago ", "P.")}</button>;
}
function TasaBanner({ tasa, onEdit }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #1a1a0e, #1e1a10)", border: "1px solid #3d3518", borderRadius: 14, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "#2d2510", display: "flex", alignItems: "center", justifyContent: "center", color: "#eab308", fontSize: 18 }}>$</div>
        <div>
          <div style={{ fontSize: 11, color: "#a38a2d", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Tasa del Día</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24", fontFamily: "'JetBrains Mono', monospace" }}>Bs {Number(tasa).toFixed(2)}</div>
        </div>
      </div>
      <Btn onClick={onEdit} small color="#eab308">✎ Cambiar</Btn>
    </div>
  );
}

/* ━━━ VENDEDOR ━━━ */
function Vendedor({ sales, setSales, expenses, setExpenses, cambios, setCambios, tasa, setTasa }) {
  const TODAY = getToday();
  const todayLabel = new Date().toLocaleDateString("es-VE", { day: "numeric", month: "long" });
  const monthLabel = new Date().toLocaleDateString("es-VE", { month: "long", year: "numeric" });
  const [tab, setTab] = useState("ventas");
  const [showSale, setShowSale] = useState(false);
  const [showExp, setShowExp] = useState(false);
  const [showTasa, setShowTasa] = useState(false);
  const [showCambio, setShowCambio] = useState(false);
  const [newTasa, setNewTasa] = useState(tasa);
  const [cuadreHay, setCuadreHay] = useState({});
  const [confirmingClose, setConfirmingClose] = useState(null);
  const [splitMode, setSplitMode] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = new, id = editing
  const [confirmDelete, setConfirmDelete] = useState(null); // sale id to delete
  const [expandedNotes, setExpandedNotes] = useState({});
  const [showCuadreBanco, setShowCuadreBanco] = useState(false);
  const [cuadreVerified, setCuadreVerified] = useState(false);
  const [editingExpId, setEditingExpId] = useState(null);

  // Nota de venta state
  const blankItem = () => ({ tipo: "", descripcion: "", cantidad: "1", costo: "", precioVenta: "" });
  const [notaItems, setNotaItems] = useState([]);
  const [curItem, setCurItem] = useState(blankItem());
  const [notaPagos, setNotaPagos] = useState({});
  const [notaTasa, setNotaTasa] = useState(String(tasa));
  // Vuelto
  const [vueltoActive, setVueltoActive] = useState(false);
  const [vueltoPagaCon, setVueltoPagaCon] = useState("");
  const [vueltoEnDolares, setVueltoEnDolares] = useState("");
  const [vueltoMetodoBs, setVueltoMetodoBs] = useState("Pago Móvil");
  const [vueltoTasa, setVueltoTasa] = useState(String(tasa));

  // Expense
  const [expForm, setExpForm] = useState({ descripcion: "", costo: "", tasaBs: String(tasa) });
  const [expPagos, setExpPagos] = useState({});
  const [expSplit, setExpSplit] = useState(false);

  useEffect(() => { setNotaTasa(String(tasa)); setExpForm(f => ({ ...f, tasaBs: String(tasa) })); }, [tasa]);

  // Next nota number
  const nextNota = Math.max(0, ...sales.map(s => s.nota || 0)) + 1;

  const todaySales = sales.filter(s => s.date === TODAY).sort((a, b) => (b.createdAt || b.id) > (a.createdAt || a.id) ? 1 : -1);
  const todayExp = expenses.filter(e => e.date === TODAY);
  const todayTotal = todaySales.reduce((a, s) => a + s.pago, 0);
  const todayGan = todaySales.reduce((a, s) => a + (s.pago - saleCosto(s)), 0);
  const todayExpTotal = todayExp.reduce((a, e) => a + e.costo, 0);

  // Nota totals
  const notaTotal = notaItems.reduce((a, i) => a + i.precioVenta * i.cantidad, 0);
  const selectedMethods = Object.keys(notaPagos);
  const totalAsignado = selectedMethods.reduce((a, m) => a + Number(notaPagos[m] || 0), 0);
  const needsBs = selectedMethods.some(m => USES_BS.has(m));
  const faltaAsignar = +(notaTotal - totalAsignado).toFixed(2);

  function addItem() {
    const item = { tipo: curItem.tipo, descripcion: curItem.descripcion, cantidad: Number(curItem.cantidad) || 1, costo: Number(curItem.costo), precioVenta: Number(curItem.precioVenta) };
    const newItems = [...notaItems, item];
    setNotaItems(newItems);
    setCurItem(blankItem());
    const newTotal = newItems.reduce((a, i) => a + i.precioVenta * i.cantidad, 0);
    if (selectedMethods.length === 1) setNotaPagos({ [selectedMethods[0]]: newTotal });
  }

  function removeItem(idx) {
    const newItems = notaItems.filter((_, i) => i !== idx);
    setNotaItems(newItems);
    const newTotal = newItems.reduce((a, i) => a + i.precioVenta * i.cantidad, 0);
    if (selectedMethods.length === 1) setNotaPagos({ [selectedMethods[0]]: newTotal });
  }

  function toggleMethod(m) {
    const p = { ...notaPagos };
    if (p[m] !== undefined) { delete p[m]; } else {
      const used = Object.keys(p).reduce((a, k) => a + Number(p[k] || 0), 0);
      p[m] = Math.max(0, +(notaTotal - used).toFixed(2));
    }
    setNotaPagos(p);
  }

  function selectSingleMethod(m) { setNotaPagos({ [m]: notaTotal }); }

  function saveNota() {
    const t = Number(notaTasa);
    const pagosArr = selectedMethods.map(m => ({ metodo: m, monto: Number(notaPagos[m]) })).filter(p => p.monto > 0);
    const bsPortion = pagosArr.filter(p => USES_BS.has(p.metodo)).reduce((a, p) => a + p.monto, 0);
    if (editingId) {
      setSales(sales.map(s => s.id === editingId ? { ...s, items: notaItems, pago: notaTotal, tasaBs: t, totalBs: bsPortion * t, pagos: pagosArr } : s));
    } else {
      setSales([...sales, { id: Date.now(), nota: nextNota, date: TODAY, createdAt: new Date().toISOString(), items: notaItems, pago: notaTotal, tasaBs: t, totalBs: bsPortion * t, pagos: pagosArr }]);
    }
    // Auto-create/replace cambio for vuelto in Bs
    if (vueltoActive) {
      const pagaCon = Number(vueltoPagaCon) || 0;
      const vueltoTotal = pagaCon - notaTotal;
      const enDolares = Number(vueltoEnDolares) || 0;
      const enBs = +(vueltoTotal - enDolares).toFixed(2);
      const vt = Number(vueltoTasa) || t;
      const notaNum = editingId ? (sales.find(s => s.id === editingId)?.nota || "?") : nextNota;
      const cambioNota = `Vuelto Nota #${String(notaNum).padStart(3, "0")}`;
      // Remove old cambio for this nota if exists
      const filtered = cambios.filter(c => c.nota !== cambioNota);
      if (enBs > 0) {
        setCambios([...filtered, {
          id: Date.now() + 1, date: TODAY, createdAt: new Date().toISOString(),
          nota: cambioNota,
          doy: { metodo: vueltoMetodoBs, monto: enBs, bs: enBs * vt },
          recibo: { metodo: "Efectivo $", monto: enBs, bs: 0 },
          tasaBs: vt,
        }]);
      } else {
        setCambios(filtered); // No Bs portion, just clean up old
      }
    }
    resetNota(); setShowSale(false);
  }

  function resetNota() {
    setNotaItems([]); setCurItem(blankItem()); setNotaPagos({}); setNotaTasa(String(tasa)); setSplitMode(false); setEditingId(null);
    setVueltoActive(false); setVueltoPagaCon(""); setVueltoEnDolares(""); setVueltoMetodoBs("Pago Móvil"); setVueltoTasa(String(tasa));
  }

  function openNota(tipo) { resetNota(); if (tipo) setCurItem({ ...blankItem(), tipo }); setConfirmingClose(null); setShowSale(true); }

  function editNota(s) {
    setEditingId(s.id);
    setNotaItems([...getItems(s)]);
    const pagosObj = {};
    getPagos(s).forEach(p => { pagosObj[p.metodo] = p.monto; });
    setNotaPagos(pagosObj);
    setNotaTasa(String(s.tasaBs));
    setSplitMode(getPagos(s).length > 1);
    setCurItem(blankItem());
    setConfirmingClose(null);
    // Load existing vuelto if there's a matching cambio
    const notaNum = s.nota || "";
    const existingCambio = cambios.find(c => c.nota === `Vuelto Nota #${String(notaNum).padStart(3, "0")}`);
    if (existingCambio) {
      setVueltoActive(true);
      const saleTotal = getItems(s).reduce((a, i) => a + i.precioVenta * i.cantidad, 0);
      setVueltoPagaCon(String(+(saleTotal + existingCambio.recibo.monto + Number(existingCambio.doy.monto === existingCambio.recibo.monto ? 0 : 0)).toFixed(2)));
      // Reconstruct: pagaCon = saleTotal + vueltoTotal, vueltoTotal = enDolares + enBs
      const enBsMonto = existingCambio.recibo.monto;
      setVueltoPagaCon(String(+(saleTotal + enBsMonto).toFixed(2)));
      setVueltoEnDolares("0");
      setVueltoMetodoBs(existingCambio.doy.metodo);
      setVueltoTasa(String(existingCambio.tasaBs));
    } else {
      setVueltoActive(false); setVueltoPagaCon(""); setVueltoEnDolares(""); setVueltoMetodoBs("Pago Móvil"); setVueltoTasa(String(tasa));
    }
    setShowSale(true);
  }

  function deleteNota(id) { setSales(sales.filter(s => s.id !== id)); setConfirmDelete(null); }

  function saveExp() {
    const c = Number(expForm.costo); const t = Number(expForm.tasaBs);
    const selMethods = Object.keys(expPagos);
    const pagosArr = selMethods.map(m => ({ metodo: m, monto: Number(expPagos[m]) })).filter(p => p.monto > 0);
    const bsPortion = pagosArr.filter(p => USES_BS.has(p.metodo)).reduce((a, p) => a + p.monto, 0);
    const expData = {
      id: editingExpId || Date.now(), date: TODAY, createdAt: new Date().toISOString(),
      descripcion: expForm.descripcion, costo: c, tasaBs: t,
      costoBs: bsPortion * t, pagos: pagosArr,
      metodoPago: pagosArr.length === 1 ? pagosArr[0].metodo : "Múltiple",
    };
    if (editingExpId) {
      setExpenses(expenses.map(e => e.id === editingExpId ? { ...expData, date: expenses.find(x => x.id === editingExpId)?.date || TODAY } : e));
    } else {
      setExpenses([...expenses, expData]);
    }
    resetExp(); setShowExp(false);
  }
  function resetExp() { setExpForm({ descripcion: "", costo: "", tasaBs: String(tasa), costoBsInput: "" }); setExpPagos({}); setExpSplit(false); setEditingExpId(null); }
  function editExp(e) {
    const ep = getExpPagos(e);
    const pagosObj = {};
    ep.forEach(p => { pagosObj[p.metodo] = p.monto; });
    setExpForm({ descripcion: e.descripcion, costo: String(e.costo), tasaBs: String(e.tasaBs), costoBsInput: e.costoBs ? String(e.costoBs) : "" });
    setExpPagos(pagosObj);
    setExpSplit(ep.length > 1);
    setEditingExpId(e.id);
    setShowExp(true);
  }
  function deleteExp(id) { setExpenses(expenses.filter(e => e.id !== id)); }

  // Cambio state
  const [cambioForm, setCambioForm] = useState({ doyMetodo: "", doyMonto: "", reciboMetodo: "", reciboMonto: "", tasaBs: String(tasa), nota: "" });
  const todayCambios = cambios.filter(c => c.date === TODAY);

  function saveCambio() { saveCambioEdit(); }
  function resetCambio() { setCambioForm({ doyMetodo: "", doyMonto: "", reciboMetodo: "", reciboMonto: "", tasaBs: String(tasa), nota: "" }); }

  // Determine if tasa applies as Bs/$ or as generic rate
  function cambioTasaType() {
    const dBs = USES_BS.has(cambioForm.doyMetodo);
    const rBs = USES_BS.has(cambioForm.reciboMetodo);
    if (dBs !== rBs) return "bs"; // one Bs, one $ → Bs per dollar
    return "rate"; // both same type → generic rate
  }

  // Auto-calc: given doy amount, calc recibo
  function cambioCalcRecibo(doyVal, t, doyM, recM) {
    const dBs = USES_BS.has(doyM); const rBs = USES_BS.has(recM);
    if (!recM || !doyVal) return "";
    const v = Number(doyVal);
    if (dBs && !rBs) return String(+(v / t).toFixed(2)); // Bs→$: divide
    if (!dBs && rBs) return String(+(v * t).toFixed(2)); // $→Bs: multiply
    return String(+(v * t).toFixed(2)); // same type: rate
  }
  // Auto-calc: given recibo amount, calc doy
  function cambioCalcDoy(recVal, t, doyM, recM) {
    const dBs = USES_BS.has(doyM); const rBs = USES_BS.has(recM);
    if (!doyM || !recVal) return "";
    const v = Number(recVal);
    if (dBs && !rBs) return String(+(v * t).toFixed(2)); // $→Bs: multiply
    if (!dBs && rBs) return String(+(v / t).toFixed(2)); // Bs→$: divide
    return String(+(v / t).toFixed(2)); // same type: reverse rate
  }

  function cambioSetDoy(monto) {
    const t = Number(cambioForm.tasaBs) || 1;
    const rec = cambioCalcRecibo(monto, t, cambioForm.doyMetodo, cambioForm.reciboMetodo);
    setCambioForm({ ...cambioForm, doyMonto: monto, reciboMonto: rec });
  }
  function cambioSetRecibo(monto) {
    const doyVal = Number(cambioForm.doyMonto);
    const recVal = Number(monto);
    let newTasa = cambioForm.tasaBs;
    if (doyVal > 0 && recVal > 0) {
      const dBs = USES_BS.has(cambioForm.doyMetodo);
      const rBs = USES_BS.has(cambioForm.reciboMetodo);
      if (dBs && !rBs) newTasa = String(+(doyVal / recVal).toFixed(2)); // Bs→$: tasa = Bs/dollar
      else if (!dBs && rBs) newTasa = String(+(recVal / doyVal).toFixed(2)); // $→Bs: tasa = Bs/dollar
      else newTasa = String(+(recVal / doyVal).toFixed(4)); // same type: rate
    }
    setCambioForm({ ...cambioForm, reciboMonto: monto, tasaBs: newTasa });
  }
  function cambioAutoNota(dM, rM) {
    if (!dM || !rM) return "";
    const dBs = USES_BS.has(dM); const rBs = USES_BS.has(rM);
    if (dBs && !rBs) {
      if (rM === "Efectivo $") return "Compra de dólares efectivo";
      if (rM === "Binance") return "Compra USDT con Bs";
      if (rM === "Zelle") return "Compra Zelle con Bs";
      return `Cambio ${dM} a ${rM}`;
    }
    if (!dBs && rBs) {
      if (dM === "Efectivo $") return "Venta de dólares efectivo";
      if (dM === "Binance") return "Venta USDT a Bs";
      if (dM === "Zelle") return "Venta Zelle a Bs";
      return `Cambio ${dM} a ${rM}`;
    }
    if (dM === "Efectivo $" && rM === "Binance") return "Compra USDT con efectivo";
    if (dM === "Binance" && rM === "Efectivo $") return "Venta USDT a efectivo";
    if (dM === "Efectivo $" && rM === "Zelle") return "Compra Zelle con efectivo";
    if (dM === "Zelle" && rM === "Efectivo $") return "Venta Zelle a efectivo";
    if (dM === "Zelle" && rM === "Binance") return "Cambio Zelle a Binance";
    if (dM === "Binance" && rM === "Zelle") return "Cambio Binance a Zelle";
    return `Cambio ${dM} a ${rM}`;
  }
  function cambioSelectDoy(m) {
    const rBs = USES_BS.has(cambioForm.reciboMetodo); const dBs = USES_BS.has(m);
    const newTasa = (dBs !== rBs) ? String(tasa) : (dBs === rBs && !dBs) ? "1" : String(tasa);
    const t = Number(newTasa) || 1;
    const rec = cambioCalcRecibo(cambioForm.doyMonto, t, m, cambioForm.reciboMetodo);
    const nota = cambioAutoNota(m, cambioForm.reciboMetodo);
    setCambioForm({ ...cambioForm, doyMetodo: m, tasaBs: newTasa, reciboMonto: rec, nota: nota || cambioForm.nota });
  }
  function cambioSelectRecibo(m) {
    const dBs = USES_BS.has(cambioForm.doyMetodo); const rBs = USES_BS.has(m);
    const newTasa = (dBs !== rBs) ? String(tasa) : (dBs === rBs && !dBs) ? "1" : String(tasa);
    const t = Number(newTasa) || 1;
    const rec = cambioCalcRecibo(cambioForm.doyMonto, t, cambioForm.doyMetodo, m);
    const nota = cambioAutoNota(cambioForm.doyMetodo, m);
    setCambioForm({ ...cambioForm, reciboMetodo: m, tasaBs: newTasa, reciboMonto: rec, nota: nota || cambioForm.nota });
  }
  function cambioSetTasa(val) {
    const t = Number(val) || 1;
    const rec = cambioCalcRecibo(cambioForm.doyMonto, t, cambioForm.doyMetodo, cambioForm.reciboMetodo);
    setCambioForm({ ...cambioForm, tasaBs: val, reciboMonto: rec });
  }
  const canSaveCambio = cambioForm.doyMetodo && cambioForm.reciboMetodo && cambioForm.doyMonto && cambioForm.reciboMonto && cambioForm.doyMetodo !== cambioForm.reciboMetodo;
  const [editingCambioId, setEditingCambioId] = useState(null);

  function editCambio(c) {
    const dBs = USES_BS.has(c.doy.metodo);
    const rBs = USES_BS.has(c.recibo.metodo);
    setCambioForm({
      doyMetodo: c.doy.metodo, doyMonto: String(dBs ? c.doy.bs : c.doy.monto),
      reciboMetodo: c.recibo.metodo, reciboMonto: String(rBs ? c.recibo.bs : c.recibo.monto),
      tasaBs: String(c.tasaBs), nota: c.nota,
    });
    setEditingCambioId(c.id);
    setShowCambio(true);
  }
  function saveCambioEdit() {
    const t = Number(cambioForm.tasaBs);
    const rawDoy = Number(cambioForm.doyMonto);
    const rawRecibo = Number(cambioForm.reciboMonto);
    const doyIsBs = USES_BS.has(cambioForm.doyMetodo);
    const reciboIsBs = USES_BS.has(cambioForm.reciboMetodo);
    const doyMontoDol = doyIsBs ? rawDoy / t : rawDoy;
    const doyBs = doyIsBs ? rawDoy : 0;
    const reciboMontoDol = reciboIsBs ? rawRecibo / t : rawRecibo;
    const reciboBs = reciboIsBs ? rawRecibo : 0;
    const newCambio = { id: editingCambioId || Date.now(), date: TODAY, createdAt: new Date().toISOString(), nota: cambioForm.nota || "Cambio de divisas", doy: { metodo: cambioForm.doyMetodo, monto: +doyMontoDol.toFixed(2), bs: doyBs }, recibo: { metodo: cambioForm.reciboMetodo, monto: +reciboMontoDol.toFixed(2), bs: reciboBs }, tasaBs: t };
    if (editingCambioId) {
      setCambios(cambios.map(c => c.id === editingCambioId ? newCambio : c));
    } else {
      setCambios([...cambios, newCambio]);
    }
    resetCambio(); setEditingCambioId(null); setShowCambio(false);
  }
  function deleteCambio(id) { setCambios(cambios.filter(c => c.id !== id)); }

  const notaDirty = notaItems.length > 0 || curItem.descripcion || curItem.costo;
  const expDirty = !!(expForm.descripcion || expForm.costo || Object.keys(expPagos).length);
  function tryCloseNota() { if (notaDirty) setConfirmingClose("sale"); else { resetNota(); setShowSale(false); } }
  function tryCloseExp() { if (expDirty) setConfirmingClose("exp"); else { resetExp(); setShowExp(false); } }
  function forceClose() {
    if (confirmingClose === "sale") { resetNota(); setShowSale(false); }
    if (confirmingClose === "exp") { resetExp(); setShowExp(false); }
    setConfirmingClose(null);
  }

  const canAddItem = curItem.tipo && curItem.descripcion && curItem.costo && curItem.precioVenta;
  const canSave = notaItems.length > 0 && selectedMethods.length > 0 && Math.abs(faltaAsignar) < 0.01;

  const VENDEDOR_CUADRE = ["Pago Móvil", "Punto de Venta", "Efectivo Bs", "Efectivo $", "Binance", "Zelle"];
  const cuadre = VENDEDOR_CUADRE.map(m => {
    const isBs = USES_BS.has(m);
    const venta = todaySales.reduce((a, s) => a + getPagos(s).filter(p => p.metodo === m).reduce((x, p) => x + p.monto, 0), 0);
    const gasto = todayExp.reduce((a, e) => a + getExpPagos(e).filter(p => p.metodo === m).reduce((x, p) => x + p.monto, 0), 0);
    // Cambios: recibo = income, doy = expense
    const cambioIn = todayCambios.filter(c => c.recibo.metodo === m).reduce((a, c) => a + c.recibo.monto, 0);
    const cambioOut = todayCambios.filter(c => c.doy.metodo === m).reduce((a, c) => a + c.doy.monto, 0);
    const ventaBs = isBs ? todaySales.reduce((a, s) => a + getPagos(s).filter(p => p.metodo === m).reduce((x, p) => x + p.monto * (s.tasaBs || 0), 0), 0) : 0;
    const gastoBs = isBs ? todayExp.reduce((a, e) => a + getExpPagos(e).filter(p => p.metodo === m).reduce((x, p) => x + p.monto * (e.tasaBs || 0), 0), 0) : 0;
    const cambioInBs = isBs ? todayCambios.filter(c => c.recibo.metodo === m).reduce((a, c) => a + (c.recibo.bs || 0), 0) : 0;
    const cambioOutBs = isBs ? todayCambios.filter(c => c.doy.metodo === m).reduce((a, c) => a + (c.doy.bs || 0), 0) : 0;
    const debe = venta - gasto + cambioIn - cambioOut;
    const debeBs = ventaBs - gastoBs + cambioInBs - cambioOutBs;
    const hay = cuadreHay[m] ?? "";
    return { m, venta, gasto, debe, ventaBs, gastoBs, debeBs, hay, diff: hay !== "" ? Number(hay) - (isBs ? debeBs : debe) : null };
  });

  const tabs = [{ id: "ventas", em: "💰", label: "Ventas" }, { id: "gastos", em: "📋", label: "Gastos" }, { id: "cambio", em: "💱", label: "Cambio" }, { id: "cuadre", em: "🏦", label: "Cuadre" }];

  return (
    <div>
      <div style={{ display: "flex", gap: 3, marginBottom: 22, background: "#0e0e22", borderRadius: 12, padding: 3 }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 6px", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: tab === t.id ? "#252545" : "transparent", color: tab === t.id ? "#c4b5fd" : "#4a4a6a" }}>{t.em} {t.label}</button>)}
      </div>

      {/* ─ VENTAS ─ */}
      {tab === "ventas" && <>
        {/* Balance del día */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "#6b6b8d", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Ventas Hoy</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#818cf8", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(todayTotal)}</span>
          </div>
          <div style={{ flex: 1, background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "#6b6b8d", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Notas</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#fbbf24", fontFamily: "'JetBrains Mono', monospace" }}>{todaySales.length}</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "#c0c0d8", fontWeight: 700 }}>Ventas — {todayLabel}</h3>
          <div style={{ display: "flex", gap: 6 }}>
            <Btn onClick={() => openNota("Accesorio")} small color="#2563eb">📱 Accesorio</Btn>
            <Btn onClick={() => openNota("Servicio Técnico")} small color="#d97706">🔧 Servicio</Btn>
          </div>
        </div>
        {todaySales.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#3a3a5a", fontSize: 13 }}>Sin ventas hoy.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todaySales.map(s => {
              const items = getItems(s); const sp = getPagos(s);
              const notaNum = s.nota || "—";
              const time = s.createdAt ? new Date(s.createdAt).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
              const isOpen = expandedNotes[s.id];
              return (
                <div key={s.id} style={{ background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 12, overflow: "hidden" }}>
                  {/* Compact row */}
                  <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 8, cursor: "pointer" }}
                    onClick={() => setExpandedNotes({ ...expandedNotes, [s.id]: !isOpen })}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#5a5a7a", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>#{String(notaNum).padStart(3, "0")}</span>
                    <span style={{ fontSize: 10, color: "#3a3a5a", flexShrink: 0 }}>{time}</span>
                    <div style={{ flex: 1, display: "flex", gap: 3, flexWrap: "wrap", overflow: "hidden" }}>
                      {sp.map((p, i) => <Badge key={i} method={p.metodo} small />)}
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#818cf8", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{fmt(s.pago)}</span>
                    <span style={{ fontSize: 10, color: "#4a4a6a", transition: "transform 0.2s", display: "inline-block", transform: isOpen ? "rotate(180deg)" : "rotate(0)", flexShrink: 0 }}>▼</span>
                  </div>
                  {/* Expanded details */}
                  {isOpen && (
                    <div style={{ padding: "0 14px 12px", borderTop: "1px solid #1e1e3a" }}>
                      {/* Items */}
                      {items.map((it, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < items.length - 1 ? "1px solid #1e1e3a" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <TypeBadge tipo={it.tipo} />
                            <span style={{ fontSize: 13, color: "#ddddf0", fontWeight: 600 }}>{it.descripcion}</span>
                            <span style={{ fontSize: 11, color: "#4a4a6a" }}>×{it.cantidad}</span>
                          </div>
                          <span style={{ fontSize: 13, color: "#818cf8", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(it.precioVenta * it.cantidad)}</span>
                        </div>
                      ))}
                      {/* Payment detail */}
                      {sp.length > 1 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 8, marginTop: 6, borderTop: "1px solid #1e1e3a" }}>
                          {sp.map((p, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Badge method={p.metodo} small /><span style={{ fontSize: 10, color: "#4a4a6a", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(p.monto)}</span></span>)}
                        </div>
                      )}
                      {s.totalBs > 0 && <div style={{ fontSize: 10, color: "#3a3a5a", fontFamily: "'JetBrains Mono', monospace", textAlign: "right", marginTop: 4 }}>{fmtBs(s.totalBs)}</div>}
                      {/* Actions */}
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
                        <button onClick={e => { e.stopPropagation(); editNota(s); }} style={{ background: "#1e1e3a", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: "#818cf8", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>✎ Editar</button>
                        <button onClick={e => { e.stopPropagation(); setConfirmDelete(s.id); }} style={{ background: "#1e1e3a", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", color: "#5a3a3a", fontSize: 12 }}>🗑</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </>}

      {/* ─ GASTOS ─ */}
      {tab === "gastos" && <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <Stat label="Gastos Hoy" value={fmt(todayExpTotal)} color="#f87171" icon={<span style={{ fontSize: 28 }}>📋</span>} hideable />
          <Stat label="Neto Hoy" value={fmt(todayGan - todayExpTotal)} color={todayGan - todayExpTotal >= 0 ? "#34d399" : "#f87171"} icon={<span style={{ fontSize: 28 }}>📊</span>} hideable />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "#c0c0d8", fontWeight: 700 }}>Gastos — {todayLabel}</h3>
          <Btn onClick={() => setShowExp(true)} small color="#ef4444">+ Nuevo Gasto</Btn>
        </div>
        {todayExp.length === 0 ? <div style={{ textAlign: "center", padding: 48, color: "#3a3a5a", fontSize: 13 }}>Sin gastos hoy.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...todayExp].sort((a, b) => (b.createdAt || b.id) > (a.createdAt || a.id) ? 1 : -1).map(e => {
              const time = e.createdAt ? new Date(e.createdAt).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
              const ep = getExpPagos(e);
              const allBs = ep.every(p => USES_BS.has(p.metodo));
              return (
                <div key={e.id} style={{ background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: "#ddddf0", fontSize: 13 }}>{e.descripcion}</span>
                      {time && <span style={{ fontSize: 10, color: "#3a3a5a" }}>{time}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                      {ep.map((p, i) => <Badge key={i} method={p.metodo} small />)}
                      <button onClick={() => editExp(e)} style={{ background: "#1e1e3a", border: "none", borderRadius: 5, padding: "2px 7px", cursor: "pointer", color: "#818cf8", fontSize: 9, fontWeight: 700, fontFamily: "inherit", marginLeft: 4 }}>✎</button>
                      <button onClick={() => deleteExp(e.id)} style={{ background: "#1e1e3a", border: "none", borderRadius: 5, padding: "2px 5px", cursor: "pointer", color: "#5a3a3a", fontSize: 10 }}>🗑</button>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {allBs && e.costoBs > 0 ? (
                      <>
                        <div style={{ fontWeight: 800, color: "#f87171", fontSize: 15, fontFamily: "'JetBrains Mono', monospace" }}>-{fmtBs(e.costoBs)}</div>
                        <div style={{ fontSize: 10, color: "#3a3a5a", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(e.costo)}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 800, color: "#f87171", fontSize: 15, fontFamily: "'JetBrains Mono', monospace" }}>-{fmt(e.costo)}</div>
                        {e.costoBs > 0 && <div style={{ fontSize: 10, color: "#3a3a5a", fontFamily: "'JetBrains Mono', monospace" }}>{fmtBs(e.costoBs)}</div>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>}

      {/* ─ CAMBIO ─ */}
      {tab === "cambio" && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "#c0c0d8", fontWeight: 700 }}>Cambios — {todayLabel}</h3>
          <Btn onClick={() => { resetCambio(); setShowCambio(true); }} small color="#8b5cf6">💱 Nuevo Cambio</Btn>
        </div>
        {todayCambios.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#3a3a5a", fontSize: 13 }}>Sin cambios hoy.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...todayCambios].sort((a, b) => (b.createdAt || b.id) > (a.createdAt || a.id) ? 1 : -1).map(c => {
              const hasBs = USES_BS.has(c.doy.metodo) || USES_BS.has(c.recibo.metodo);
              return (
              <div key={c.id} style={{ background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#c4b5fd" }}>💱</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#ddddf0", flex: 1 }}>{c.nota}</span>
                  <span style={{ fontSize: 10, color: "#3a3a5a" }}>{c.createdAt ? new Date(c.createdAt).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: true }) : ""}</span>
                  <button onClick={() => editCambio(c)} style={{ background: "#1e1e3a", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", color: "#818cf8", fontSize: 10, fontWeight: 700, fontFamily: "inherit" }}>✎</button>
                  <button onClick={() => deleteCambio(c.id)} style={{ background: "#1e1e3a", border: "none", borderRadius: 5, padding: "3px 6px", cursor: "pointer", color: "#5a3a3a", fontSize: 11 }}>🗑</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, padding: "6px 8px", borderRadius: 8, background: "#2a1015", border: "1px solid #3a1520", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#f87171", fontWeight: 600, marginBottom: 2 }}>ENTREGASTE</div>
                    <Badge method={c.doy.metodo} small />
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#f87171", fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>{USES_BS.has(c.doy.metodo) && c.doy.bs ? fmtBs(c.doy.bs) : fmt(c.doy.monto)}</div>
                  </div>
                  <span style={{ fontSize: 16, color: "#4a4a6a" }}>→</span>
                  <div style={{ flex: 1, padding: "6px 8px", borderRadius: 8, background: "#0f2e1e", border: "1px solid #1a4a38", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#34d399", fontWeight: 600, marginBottom: 2 }}>RECIBISTE</div>
                    <Badge method={c.recibo.metodo} small />
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#34d399", fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>{USES_BS.has(c.recibo.metodo) && c.recibo.bs ? fmtBs(c.recibo.bs) : fmt(c.recibo.monto)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 9, color: "#4a4a6a", textAlign: "center", marginTop: 4 }}>{hasBs ? `Tasa: Bs ${c.tasaBs}` : `Ratio: ${c.tasaBs}`}</div>
              </div>
            )})}
          </div>
        )}
      </>}

      {/* ─ CUADRE ─ */}
      {tab === "cuadre" && <>
        <h3 style={{ margin: "0 0 6px 0", fontSize: 15, color: "#c0c0d8", fontWeight: 700 }}>Cuadre de Caja — {todayLabel}</h3>
        <p style={{ margin: "0 0 16px 0", fontSize: 11, color: "#4a4a6a", lineHeight: 1.5 }}>
          {!cuadreVerified ? "Cuenta el dinero de cada método y escribe cuánto hay. Al terminar, presiona Verificar." : "Resultados del cuadre. Puedes volver a contar si lo necesitas."}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {cuadre.map(r => {
            const isBs = USES_BS.has(r.m);
            const hay = r.hay;
            const hayVal = Number(hay);
            const debeVal = isBs ? r.debeBs : r.debe;
            const diff = hay !== "" ? +(hayVal - debeVal).toFixed(2) : null;
            const c = PAY_COLORS[r.m];
            return (
              <div key={r.m} style={{ background: "#13132b", border: `1px solid ${cuadreVerified && diff !== null ? (diff === 0 ? "#22543d" : diff > 0 ? "#3d3518" : "#5a1a1a") : "#1e1e3a"}`, borderRadius: 10, overflow: "hidden", transition: "border-color 0.3s" }}>
                {/* Compact row: method + input */}
                <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 120, flexShrink: 0 }}>
                    <span style={{ fontSize: 15 }}>{PAY_ICONS[r.m]}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.fg }}>{r.m.replace("Efectivo ", "Efvo. ")}</span>
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11, color: "#4a4a6a", fontWeight: 600, flexShrink: 0 }}>{isBs ? "Bs" : "$"}</span>
                    <input type="number" value={hay} onChange={e => { setCuadreHay({ ...cuadreHay, [r.m]: e.target.value }); if (cuadreVerified) setCuadreVerified(false); }}
                      placeholder={isBs ? "0.00" : "0.00"}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #252545", background: "#0a0a1e", color: "#e2e2f0", fontSize: 15, fontWeight: 700, outline: "none", fontFamily: "'JetBrains Mono', monospace", boxSizing: "border-box", textAlign: "right" }} />
                  </div>
                </div>
                {/* Result bar - only after verify */}
                {cuadreVerified && diff !== null && (
                  <div style={{ padding: "6px 12px", background: diff === 0 ? "#0f2e1e" : diff > 0 ? "#2d2510" : "#2a1015", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: diff === 0 ? "#34d399" : diff > 0 ? "#fbbf24" : "#f87171" }}>
                      {diff === 0 ? "✓ Cuadra" : diff > 0 ? `↑ Sobra ${isBs ? fmtBs(diff) : fmt(diff)}` : `↓ Falta ${isBs ? fmtBs(Math.abs(diff)) : fmt(Math.abs(diff))}`}
                    </span>
                    <span style={{ fontSize: 9, color: "#4a4a6a" }}>esperado: {isBs ? fmtBs(debeVal) : fmt(debeVal)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Verify / Reset button */}
        <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center" }}>
          {!cuadreVerified ? (
            <button onClick={() => setCuadreVerified(true)}
              disabled={cuadre.every(r => (cuadreHay[r.m] ?? "") === "")}
              style={{ padding: "14px 36px", borderRadius: 12, border: "none", background: cuadre.every(r => (cuadreHay[r.m] ?? "") === "") ? "#1e1e3a" : "linear-gradient(135deg, #4338ca, #6366f1)", color: cuadre.every(r => (cuadreHay[r.m] ?? "") === "") ? "#3a3a5a" : "#fff", fontSize: 15, fontWeight: 800, cursor: cuadre.every(r => (cuadreHay[r.m] ?? "") === "") ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: cuadre.every(r => (cuadreHay[r.m] ?? "") === "") ? "none" : "0 4px 20px rgba(99,102,241,0.3)" }}>
              🔍 Verificar Cuadre
            </button>
          ) : (
            <button onClick={() => { setCuadreHay({}); setCuadreVerified(false); }}
              style={{ padding: "12px 28px", borderRadius: 12, border: "1px solid #252545", background: "transparent", color: "#6b6b8d", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              ↻ Volver a contar
            </button>
          )}
        </div>
      </>}

      {/* ══ MODAL TASA ══ */}
      <Modal open={showTasa} onClose={() => setShowTasa(false)} title="Actualizar Tasa del Día" width={380}>
        <div style={{ fontSize: 12, color: "#5a5a7a", marginBottom: 14, lineHeight: 1.6 }}>Se usará como predeterminado en cada nueva nota y gasto.</div>
        <Field label="Nueva tasa (1 USD = X Bs)" type="number" value={newTasa} onChange={v => setNewTasa(v)} highlight />
        <div style={{ marginTop: 18, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn ghost small onClick={() => setShowTasa(false)}>Cancelar</Btn>
          <Btn small color="#eab308" onClick={() => { setTasa(Number(newTasa)); setShowTasa(false); }}>✓ Actualizar</Btn>
        </div>
      </Modal>

      {/* ══ MODAL NOTA DE VENTA ══ */}
      <Modal open={showSale} onClose={tryCloseNota} title={editingId ? `✎ Editar Nota #${String((sales.find(s => s.id === editingId)?.nota) || "").padStart(3, "0")}` : `📋 Nota de Venta #${String(nextNota).padStart(3, "0")}`} width={560}>
        {/* ── Item input area ── */}
        <div style={{ padding: 14, borderRadius: 12, background: "#0e0e22", border: "1px solid #1e1e3a", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["Accesorio", "Servicio Técnico"].map(t => (
              <button key={t} onClick={() => setCurItem({ ...curItem, tipo: t })} style={{
                flex: 1, padding: "8px 10px", borderRadius: 8, border: curItem.tipo === t ? `2px solid ${t === "Accesorio" ? "#3b82f6" : "#d97706"}` : "1px solid #252545",
                background: curItem.tipo === t ? (t === "Accesorio" ? "#1e3a5f" : "#4a2c17") : "transparent",
                color: curItem.tipo === t ? (t === "Accesorio" ? "#93c5fd" : "#fcd34d") : "#5a5a7a",
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>{t === "Accesorio" ? "📱 Accesorio" : "🔧 Servicio"}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            <Field label="Descripción" value={curItem.descripcion} onChange={v => setCurItem({ ...curItem, descripcion: v })} placeholder="Ej: Forro Samsung A15" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <Field label="Cantidad" type="number" value={curItem.cantidad} onChange={v => setCurItem({ ...curItem, cantidad: v })} />
              <Field label="Costo ($)" type="number" value={curItem.costo} onChange={v => setCurItem({ ...curItem, costo: v })} placeholder="Tu costo" />
              <Field label="Precio ($)" type="number" value={curItem.precioVenta} onChange={v => setCurItem({ ...curItem, precioVenta: v })} placeholder="Al cliente" />
            </div>
          </div>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <Btn small color="#2563eb" onClick={addItem} disabled={!canAddItem}>+ Agregar a la nota</Btn>
          </div>
        </div>

        {/* ── Items list ── */}
        {notaItems.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#6b6b8d", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Productos ({notaItems.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {notaItems.map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "#13132b", border: "1px solid #1e1e3a" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                    <TypeBadge tipo={it.tipo} />
                    <span style={{ fontSize: 13, color: "#ddddf0", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.descripcion}</span>
                    <span style={{ fontSize: 11, color: "#4a4a6a", flexShrink: 0 }}>×{it.cantidad}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 14, color: "#818cf8", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(it.precioVenta * it.cantidad)}</span>
                    <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#5a3a3a", fontSize: 14, padding: 2 }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            {/* Total */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 8, padding: "0 12px" }}>
              <span style={{ fontSize: 12, color: "#6b6b8d", fontWeight: 600 }}>Total:</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#818cf8", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(notaTotal)}</span>
            </div>
          </div>
        )}

        {/* ── Payment (only if items exist) ── */}
        {notaItems.length > 0 && (
          <div style={{ padding: 14, borderRadius: 12, background: "#0e0e22", border: "1px solid #1e1e3a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "#5a5a7a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Método de Pago</span>
              <button onClick={() => setSplitMode(!splitMode)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, border: splitMode ? "1.5px solid #818cf8" : "1px solid #252545", background: splitMode ? "#252560" : "transparent", color: splitMode ? "#c4b5fd" : "#5a5a7a", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                ✂️ {splitMode ? "Dividir ON" : "Dividir"}
              </button>
            </div>

            {!splitMode ? (
              <>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PAY_METHODS.map(m => <PayBtn key={m} method={m} selected={notaPagos[m] !== undefined} onClick={() => selectSingleMethod(m)} />)}
                </div>
                {needsBs && (
                  <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "#1a1a0e", border: "1px solid #2d2510", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "#a38a2d", fontWeight: 700 }}>Tasa Bs</span>
                      <input type="number" value={notaTasa} onChange={e => setNotaTasa(e.target.value)} style={{ width: 75, padding: "5px 8px", borderRadius: 6, border: "1px solid #3d3518", background: "#1a1a0e", color: "#fbbf24", fontSize: 14, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
                    </div>
                    <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>= {fmtBs(notaTotal * Number(notaTasa))}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {needsBs && (
                  <div style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 8, background: "#1a1a0e", border: "1px solid #2d2510", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#a38a2d", fontWeight: 700 }}>Tasa:</span>
                    <input type="number" value={notaTasa} onChange={e => setNotaTasa(e.target.value)} style={{ width: 70, padding: "4px 6px", borderRadius: 6, border: "1px solid #3d3518", background: "#0e0e22", color: "#fbbf24", fontSize: 13, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
                    <span style={{ fontSize: 10, color: "#5a5020" }}>Bs/$</span>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {PAY_METHODS.map(m => {
                    const c = PAY_COLORS[m]; const isOn = notaPagos[m] !== undefined; const isBs = USES_BS.has(m);
                    return (
                      <div key={m} onClick={() => { if (!isOn) toggleMethod(m); }} style={{ padding: isOn ? "10px 14px" : "8px 14px", borderRadius: 10, border: isOn ? `1.5px solid ${c.dot}` : "1px solid #1e1e3a", background: isOn ? c.bg + "33" : "#0e0e22", cursor: isOn ? "default" : "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 16 }}>{PAY_ICONS[m]}</span>
                            <span style={{ fontSize: 13, color: isOn ? c.fg : "#5a5a7a", fontWeight: 700 }}>{m}</span>
                            {isBs && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#1a1a0e", color: "#a38a2d", fontWeight: 600 }}>Bs</span>}
                          </div>
                          {isOn ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 12, color: "#5a5a7a" }}>$</span>
                              <input type="number" value={notaPagos[m]} onChange={e => setNotaPagos({ ...notaPagos, [m]: e.target.value })} onClick={e => e.stopPropagation()} style={{ width: 80, padding: "6px 8px", borderRadius: 7, border: `1px solid ${c.dot}44`, background: c.bg + "55", color: "#e2e2f0", fontSize: 14, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
                              <button onClick={e => { e.stopPropagation(); toggleMethod(m); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#5a3a3a", padding: 2, fontSize: 14 }}>✕</button>
                            </div>
                          ) : <span style={{ fontSize: 11, color: "#3a3a5a" }}>+ Agregar</span>}
                        </div>
                        {isOn && isBs && Number(notaPagos[m]) > 0 && (
                          <div style={{ marginTop: 5, paddingLeft: 32, fontSize: 11, color: "#fbbf24", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>= {fmtBs(Number(notaPagos[m]) * Number(notaTasa))}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 4px", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "#4a4a6a" }}>Total: {fmt(notaTotal)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: Math.abs(faltaAsignar) < 0.01 ? "#34d399" : "#f87171" }}>
                    {Math.abs(faltaAsignar) < 0.01 ? "✓ Completo" : faltaAsignar > 0 ? `Faltan ${fmt(faltaAsignar)}` : `Excede ${fmt(Math.abs(faltaAsignar))}`}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Vuelto (with Efectivo $) ── */}
        {notaItems.length > 0 && notaPagos["Efectivo $"] !== undefined && (
          <div style={{ marginTop: 14 }}>
            <button onClick={() => setVueltoActive(!vueltoActive)} style={{
              width: "100%", padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
              border: vueltoActive ? "1.5px solid #8b5cf6" : "1px solid #252545",
              background: vueltoActive ? "#1e1040" : "#0e0e22",
              color: vueltoActive ? "#c4b5fd" : "#5a5a7a", fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>💱 {vueltoActive ? "Vuelto activado" : "¿Dar vuelto en Bs?"}</button>
            {vueltoActive && (() => {
              const pagaCon = Number(vueltoPagaCon) || 0;
              const vueltoTotal = Math.max(0, +(pagaCon - notaTotal).toFixed(2));
              const enDol = Number(vueltoEnDolares) || 0;
              const enBs = Math.max(0, +(vueltoTotal - enDol).toFixed(2));
              const vt = Number(vueltoTasa) || 1;
              return (
                <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: "#1e1040", border: "1px solid #3b2070" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <Field label="Paga con ($)" type="number" value={vueltoPagaCon} onChange={v => setVueltoPagaCon(v)} placeholder="Ej: 20" />
                    <div>
                      <div style={{ fontSize: 11, color: "#5a5a7a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Vuelto total</div>
                      <div style={{ padding: "10px 13px", borderRadius: 9, background: vueltoTotal > 0 ? "#1e1040" : "#0e0e22", border: vueltoTotal > 0 ? "1px solid #6d28d9" : "1px solid #252545", fontSize: 16, fontWeight: 800, color: vueltoTotal > 0 ? "#c4b5fd" : "#3a3a5a", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(vueltoTotal)}</div>
                    </div>
                  </div>
                  {vueltoTotal > 0 && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                        <Field label="Devuelves en $ efectivo" type="number" value={vueltoEnDolares} onChange={v => { const val = Math.min(Number(v) || 0, vueltoTotal); setVueltoEnDolares(String(val)); }} placeholder="0" />
                        <div>
                          <div style={{ fontSize: 11, color: "#a38a2d", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Restante en Bs</div>
                          <div style={{ padding: "10px 13px", borderRadius: 9, background: "#1a1a0e", border: "1px solid #3d3518", fontSize: 16, fontWeight: 800, color: "#fbbf24", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(enBs)}</div>
                        </div>
                      </div>
                      <div style={{ padding: "8px 10px", borderRadius: 8, background: "#1a1a0e", border: "1px solid #2d2510" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <span style={{ fontSize: 10, color: "#a38a2d", fontWeight: 700 }}>Dar Bs via:</span>
                          {["Pago Móvil", "Punto de Venta", "Efectivo Bs"].map(m => (
                            <button key={m} onClick={() => setVueltoMetodoBs(m)} style={{ padding: "3px 8px", borderRadius: 6, border: vueltoMetodoBs === m ? `1.5px solid ${PAY_COLORS[m].dot}` : "1px solid #252545", background: vueltoMetodoBs === m ? PAY_COLORS[m].bg + "55" : "transparent", color: vueltoMetodoBs === m ? PAY_COLORS[m].fg : "#5a5a7a", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{PAY_ICONS[m]} {m.replace("Efectivo ", "Efvo. ").replace("Punto de Venta", "PdV")}</button>
                          ))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 10, color: "#a38a2d" }}>Tasa:</span>
                            <input type="number" value={vueltoTasa} onChange={e => setVueltoTasa(e.target.value)} style={{ width: 65, padding: "4px 6px", borderRadius: 5, border: "1px solid #3d3518", background: "#0e0e22", color: "#fbbf24", fontSize: 13, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
                          </div>
                          <span style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24", fontFamily: "'JetBrains Mono', monospace" }}>= {fmtBs(enBs * vt)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn ghost small onClick={tryCloseNota}>Cancelar</Btn>
          <Btn small color="#10b981" onClick={saveNota} disabled={!canSave}>{editingId ? "✓ Actualizar Nota" : "✓ Guardar Nota"}</Btn>
        </div>
      </Modal>

      {/* ══ MODAL GASTO ══ */}
      <Modal open={showExp} onClose={tryCloseExp} title={editingExpId ? "✎ Editar Gasto" : "Registrar Gasto"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Descripción" value={expForm.descripcion} onChange={v => setExpForm({ ...expForm, descripcion: v })} placeholder="Ej: Almuerzo" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Costo ($)" type="number" value={expForm.costo} onChange={v => {
              const bs = Number(expForm.costoBsInput);
              const usd = Number(v);
              const newTasa = (usd > 0 && bs > 0) ? String(+(bs / usd).toFixed(2)) : expForm.tasaBs;
              setExpForm({ ...expForm, costo: v, tasaBs: newTasa });
              const selM = Object.keys(expPagos);
              if (selM.length === 1) setExpPagos({ [selM[0]]: usd || 0 });
            }} placeholder="Monto en $" />
            <Field label="Monto (Bs)" type="number" value={expForm.costoBsInput || ""} onChange={v => {
              const usd = Number(expForm.costo);
              const bs = Number(v);
              const newTasa = (usd > 0 && bs > 0) ? String(+(bs / usd).toFixed(2)) : expForm.tasaBs;
              setExpForm({ ...expForm, costoBsInput: v, tasaBs: newTasa });
            }} placeholder="Monto en Bs" />
          </div>
          {(expForm.costo || expForm.costoBsInput) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "6px 12px", borderRadius: 8, background: "#1a1a0e", border: "1px solid #2d2510" }}>
              <span style={{ fontSize: 11, color: "#a38a2d", fontWeight: 700 }}>Tasa:</span>
              <input type="number" value={expForm.tasaBs} onChange={e => {
                const newT = Number(e.target.value) || 1;
                const usd = Number(expForm.costo);
                setExpForm({ ...expForm, tasaBs: e.target.value, costoBsInput: usd ? String(+(usd * newT).toFixed(2)) : expForm.costoBsInput });
              }} style={{ width: 75, padding: "4px 6px", borderRadius: 6, border: "1px solid #3d3518", background: "#0e0e22", color: "#fbbf24", fontSize: 16, fontWeight: 800, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }} />
              <span style={{ fontSize: 10, color: "#5a5020" }}>Bs/$</span>
            </div>
          )}
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: "#5a5a7a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>¿De dónde sale el dinero?</label>
            <button onClick={() => { setExpSplit(!expSplit); if (expSplit) { const k = Object.keys(expPagos); if (k.length > 0) setExpPagos({ [k[0]]: Number(expForm.costo) || 0 }); } }}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, border: expSplit ? "1.5px solid #818cf8" : "1px solid #252545", background: expSplit ? "#252560" : "transparent", color: expSplit ? "#c4b5fd" : "#5a5a7a", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              ✂️ {expSplit ? "Dividir ON" : "Dividir"}
            </button>
          </div>
          {!expSplit ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {EXPENSE_METHODS.map(m => <PayBtn key={m} method={m} selected={expPagos[m] !== undefined} onClick={() => setExpPagos({ [m]: Number(expForm.costo) || 0 })} />)}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {EXPENSE_METHODS.map(m => {
                const c = PAY_COLORS[m]; const isOn = expPagos[m] !== undefined;
                return (
                  <div key={m} onClick={() => { if (!isOn) { const p = { ...expPagos }; const used = Object.values(p).reduce((a, v) => a + Number(v || 0), 0); p[m] = Math.max(0, +((Number(expForm.costo) || 0) - used).toFixed(2)); setExpPagos(p); } }}
                    style={{ padding: isOn ? "8px 12px" : "7px 12px", borderRadius: 9, border: isOn ? `1.5px solid ${c.dot}` : "1px solid #1e1e3a", background: isOn ? c.bg + "33" : "#0e0e22", cursor: isOn ? "default" : "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{PAY_ICONS[m]}</span>
                        <span style={{ fontSize: 12, color: isOn ? c.fg : "#5a5a7a", fontWeight: 700 }}>{m}</span>
                      </div>
                      {isOn ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: "#5a5a7a" }}>$</span>
                          <input type="number" value={expPagos[m]} onChange={e => setExpPagos({ ...expPagos, [m]: e.target.value })} onClick={e => e.stopPropagation()}
                            style={{ width: 80, padding: "5px 8px", borderRadius: 7, border: `1px solid ${c.dot}44`, background: c.bg + "55", color: "#e2e2f0", fontSize: 14, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
                          <button onClick={e => { e.stopPropagation(); const p = { ...expPagos }; delete p[m]; setExpPagos(p); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#5a3a3a", padding: 2, fontSize: 13 }}>✕</button>
                        </div>
                      ) : <span style={{ fontSize: 10, color: "#3a3a5a" }}>+ Agregar</span>}
                    </div>
                  </div>
                );
              })}
              {(() => { const total = Number(expForm.costo) || 0; const assigned = Object.values(expPagos).reduce((a, v) => a + Number(v || 0), 0); const rem = +(total - assigned).toFixed(2); return (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 4px", fontSize: 11 }}>
                  <span style={{ color: "#4a4a6a" }}>Total: {fmt(total)}</span>
                  <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: Math.abs(rem) < 0.01 ? "#34d399" : "#f87171" }}>{Math.abs(rem) < 0.01 ? "✓ Completo" : rem > 0 ? `Faltan ${fmt(rem)}` : `Excede ${fmt(Math.abs(rem))}`}</span>
                </div>
              );})()}
            </div>
          )}
        </div>
        {expForm.costo && Object.keys(expPagos).some(m => USES_BS.has(m)) && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#1e0e0e", border: "1px solid #3a1515", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#7a3a3a" }}>Porción en Bs</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#f87171", fontFamily: "'JetBrains Mono', monospace" }}>{fmtBs(Object.keys(expPagos).filter(m => USES_BS.has(m)).reduce((a, m) => a + Number(expPagos[m] || 0), 0) * Number(expForm.tasaBs))}</span>
          </div>
        )}
        <div style={{ marginTop: 18, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn ghost small onClick={tryCloseExp}>Cancelar</Btn>
          <Btn small color="#ef4444" onClick={saveExp} disabled={!expForm.descripcion || !expForm.costo || Object.keys(expPagos).length === 0 || (expSplit && Math.abs((Number(expForm.costo) || 0) - Object.values(expPagos).reduce((a, v) => a + Number(v || 0), 0)) > 0.01)}>✓ Guardar</Btn>
        </div>
      </Modal>

      {/* ══ MODAL CAMBIO ══ */}
      <Modal open={showCambio} onClose={() => { setShowCambio(false); setEditingCambioId(null); resetCambio(); }} title={editingCambioId ? "✎ Editar Cambio" : "💱 Cambio de Divisas"} width={480}>
        <div style={{ fontSize: 11, color: "#5a5a7a", marginBottom: 14, lineHeight: 1.5 }}>Registra un intercambio de moneda. No afecta ganancia, solo mueve dinero entre métodos.</div>

        {/* DOY */}
        <div style={{ padding: 12, borderRadius: 10, background: "#1e0e0e", border: "1px solid #3a1520", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#f87171", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>¿Qué entregas?</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {PAY_METHODS.map(m => <PayBtn key={m} method={m} selected={cambioForm.doyMetodo === m} onClick={() => cambioSelectDoy(m)} />)}
          </div>
          {cambioForm.doyMetodo && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#5a5a7a", fontWeight: 600 }}>{USES_BS.has(cambioForm.doyMetodo) ? "Bs" : "$"}</span>
              <input type="number" value={cambioForm.doyMonto} onChange={e => cambioSetDoy(e.target.value)} placeholder="Monto"
                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #3a1520", background: "#0e0e22", color: "#e2e2f0", fontSize: 16, fontWeight: 700, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
            </div>
          )}
        </div>

        {/* Tasa */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: "#1a1a0e", border: "1px solid #2d2510" }}>
          <span style={{ fontSize: 11, color: "#a38a2d", fontWeight: 700 }}>{cambioTasaType() === "bs" ? "Tasa:" : "Rate:"}</span>
          <input type="number" value={cambioForm.tasaBs} onChange={e => cambioSetTasa(e.target.value)}
            style={{ width: 80, padding: "5px 8px", borderRadius: 6, border: "1px solid #3d3518", background: "#0e0e22", color: "#fbbf24", fontSize: 15, fontWeight: 800, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }} />
          <span style={{ fontSize: 10, color: "#5a5020" }}>{cambioTasaType() === "bs" ? "Bs/$" : "×"}</span>
        </div>

        {/* RECIBO */}
        <div style={{ padding: 12, borderRadius: 10, background: "#0a1e14", border: "1px solid #1a4a38", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#34d399", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>¿Qué recibes?</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {PAY_METHODS.filter(m => m !== cambioForm.doyMetodo).map(m => <PayBtn key={m} method={m} selected={cambioForm.reciboMetodo === m} onClick={() => cambioSelectRecibo(m)} />)}
          </div>
          {cambioForm.reciboMetodo && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#5a5a7a", fontWeight: 600 }}>{USES_BS.has(cambioForm.reciboMetodo) ? "Bs" : "$"}</span>
              <input type="number" value={cambioForm.reciboMonto} onChange={e => cambioSetRecibo(e.target.value)} placeholder="Monto"
                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #1a4a38", background: "#0e0e22", color: "#e2e2f0", fontSize: 16, fontWeight: 700, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
            </div>
          )}
        </div>

        {/* Nota */}
        <Field label="Nota (opcional)" value={cambioForm.nota} onChange={v => setCambioForm({ ...cambioForm, nota: v })} placeholder="Ej: Cliente vendió dólares" />

        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn ghost small onClick={() => setShowCambio(false)}>Cancelar</Btn>
          <Btn small color="#8b5cf6" onClick={saveCambio} disabled={!canSaveCambio}>{editingCambioId ? "✓ Actualizar" : "💱 Registrar Cambio"}</Btn>
        </div>
      </Modal>

      {/* Confirm close */}
      {confirmingClose && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#1a1a35", border: "1px solid #2a2a50", borderRadius: 16, padding: "28px 32px", maxWidth: 340, textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>⚠️</div>
            <div style={{ fontSize: 15, color: "#e2e2f0", fontWeight: 700, marginBottom: 6 }}>Hay datos sin guardar</div>
            <div style={{ fontSize: 13, color: "#6b6b8d", marginBottom: 22, lineHeight: 1.5 }}>Se perderá lo que escribiste.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmingClose(null)} style={{ padding: "10px 20px", borderRadius: 9, border: "1px solid #252545", background: "transparent", color: "#c0c0d8", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Seguir editando</button>
              <button onClick={forceClose} style={{ padding: "10px 20px", borderRadius: 9, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Sí, cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (() => {
        const nota = sales.find(s => s.id === confirmDelete);
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
            <div style={{ background: "#1a1a35", border: "1px solid #3a1520", borderRadius: 16, padding: "28px 32px", maxWidth: 360, textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>🗑</div>
              <div style={{ fontSize: 15, color: "#e2e2f0", fontWeight: 700, marginBottom: 6 }}>Eliminar Nota #{String(nota?.nota || "").padStart(3, "0")}</div>
              <div style={{ fontSize: 13, color: "#6b6b8d", marginBottom: 8, lineHeight: 1.5 }}>
                {nota && getItems(nota).map(it => it.descripcion).join(", ")}
              </div>
              <div style={{ fontSize: 14, color: "#f87171", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", marginBottom: 20 }}>{nota && fmt(nota.pago)}</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => setConfirmDelete(null)} style={{ padding: "10px 20px", borderRadius: 9, border: "1px solid #252545", background: "transparent", color: "#c0c0d8", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                <button onClick={() => deleteNota(confirmDelete)} style={{ padding: "10px 20px", borderRadius: 9, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Sí, eliminar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ━━━ ADMIN ━━━ */
function Admin({ sales, expenses, setExpenses, cambios, setCambios, tasa, balanceInicial, saveBalanceInicial }) {
  const [tab, setTab] = useState("resumen");
  const [tasaRef, setTasaRef] = useState(String(tasa));
  const [showBancoDetail, setShowBancoDetail] = useState(false);
  // Admin cambio form
  const [showAdminCambio, setShowAdminCambio] = useState(false);
  const [adminCambioEdit, setAdminCambioEdit] = useState(null);
  const [acForm, setAcForm] = useState({ doyMetodo: "", doyMonto: "", reciboMetodo: "", reciboMonto: "", tasaBs: String(tasa), nota: "" });
  function acReset() { setAcForm({ doyMetodo: "", doyMonto: "", reciboMetodo: "", reciboMonto: "", tasaBs: String(tasa), nota: "" }); setAdminCambioEdit(null); }
  function acSelectDoy(m) {
    const rBs = USES_BS.has(acForm.reciboMetodo); const dBs = USES_BS.has(m);
    const newT = (dBs !== rBs) ? String(tasa) : (!dBs && !rBs) ? "1" : String(tasa);
    setAcForm({ ...acForm, doyMetodo: m, tasaBs: newT });
  }
  function acSelectRec(m) {
    const dBs = USES_BS.has(acForm.doyMetodo); const rBs = USES_BS.has(m);
    const newT = (dBs !== rBs) ? String(tasa) : (!dBs && !rBs) ? "1" : String(tasa);
    setAcForm({ ...acForm, reciboMetodo: m, tasaBs: newT });
  }
  function acSetDoy(v) {
    const t = Number(acForm.tasaBs) || 1; const dBs = USES_BS.has(acForm.doyMetodo); const rBs = USES_BS.has(acForm.reciboMetodo);
    let rec = "";
    if (acForm.reciboMetodo && v) { const usd = dBs ? Number(v)/t : Number(v); rec = rBs ? String(+(usd*t).toFixed(2)) : String(+usd.toFixed(2)); }
    setAcForm({ ...acForm, doyMonto: v, reciboMonto: rec });
  }
  function acSetRec(v) {
    const doy = Number(acForm.doyMonto); const rec = Number(v);
    let newT = acForm.tasaBs;
    if (doy > 0 && rec > 0) {
      const dBs = USES_BS.has(acForm.doyMetodo); const rBs = USES_BS.has(acForm.reciboMetodo);
      if (dBs && !rBs) newT = String(+(doy/rec).toFixed(2));
      else if (!dBs && rBs) newT = String(+(rec/doy).toFixed(2));
      else newT = String(+(rec/doy).toFixed(4));
    }
    setAcForm({ ...acForm, reciboMonto: v, tasaBs: newT });
  }
  function acSave() {
    const t = Number(acForm.tasaBs); const rawD = Number(acForm.doyMonto); const rawR = Number(acForm.reciboMonto);
    const dBs = USES_BS.has(acForm.doyMetodo); const rBs = USES_BS.has(acForm.reciboMetodo);
    const c = { id: adminCambioEdit || Date.now(), date: getToday(), createdAt: new Date().toISOString(), nota: acForm.nota || "Cambio de divisas",
      doy: { metodo: acForm.doyMetodo, monto: +(dBs ? rawD/t : rawD).toFixed(2), bs: dBs ? rawD : 0 },
      recibo: { metodo: acForm.reciboMetodo, monto: +(rBs ? rawR/t : rawR).toFixed(2), bs: rBs ? rawR : 0 }, tasaBs: t };
    if (adminCambioEdit) setCambios(cambios.map(x => x.id === adminCambioEdit ? { ...c, date: cambios.find(y => y.id === adminCambioEdit)?.date || c.date } : x));
    else setCambios([...cambios, c]);
    acReset(); setShowAdminCambio(false);
  }
  function acEdit(c) {
    const dBs = USES_BS.has(c.doy.metodo); const rBs = USES_BS.has(c.recibo.metodo);
    setAcForm({ doyMetodo: c.doy.metodo, doyMonto: String(dBs ? c.doy.bs : c.doy.monto), reciboMetodo: c.recibo.metodo, reciboMonto: String(rBs ? c.recibo.bs : c.recibo.monto), tasaBs: String(c.tasaBs), nota: c.nota });
    setAdminCambioEdit(c.id); setShowAdminCambio(true);
  }
  useEffect(() => { setTasaRef(String(tasa)); }, [tasa]);
  const byDate = {};
  sales.forEach(s => { if (!byDate[s.date]) byDate[s.date] = []; byDate[s.date].push(s); });
  const dates = Object.keys(byDate).sort();
  const totV = sales.reduce((a, s) => a + s.pago, 0);
  const totC = sales.reduce((a, s) => a + saleCosto(s), 0);
  const totG = totV - totC;
  const totE = expenses.reduce((a, e) => a + e.costo, 0);
  const totEBs = expenses.reduce((a, e) => a + (e.costoBs || 0), 0);
  const totEUsd = expenses.reduce((a, e) => a + getExpPagos(e).filter(p => !USES_BS.has(p.metodo)).reduce((x, p) => x + p.monto, 0), 0);
  const neto = totG - totE;
  const allItems = sales.flatMap(s => getItems(s));
  const vAcc = allItems.filter(i => i.tipo === "Accesorio").reduce((a, i) => a + i.precioVenta * i.cantidad, 0);
  const vServ = allItems.filter(i => i.tipo === "Servicio Técnico").reduce((a, i) => a + i.precioVenta * i.cantidad, 0);

  const byMethod = {};
  const bi = balanceInicial;
  const biTasa = Number(bi.biTasa) || tasa || 1;
  PAY_METHODS.forEach(m => {
    const isBs = USES_BS.has(m);
    const ini = Number(bi[m]) || 0;
    const iniDol = isBs ? ini / biTasa : ini;
    const iniBs = isBs ? ini : 0;
    const ing = sales.reduce((a, s) => a + getPagos(s).filter(p => p.metodo === m).reduce((x, p) => x + p.monto, 0), 0);
    const egr = expenses.reduce((a, e) => a + getExpPagos(e).filter(p => p.metodo === m).reduce((x, p) => x + p.monto, 0), 0);
    const cIn = cambios.filter(c => c.recibo.metodo === m).reduce((a, c) => a + c.recibo.monto, 0);
    const cOut = cambios.filter(c => c.doy.metodo === m).reduce((a, c) => a + c.doy.monto, 0);
    const ingBs = isBs ? sales.reduce((a, s) => a + getPagos(s).filter(p => p.metodo === m).reduce((x, p) => x + p.monto * (s.tasaBs || 0), 0), 0) : 0;
    const egrBs = isBs ? expenses.reduce((a, e) => a + getExpPagos(e).filter(p => p.metodo === m).reduce((x, p) => x + p.monto * (e.tasaBs || 0), 0), 0) : 0;
    const cInBs = isBs ? cambios.filter(c => c.recibo.metodo === m).reduce((a, c) => a + (c.recibo.bs || 0), 0) : 0;
    const cOutBs = isBs ? cambios.filter(c => c.doy.metodo === m).reduce((a, c) => a + (c.doy.bs || 0), 0) : 0;
    byMethod[m] = { ini: iniDol, iniBs, ing: ing + cIn, egr: egr + cOut, disp: iniDol + ing - egr + cIn - cOut, ingBs: ingBs + cInBs, egrBs: egrBs + cOutBs, dispBs: iniBs + ingBs - egrBs + cInBs - cOutBs };
  });
  const biCuentaBancaria = Number(bi["Cuenta Bancaria"]) || 0;
  const bancoIni = biCuentaBancaria / biTasa;
  const bancoIniBs = biCuentaBancaria;
  const bancoIng = (byMethod["Pago Móvil"]?.ing || 0) + (byMethod["Punto de Venta"]?.ing || 0);
  const bancoIngBs = (byMethod["Pago Móvil"]?.ingBs || 0) + (byMethod["Punto de Venta"]?.ingBs || 0);
  const bancoEgrBase = expenses.reduce((a, e) => a + getExpPagos(e).filter(p => p.metodo === "Cuenta Bancaria").reduce((x, p) => x + p.monto, 0), 0);
  const bancoEgrBsBase = expenses.reduce((a, e) => a + getExpPagos(e).filter(p => p.metodo === "Cuenta Bancaria").reduce((x, p) => x + p.monto * (e.tasaBs || 0), 0), 0);
  // Egr includes: Cuenta Bancaria expenses + P.Móvil outflows + PdV outflows (cambios, etc.)
  const bancoEgr = bancoEgrBase + (byMethod["Pago Móvil"]?.egr || 0) + (byMethod["Punto de Venta"]?.egr || 0);
  const bancoEgrBs = bancoEgrBsBase + (byMethod["Pago Móvil"]?.egrBs || 0) + (byMethod["Punto de Venta"]?.egrBs || 0);
  byMethod["Cuenta Bancaria"] = { ini: bancoIni, iniBs: bancoIniBs, ing: bancoIng, egr: bancoEgr, disp: bancoIni + bancoIng - bancoEgr, ingBs: bancoIngBs, egrBs: bancoEgrBs, dispBs: bancoIniBs + bancoIngBs - bancoEgrBs };

  const chartData = dates.map(d => ({ l: d.split("-")[2], v: byDate[d].reduce((a, s) => a + s.pago, 0) }));
  const chartMax = Math.max(...chartData.map(d => d.v), 1);
  const tabs = [{ id: "resumen", em: "📊", label: "Resumen" }, { id: "dinero", em: "🏦", label: "Dinero" }, { id: "detalle", em: "📅", label: "Detalle" }, { id: "gastos", em: "📋", label: "Gastos" }, { id: "cambios", em: "💱", label: "Cambios" }, { id: "reportes", em: "📄", label: "Reportes" }, { id: "balance", em: "⚖️", label: "Inicio" }];

  return (
    <div>
      <div style={{ display: "flex", gap: 3, marginBottom: 22, background: "#0e0e22", borderRadius: 12, padding: 3, flexWrap: "wrap" }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, minWidth: 80, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 6px", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: tab === t.id ? "#0f2e1e" : "transparent", color: tab === t.id ? "#6ee7b7" : "#4a4a6a" }}>{t.em} {t.label}</button>)}
      </div>

      {tab === "resumen" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10, marginBottom: 20 }}>
          <Stat label="Total Ventas" value={fmt(totV)} color="#818cf8" icon={<span style={{ fontSize: 28 }}>💰</span>} hideable />
          <Stat label="Capital" value={fmt(totC)} color="#f59e0b" icon={<span style={{ fontSize: 28 }}>📦</span>} sub="Costo de productos" hideable />
          <Stat label="Ganancia Bruta" value={fmt(totG)} color="#34d399" icon={<span style={{ fontSize: 28 }}>📈</span>} sub="Ventas − Capital" hideable />
          <Stat label="Ganancia Neta" value={fmt(neto)} color={neto >= 0 ? "#34d399" : "#f87171"} icon={<span style={{ fontSize: 28 }}>🏦</span>} sub="Ganancia − Gastos" hideable />
        </div>

        {/* Gastos desglosado */}
        <div style={{ background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 14, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: "#6b6b8d", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2 }}>Gastos Totales</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#f87171", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(totE)}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: "#0e0e22", border: "1px solid #1e1e3a" }}>
              <div style={{ fontSize: 10, color: "#4a4a6a", fontWeight: 600, marginBottom: 4 }}>EN BOLÍVARES</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24", fontFamily: "'JetBrains Mono', monospace" }}>{fmtBs(totEBs)}</div>
              <div style={{ fontSize: 10, color: "#a38a2d", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>Bs reales gastados</div>
            </div>
            <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: "#0e0e22", border: "1px solid #1e1e3a" }}>
              <div style={{ fontSize: 10, color: "#4a4a6a", fontWeight: 600, marginBottom: 4 }}>EN DÓLARES</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#34d399", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(totEUsd)}</div>
              <div style={{ fontSize: 10, color: "#3a5a3a", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>Efectivo $, Binance, Zelle</div>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <div style={{ background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 10, color: "#4a4a6a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Accesorios</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#93c5fd", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(vAcc)}</div>
          </div>
          <div style={{ background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 10, color: "#4a4a6a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Servicio Técnico</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fcd34d", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(vServ)}</div>
          </div>
        </div>
        <div style={{ background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#4a4a6a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Ventas por Día</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
            {chartData.map((d, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                <div style={{ fontSize: 9, color: "#818cf8", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{fmt(d.v)}</div>
                <div style={{ width: "100%", maxWidth: 40, height: Math.max(6, (d.v / chartMax) * 60), background: "linear-gradient(180deg, #6366f1, #4338ca)", borderRadius: 5 }} />
                <span style={{ fontSize: 10, color: "#4a4a6a", fontFamily: "'JetBrains Mono', monospace" }}>{d.l}</span>
              </div>
            ))}
          </div>
        </div>
      </>}

      {tab === "dinero" && (() => {
        const banco = byMethod["Cuenta Bancaria"];
        const otherMethods = PAY_METHODS.filter(m => !BANCO_METHODS.has(m));
        const tr = Number(tasaRef) || 1;
        return <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: "#c0c0d8", fontWeight: 700 }}>Balance por Método de Pago</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, background: "#1a1a0e", border: "1px solid #2d2510" }}>
              <span style={{ fontSize: 11, color: "#a38a2d", fontWeight: 700 }}>Tasa ref:</span>
              <input type="number" value={tasaRef} onChange={e => setTasaRef(e.target.value)}
                style={{ width: 70, padding: "4px 6px", borderRadius: 6, border: "1px solid #3d3518", background: "#0e0e22", color: "#fbbf24", fontSize: 13, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
              <span style={{ fontSize: 10, color: "#5a5020" }}>Bs/$</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

            {/* Cuenta Bancaria — actual Bs */}
            <div style={{ background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px 4px 9px", borderRadius: 7, fontSize: 12, fontWeight: 700, background: "#0c4a6e55", color: "#7dd3fc" }}>🏦 Cuenta Bancaria</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: banco.dispBs >= 0 ? "#34d399" : "#f87171" }}>{fmtBs(banco.dispBs)}</div>
                  <div style={{ fontSize: 11, color: "#a38a2d", fontFamily: "'JetBrains Mono', monospace" }}>en dólares son {fmt(banco.dispBs / tr)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 12, marginBottom: 12 }}>
                <div>
                  <span style={{ color: "#4a4a6a" }}>Ing. </span><span style={{ color: "#6ee7b7", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtBs(banco.ingBs)}</span>
                  <div style={{ fontSize: 10, color: "#3a3a5a", fontFamily: "'JetBrains Mono', monospace" }}>en dólares son {fmt(banco.ingBs / tr)}</div>
                </div>
                <div>
                  <span style={{ color: "#4a4a6a" }}>Egr. </span><span style={{ color: "#fca5a5", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtBs(banco.egrBs)}</span>
                  <div style={{ fontSize: 10, color: "#3a3a5a", fontFamily: "'JetBrains Mono', monospace" }}>en dólares son {fmt(banco.egrBs / tr)}</div>
                </div>
              </div>
              <button onClick={() => setShowBancoDetail(!showBancoDetail)} style={{
                width: "100%", padding: "8px 0", border: "none", background: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                color: "#4a4a6a", fontSize: 11, fontWeight: 600, fontFamily: "inherit",
              }}>
                <span style={{ transition: "transform 0.2s", display: "inline-block", transform: showBancoDetail ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
                {showBancoDetail ? "Ocultar desglose" : "Ver desglose P.Móvil / PdV"}
              </button>
              {showBancoDetail && (
                <div style={{ display: "flex", gap: 8, paddingBottom: 4 }}>
                  {["Pago Móvil", "Punto de Venta"].map(m => {
                    const d = byMethod[m] || { ingBs: 0 }; const c = PAY_COLORS[m];
                    return (
                      <div key={m} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: "#0e0e22", border: "1px solid #1e1e3a" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                          <span style={{ fontSize: 13 }}>{PAY_ICONS[m]}</span>
                          <span style={{ fontSize: 11, color: c.fg, fontWeight: 700 }}>{m}</span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: c.fg, fontFamily: "'JetBrains Mono', monospace" }}>{fmtBs(d.ingBs)}</div>
                        <div style={{ fontSize: 10, color: "#3a3a5a", fontFamily: "'JetBrains Mono', monospace" }}>en dólares son {fmt(d.ingBs / tr)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Efectivo Bs — actual Bs */}
            {(() => {
              const efBs = byMethod["Efectivo Bs"];
              return (
                <div style={{ background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 14, padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <Badge method="Efectivo Bs" />
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: efBs.dispBs >= 0 ? "#34d399" : "#f87171" }}>{fmtBs(efBs.dispBs)}</div>
                      <div style={{ fontSize: 11, color: "#a38a2d", fontFamily: "'JetBrains Mono', monospace" }}>en dólares son {fmt(efBs.dispBs / tr)}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                    <div>
                      <span style={{ color: "#4a4a6a" }}>Ing. </span><span style={{ color: "#6ee7b7", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtBs(efBs.ingBs)}</span>
                      <div style={{ fontSize: 10, color: "#3a3a5a", fontFamily: "'JetBrains Mono', monospace" }}>en dólares son {fmt(efBs.ingBs / tr)}</div>
                    </div>
                    <div>
                      <span style={{ color: "#4a4a6a" }}>Egr. </span><span style={{ color: "#fca5a5", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtBs(efBs.egrBs)}</span>
                      <div style={{ fontSize: 10, color: "#3a3a5a", fontFamily: "'JetBrains Mono', monospace" }}>en dólares son {fmt(efBs.egrBs / tr)}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Dollar methods — in $ */}
            {otherMethods.filter(m => m !== "Efectivo Bs").map(m => (
              <div key={m} style={{ background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 14, padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <Badge method={m} />
                  <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: byMethod[m].disp >= 0 ? "#34d399" : "#f87171" }}>{fmt(byMethod[m].disp)}</span>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                  <div><span style={{ color: "#4a4a6a" }}>Ing. </span><span style={{ color: "#6ee7b7", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(byMethod[m].ing)}</span></div>
                  <div><span style={{ color: "#4a4a6a" }}>Egr. </span><span style={{ color: "#fca5a5", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(byMethod[m].egr)}</span></div>
                </div>
              </div>
            ))}
          </div>
        </>;
      })()}

      {tab === "detalle" && <>
        <h3 style={{ margin: "0 0 14px 0", fontSize: 15, color: "#c0c0d8", fontWeight: 700 }}>Resumen Diario</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Día", "Ventas", "Acces.", "Servicio", "Capital", "Ganancia", "#"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, color: "#4a4a6a", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, borderBottom: "1px solid #1e1e3a" }}>{h}</th>)}</tr></thead>
            <tbody>
              {dates.map(d => {
                const ds = byDate[d]; const dT = ds.reduce((a, s) => a + s.pago, 0);
                const di = ds.flatMap(s => getItems(s));
                const dA = di.filter(i => i.tipo === "Accesorio").reduce((a, i) => a + i.precioVenta * i.cantidad, 0);
                const dS = di.filter(i => i.tipo === "Servicio Técnico").reduce((a, i) => a + i.precioVenta * i.cantidad, 0);
                const dC = ds.reduce((a, s) => a + saleCosto(s), 0);
                const dG = ds.reduce((a, s) => a + (s.pago - saleCosto(s)), 0);
                return <tr key={d} style={{ borderBottom: "1px solid #151530" }}>
                  <td style={{ padding: "8px 10px", color: "#c0c0d8", fontWeight: 700 }}>{d.split("-")[2]} Mayo</td>
                  <td style={{ padding: "8px 10px", color: "#818cf8", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(dT)}</td>
                  <td style={{ padding: "8px 10px", color: "#93c5fd", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(dA)}</td>
                  <td style={{ padding: "8px 10px", color: "#fcd34d", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(dS)}</td>
                  <td style={{ padding: "8px 10px", color: "#f59e0b", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(dC)}</td>
                  <td style={{ padding: "8px 10px", color: "#34d399", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(dG)}</td>
                  <td style={{ padding: "8px 10px", color: "#4a4a6a" }}>{ds.length}</td>
                </tr>;
              })}
            </tbody>
            <tfoot><tr style={{ borderTop: "2px solid #252545" }}>
              <td style={{ padding: "10px", color: "#e2e2f0", fontWeight: 800 }}>TOTAL</td>
              <td style={{ padding: "10px", color: "#818cf8", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(totV)}</td>
              <td style={{ padding: "10px", color: "#93c5fd", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(vAcc)}</td>
              <td style={{ padding: "10px", color: "#fcd34d", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(vServ)}</td>
              <td style={{ padding: "10px", color: "#f59e0b", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(totC)}</td>
              <td style={{ padding: "10px", color: "#34d399", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(totG)}</td>
              <td style={{ padding: "10px", color: "#4a4a6a" }}>{sales.length}</td>
            </tr></tfoot>
          </table>
        </div>
      </>}

      {tab === "gastos" && <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <Stat label="Total Gastos" value={fmt(totE)} color="#f87171" icon={<span style={{ fontSize: 28 }}>📋</span>} hideable />
          <Stat label="Ganancia Neta" value={fmt(neto)} color={neto >= 0 ? "#34d399" : "#f87171"} icon={<span style={{ fontSize: 28 }}>📊</span>} hideable />
        </div>
        <h3 style={{ margin: "0 0 12px 0", fontSize: 15, color: "#c0c0d8", fontWeight: 700 }}>Todos los Gastos ({expenses.length})</h3>
        {expenses.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#3a3a5a", fontSize: 13 }}>Sin gastos registrados.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...expenses].sort((a, b) => (b.createdAt || b.date) > (a.createdAt || a.date) ? 1 : -1).map(e => {
              const time = e.createdAt ? new Date(e.createdAt).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
              const dateStr = e.createdAt ? new Date(e.createdAt).toLocaleDateString("es-VE", { day: "2-digit", month: "short" }) : e.date.split("-")[2] + " Mayo";
              const ep = getExpPagos(e);
              const hasBs = ep.some(p => USES_BS.has(p.metodo));
              const allBs = ep.every(p => USES_BS.has(p.metodo));
              return (
                <div key={e.id} style={{ background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#ddddf0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.descripcion}</span>
                        <button onClick={() => setExpenses(expenses.filter(x => x.id !== e.id))} style={{ background: "#1e1e3a", border: "none", borderRadius: 5, padding: "2px 5px", cursor: "pointer", color: "#5a3a3a", fontSize: 10, flexShrink: 0 }}>🗑</button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, color: "#4a4a6a" }}>{dateStr} {time}</span>
                        {ep.map((p, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}><Badge method={p.metodo} small />{ep.length > 1 && <span style={{ fontSize: 9, color: "#4a4a6a", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(p.monto)}</span>}</span>)}
                        {hasBs && <span style={{ fontSize: 9, color: "#5a5a7a", fontFamily: "'JetBrains Mono', monospace" }}>T:{e.tasaBs}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                      {allBs && e.costoBs > 0 ? (
                        <>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#f87171", fontFamily: "'JetBrains Mono', monospace" }}>{fmtBs(e.costoBs)}</div>
                          <div style={{ fontSize: 10, color: "#5a5a7a", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(e.costo)}</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#f87171", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(e.costo)}</div>
                          {e.costoBs > 0 && <div style={{ fontSize: 10, color: "#5a5a7a", fontFamily: "'JetBrains Mono', monospace" }}>{fmtBs(e.costoBs)}</div>}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>}

      {tab === "cambios" && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "#c0c0d8", fontWeight: 700 }}>Historial de Cambios ({cambios.length})</h3>
          <button onClick={() => { acReset(); setShowAdminCambio(true); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#8b5cf6", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>💱 Nuevo Cambio</button>
        </div>
        {cambios.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#3a3a5a", fontSize: 13 }}>Sin cambios registrados.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...cambios].sort((a, b) => (b.createdAt || b.date) > (a.createdAt || a.date) ? 1 : -1).map(c => {
              const time = c.createdAt ? new Date(c.createdAt).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
              const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString("es-VE", { day: "2-digit", month: "short" }) : c.date;
              return (
                <div key={c.id} style={{ background: "#13132b", border: "1px solid #1e1e3a", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#c4b5fd" }}>💱</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#ddddf0", flex: 1 }}>{c.nota}</span>
                    <span style={{ fontSize: 10, color: "#3a3a5a" }}>{dateStr} {time}</span>
                    <button onClick={() => acEdit(c)} style={{ background: "#1e1e3a", border: "none", borderRadius: 5, padding: "2px 7px", cursor: "pointer", color: "#818cf8", fontSize: 9, fontWeight: 700, fontFamily: "inherit" }}>✎</button>
                    <button onClick={() => setCambios(cambios.filter(x => x.id !== c.id))} style={{ background: "#1e1e3a", border: "none", borderRadius: 5, padding: "2px 5px", cursor: "pointer", color: "#5a3a3a", fontSize: 10 }}>🗑</button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, padding: "6px 8px", borderRadius: 8, background: "#2a1015", border: "1px solid #3a1520", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#f87171", fontWeight: 600, marginBottom: 2 }}>SALIÓ</div>
                      <Badge method={c.doy.metodo} small />
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#f87171", fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>{USES_BS.has(c.doy.metodo) && c.doy.bs ? fmtBs(c.doy.bs) : fmt(c.doy.monto)}</div>
                      {USES_BS.has(c.doy.metodo) && <div style={{ fontSize: 9, color: "#5a3a3a", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(c.doy.monto)}</div>}
                    </div>
                    <span style={{ fontSize: 16, color: "#4a4a6a" }}>→</span>
                    <div style={{ flex: 1, padding: "6px 8px", borderRadius: 8, background: "#0f2e1e", border: "1px solid #1a4a38", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#34d399", fontWeight: 600, marginBottom: 2 }}>ENTRÓ</div>
                      <Badge method={c.recibo.metodo} small />
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#34d399", fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>{USES_BS.has(c.recibo.metodo) && c.recibo.bs ? fmtBs(c.recibo.bs) : fmt(c.recibo.monto)}</div>
                      {USES_BS.has(c.recibo.metodo) && <div style={{ fontSize: 9, color: "#1a5a3a", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(c.recibo.monto)}</div>}
                    </div>
                  </div>
                  <div style={{ fontSize: 9, color: "#4a4a6a", textAlign: "center", marginTop: 4 }}>{(USES_BS.has(c.doy.metodo) || USES_BS.has(c.recibo.metodo)) ? `Tasa: Bs ${c.tasaBs}` : `Ratio: ${c.tasaBs}`}</div>
                </div>
              );
            })}
          </div>
        )}
      </>}

      {/* Admin Cambio Modal */}
      <Modal open={showAdminCambio} onClose={() => { setShowAdminCambio(false); acReset(); }} title={adminCambioEdit ? "✎ Editar Cambio" : "💱 Nuevo Cambio"} width={480}>
        <div style={{ padding: 12, borderRadius: 10, background: "#2a1015", border: "1px solid #3a1520", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#f87171", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>¿Qué entregas?</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {PAY_METHODS.map(m => <PayBtn key={m} method={m} selected={acForm.doyMetodo === m} onClick={() => acSelectDoy(m)} />)}
          </div>
          {acForm.doyMetodo && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#5a5a7a", fontWeight: 600 }}>{USES_BS.has(acForm.doyMetodo) ? "Bs" : "$"}</span>
            <input type="number" value={acForm.doyMonto} onChange={e => acSetDoy(e.target.value)} placeholder="Monto" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #3a1520", background: "#0e0e22", color: "#e2e2f0", fontSize: 16, fontWeight: 700, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
          </div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: "#1a1a0e", border: "1px solid #2d2510" }}>
          <span style={{ fontSize: 11, color: "#a38a2d", fontWeight: 700 }}>{(USES_BS.has(acForm.doyMetodo) !== USES_BS.has(acForm.reciboMetodo)) ? "Tasa:" : "Rate:"}</span>
          <input type="number" value={acForm.tasaBs} onChange={e => { const t = Number(e.target.value)||1; const dBs = USES_BS.has(acForm.doyMetodo); const rBs = USES_BS.has(acForm.reciboMetodo); let rec = ""; if (acForm.doyMonto) { const v = Number(acForm.doyMonto); rec = (dBs && !rBs) ? String(+(v/t).toFixed(2)) : (!dBs && rBs) ? String(+(v*t).toFixed(2)) : String(+(v*t).toFixed(2)); } setAcForm({ ...acForm, tasaBs: e.target.value, reciboMonto: rec }); }}
            style={{ width: 80, padding: "5px 8px", borderRadius: 6, border: "1px solid #3d3518", background: "#0e0e22", color: "#fbbf24", fontSize: 15, fontWeight: 800, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }} />
          <span style={{ fontSize: 10, color: "#5a5020" }}>{(USES_BS.has(acForm.doyMetodo) !== USES_BS.has(acForm.reciboMetodo)) ? "Bs/$" : "×"}</span>
        </div>
        <div style={{ padding: 12, borderRadius: 10, background: "#0a1e14", border: "1px solid #1a4a38", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#34d399", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>¿Qué recibes?</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {PAY_METHODS.filter(m => m !== acForm.doyMetodo).map(m => <PayBtn key={m} method={m} selected={acForm.reciboMetodo === m} onClick={() => acSelectRec(m)} />)}
          </div>
          {acForm.reciboMetodo && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#5a5a7a", fontWeight: 600 }}>{USES_BS.has(acForm.reciboMetodo) ? "Bs" : "$"}</span>
            <input type="number" value={acForm.reciboMonto} onChange={e => acSetRec(e.target.value)} placeholder="Monto" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #1a4a38", background: "#0e0e22", color: "#e2e2f0", fontSize: 16, fontWeight: 700, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
          </div>}
        </div>
        <Field label="Nota" value={acForm.nota} onChange={v => setAcForm({ ...acForm, nota: v })} placeholder="Ej: Compra de dólares" />
        <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn ghost small onClick={() => { setShowAdminCambio(false); acReset(); }}>Cancelar</Btn>
          <Btn small color="#8b5cf6" onClick={acSave} disabled={!acForm.doyMetodo || !acForm.reciboMetodo || !acForm.doyMonto || !acForm.reciboMonto}>{adminCambioEdit ? "✓ Actualizar" : "💱 Registrar"}</Btn>
        </div>
      </Modal>

      {tab === "reportes" && (() => {
        const allMethods = ["Pago Móvil", "Punto de Venta", "Efectivo Bs", "Efectivo $", "Binance", "Zelle"];
        const allDatesSet = new Set();
        sales.forEach(s => allDatesSet.add(s.date));
        const allDates = [...allDatesSet].sort();

        return <>
          <h3 style={{ margin: "0 0 14px 0", fontSize: 15, color: "#c0c0d8", fontWeight: 700 }}>📄 Reporte por Método de Pago</h3>

          {allMethods.map(method => {
            const isBs = USES_BS.has(method);
            const c = PAY_COLORS[method];

            // Ingresos: sales by date for this method
            const ingresos = allDates.map(d => {
              const daySales = sales.filter(s => s.date === d);
              const monto = daySales.reduce((a, s) => a + getPagos(s).filter(p => p.metodo === method).reduce((x, p) => x + p.monto, 0), 0);
              const montoBs = isBs ? daySales.reduce((a, s) => a + getPagos(s).filter(p => p.metodo === method).reduce((x, p) => x + p.monto * (s.tasaBs || 0), 0), 0) : 0;
              return { date: d, monto, montoBs };
            }).filter(r => r.monto > 0);

            // Cambios entrantes
            const cambiosIn = cambios.filter(cx => cx.recibo.metodo === method).map(cx => ({
              date: cx.date, desc: cx.nota, monto: cx.recibo.monto, montoBs: cx.recibo.bs || 0, tipo: "Cambio ↓"
            }));

            // Cambios salientes (se muestran como gasto)
            const cambiosOut = cambios.filter(cx => cx.doy.metodo === method).map(cx => ({
              date: cx.date, desc: cx.nota, monto: cx.doy.monto, montoBs: cx.doy.bs || 0, tasa: cx.tasaBs, tipo: "Cambio ↑"
            }));

            // Gastos for this method
            const gastos = expenses.reduce((arr, e) => {
              const pagos = getExpPagos(e);
              pagos.filter(p => p.metodo === method).forEach(p => {
                arr.push({ date: e.date, desc: e.descripcion, monto: p.monto, tasa: e.tasaBs, montoBs: isBs ? p.monto * (e.tasaBs || 0) : 0 });
              });
              return arr;
            }, []);
            // Also expenses via "Cuenta Bancaria" show under P.Móvil (since same bank)
            if (method === "Pago Móvil" || method === "Punto de Venta") {
              expenses.forEach(e => {
                getExpPagos(e).filter(p => p.metodo === "Cuenta Bancaria").forEach(p => {
                  // Split equally or show on P.Móvil only
                  if (method === "Pago Móvil") gastos.push({ date: e.date, desc: e.descripcion + " (Cta Bancaria)", monto: p.monto, tasa: e.tasaBs, montoBs: isBs ? p.monto * (e.tasaBs || 0) : 0 });
                });
              });
            }

            const allGastos = [...gastos, ...cambiosOut].sort((a, b) => a.date > b.date ? 1 : -1);
            const allIngresos = [...ingresos.map(r => ({ ...r, tipo: "Ventas" })), ...cambiosIn].sort((a, b) => a.date > b.date ? 1 : -1);

            const totalIng = allIngresos.reduce((a, r) => a + r.monto, 0);
            const totalIngBs = allIngresos.reduce((a, r) => a + (r.montoBs || 0), 0);
            const totalEgr = allGastos.reduce((a, r) => a + r.monto, 0);
            const totalEgrBs = allGastos.reduce((a, r) => a + (r.montoBs || 0), 0);

            if (totalIng === 0 && totalEgr === 0) return null;

            return (
              <div key={method} style={{ marginBottom: 16, background: "#13132b", border: `1px solid ${c.bg}`, borderRadius: 14, overflow: "hidden" }}>
                {/* Method header */}
                <div style={{ padding: "12px 16px", background: c.bg + "66", borderBottom: `1px solid ${c.bg}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{PAY_ICONS[method]}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: c.fg, textTransform: "uppercase", letterSpacing: 1 }}>{method}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 60 }}>
                  {/* LEFT: INGRESOS */}
                  <div style={{ padding: "10px 12px", borderRight: "1px solid #1e1e3a" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, textAlign: "center", padding: "4px", background: "#0f2e1e", borderRadius: 6 }}>INGRESOS</div>
                    <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                      <thead><tr>
                        <th style={{ textAlign: "left", padding: "4px 6px", color: "#4a4a6a", fontSize: 9, fontWeight: 600 }}>Fecha</th>
                        <th style={{ textAlign: "right", padding: "4px 6px", color: "#4a4a6a", fontSize: 9, fontWeight: 600 }}>Monto</th>
                        <th style={{ textAlign: "left", padding: "4px 6px", color: "#4a4a6a", fontSize: 9, fontWeight: 600 }}>Tipo</th>
                      </tr></thead>
                      <tbody>
                        {allIngresos.map((r, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #151530" }}>
                            <td style={{ padding: "4px 6px", color: "#8a8aa0", fontSize: 10 }}>{r.date.split("-").reverse().join("/")}</td>
                            <td style={{ padding: "4px 6px", textAlign: "right", color: "#34d399", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{isBs ? fmtBs(r.montoBs) : fmt(r.monto)}</td>
                            <td style={{ padding: "4px 6px", color: "#5a5a7a", fontSize: 9 }}>{r.tipo || "Ventas"}</td>
                          </tr>
                        ))}
                        {allIngresos.length === 0 && <tr><td colSpan={3} style={{ padding: "10px", color: "#3a3a5a", textAlign: "center", fontSize: 10 }}>—</td></tr>}
                      </tbody>
                      <tfoot><tr style={{ borderTop: "2px solid #252545" }}>
                        <td style={{ padding: "5px 6px", color: "#6b6b8d", fontWeight: 700, fontSize: 10 }}>TOTAL</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", color: "#34d399", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{isBs ? fmtBs(totalIngBs) : fmt(totalIng)}</td>
                        <td></td>
                      </tr></tfoot>
                    </table>
                  </div>

                  {/* RIGHT: GASTOS */}
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, textAlign: "center", padding: "4px", background: "#2a1015", borderRadius: 6 }}>GASTOS</div>
                    <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                      <thead><tr>
                        <th style={{ textAlign: "left", padding: "4px 4px", color: "#4a4a6a", fontSize: 9, fontWeight: 600 }}>Fecha</th>
                        <th style={{ textAlign: "left", padding: "4px 4px", color: "#4a4a6a", fontSize: 9, fontWeight: 600 }}>Descripción</th>
                        <th style={{ textAlign: "right", padding: "4px 4px", color: "#4a4a6a", fontSize: 9, fontWeight: 600 }}>{isBs ? "Bs" : "$"}</th>
                      </tr></thead>
                      <tbody>
                        {allGastos.map((r, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #151530" }}>
                            <td style={{ padding: "4px 4px", color: "#8a8aa0", fontSize: 10 }}>{r.date.split("-").reverse().join("/")}</td>
                            <td style={{ padding: "4px 4px", color: "#c0c0d8", fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.desc || r.tipo}</td>
                            <td style={{ padding: "4px 4px", textAlign: "right", color: "#f87171", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{isBs ? fmtBs(r.montoBs) : fmt(r.monto)}</td>
                          </tr>
                        ))}
                        {allGastos.length === 0 && <tr><td colSpan={3} style={{ padding: "10px", color: "#3a3a5a", textAlign: "center", fontSize: 10 }}>—</td></tr>}
                      </tbody>
                      <tfoot><tr style={{ borderTop: "2px solid #252545" }}>
                        <td style={{ padding: "5px 4px", color: "#6b6b8d", fontWeight: 700, fontSize: 10 }}>TOTAL</td>
                        <td></td>
                        <td style={{ padding: "5px 4px", textAlign: "right", color: "#f87171", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{isBs ? fmtBs(totalEgrBs) : fmt(totalEgr)}</td>
                      </tr></tfoot>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </>;
      })()}

      {tab === "balance" && (() => {
        const methods = ["Cuenta Bancaria", "Efectivo Bs", "Efectivo $", "Binance", "Zelle"];
        return <>
          <h3 style={{ margin: "0 0 6px 0", fontSize: 15, color: "#c0c0d8", fontWeight: 700 }}>⚖️ Balance Inicial</h3>
          <p style={{ margin: "0 0 16px 0", fontSize: 11, color: "#4a4a6a", lineHeight: 1.6 }}>Ingresa cuánto hay en cada método al arrancar el sistema. Se puede modificar cuando quieras.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {methods.map(m => {
              const isBs = USES_BS.has(m); const c = PAY_COLORS[m];
              return (
                <div key={m} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "#13132b", border: `1px solid ${c.bg}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 16 }}>{PAY_ICONS[m]}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.fg }}>{m}</span>
                    {m === "Cuenta Bancaria" && <span style={{ fontSize: 9, color: "#4a4a6a" }}>(P.Móvil + PdV)</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11, color: "#5a5a7a" }}>{isBs ? "Bs" : "$"}</span>
                    <input type="number" value={balanceInicial[m] || ""} onChange={e => {
                      const nb = { ...balanceInicial, [m]: e.target.value };
                      saveBalanceInicial(nb);
                    }} placeholder="0" style={{ width: 100, padding: "6px 8px", borderRadius: 7, border: `1px solid ${c.bg}`, background: "#0e0e22", color: "#e2e2f0", fontSize: 14, fontWeight: 700, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: "10px 14px", borderRadius: 10, background: "#1a1a0e", border: "1px solid #2d2510", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#a38a2d", fontWeight: 700 }}>Tasa referencia:</span>
            <input type="number" value={balanceInicial.biTasa || ""} onChange={e => {
              saveBalanceInicial({ ...balanceInicial, biTasa: e.target.value });
            }} style={{ width: 70, padding: "5px 8px", borderRadius: 6, border: "1px solid #3d3518", background: "#0e0e22", color: "#fbbf24", fontSize: 14, fontWeight: 800, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }} />
            <span style={{ fontSize: 10, color: "#5a5020" }}>Bs/$ (convierte Bs a $)</span>
          </div>
        </>;
      })()}
    </div>
  );
}

/* ━━━ APP ━━━ */
export default function App() {
  const [role, setRole] = useState(() => sessionStorage.getItem("vm_role") || null);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cambios, setCambios] = useState([]);
  const [balanceInicial, setBalanceInicial] = useState({ "Pago Móvil": 0, "Punto de Venta": 0, "Efectivo Bs": 0, "Efectivo $": 0, "Binance": 0, "Zelle": 0 });
  const [tasa, setTasa] = useState(() => Number(sessionStorage.getItem("vm_tasa")) || 86.50);
  const [ready, setReady] = useState(false);
  const [tasaConfirmed, setTasaConfirmed] = useState(() => sessionStorage.getItem("vm_tasaDate") === getToday());
  const [tempTasa, setTempTasa] = useState("86.50");
  const [dbLoaded, setDbLoaded] = useState(false);
  const [dbStatus, setDbStatus] = useState("loading"); // loading, ok, error

  // Refs to track previous state for Firestore diff sync
  const prevSales = useRef([]);
  const prevExpenses = useRef([]);
  const prevCambios = useRef([]);
  const isRemote = useRef(false);

  // Real-time listeners from Firestore
  useEffect(() => {
    setReady(true);
    if (!db) { setDbLoaded(true); setDbStatus("local"); return; }
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db, "ventas"), snap => {
      const data = snap.docs.map(d => d.data());
      isRemote.current = true;
      setSales(data); prevSales.current = data;
      setTimeout(() => { isRemote.current = false; }, 100);
    }));
    unsubs.push(onSnapshot(collection(db, "gastos"), snap => {
      const data = snap.docs.map(d => d.data());
      isRemote.current = true;
      setExpenses(data); prevExpenses.current = data;
      setTimeout(() => { isRemote.current = false; }, 100);
    }));
    unsubs.push(onSnapshot(collection(db, "cambios"), snap => {
      const data = snap.docs.map(d => d.data());
      isRemote.current = true;
      setCambios(data); prevCambios.current = data;
      setTimeout(() => { isRemote.current = false; }, 100);
    }));
    setDbLoaded(true); setDbStatus("ok");
    // Load balance inicial
    getDocs(collection(db, "config")).then(snap => {
      const biDoc = snap.docs.find(d => d.id === "balanceInicial");
      if (biDoc) setBalanceInicial(prev => ({ ...prev, ...biDoc.data() }));
    }).catch(console.error);
    // Real-time tasa sync
    unsubs.push(onSnapshot(doc(db, "config", "tasa"), snap => {
      if (snap.exists() && snap.data().valor) {
        const t = Number(snap.data().valor);
        isRemote.current = true;
        setTasa(t); setTempTasa(String(t));
        setTimeout(() => { isRemote.current = false; }, 100);
      }
    }));
    return () => unsubs.forEach(u => u());
  }, []);

  // Sync sales to Firestore (local changes only)
  useEffect(() => {
    if (!dbLoaded || !db || isRemote.current) return;
    const prev = prevSales.current; const curr = sales;
    curr.forEach(s => {
      const old = prev.find(p => p.id === s.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(s)) {
        setDoc(doc(db, "ventas", String(s.id)), JSON.parse(JSON.stringify(s))).catch(console.error);
      }
    });
    prev.forEach(s => { if (!curr.find(c => c.id === s.id)) deleteDoc(doc(db, "ventas", String(s.id))).catch(console.error); });
    prevSales.current = curr;
  }, [sales, dbLoaded]);

  // Sync expenses to Firestore (local changes only)
  useEffect(() => {
    if (!dbLoaded || !db || isRemote.current) return;
    const prev = prevExpenses.current; const curr = expenses;
    curr.forEach(e => {
      const old = prev.find(p => p.id === e.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(e)) {
        setDoc(doc(db, "gastos", String(e.id)), JSON.parse(JSON.stringify(e))).catch(console.error);
      }
    });
    prev.forEach(e => { if (!curr.find(c => c.id === e.id)) deleteDoc(doc(db, "gastos", String(e.id))).catch(console.error); });
    prevExpenses.current = curr;
  }, [expenses, dbLoaded]);

  // Sync cambios to Firestore (local changes only)
  useEffect(() => {
    if (!dbLoaded || !db || isRemote.current) return;
    const prev = prevCambios.current; const curr = cambios;
    curr.forEach(c => {
      const old = prev.find(p => p.id === c.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(c)) {
        setDoc(doc(db, "cambios", String(c.id)), JSON.parse(JSON.stringify(c))).catch(console.error);
      }
    });
    prev.forEach(c => { if (!curr.find(x => x.id === c.id)) deleteDoc(doc(db, "cambios", String(c.id))).catch(console.error); });
    prevCambios.current = curr;
  }, [cambios, dbLoaded]);

  // Persist role/tasa to sessionStorage
  useEffect(() => { if (role) sessionStorage.setItem("vm_role", role); else sessionStorage.removeItem("vm_role"); }, [role]);
  useEffect(() => { sessionStorage.setItem("vm_tasa", String(tasa)); }, [tasa]);
  useEffect(() => { if (db && dbLoaded && !isRemote.current) setDoc(doc(db, "config", "tasa"), { valor: tasa }).catch(console.error); }, [tasa, dbLoaded]);
  useEffect(() => { if (tasaConfirmed) sessionStorage.setItem("vm_tasaDate", getToday()); }, [tasaConfirmed]);

  function saveBalanceInicial(newBi) {
    setBalanceInicial(newBi);
    if (db) setDoc(doc(db, "config", "balanceInicial"), newBi).catch(console.error);
  }

  const [showHeaderTasa, setShowHeaderTasa] = useState(false);
  const [headerTasaVal, setHeaderTasaVal] = useState(String(tasa));
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState("");
  const [adminPassError, setAdminPassError] = useState(false);
  const ADMIN_PASS = "max2026";

  function selectRole(r) {
    if (r === "admin") { setShowAdminPass(true); setAdminPassInput(""); setAdminPassError(false); return; }
    setRole(r);
    setTempTasa(String(tasa));
  }
  function confirmAdminPass() {
    if (adminPassInput === ADMIN_PASS) { setShowAdminPass(false); setRole("admin"); setTasaConfirmed(true); }
    else { setAdminPassError(true); setTimeout(() => setAdminPassError(false), 1500); }
  }
  function confirmTasa() {
    setTasa(Number(tempTasa));
    setTasaConfirmed(true);
  }
  function skipTasa() {
    setTasaConfirmed(true);
  }

  if (!role) {
    return (
      <div style={{ minHeight: "100vh", background: "#080818", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 20, position: "relative", overflow: "hidden" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <div style={{ position: "absolute", top: -200, right: -200, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.06), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -150, left: -150, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.05), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ opacity: ready ? 1 : 0, transform: ready ? "translateY(0)" : "translateY(30px)", transition: "all 1s cubic-bezier(0.16, 1, 0.3, 1)", textAlign: "center", position: "relative" }}>
          {/* VentaMax Logo */}
          <div style={{ width: 72, height: 72, borderRadius: 18, margin: "0 auto 24px", background: "linear-gradient(135deg, #4338ca, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 60px rgba(99,102,241,0.3), 0 8px 32px rgba(0,0,0,0.4)", position: "relative" }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M8 10L14 28H16L20 18L24 28H26L32 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="32" cy="12" r="4" fill="#fbbf24" stroke="#fff" strokeWidth="1.5"/>
              <text x="30" y="15" fontSize="6" fontWeight="800" fill="#000" textAnchor="middle">$</text>
            </svg>
          </div>
          <h1 style={{ margin: "0 0 4px 0", fontSize: 28, fontWeight: 800, color: "#e2e2f0", letterSpacing: -1 }}>Venta<span style={{ color: "#818cf8" }}>Max</span></h1>
          <p style={{ margin: "0 0 36px 0", fontSize: 13, color: "#4a4a6a" }}>Sistema de ventas · Doble moneda · Cuadre de caja</p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            {[{ id: "vendedor", label: "Vendedor", desc: "Notas de venta, gastos y cuadre", color: "#6366f1", gradient: "linear-gradient(135deg, #4338ca, #6366f1)", border: "#2e2b6e" },
              { id: "admin", label: "Administrador", desc: "Reportes y control financiero", color: "#10b981", gradient: "linear-gradient(135deg, #065f46, #10b981)", border: "#1a4a38" }].map(r => (
              <button key={r.id} onClick={() => selectRole(r.id)} style={{ width: 210, padding: 26, borderRadius: 18, background: "#0e0e22", border: `1px solid ${r.border}`, cursor: "pointer", textAlign: "center", color: "#fff", fontFamily: "inherit", transition: "all 0.25s ease" }}
                onMouseOver={e => { e.currentTarget.style.borderColor = r.color; e.currentTarget.style.transform = "translateY(-3px)"; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = r.border; e.currentTarget.style.transform = "translateY(0)"; }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: r.gradient, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 22 }}>{r.id === "vendedor" ? "💰" : "📊"}</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: "#e2e2f0" }}>{r.label}</div>
                <div style={{ fontSize: 11, color: "#4a4a6a", lineHeight: 1.5 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } } @keyframes shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-8px); } 40%,80% { transform: translateX(8px); } }`}</style>
        {/* Admin password modal */}
        {showAdminPass && (
          <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}>
            <div style={{ background: "#151530", border: "1px solid #1a4a38", borderRadius: 22, padding: "36px 34px", maxWidth: 340, width: "100%", textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", animation: adminPassError ? "shake 0.4s ease" : "none" }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #065f46, #10b981)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 24 }}>🔒</div>
              <h2 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 800, color: "#e2e2f0" }}>Acceso Admin</h2>
              <p style={{ margin: "0 0 20px 0", fontSize: 12, color: "#5a5a7a" }}>Ingresa la contraseña para continuar</p>
              <input type="password" value={adminPassInput} onChange={e => setAdminPassInput(e.target.value)} autoFocus
                onKeyDown={e => e.key === "Enter" && confirmAdminPass()}
                placeholder="Contraseña"
                style={{ width: "100%", padding: "14px 18px", borderRadius: 12, border: adminPassError ? "1.5px solid #ef4444" : "1.5px solid #1a4a38", background: "#0e0e22", color: "#e2e2f0", fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", textAlign: "center", outline: "none", letterSpacing: 4, marginBottom: 6 }} />
              {adminPassError && <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, marginBottom: 6 }}>Contraseña incorrecta</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={() => setShowAdminPass(false)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #252545", background: "transparent", color: "#5a5a7a", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                <button onClick={confirmAdminPass} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #065f46, #10b981)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Entrar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080818", fontFamily: "'DM Sans', sans-serif", color: "#e2e2f0" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Daily tasa prompt - only for vendedor */}
      {!tasaConfirmed && role === "vendedor" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}>
          <div style={{ background: "#151530", border: "1px solid #252545", borderRadius: 22, padding: "36px 34px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #92400e, #eab308)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 26 }}>$</div>
            <h2 style={{ margin: "0 0 6px 0", fontSize: 20, fontWeight: 800, color: "#e2e2f0" }}>¿Tasa de hoy?</h2>
            <p style={{ margin: "0 0 24px 0", fontSize: 12, color: "#5a5a7a", lineHeight: 1.6 }}>¿A cuánto está el dólar hoy? Se usará como referencia para nuevas ventas y gastos.</p>
            <div style={{ position: "relative", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 14, border: "1.5px solid #eab308", background: "#1a1a0e" }}>
                <span style={{ fontSize: 14, color: "#a38a2d", fontWeight: 700 }}>1 USD =</span>
                <input type="number" value={tempTasa} onChange={e => setTempTasa(e.target.value)} autoFocus
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fbbf24", fontSize: 28, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }} />
                <span style={{ fontSize: 14, color: "#a38a2d", fontWeight: 700 }}>Bs</span>
              </div>
              <div style={{ fontSize: 11, color: "#5a5020", marginTop: 6 }}>Tasa anterior: Bs {tasa.toFixed(2)}</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={skipTasa} style={{ flex: 1, padding: "12px 18px", borderRadius: 12, border: "1px solid #252545", background: "transparent", color: "#6b6b8d", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Omitir</button>
              <button onClick={confirmTasa} style={{ flex: 1, padding: "12px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #92400e, #eab308)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>✓ Confirmar</button>
            </div>
          </div>
        </div>
      )}
      <header style={{ padding: "12px 20px", borderBottom: "1px solid #1e1e3a", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(8,8,24,0.9)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #4338ca, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none"><path d="M8 10L14 28H16L20 18L24 28H26L32 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="32" cy="12" r="4" fill="#fbbf24"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Venta<span style={{ color: "#818cf8" }}>Max</span></div>
            <div style={{ fontSize: 10, color: "#4a4a6a", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>{role === "vendedor" ? "Vendedor" : "Admin"} · {new Date().toLocaleDateString("es-VE", { month: "long", year: "numeric" })}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {role === "vendedor" && <button onClick={() => { setHeaderTasaVal(String(tasa)); setShowHeaderTasa(true); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, background: "#1a1a0e", border: "1px solid #2d2510", cursor: "pointer", fontFamily: "inherit" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#eab308" }} /><span style={{ fontSize: 11, color: "#a38a2d", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>Bs {tasa.toFixed(2)}</span></button>}
          <button onClick={() => { setRole(null); setTasaConfirmed(false); sessionStorage.clear(); }} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #1e1e3a", background: "#0e0e22", color: "#5a5a7a", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← Salir</button>
        </div>
      </header>
      {/* Quick tasa edit */}
      {showHeaderTasa && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setShowHeaderTasa(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 52, right: 16, background: "#151530", border: "1px solid #2d2510", borderRadius: 12, padding: "12px 14px", width: 220, boxShadow: "0 10px 40px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize: 11, color: "#a38a2d", fontWeight: 700, marginBottom: 8 }}>Tasa del día</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", flex: 1, gap: 4, padding: "6px 8px", borderRadius: 8, border: "1px solid #3d3518", background: "#1a1a0e" }}>
                <span style={{ fontSize: 10, color: "#5a5020" }}>Bs</span>
                <input type="number" value={headerTasaVal} onChange={e => setHeaderTasaVal(e.target.value)} autoFocus
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fbbf24", fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", textAlign: "right", width: "100%" }} />
              </div>
              <button onClick={() => { setTasa(Number(headerTasaVal)); setShowHeaderTasa(false); }}
                style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#eab308", color: "#000", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>✓</button>
            </div>
          </div>
        </div>
      )}
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "22px 16px" }}>
        {role === "vendedor" ? <Vendedor sales={sales} setSales={setSales} expenses={expenses} setExpenses={setExpenses} cambios={cambios} setCambios={setCambios} tasa={tasa} setTasa={setTasa} /> : <Admin sales={sales} expenses={expenses} setExpenses={setExpenses} cambios={cambios} setCambios={setCambios} tasa={tasa} balanceInicial={balanceInicial} saveBalanceInicial={saveBalanceInicial} />}
      </main>
    </div>
  );
}
