import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronDown, MapPin, Search, Ticket, UserRound } from 'lucide-react';
import { api, casesPath, casePath } from './backendClient';
import { CaseBoard } from './CaseBoard';
import { WebRegistration } from './WebRegistration';
import logo from './salud-digna-logo.png';
import './style.css';

const channels = [
  ['WEB', 'Portal web'], ['WHATSAPP', 'WhatsApp'],
  ['CALL_CENTER', 'Call Center'], ['CLINICA', 'Clínica'],
];
const channelName = value => channels.find(([id]) => id === value)?.[1] ?? value;
const label = value => value?.toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ') ?? '';
const dateTime = value => value ? new Date(value).toLocaleString('es-MX') : '—';
const fields = [['estudio', 'Estudio', 'text'], ['clinica', 'Clínica', 'text'], ['fecha', 'Fecha', 'date'], ['horario', 'Horario', 'time'], ['parentesco', 'Parentesco', 'text']];
const initialLogin = { rol: 'ASESOR', clave: '' };
const webDemoCase = {
  id: 'DEMO-WEB-01', tipoConsultaId: 'ultrasonido', pasoActual: 'prerregistro',
  estado: 'INTERRUMPIDO', ultimoCanal: 'WHATSAPP',
  datos: { estudio: 'Ultrasonido', clinica: 'Chihuahua Nueva España', parentesco: 'Para mí' },
};
const webDemoEvents = [
  { id: 'inicio', canal: 'WHATSAPP', resumen: 'El paciente inició la solicitud de Ultrasonido.' },
  { id: 'clinica', canal: 'WHATSAPP', resumen: 'Seleccionó la clínica y dejó pendiente la cita.' },
];

