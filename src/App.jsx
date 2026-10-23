import React, { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Bell, CheckCircle2, ChevronDown, ClipboardList, Clock3, Cross, HeartPulse, LogOut, MapPin, Package, Plus, Search, ShieldCheck, ShoppingCart, Store, Trash2, UserRound, X } from "lucide-react";

const money = n => `₹${Number(n || 0).toFixed(2)}`;
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const api = async (path, options = {}, token = "") => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}/api${cleanPath}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
};
const initialLogin = { loginId: "", password: "" };

function App() {
  const [token, setToken] = useState(localStorage.getItem("medmap_token") || "");
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("medmap_user") || "null"); } catch { return null; } });
  const [tab, setTab] = useState("discover");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [login, setLogin] = useState(initialLogin);
  const [register, setRegister] = useState({ name: "", email: "", password: "" });
  const [showRegister, setShowRegister] = useState(false);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [pharmacies, setPharmacies] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [stock, setStock] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState({});
  const [selectedPharmacy, setSelectedPharmacy] = useState("");
  const [checkout, setCheckout] = useState({ name: "", phone: "", address: "", paymentMethod: "Cash on delivery" });
  const [pharmacyForm, setPharmacyForm] = useState({ name: "", address: "", city: "Pune", phone: "" });
  const [medicineForm, setMedicineForm] = useState({ name: "", brand: "", category: "General", description: "", prescriptionRequired: false });
  const [stockForm, setStockForm] = useState({ pharmacyId: "", medicineId: "", quantity: 10, price: 30 });
  const [editingMed, setEditingMed] = useState("");
  const [editForm, setEditForm] = useState({ name: "", brand: "", category: "", description: "", prescriptionRequired: false });
  const [dbInfo, setDbInfo] = useState(null);

  const message = (ok, msg) => { setError(ok ? "" : msg); setNotice(ok ? msg : ""); };
  const loadPublic = async () => {
    try {
      const [h, p, m, s] = await Promise.all([
        api("/health").catch(() => null),
        api(`/pharmacies${city ? `?city=${encodeURIComponent(city)}` : ""}`),
        api(`/medicines?q=${encodeURIComponent(query)}`),
        api("/stock")
      ]);
      if (h?.database) setDbInfo(h.database);
      setPharmacies(p); setMedicines(m); setStock(s);
      if (!selectedPharmacy && p.length) setSelectedPharmacy(p[0]._id);
      if (!stockForm.pharmacyId && p.length) setStockForm(v => ({ ...v, pharmacyId: p[0]._id }));
    } catch (e) { message(false, e.message); }
  };
  const loadPrivate = async (role = user?.role) => {
    if (!token || !role) return;
    try {
      const [p, m, s] = await Promise.all([api("/pharmacies", {}, token), api("/medicines", {}, token), api("/stock", {}, token)]);
      setPharmacies(p); setMedicines(m); setStock(s);
      if (role === "patient") setOrders(await api("/orders/mine", {}, token));
      else setOrders(await api("/orders", {}, token));
    } catch (e) { if (e.message.includes("Session expired") || e.message.includes("log in")) logout(); else message(false, e.message); }
  };
  useEffect(() => { loadPublic(); }, [query, city]);
  useEffect(() => { if (token && user) loadPrivate(); }, [token, user?.role]);
  const pharmacyStock = useMemo(() => stock.filter(s => String(s.pharmacyId?._id) === String(selectedPharmacy)), [stock, selectedPharmacy]);
  const cartItems = useMemo(() => Object.entries(cart).filter(([, q]) => Number(q) > 0).map(([id, quantity]) => {
    const s = pharmacyStock.find(x => x.medicineId?._id === id);
    return s ? { ...s, quantity: Number(quantity) } : null;
  }).filter(Boolean), [cart, pharmacyStock]);
  const total = cartItems.reduce((sum, s) => sum + s.price * s.quantity, 0);

  function logout() {
    localStorage.removeItem("medmap_token"); localStorage.removeItem("medmap_user");
    setToken(""); setUser(null); setOrders([]); setCart({}); setTab("discover"); message(true, "You have been logged out.");
  }
  async function signIn(e) {
    e.preventDefault(); setBusy(true); message(true, "");
    try {
      const result = await api("/auth/login", { method: "POST", body: JSON.stringify(login) });
      localStorage.setItem("medmap_token", result.token); localStorage.setItem("medmap_user", JSON.stringify(result.user));
      setToken(result.token); setUser(result.user); setTab(result.user.role === "admin" ? "admin" : result.user.role === "pharmacist" ? "pharmacy" : "discover");
      message(true, `Welcome, ${result.user.name}.`);
    } catch (e) { message(false, e.message); } finally { setBusy(false); }
  }
  async function signUp(e) {
    e.preventDefault(); setBusy(true);
    try {
      const result = await api("/auth/register", { method: "POST", body: JSON.stringify(register) });
      localStorage.setItem("medmap_token", result.token); localStorage.setItem("medmap_user", JSON.stringify(result.user));
      setToken(result.token); setUser(result.user); setShowRegister(false); setTab("discover"); message(true, "Account created. Welcome to MedMap.");
    } catch (e) { message(false, e.message); } finally { setBusy(false); }
  }
  async function action(fn, success) {
    setBusy(true); message(true, "");
    try { await fn(); message(true, success); await loadPublic(); if (user) await loadPrivate(); }
    catch (e) { message(false, e.message); } finally { setBusy(false); }
  }
  async function createOrder() {
    if (!user) {
      setTab("login");
      setShowRegister(false);
      message(false, "Please sign in or create an account to place an order.");
      return;
    }
    if (user.role === "pharmacist") {
      message(false, "Pharmacist accounts cannot place orders. Please use a patient account.");
      return;
    }
    const orderName = (checkout.name || user.name || "").trim();
    const orderPhone = (checkout.phone || "").trim();
    const orderAddress = (checkout.address || "").trim();

    if (!orderName) { message(false, "Please provide the recipient's full name."); return; }
    if (!orderPhone || !/^[0-9+()\- ]{10,16}$/.test(orderPhone)) { message(false, "Please enter a valid 10-digit contact phone number."); return; }
    if (!orderAddress) { message(false, "Please provide a delivery address."); return; }
    if (!selectedPharmacy) { message(false, "Please choose a pharmacy first."); return; }
    if (!cartItems.length) { message(false, "Add at least one medicine to your cart."); return; }

    await action(async () => {
      const orderPayload = {
        pharmacyId: selectedPharmacy,
        patientName: orderName,
        patientPhone: orderPhone,
        deliveryAddress: orderAddress,
        paymentMethod: checkout.paymentMethod || "Cash on delivery",
        items: cartItems.map(s => ({ medicineId: s.medicineId._id, quantity: s.quantity })),
        hasPrescription: true
      };
      await api("/orders", { method: "POST", body: JSON.stringify(orderPayload) }, token);
      setCart({});
      await loadPrivate();
      setTab("orders");
    }, "Order placed successfully! The pharmacy has received your order.");
  }
  const activePharmacy = pharmacies.find(p => p._id === selectedPharmacy);

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setTab("discover")} aria-label="MedMap home"><span className="brand-icon"><Cross size={22} strokeWidth={3}/></span><span>med<span className="brand-accent">map</span><small>MEDICINE, WITH CLARITY</small></span></button>
      <nav className="desktop-nav">
        <button className={tab === "discover" ? "nav-link active" : "nav-link"} onClick={() => setTab("discover")}>Find medicine</button>
        {(user?.role === "patient" || user?.role === "admin") && <button className={tab === "orders" ? "nav-link active" : "nav-link"} onClick={() => { setTab("orders"); loadPrivate(); }}>My orders</button>}
        {user?.role === "pharmacist" && <button className={tab === "pharmacy" ? "nav-link active" : "nav-link"} onClick={() => setTab("pharmacy")}>Pharmacy portal</button>}
        {user?.role === "admin" && <button className={tab === "admin" ? "nav-link active" : "nav-link"} onClick={() => setTab("admin")}>Admin panel</button>}
      </nav>
      <div className="top-actions">
        {dbInfo && (
          <span
            className={dbInfo.connected ? "tag tag-green" : "tag tag-warn"}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "10px", padding: "5px 10px" }}
            title={dbInfo.connected ? `Connected to MongoDB Atlas (${dbInfo.host})` : "In-memory database"}
          >
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: dbInfo.connected ? "#2b7042" : "#a96c2b", display: "inline-block" }}></span>
            {dbInfo.connected ? "Atlas Connected" : "Local Store"}
          </span>
        )}
        {user ? <><span className="user-chip"><span className="avatar">{user.name?.[0] || "U"}</span><span className="user-name">{user.name}<small>{user.role}</small></span></span><button className="icon-button" title="Log out" onClick={logout}><LogOut size={18}/></button></> : <button className="button button-dark button-small" onClick={() => { setTab("login"); setShowRegister(false); }}>Log in <ArrowRight size={15}/></button>}
      </div>
    </header>

    {(notice || error) && <div className={error ? "toast toast-error" : "toast toast-ok"}><span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }}><X size={15}/></button></div>}

    {(!user && tab === "login") ? <main className="auth-page">
      <div className="auth-art"><div className="art-orbit orbit-one"></div><div className="art-orbit orbit-two"></div><div className="art-cross"><Cross size={64} strokeWidth={2.5}/></div><span className="art-label">CARE THAT CONNECTS</span><h1>Better access.<br/>Better care.</h1><p>Find local pharmacy stock and send your order directly to the pharmacy you choose.</p><div className="art-pills"><span><MapPin size={15}/> Local availability</span><span><ShieldCheck size={15}/> Role-based access</span></div></div>
      <div className="auth-form-wrap"><div className="auth-form">
        <span className="eyebrow">{showRegister ? "JOIN MEDMAP" : "WELCOME BACK"}</span><h2>{showRegister ? "Create your account" : "Sign in to MedMap"}</h2><p className="muted">{showRegister ? "Patient accounts can browse stock and place orders." : "Your medicine access, all in one place."}</p>
        {showRegister ? <form onSubmit={signUp} className="form-stack"><label>Full name<input required value={register.name} onChange={e => setRegister({...register, name:e.target.value})} placeholder="Your name"/></label><label>Email address<input required type="email" value={register.email} onChange={e => setRegister({...register, email:e.target.value})} placeholder="you@example.com"/></label><label>Password<input required minLength="6" type="password" value={register.password} onChange={e => setRegister({...register, password:e.target.value})} placeholder="At least 6 characters"/></label><button disabled={busy} className="button button-dark button-wide">{busy ? "Please wait..." : "Create patient account"} <ArrowRight size={17}/></button><p className="switch-auth">Already registered? <button type="button" onClick={() => setShowRegister(false)}>Sign in</button></p></form> : <form onSubmit={signIn} className="form-stack"><label>Login ID or email<input required value={login.loginId} onChange={e => setLogin({...login, loginId:e.target.value})} placeholder="Enter your ID or email"/></label><label>Password<input required type="password" value={login.password} onChange={e => setLogin({...login, password:e.target.value})} placeholder="Enter your password"/></label><button disabled={busy} className="button button-dark button-wide">{busy ? "Signing in..." : "Sign in securely"} <ArrowRight size={17}/></button><p className="switch-auth">New to MedMap? <button type="button" onClick={() => setShowRegister(true)}>Create patient account</button></p></form>}
        <div className="demo-box"><ShieldCheck size={17}/><div><strong>Demo access</strong><p>Admin ID <b>115</b> · Pharmacist ID <b>116</b><br/>Password for both: <b>51000</b></p></div></div>
      </div></div>
    </main> : tab === "login" && user ? <main className="content"><div className="panel"><h2>You are signed in</h2><button className="button button-dark" onClick={() => setTab(user.role === "admin" ? "admin" : user.role === "pharmacist" ? "pharmacy" : "discover")}>Continue <ArrowRight size={16}/></button></div></main>
    : tab === "admin" && user?.role === "admin" ? <main className="content">
      <PageHeading eyebrow="CONTROL CENTRE" title="Admin dashboard" description="Manage medicine records, pharmacy listings and review every order."/>
      <div className="stats-grid"><Stat icon={<Store/>} label="Active pharmacies" value={pharmacies.length}/><Stat icon={<Package/>} label="Medicine records" value={medicines.length}/><Stat icon={<ClipboardList/>} label="All orders" value={orders.length}/><Stat icon={<ShieldCheck/>} label="Access level" value="Admin"/></div>
      <div className="dashboard-grid">
        <section className="panel"><SectionTitle icon={<Plus/>} title="Add medicine" subtitle="Create a catalogue entry"/> <form className="form-grid" onSubmit={e => {e.preventDefault(); action(async()=>{await api("/medicines",{method:"POST",body:JSON.stringify(medicineForm)},token);setMedicineForm({name:"",brand:"",category:"General",description:"",prescriptionRequired:false});},"Medicine added.");}}><label>Medicine name<input required value={medicineForm.name} onChange={e=>setMedicineForm({...medicineForm,name:e.target.value})}/></label><label>Brand<input value={medicineForm.brand} onChange={e=>setMedicineForm({...medicineForm,brand:e.target.value})}/></label><label>Category<input value={medicineForm.category} onChange={e=>setMedicineForm({...medicineForm,category:e.target.value})}/></label><label>Description<input value={medicineForm.description} onChange={e=>setMedicineForm({...medicineForm,description:e.target.value})}/></label><label className="check-label"><input type="checkbox" checked={medicineForm.prescriptionRequired} onChange={e=>setMedicineForm({...medicineForm,prescriptionRequired:e.target.checked})}/> Prescription required</label><button className="button button-dark" disabled={busy}>Add medicine <Plus size={15}/></button></form></section>
        <section className="panel"><SectionTitle icon={<Store/>} title="Add pharmacy" subtitle="Create a pharmacy listing"/> <form className="form-grid" onSubmit={e=>{e.preventDefault();action(async()=>{await api("/pharmacies",{method:"POST",body:JSON.stringify(pharmacyForm)},token);setPharmacyForm({name:"",address:"",city:"Pune",phone:""});},"Pharmacy added.");}}><label>Pharmacy name<input required value={pharmacyForm.name} onChange={e=>setPharmacyForm({...pharmacyForm,name:e.target.value})}/></label><label>Address<input required value={pharmacyForm.address} onChange={e=>setPharmacyForm({...pharmacyForm,address:e.target.value})}/></label><label>City<input required value={pharmacyForm.city} onChange={e=>setPharmacyForm({...pharmacyForm,city:e.target.value})}/></label><label>Phone<input value={pharmacyForm.phone} onChange={e=>setPharmacyForm({...pharmacyForm,phone:e.target.value})}/></label><button className="button button-dark" disabled={busy}>Add pharmacy <Plus size={15}/></button></form></section>
      </div>
      <section className="panel table-panel"><SectionTitle icon={<Package/>} title="Medicine catalogue" subtitle="Update or remove medicine records"/> <div className="table-scroll"><table><thead><tr><th>Medicine</th><th>Category</th><th>Prescription</th><th>Actions</th></tr></thead><tbody>{medicines.map(m=><tr key={m._id}><td><strong>{m.name}</strong><small>{m.brand || "Generic"}</small></td><td>{m.category}</td><td>{m.prescriptionRequired ? <span className="tag tag-warn">Required</span> : <span className="tag">Not required</span>}</td><td className="actions-cell">{editingMed===m._id ? <><input className="inline-edit" value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})}/><button className="mini-action" onClick={()=>action(async()=>{await api(`/medicines/${m._id}`,{method:"PATCH",body:JSON.stringify(editForm)},token);setEditingMed("");},"Medicine updated.")}>Save</button><button className="mini-action" onClick={()=>setEditingMed("")}>Cancel</button></> : <><button className="mini-action" onClick={()=>{setEditingMed(m._id);setEditForm({name:m.name,brand:m.brand,category:m.category,description:m.description,prescriptionRequired:m.prescriptionRequired});}}>Edit</button><button className="mini-action danger" onClick={()=>{if(confirm(`Delete ${m.name}?`))action(()=>api(`/medicines/${m._id}`,{method:"DELETE"},token),"Medicine deleted.");}}>Delete</button></>}</td></tr>)}</tbody></table></div></section>
      <PharmacyTable pharmacies={pharmacies} onRemove={p=>{if(confirm(`Remove ${p.name} from public listings?`))action(()=>api(`/pharmacies/${p._id}`,{method:"DELETE"},token),"Pharmacy deactivated.");}}/>
      <OrderTable orders={orders} role="admin" onStatus={(id,status)=>action(()=>api(`/orders/${id}/status`,{method:"PATCH",body:JSON.stringify({status})},token),"Order status updated.")}/>
    </main> : tab === "pharmacy" && user?.role === "pharmacist" ? <main className="content">
      <PageHeading eyebrow="PHARMACY PORTAL" title="Your pharmacy, in sync." description="Maintain your pharmacy details, keep stock accurate and manage orders routed to you."/>
      <div className="stats-grid"><Stat icon={<Package/>} label="Stock entries" value={stock.filter(s=>String(s.pharmacyId?.pharmacistId || "")===String(user.id)).length || stock.length}/><Stat icon={<ClipboardList/>} label="Orders assigned to you" value={orders.length}/><Stat icon={<Clock3/>} label="Awaiting action" value={orders.filter(o=>o.status==="Placed").length}/><Stat icon={<CheckCircle2/>} label="Ready / completed" value={orders.filter(o=>["Ready","Completed"].includes(o.status)).length}/></div>
      <div className="dashboard-grid">
        <section className="panel"><SectionTitle icon={<Store/>} title="Add your pharmacy" subtitle="New listings are assigned to your account"/> <form className="form-grid" onSubmit={e=>{e.preventDefault();action(async()=>{await api("/pharmacies",{method:"POST",body:JSON.stringify(pharmacyForm)},token);setPharmacyForm({name:"",address:"",city:"Pune",phone:""});},"Pharmacy added to your portal.");}}><label>Pharmacy name<input required value={pharmacyForm.name} onChange={e=>setPharmacyForm({...pharmacyForm,name:e.target.value})}/></label><label>Address<input required value={pharmacyForm.address} onChange={e=>setPharmacyForm({...pharmacyForm,address:e.target.value})}/></label><label>City<input required value={pharmacyForm.city} onChange={e=>setPharmacyForm({...pharmacyForm,city:e.target.value})}/></label><label>Phone<input value={pharmacyForm.phone} onChange={e=>setPharmacyForm({...pharmacyForm,phone:e.target.value})}/></label><button className="button button-dark" disabled={busy}>Add pharmacy <Plus size={15}/></button></form></section>
        <section className="panel"><SectionTitle icon={<Activity/>} title="Update stock" subtitle="Set the available quantity and price"/> <form className="form-grid" onSubmit={e=>{e.preventDefault();action(async()=>{await api("/stock",{method:"POST",body:JSON.stringify(stockForm)},token);},"Stock updated successfully.");}}><label>Pharmacy<select required value={stockForm.pharmacyId} onChange={e=>setStockForm({...stockForm,pharmacyId:e.target.value})}><option value="">Choose pharmacy</option>{pharmacies.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}</select></label><label>Medicine<select required value={stockForm.medicineId} onChange={e=>setStockForm({...stockForm,medicineId:e.target.value})}><option value="">Choose medicine</option>{medicines.map(m=><option key={m._id} value={m._id}>{m.name}</option>)}</select></label><label>Quantity<input type="number" min="0" step="1" required value={stockForm.quantity} onChange={e=>setStockForm({...stockForm,quantity:e.target.value})}/></label><label>Price per unit (₹)<input type="number" min="0" step=".01" required value={stockForm.price} onChange={e=>setStockForm({...stockForm,price:e.target.value})}/></label><button className="button button-dark" disabled={busy}>Save stock <CheckCircle2 size={16}/></button></form></section>
      </div>
      <section className="panel table-panel"><SectionTitle icon={<Package/>} title="Current inventory" subtitle="Stock updates reflect on the patient search page"/> <div className="table-scroll"><table><thead><tr><th>Pharmacy</th><th>Medicine</th><th>Quantity</th><th>Price</th><th>Action</th></tr></thead><tbody>{stock.map(s=><tr key={s._id}><td>{s.pharmacyId?.name}</td><td>{s.medicineId?.name}</td><td><span className={s.quantity===0?"tag tag-warn":"tag tag-green"}>{s.quantity} units</span></td><td>{money(s.price)}</td><td><button className="mini-action danger" onClick={()=>{if(confirm("Remove this stock entry?"))action(()=>api(`/stock/${s._id}`,{method:"DELETE"},token),"Stock entry removed.");}}><Trash2 size={14}/> Remove</button></td></tr>)}</tbody></table></div></section>
      <PharmacyTable pharmacies={pharmacies.filter(p=>String(p.pharmacistId?._id || p.pharmacistId)===String(user.id))} onRemove={p=>{if(confirm(`Remove ${p.name} from public listings?`))action(()=>api(`/pharmacies/${p._id}`,{method:"DELETE"},token),"Pharmacy deactivated.");}}/>
    </main> : tab === "orders" && (user?.role === "patient" || user?.role === "admin") ? <main className="content"><PageHeading eyebrow="ORDER HISTORY" title="Your medicine orders" description="Track each order from the pharmacy you selected."/><OrderTable orders={orders} role={user?.role} onStatus={(id,status)=>action(()=>api(`/orders/${id}/status`,{method:"PATCH",body:JSON.stringify({status})},token),"Order status updated.")}/></main>
    : <main className="content">
      <section className="hero">
        <div className="hero-copy"><div className="hero-pill"><span className="pulse"></span> YOUR LOCAL MEDICINE GUIDE</div><h1>Find the right medicine.<br/><em>Find it nearby.</em></h1><p>Search pharmacy stock, compare prices and place an order directly with your chosen local pharmacy.</p><div className="hero-points"><span><CheckCircle2 size={17}/> Live stock from registered pharmacies</span><span><CheckCircle2 size={17}/> Orders sent to the selected pharmacy</span></div><button className="button button-light" onClick={()=>document.getElementById("medicine-search")?.scrollIntoView({behavior:"smooth"})}>Explore medicines <ArrowRight size={17}/></button></div>
        <div className="hero-visual"><div className="hero-circle"></div><div className="floating-card stock-card"><span className="floating-icon"><Package size={19}/></span><div><strong>Stock visibility</strong><small>Updated by pharmacies</small></div><span className="live-dot"></span></div><div className="medicine-illustration"><div className="bottle-cap"></div><div className="bottle"><div className="bottle-label"><Cross size={22}/><span>MED<br/>CARE</span></div></div><div className="pill-illustration"><span></span></div></div><div className="floating-card safe-card"><span className="safe-icon"><ShieldCheck size={20}/></span><div><strong>Made simpler</strong><small>One search, local options</small></div></div><div className="visual-stamp"><HeartPulse size={22}/><span>CARE<br/>NEAR YOU</span></div></div>
      </section>
      <section id="medicine-search" className="search-section"><div className="section-intro"><div><span className="eyebrow">THE MEDICINE FINDER</span><h2>What do you need today?</h2><p className="muted">Availability and price depend on each pharmacy's latest stock update.</p></div><span className="result-count">{stock.length} stock listings</span></div>
        <div className="search-bar"><Search size={20}/><input placeholder="Search medicine, brand or category..." value={query} onChange={e=>setQuery(e.target.value)}/><div className="search-divider"></div><MapPin size={18}/><input className="city-input" placeholder="Filter by city" value={city} onChange={e=>setCity(e.target.value)}/></div>
        <div className="browse-layout"><div className="medicine-list"><div className="list-heading"><h3>Available medicines</h3><span>{medicines.length} catalogue results</span></div>
          {medicines.length===0 ? <EmptyState title="No matching medicines" text="Try another medicine name or category."/> : medicines.map((m,i)=>{const records=stock.filter(s=>s.medicineId?._id===m._id && s.pharmacyId?.active);const available=records.filter(s=>s.quantity>0);return <article className="medicine-row" key={m._id}><div className={`med-symbol med-symbol-${i%4}`}><Cross size={21}/></div><div className="med-info"><div className="med-name-line"><h4>{m.name}</h4>{m.prescriptionRequired&&<span className="tag tag-warn">Prescription</span>}</div><p>{m.brand||"Generic"} <span>·</span> {m.category}</p><small>{m.description}</small><div className="availability-line"><span className={available.length?"availability-dot":"availability-dot out"}></span>{available.length ? `Available at ${available.length} ${available.length===1?"pharmacy":"pharmacies"}` : "Currently out of stock"}</div></div><div className="med-actions"><strong>{available.length?`From ${money(Math.min(...available.map(s=>s.price)))}`:"—"}</strong><button className="text-button" onClick={()=>{if(records.length){setSelectedPharmacy(records[0].pharmacyId._id);document.getElementById("pharmacy-chooser")?.scrollIntoView({behavior:"smooth"});}else message(false,"No pharmacy has listed this medicine in stock yet.");}}>View stock <ArrowRight size={14}/></button></div></article>;})}
        </div>
        <aside className="order-aside" id="pharmacy-chooser"><div className="aside-head"><span className="aside-icon"><Store size={20}/></span><div><h3>Choose a pharmacy</h3><p>Orders go to this pharmacy</p></div></div><label className="field-label">PHARMACY LOCATION</label><select className="full-select" value={selectedPharmacy} onChange={e=>{setSelectedPharmacy(e.target.value);setCart({});}}><option value="">Select a pharmacy</option>{pharmacies.map(p=><option key={p._id} value={p._id}>{p.name} — {p.city}</option>)}</select>
          {activePharmacy ? <div className="chosen-pharmacy"><span className="pharmacy-pin"><MapPin size={18}/></span><div><strong>{activePharmacy.name}</strong><p>{activePharmacy.address}, {activePharmacy.city}</p>{activePharmacy.phone&&<small>{activePharmacy.phone}</small>}</div></div> : <p className="muted small-text">Select a pharmacy to see its available inventory.</p>}
          <div className="aside-rule"></div><div className="cart-title"><h3>Your order</h3><span>{cartItems.reduce((n,s)=>n+s.quantity,0)} items</span></div>
          {pharmacyStock.filter(s=>s.quantity>0).length ? <div className="cart-stock-list">{pharmacyStock.filter(s=>s.quantity>0).map(s=><div className="stock-pick" key={s._id}><div><strong>{s.medicineId?.name}</strong><small>{money(s.price)} / unit · {s.quantity} in stock</small></div><div className="quantity-control"><button disabled={!cart[s.medicineId?._id]} onClick={()=>setCart({...cart,[s.medicineId._id]:Math.max(0,(cart[s.medicineId._id]||0)-1)})}>−</button><span>{cart[s.medicineId?._id]||0}</span><button disabled={(cart[s.medicineId?._id]||0)>=s.quantity} onClick={()=>setCart({...cart,[s.medicineId._id]:(cart[s.medicineId._id]||0)+1})}>+</button></div></div>)}</div> : <p className="muted small-text">No stock listed for this pharmacy.</p>}
          {user ? (
            <div className="checkout-fields">
              <div className="checkout-heading"><UserRound size={16}/><strong>Delivery details</strong></div>
              <label>Full name<input required autoComplete="name" value={checkout.name || user.name || ""} onChange={e=>setCheckout({...checkout, name: e.target.value})} placeholder="Name of the person receiving the order"/></label>
              <label>Phone number<input required type="tel" autoComplete="tel" pattern="[0-9+()\- ]{10,16}" value={checkout.phone} onChange={e=>setCheckout({...checkout, phone: e.target.value})} placeholder="10-digit contact number (e.g. 9876543210)"/></label>
              <label>Delivery address<textarea required rows="3" autoComplete="street-address" value={checkout.address} onChange={e=>setCheckout({...checkout, address: e.target.value})} placeholder="Flat/house, street, area, city and PIN code"/></label>
              <label>Payment method<select value={checkout.paymentMethod} onChange={e=>setCheckout({...checkout, paymentMethod: e.target.value})}><option>Cash on delivery</option><option>UPI at pharmacy</option><option>Card at pharmacy</option></select></label>
              <p className="payment-note">Payment is collected by the pharmacy upon fulfilment using your selected method.</p>
            </div>
          ) : (
            <div className="checkout-fields" style={{ textAlign: "center", padding: "16px 14px" }}>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                Ready to order? Sign in or register a patient account to enter delivery details.
              </p>
              <button
                type="button"
                className="button button-dark button-small button-wide"
                onClick={() => { setTab("login"); setShowRegister(false); }}
              >
                Sign In to Place Order <ArrowRight size={14}/>
              </button>
            </div>
          )}
          <div className="total-line"><span>Estimated total</span><strong>{money(total)}</strong></div>
          <button
            className="button button-dark button-wide order-button"
            disabled={busy || !cartItems.length || user?.role === "pharmacist" || (user && (!(checkout.name || user.name || "").trim() || !checkout.phone.trim() || !checkout.address.trim()))}
            onClick={createOrder}
          >
            <ShoppingCart size={17}/>
            {!user ? "Sign In to place order" : user.role === "pharmacist" ? "Switch account to order" : "Place order"}
            <ArrowRight size={16}/>
          </button>
          <p className="fine-print"><ShieldCheck size={13}/> Your order and delivery details are sent to the selected pharmacy. Payment is not collected online in this demo.</p>
        </aside></div>
      </section>
      <section className="how-section"><div className="section-intro"><div><span className="eyebrow">HOW MEDMAP WORKS</span><h2>From search to pharmacy.</h2></div></div><div className="steps-grid"><Step number="01" icon={<Search/>} title="Search" text="Find a medicine by name, brand or category."/><Step number="02" icon={<MapPin/>} title="Choose" text="Compare local stock and select the pharmacy."/><Step number="03" icon={<ShoppingCart/>} title="Order" text="Your order is routed to that pharmacy's assigned pharmacist." /></div></section>
    </main>}
    <footer className="footer">
      <div className="footer-brand"><span className="brand-icon"><Cross size={18} strokeWidth={3}/></span><strong>med<span className="brand-accent">map</span></strong></div>
      <p>Better visibility for local medicine access.</p>
      {dbInfo && (
        <span
          className={dbInfo.connected ? "tag tag-green" : "tag tag-warn"}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          title={dbInfo.connected ? `Connected to ${dbInfo.host}` : "Running in-memory"}
        >
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: dbInfo.connected ? "#2b7042" : "#a96c2b" }}></span>
          {dbInfo.connected ? `MongoDB Atlas: ${dbInfo.name || 'medmap'}` : "Database: In-Memory"}
        </span>
      )}
      <span className="footer-note">Educational project · Not a substitute for medical advice</span>
    </footer>
  </div>;
}

