import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, CalendarDays, ClipboardList, HeartPulse, Headset, LayoutDashboard, MapPin, MessageCircle, Monitor, Plus, RefreshCw, Search, Stethoscope, UserRound } from 'lucide-react';
import { api, casesPath, casePath } from './api';
import './style.css';

const channels = [
  ['WEB', 'Portal web', Monitor], ['WHATSAPP', 'WhatsApp', MessageCircle],
  ['CALL_CENTER', 'Call Center', Headset], ['CLINICA', 'Clínica', MapPin],
];
const channelName = value => channels.find(([id]) => id === value)?.[1] ?? value;
const label = value => value?.toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ') ?? '';
const dateTime = value => value ? new Date(value).toLocaleString('es-MX') : '—';
const fields = [['estudio', 'Estudio', 'text'], ['clinica', 'Clínica', 'text'], ['fecha', 'Fecha', 'date'], ['horario', 'Horario', 'time'], ['parentesco', 'Parentesco', 'text']];
const initialLogin = { curp: 'DEMO00000000000001', telefono: '+520000000001', rol: 'ASESOR', clave: '' };
const isPersonal = channel => channel === 'WEB' || channel === 'WHATSAPP';

function App() {
  const [view, setView] = useState('TABLERO');
  const [catalog, setCatalog] = useState([]);
  const [session, setSession] = useState(null);
  const [login, setLogin] = useState(initialLogin);
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState([]);
  const [data, setData] = useState({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api('/tipos-consulta').then(setCatalog).catch(e => setError(e.message)); }, []);
  const personal = isPersonal(view);
  const authorized = session && (personal ? session.rol === 'PACIENTE' : session.rol !== 'PACIENTE');
  const typeOf = item => catalog.find(type => type.id === item.tipoConsultaId && type.version === item.flujoVersion);
  const nodeOf = item => typeOf(item)?.checkpoints.find(node => node.id === item.pasoActual);
  const service = item => typeOf(item)?.nombre ?? item.tipoConsultaId ?? 'Consulta';
  const titleFor = item => nodeOf(item)?.nombre ?? label(item.pasoActual);

  async function run(action) {
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function list(identity = session) {
    const path = identity.rol === 'PACIENTE' ? casesPath(identity.patientId) : '/tablero/casos';
    setCases(await api(path));
  }

  async function load(item) {
    const current = await api(casePath(item));
    const timeline = await api(casePath(current) + '/eventos');
    setSelected(current);
    setEvents(timeline);
    setData(current.datos ?? {});
    return current;
  }

  function navigate(next) {
    setView(next);
    setSelected(null);
    setSearch('');
    setError('');
    setNotice('');
  }

  function signIn(event) {
    event.preventDefault();
    run(async () => {
      const identity = await api('/demo/identidad/' + (personal ? 'paciente' : 'personal'), 'POST',
        personal ? { curp: login.curp, telefono: login.telefono } : { rol: view === 'TABLERO' ? login.rol : 'ASESOR', clave: login.clave });
      setCases([]);
      setSession(identity);
      setLogin({ ...login, clave: '' });
      await list(identity);
    });
  }

  function begin(type) {
    run(async () => {
      const item = await api(casesPath(session.patientId), 'POST', {
        tipoConsultaId: type.id, canal: view, datos: { estudio: type.nombre },
      });
      await load(item);
      await list();
    });
  }

  function continueIn(item, channel) {
    run(async () => {
      let current = await api(casePath(item));
      if (current.ultimoCanal !== channel && current.estado !== 'COMPLETADO') {
        current = await api(casePath(current) + '/retomar', 'POST', {
          canal: channel, versionEsperada: current.version, interaccionId: crypto.randomUUID(),
        });
      }
      await load(current);
      setView(channel);
      await list();
    });
  }

  function save(step) {
    run(async () => {
      const values = Object.fromEntries(Object.entries(data).filter(([, value]) => value));
      const current = await api(casePath(selected) + '/checkpoint', 'PUT', {
        pasoActual: step, canal: view, versionEsperada: selected.version, datos: values,
      });
      await load(current);
      await list();
      setNotice('Avance guardado.');
    });
  }

  const query = search.trim().toLowerCase();
  const visibleCases = cases.filter(item => [item.id, item.patientId, service(item), item.datos?.estudio, item.datos?.clinica].some(value => value?.toLowerCase().includes(query)));
  const node = selected && nodeOf(selected);
  const editable = selected && node && view !== 'TABLERO' && selected.estado !== 'COMPLETADO' && session?.rol !== 'ADMIN';
  const staffContinuation = session?.rol === 'ASESOR' && selected?.estado !== 'COMPLETADO';
  const staffCanEnter = view === 'TABLERO' || session?.rol === 'ASESOR';

  return <>
    <header><div className="top">
      <button className="brand" onClick={() => navigate('TABLERO')} disabled={busy}><span className="brandIcon"><Activity size={23}/></span><span>Salud Digna<small>Atención omnicanal</small></span></button>
      <div className="headerRight"><span className="demo">Entorno de simulación</span>{session && <button className="quiet" disabled={busy} onClick={() => {setSession(null); setCases([]); setSelected(null);}}>Cambiar sesión</button>}</div>
    </div><nav aria-label="Vistas de atención">
      {[['TABLERO', 'Tablero', LayoutDashboard], ...channels].map(([id, name, Icon]) => <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} disabled={busy} onClick={() => navigate(id)}><Icon size={17}/>{name}</button>)}
    </nav></header>

    <main>
      <section className={'intro ' + (view === 'WEB' ? 'portal' : '')}>
        <div><span className="eyebrow">{personal ? 'ATENCIÓN AL PACIENTE' : 'OPERACIÓN OMNICANAL'}</span>
          <h1>{view === 'TABLERO' ? 'Tablero de atención' : view === 'WEB' ? 'Agenda tus estudios' : channelName(view)}</h1>
          <p>{view === 'TABLERO' ? 'Consulta el avance de cada caso y retoma la atención en el paso guardado.' : personal ? 'Inicia una consulta o recupera tu trámite desde donde lo dejaste.' : 'Recupera el contexto del paciente y continúa su atención.'}</p></div>
        {view === 'WEB' && <HeartPulse className="heroIcon" size={120} strokeWidth={.85} aria-hidden="true"/>}
      </section>
      {error && <p role="alert" className="message error">{error}</p>}
      {notice && <p role="status" className="message success">{notice}</p>}
      {(!authorized || (!personal && !staffCanEnter)) ? <form className="panel login" onSubmit={signIn}>
        <UserRound size={25}/><h2>{personal ? 'Identificación del paciente' : 'Acceso del personal'}</h2>
        <p>Usa las credenciales de prueba del backend.</p>
        {personal ? <><label>CURP de prueba<input required maxLength={18} value={login.curp} onChange={e => setLogin({...login, curp:e.target.value})}/></label>
          <label>Teléfono<input required type="tel" value={login.telefono} onChange={e => setLogin({...login, telefono:e.target.value})}/></label></> :
          <>{view === 'TABLERO' && <label>Perfil<select value={login.rol} onChange={e => setLogin({...login, rol:e.target.value})}><option value="ASESOR">Asesor</option><option value="ADMIN">Administrador</option></select></label>}
          <label>Clave de {view === 'TABLERO' && login.rol === 'ADMIN' ? 'administrador' : 'asesor'}<input required type="password" value={login.clave} onChange={e => setLogin({...login, clave:e.target.value})}/></label></>}
        <button className="primary" disabled={busy}>Iniciar sesión</button>
      </form> : <>
        {!personal && <section className="metrics" aria-label="Resumen de casos">
          {[[ClipboardList, 'Casos cargados', cases.length], [Activity, 'En progreso', cases.filter(item => item.estado === 'EN_PROGRESO').length], [CalendarDays, 'Completados', cases.filter(item => item.estado === 'COMPLETADO').length]].map(([Icon, name, value]) => <div className="panel metric" key={name}><span className="badge"><Icon size={21}/></span><div><span>{name}</span><strong>{value}</strong></div></div>)}
        </section>}
        <div className={'workspace ' + (selected ? 'split' : '')}>
          <section className="panel listing">
            <div className="sectionHead"><div><h2>{personal ? 'Mis trámites' : 'Casos recientes'}</h2><p>{cases.length} casos disponibles</p></div>
              <button className="quiet" disabled={busy} onClick={() => run(async () => { await list(); if (selected) await load(selected); })}><RefreshCw size={16}/> Actualizar</button></div>
            {!personal && <label className="search"><Search size={18}/><input aria-label="Buscar casos" placeholder="Buscar estudio, clínica o identificador" value={search} onChange={e => setSearch(e.target.value)}/></label>}
            {!visibleCases.length && <p className="empty">{query ? 'No hay coincidencias.' : 'Todavía no hay casos.'}</p>}
            {visibleCases.map(item => <button key={item.id} className={'caseRow ' + (selected?.id === item.id ? 'selected' : '')} disabled={busy}
              onClick={() => run(() => load(item))}><span className="badge"><Stethoscope size={19}/></span><span className="rowCopy"><strong>{item.datos?.estudio || service(item)}</strong><small>{titleFor(item)} · {channelName(item.ultimoCanal)} · {item.id.slice(0,8)}</small></span><span className={'status ' + (item.estado === 'COMPLETADO' ? 'complete' : '')}>{label(item.estado)}</span></button>)}
          </section>
          {selected && <section className="panel detail">
            <div className="sectionHead"><div><span className="eyebrow">CASO {selected.id.slice(0,8).toUpperCase()}</span><h2>{service(selected)}</h2><p>{channelName(selected.ultimoCanal)} · {dateTime(selected.updatedAt)}</p></div><button className="quiet" disabled={busy} onClick={() => setSelected(null)}>Cerrar</button></div>
            <div className="checkpoint"><span>Paso guardado</span><strong>{titleFor(selected)}</strong></div>
            {view === 'TABLERO' && staffContinuation && <div className="actions">
              <button className="primary" disabled={busy} onClick={() => continueIn(selected, 'CALL_CENTER')}>Continuar en Call Center</button>
              <button className="quiet" disabled={busy} onClick={() => continueIn(selected, 'CLINICA')}>Continuar en Clínica</button>
            </div>}
            {editable && selected.ultimoCanal !== view ? <button className="primary" disabled={busy} onClick={() => continueIn(selected, view)}>Continuar en {channelName(view)}</button> :
              editable ? <><div className="fieldGrid">{fields.map(([key, name, type]) => <label key={key}>{name}<input type={type} maxLength={key === 'parentesco' ? 80 : 180} value={key === 'horario' ? (data[key] ?? '').slice(0,5) : data[key] ?? ''} onChange={e => setData({...data,[key]:e.target.value})}/></label>)}</div>
                <div className="actions"><button className="quiet" disabled={busy} onClick={() => save(selected.pasoActual)}>Guardar avance</button>
                {node.siguientes.map(step => <button className="primary" key={step} disabled={busy} onClick={() => save(step)}>{typeOf(selected).checkpoints.find(option => option.id === step)?.nombre ?? label(step)}</button>)}</div></> : null}
            {(!editable || selected.ultimoCanal !== view) && <dl className="context">{fields.map(([key, name]) => <div key={key}><dt>{name}</dt><dd>{selected.datos?.[key] || '—'}</dd></div>)}</dl>}
            <h3>Historial de atención</h3>
            {!events.length && <p>Sin eventos registrados.</p>}
            <ol className="timeline">{[...events].sort((a,b) => a.ocurridoAt.localeCompare(b.ocurridoAt) || (a.version ?? 0) - (b.version ?? 0)).map(event => <li key={event.id + ":" + event.version}><strong>{event.resumen || label(event.tipoEvento)}</strong><small>{channelName(event.canal)} · {dateTime(event.ocurridoAt)}{event.modoPersistencia ? ' · ' + event.modoPersistencia : ''}</small></li>)}</ol>
          </section>}
        </div>
        {personal && <section className="catalog"><h2>Servicios disponibles</h2><p>Selecciona un servicio para iniciar un trámite simulado.</p>
          <div className="services">{catalog.map(type => <button className="panel service" key={type.id} disabled={busy} onClick={() => begin(type)}><span className="badge"><Stethoscope size={21}/></span><strong>{type.nombre}</strong><Plus size={16}/></button>)}</div></section>}
      </>}
    </main><footer>Salud Digna · Prototipo HackaTec</footer>
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);