function App() {
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('vista') === 'operador' ? 'OPERADOR' : 'PACIENTE');
  const [catalog, setCatalog] = useState([]);
  const [demoEmail, setDemoEmail] = useState('');
  const [session, setSession] = useState(null);
  const [login, setLogin] = useState(initialLogin);
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [events, setEvents] = useState([]);
  const [data, setData] = useState({});
  const [search, setSearch] = useState('');
  const [boardChannel, setBoardChannel] = useState('');
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState(null);
  const [patientFilter, setPatientFilter] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const personal = view === 'PACIENTE';
  useEffect(() => {
    if (!personal) api('/tipos-consulta').then(setCatalog).catch(e => setError(e.message));
  }, [personal]);
  const authorized = session && (personal ? session.rol === 'PACIENTE' : session.rol !== 'PACIENTE');
  const channel = personal ? 'WEB' : 'CALL_CENTER';
  const openCaseId = selected?.id;

  useEffect(() => {
    if (openCaseId) document.getElementById('detalle-caso')?.focus();
  }, [openCaseId]);

  useEffect(() => {
    if (personal || !authorized || busy) return;
    let active = true;
    let pending = false;
    const timer = window.setInterval(async () => {
      if (pending) return;
      pending = true;
      try {
        const latest = await api(listPath());
        if (active) setCases(latest);
      } catch {
        // Keep the last snapshot. Manual refresh reports API errors.
      } finally {
        pending = false;
      }
    }, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [personal, authorized, busy, session, patientFilter]);
  const typeOf = item => catalog.find(type => type.id === item.tipoConsultaId && type.version === item.flujoVersion);
  const nodeOf = item => typeOf(item)?.checkpoints.find(node => node.id === item.pasoActual);
  const service = item => typeOf(item)?.nombre ?? item.tipoConsultaId ?? 'Consulta';
  const titleFor = item => item.id === webDemoCase.id ? (item.estado === "COMPLETADO" ? "Prerregistro generado" : "Prerregistro pendiente") : nodeOf(item)?.nombre ?? label(item.pasoActual);

  async function run(action) {
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  function listPath(identity = session, filter = patientFilter) {
    const patientId = identity.rol === 'PACIENTE' ? identity.patientId : filter?.id;
    return patientId ? casesPath(patientId) + '?incluirCompletados=true' : '/tablero/casos';
  }

  async function list(identity = session, filter = patientFilter) {
    if (identity.rol !== "PACIENTE") setCases(await api(listPath(identity, filter)));
  }

  function findPatients(event) {
    event.preventDefault();
    run(async () => setPatientResults(await api('/pacientes?buscar=' + encodeURIComponent(patientQuery.trim()))));
  }

  function filterPatient(patient) {
    run(async () => {
      const result = await api(listPath(session, patient));
      setPatientFilter(patient);
      setSelected(null);
      setCases(result);
    });
  }

  async function load(item) {
    if (personal) {
      setSelected(item);
      setEvents(item.ultimoCanal === 'WEB'
        ? [...webDemoEvents, { id: 'web', canal: 'WEB', resumen: 'El paciente retomó el trámite desde el portal web.' }]
        : webDemoEvents);
      return item;
    }
    const current = await api(casePath(item));
    const timeline = await api(casePath(current) + '/eventos');
    setSelected(current);
    setEvents(timeline);
    setData(current.datos ?? {});
    return current;
  }

  function navigate(next) {
    setView(next);
    setRegistration(null);
    setDemoEmail('');
    setSelected(null);
    setSearch('');
    setPatientQuery('');
    setPatientResults(null);
    setPatientFilter(null);
    setError('');
    setNotice('');
  }

  function signIn(event) {
    event.preventDefault();
    if (personal) {
      setError('');
      setNotice('');
      setSelected(null);
      setCases([webDemoCase]);
      setSession({ rol: 'PACIENTE' });
      return;
    }
    run(async () => {
      const identity = await api('/demo/identidad/personal', 'POST', { rol: login.rol, clave: login.clave });
      setCases([]);
      setSession(identity);
      setLogin({ ...login, clave: '' });
      await list(identity);
    });
  }

  function continueIn(item, channel) {
    if (personal) {
      const resumed = { ...item, ultimoCanal: 'WEB', estado: 'EN_PROGRESO' };
      setCases(current => current.map(existing => existing.id === resumed.id ? resumed : existing));
      setRegistration(resumed);
      window.scrollTo(0, 0);
      return;
    }
    run(async () => {
      let current = await api(casePath(item));
      if (current.ultimoCanal !== channel && current.estado !== 'COMPLETADO') {
        current = await api(casePath(current) + '/retomar', 'POST', {
          canal: channel, versionEsperada: current.version, interaccionId: crypto.randomUUID(),
        });
      }
      await load(current);

      await list();
    });
  }

  function save(step) {
    run(async () => {
      const values = Object.fromEntries(Object.entries(data).filter(([, value]) => value));
      const current = await api(casePath(selected) + '/checkpoint', 'PUT', {
        pasoActual: step, canal: channel, versionEsperada: selected.version, datos: values,
      });
      await load(current);
      await list();
      setNotice('Avance guardado.');
    });
  }

  const query = search.trim().toLowerCase();
  const visibleCases = cases.filter(item => [item.id, item.patientId, service(item), item.datos?.estudio, item.datos?.clinica].some(value => value?.toLowerCase().includes(query)));
  const node = selected && nodeOf(selected);
  const editable = !personal && selected && node && selected.estado !== 'COMPLETADO' && session?.rol !== 'ADMIN';

  const patientSignIn = personal && !authorized;
  return <>
    {patientSignIn ? <header className="portalMasthead">
      <div className="portalTopLine"><div className="portalHeaderInner">
        <img src={logo} className="portalLogo" alt="Salud Digna"/>
        <div className="portalClinic"><MapPin size={16}/><div><strong>Selecciona una clínica</strong><small>Consulta disponibilidad</small></div><ChevronDown size={14}/></div>
        <div className="portalAudiences"><span className="portalAudienceActive"><UserRound size={14}/> Pacientes</span><span>Personal de atención</span></div>
      </div></div>
      <div className="portalHeaderInner portalMenu">
        <div className="portalSearch"><span>Buscar estudios o paquetes</span><Search size={16}/></div>
        <div className="portalMenuItems">
          <span>Inicio</span><span>Servicios <ChevronDown size={13}/></span><span>Clínicas</span>
          <span className="portalMenuActive"><UserRound size={15}/> Iniciar sesión</span>

        </div>
      </div>
    </header> : <header className="workspaceHeader"><div className="top">
      <button className="brand" onClick={() => navigate('PACIENTE')} disabled={busy}><img className="brandLogo" src={logo} alt="Salud Digna" width="166" height="59"/></button>
      <div className="headerRight"><span className="demo">Entorno de simulación</span>{session && <button className="quiet" disabled={busy} onClick={() => {setSession(null); setCases([]); setSelected(null); setRegistration(null);}}>Cambiar sesión</button>}</div>
    </div><nav aria-label="Vistas de atención">
      {[['PACIENTE', 'Paciente', UserRound]].map(([id, name, Icon]) => <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} disabled={busy} onClick={() => navigate(id)}><Icon size={17}/>{name}</button>)}
    </nav></header>}

    {personal && !authorized ? <main className="patientAccess">
      <div className="patientAccessShell">
      <section className="patientAccessCard" aria-labelledby="patientAccessTitle">
        <h1 id="patientAccessTitle">Iniciar sesión</h1>
        <p>Consulta tus trámites y retómalos desde el último paso guardado.</p>
                <form onSubmit={signIn}>
          <button className="ticketOption" type="submit" disabled={busy}>
            <Ticket size={17}/> {busy ? 'Abriendo tus procesos…' : 'Continuar con ticket'}
          </button>
        </form>
        <div className="demoLoginSeparator">o</div>
        <form onSubmit={event => {
          if (demoEmail.trim()) signIn(event);
          else event.preventDefault();
        }}>
          <input type="text" inputMode="email" aria-label="Correo electrónico" placeholder="Correo electrónico"
            value={demoEmail} onChange={event => setDemoEmail(event.target.value)}/>
          <button className="patientSubmit" type="submit" disabled={busy || !demoEmail.trim()}>
            {busy ? 'Abriendo tus procesos…' : 'Continuar'}
          </button>
        </form>
      </section>
      </div>
    </main> : personal && registration ? <WebRegistration item={registration}
      onBack={() => {setRegistration(null); void load(registration);}}
      onComplete={appointment => {
        const completed = { ...registration, estado: 'COMPLETADO', datos: { ...registration.datos, ...appointment } };
        setCases(current => current.map(item => item.id === completed.id ? completed : item));
        setRegistration(null);
        void load(completed);
        setNotice('Prerregistro simulado generado.');
      }}/> : <main className="portalWorkspace">
      <section className="intro">
        <div><span className="eyebrow">{personal ? 'ATENCIÓN AL PACIENTE' : 'OPERACIÓN OMNICANAL'}</span>
          <h1>{personal ? "Mis procesos" : "Tablero de Call Center"}</h1>
          <p>{personal ? "Consulta y continúa tus trámites." : "Busca al paciente y retoma su atención."}</p></div>
      </section>
      {error && <p role="alert" className="message error">{error}</p>}
      {notice && <p role="status" className="message success">{notice}</p>}
      {!personal && authorized && <section className="panel patientFinder" aria-label="Buscador de pacientes">
        <form onSubmit={findPatients}><label>Buscar paciente<input required maxLength={200} value={patientQuery} onChange={e => {setPatientQuery(e.target.value); setPatientResults(null);}} placeholder="Nombre, CURP, teléfono con lada o identificador"/></label>
          <button className="primary" disabled={busy || !patientQuery.trim()}>Buscar</button></form>
        {patientResults?.length === 0 && <p>No se encontraron pacientes.</p>}
        {patientResults?.length > 0 && <ul>{patientResults.map(patient => <li key={patient.id}><button className="quiet" disabled={busy} onClick={() => filterPatient(patient)}>{patient.nombreCompleto} · {patient.id.slice(0, 8)}</button></li>)}</ul>}
        {patientFilter && <div className="actions"><strong>{patientFilter.nombreCompleto}</strong><button className="quiet" disabled={busy} onClick={() => filterPatient(null)}>Ver todos los casos</button></div>}
      </section>}
      <CaseBoard cases={authorized ? cases : []} visibleCases={authorized ? visibleCases : []}
        search={search} onSearch={setSearch} channel={boardChannel} onChannel={setBoardChannel}
        channels={channels} channelName={channelName} service={service} titleFor={titleFor}
        personal={personal} selected={selected} authorized={authorized} role={session?.rol} busy={busy}
        onRefresh={() => run(async () => { await list(); if (selected) await load(selected); })}
        onOpen={item => run(() => load(item))} onContinue={continueIn}/>
      {!authorized ? <form id="acceso" className="panel login" onSubmit={signIn}>
        <UserRound size={25}/><h2>Acceso del personal</h2>
        <p>Usa las credenciales de prueba del backend.</p>
        <label>Perfil<select value={login.rol} onChange={e => setLogin({...login, rol:e.target.value})}><option value="ASESOR">Asesor</option><option value="ADMIN">Administrador</option></select></label>
          <label>Clave de {login.rol === 'ADMIN' ? 'administrador' : 'asesor'}<input required type="password" value={login.clave} onChange={e => setLogin({...login, clave:e.target.value})}/></label>
        <button className="primary" disabled={busy}>Iniciar sesión</button>
      </form> : <>
        <div className="workspace">          {selected && <section id="detalle-caso" tabIndex={-1} aria-label="Detalle del caso" className="panel detail boardDetail">
            <div className="sectionHead"><div><span className="eyebrow">CASO {selected.id.slice(0,8).toUpperCase()}</span><h2>{service(selected)}</h2><p>{channelName(selected.ultimoCanal)} · {dateTime(selected.updatedAt)}</p></div><button className="quiet" disabled={busy} onClick={() => setSelected(null)}>Cerrar</button></div>
            {!personal && <p>Identificador del paciente · {selected.patientId}</p>}
            <div className="checkpoint"><span>Paso guardado</span><strong>{titleFor(selected)}</strong></div>
            {editable && selected.ultimoCanal !== channel ? <button className="primary" disabled={busy} onClick={() => continueIn(selected, channel)}>Continuar en {channelName(channel)}</button> :
              editable ? <><div className="fieldGrid">{fields.map(([key, name, type]) => <label key={key}>{name}<input type={type} maxLength={key === 'parentesco' ? 80 : 180} value={key === 'horario' ? (data[key] ?? '').slice(0,5) : data[key] ?? ''} onChange={e => setData({...data,[key]:e.target.value})}/></label>)}</div>
                <div className="actions"><button className="quiet" disabled={busy} onClick={() => save(selected.pasoActual)}>Guardar avance</button>
                {node.siguientes.map(step => <button className="primary" key={step} disabled={busy} onClick={() => save(step)}>{typeOf(selected).checkpoints.find(option => option.id === step)?.nombre ?? label(step)}</button>)}</div></> : null}
            {(!editable || selected.ultimoCanal !== channel) && <dl className="context">{fields.map(([key, name]) => <div key={key}><dt>{name}</dt><dd>{selected.datos?.[key] || '—'}</dd></div>)}</dl>}
            {personal && <div className="checkpoint"><span>Iniciado en WhatsApp</span><strong>{selected.estado === "COMPLETADO" ? "Prerregistro generado" : "Siguiente paso: elegir fecha y horario"}</strong></div>}
            <h3>Historial de atención</h3>
            {!events.length && <p>Sin eventos registrados.</p>}
            <ol className="timeline">{[...events].sort((a,b) => (a.ocurridoAt ?? "").localeCompare(b.ocurridoAt ?? "") || (a.version ?? 0) - (b.version ?? 0)).map(event => <li key={event.id + ":" + event.version}><strong>{event.resumen || label(event.tipoEvento)}</strong><small>{channelName(event.canal)}{event.ocurridoAt ? " · " + dateTime(event.ocurridoAt) : ""}{event.modoPersistencia ? ' · ' + event.modoPersistencia : ''}</small></li>)}</ol>
          </section>}
        </div>

      </>}
    </main>}
    {patientSignIn ? <footer className="patientFooter">
      <div><strong>Portal de atención</strong><p>Consulta y seguimiento de trámites</p></div>
      <div><strong>Canales</strong><p>Portal web · Call Center</p></div>
      <small>Prototipo HackaTec · Entorno de simulación</small>
    </footer> : <footer>Prototipo HackaTec</footer>}
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