function PageHeading({eyebrow,title,description}) { return <div className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>; }
function SectionTitle({icon,title,subtitle}) { return <div className="panel-title"><span className="panel-icon">{icon}</span><div><h3>{title}</h3><p>{subtitle}</p></div></div>; }
function Stat({icon,label,value}) { return <div className="stat-card"><span className="stat-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>; }
function Step({number,icon,title,text}) { return <div className="step-card"><span className="step-number">{number}</span><span className="step-icon">{icon}</span><h3>{title}</h3><p>{text}</p></div>; }
function EmptyState({title,text}) { return <div className="empty-state"><Package size={26}/><strong>{title}</strong><p>{text}</p></div>; }
function PharmacyTable({pharmacies,onRemove}) { return <section className="panel table-panel"><SectionTitle icon={<Store/>} title="Pharmacy listings" subtitle="Remove a listing without deleting order history"/><div className="table-scroll"><table><thead><tr><th>Pharmacy</th><th>Location</th><th>Assigned pharmacist</th><th>Status</th><th>Action</th></tr></thead><tbody>{pharmacies.map(p=><tr key={p._id}><td><strong>{p.name}</strong><small>{p.phone}</small></td><td>{p.address}, {p.city}</td><td>{p.pharmacistId?.name||"Not assigned"}</td><td><span className={p.active?"tag tag-green":"tag tag-warn"}>{p.active?"Active":"Inactive"}</span></td><td><button className="mini-action danger" onClick={()=>onRemove(p)}><Trash2 size={14}/> Remove</button></td></tr>)}</tbody></table>{!pharmacies.length&&<p className="empty-table">No pharmacy listings yet.</p>}</div></section>; }
function OrderTable({orders,role,onStatus}) { const statuses=["Accepted","Ready","Completed","Cancelled"]; return <section className="panel table-panel"><SectionTitle icon={<ClipboardList/>} title={role==="patient"?"Your orders":"Incoming orders"} subtitle={role==="patient"?"Status updates are provided by the selected pharmacy":"Orders are shown only to the pharmacist assigned to the selected pharmacy, and to the administrator"}/><div className="table-scroll"><table><thead><tr><th>Order</th>{role!=="patient"&&<th>Patient</th>}<th>Pharmacy</th><th>Items</th><th>Total</th><th>Status</th>{role!=="patient"&&<th>Update</th>}</tr></thead><tbody>{orders.map(o=><tr key={o._id}><td><strong>#{String(o._id).slice(-6).toUpperCase()}</strong><small>{new Date(o.createdAt).toLocaleString()}</small></td>{role!=="patient"&&<td>{o.patientName||o.patientId?.name||"Patient"}<small>{o.patientPhone||o.patientId?.email||""}<br/>{o.deliveryAddress||"Address not provided"}<br/>Payment: {o.paymentMethod||"Not specified"}</small></td>}<td>{o.pharmacyId?.name||"Pharmacy"}<small>{o.pharmacyId?.city||""}</small></td><td>{o.items?.map(i=>`${i.name} × ${i.quantity}`).join(", ")}</td><td><strong>{money(o.total)}</strong></td><td><span className={`tag ${o.status==="Completed"?"tag-green":o.status==="Cancelled"?"tag-warn":""}`}>{o.status}</span></td>{role!=="patient"&&<td>{!["Completed","Cancelled"].includes(o.status)&&<select className="status-select" value={o.status} onChange={e=>onStatus(o._id,e.target.value)}><option value="Placed" disabled>Placed</option>{statuses.map(s=><option key={s}>{s}</option>)}</select>}</td>}</tr>)}</tbody></table>{!orders.length&&<p className="empty-table">No orders yet. New orders from patients will appear here.</p>}</div></section>; }

export default App;
