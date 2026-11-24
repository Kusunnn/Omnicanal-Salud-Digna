import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronDown, MapPin, Search, Ticket, UserRound } from 'lucide-react';
import { CaseBoard } from './CaseBoard';
import { WebCaseFlow } from './WebCaseFlow';
import { ServicesHome, webServices } from './ServicesHome';
import { api as backendApi, casesPath, casePath } from './backendClient';
import { demoApi } from './demoClient';
import logo from './salud-digna-logo.png';
import './style.css';

const api = import.meta.env.VITE_USE_BACKEND === 'true' ? backendApi : demoApi;

const channels = [
  ['WEB', 'Portal web'], ['WHATSAPP', 'WhatsApp'],
  ['CALL_CENTER', 'Call Center'], ['CLINICA', 'Clínica'],
];
const channelName = value => channels.find(([id]) => id === value)?.[1] ?? value;
const demoPatient = {
  id: 'DEMO-PACIENTE-01', nombreCompleto: 'Teresa Ramírez Pérez',
  curp: 'DEMO00000000000001', telefono: '+520000000001',
};
const searchablePatient = text => text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function App() {
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('vista') === 'operador' ? 'OPERADOR' : 'PACIENTE');
  const [demoEmail, setDemoEmail] = useState('');
  const [session, setSession] = useState(null);
  const [cases, setCases] = useState([]);
  const [registration, setRegistration] = useState(null);
  const [search, setSearch] = useState('');
  const [boardChannel, setBoardChannel] = useState('');
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState(null);
  const [patientFilter, setPatientFilter] = useState(null);
  const [notice, setNotice] = useState('');
  const [screen, setScreen] = useState('servicios');
  const [servicesOpen, setServicesOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const personal = view === 'PACIENTE';
  const authorized = !personal || session;
  const service = item => item.datos?.estudio ?? 'Consulta';
  const stepNames = { inicio: 'Inicio', cotizado: 'Cotización guardada', 'clinica-seleccionada': 'Clínica seleccionada', 'horario-seleccionado': 'Horario seleccionado', 'cita-confirmada': 'Cita confirmada' };
  const titleFor = item => stepNames[item.pasoActual] ?? item.pasoActual;

  async function run(action) {
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); }
    catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }

  async function demoSession() {
    return api('/demo/identidad/paciente', 'POST', { curp: demoPatient.curp, telefono: demoPatient.telefono });
  }

  const patientId = session?.patientId;
  useEffect(() => {
    if (!patientId || registration || busy) return;
    let active = true;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const result = await api(casesPath(patientId) + '?incluirCompletados=true');
        if (active) setCases(result);
      } catch (exception) {
        if (active) setError(exception.message);
      } finally { pending = false; }
    }
    void refresh();
    const timer = setInterval(refresh, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [patientId, registration, busy]);

  useEffect(() => {
    if (!personal && !session) void run(async () => setSession(await demoSession()));
  }, [personal, session]);

  function findPatients(event) {
    event.preventDefault();
    const query = searchablePatient(patientQuery);
    const match = Object.values(demoPatient).some(value => searchablePatient(value).includes(query));
    setPatientResults(query && match && patientId ? [{ ...demoPatient, id: patientId }] : []);
  }

  function filterPatient(patient) {
    setPatientFilter(patient);
  }
  function navigate(next) {
    setView(next);
    setServicesOpen(false);
    setScreen('servicios');
    setRegistration(null);
    setDemoEmail('');
    setSearch('');
    setPatientQuery('');
    setPatientResults(null);
    setPatientFilter(null);
    setNotice('');
  }

  function signIn(event) {
    event.preventDefault();
    setNotice('');
    void run(async () => { setSession(await demoSession()); setScreen('servicios'); });
  }
  function updateCase(item) {
    setCases(current => current.some(existing => existing.id === item.id)
      ? current.map(existing => existing.id === item.id ? item : existing) : [item, ...current]);
  }

  function chooseService(tipoConsultaId, estudio) {
    if (!patientId || busy) return;
    setServicesOpen(false);
    void run(async () => {
      const item = await api(casesPath(patientId), 'POST', { tipoConsultaId, canal: 'WEB', datos: { estudio } });
      updateCase(item);
      setRegistration(item);
      window.scrollTo(0, 0);
    });
  }

  function continueInWeb(item) {
    void run(async () => {
      let current = await api(casePath(item));
      if (current.ultimoCanal !== 'WEB' && current.estado !== 'COMPLETADO') {
        current = await api(casePath(item) + '/retomar', 'POST', {
          canal: 'WEB', versionEsperada: current.version, interaccionId: crypto.randomUUID(),
        });
      }
      updateCase(current);
      if (current.estado !== 'COMPLETADO') setRegistration(current);
      window.scrollTo(0, 0);
    });
  }

  function saveCheckpoint(datos, confirm, exit = false) {
    if (busy) return;
    void run(async () => {
      const checkpoints = ['inicio', 'cotizado', 'clinica-seleccionada', 'horario-seleccionado', 'cita-confirmada'];
      let current = registration;
      const start = checkpoints.indexOf(current.pasoActual);
      if (start < 0) throw new Error('Este paso no se puede actualizar desde el formulario de cita.');
      const data = { ...current.datos, ...datos };
      const target = confirm ? 4 : data.clinica && data.fecha && data.horario ? 3 : data.clinica ? 2 : 1;
      const steps = checkpoints.slice(start + 1, Math.max(start, target) + 1);
      for (const pasoActual of steps.length ? steps : [current.pasoActual]) {
        current = await api(casePath(current) + '/checkpoint', 'PUT', {
          pasoActual, datos, canal: 'WEB', versionEsperada: current.version,
        });
        updateCase(current);
        setRegistration(current);
      }
      if (!confirm && !exit) return;
      setRegistration(null);
      setScreen('procesos');
      setNotice(confirm ? 'Cita simulada confirmada.' : 'Avance guardado. Puedes continuar después.');
      window.scrollTo(0, 0);
    });
  }
  const query = search.trim().toLowerCase();
  const visibleCases = cases.filter(item => (!patientFilter || item.patientId === patientFilter.id) && [item.id, item.patientId, service(item), item.datos?.estudio, item.datos?.clinica].some(value => value?.toLowerCase().includes(query)));

  const hasPendingCases = cases.some(item => item.patientId === patientId && item.estado !== 'COMPLETADO'
    && !['cita-confirmada', 'cita-confirmada-con-pago', 'resumen-cita', 'resumen-cita-con-pago',
      'resumen-requisitos', 'resumen-visita', 'resumen-estudios'].includes(item.pasoActual));
  const patientSignIn = personal && !authorized;
  return <>
    {personal || registration ? <header className="portalMasthead">
      <div className="portalTopLine"><div className="portalHeaderInner">
        <img src={logo} className="portalLogo" alt="Salud Digna"/>
        <div className="portalClinic"><MapPin size={16}/><div><strong>Selecciona una clínica</strong><small>Consulta disponibilidad</small></div><ChevronDown size={14}/></div>
        <div className="portalAudiences"><span className="portalAudienceActive"><UserRound size={14}/> Pacientes</span><span>Personal de atención</span></div>
      </div></div>
      <div className="portalHeaderInner portalMenu">
        <div className="portalSearch"><span>Buscar estudios o paquetes</span><Search size={16}/></div>
        <div className="portalMenuItems">
                    <span>Inicio</span>
          {session && !registration ? <div className="portalServicesMenu" onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setServicesOpen(false);
          }} onKeyDown={event => {
            if (event.key === 'Escape' && servicesOpen) {
              setServicesOpen(false);
              event.currentTarget.querySelector('button')?.focus();
            }
          }}>
            <button className="portalTextAction" type="button" aria-expanded={servicesOpen} aria-controls="menu-servicios"
              onClick={() => setServicesOpen(open => !open)}>Servicios <ChevronDown size={13}/></button>
            <ul id="menu-servicios" className="portalServicesList" hidden={!servicesOpen}>
              {webServices.map(({ id, nombre, Icon }) => <li key={id}>
                <button type="button" disabled={busy} onClick={() => chooseService(id, nombre)}><Icon size={17}/>{nombre}</button>
              </li>)}
            </ul>
          </div> : <span>Servicios <ChevronDown size={13}/></span>}
          <span>Clínicas</span>
                    {patientSignIn ? <span className="portalMenuActive"><UserRound size={15}/> Iniciar sesión</span> :
            <button className="portalTextAction" disabled={Boolean(registration)} onClick={() => {setScreen('procesos'); setError('');}}><UserRound size={15}/> Pendientes{hasPendingCases && <span className="pendingDot" role="img" aria-label="Hay trámites pendientes"/>}</button>}

        </div>
      </div>
    </header> : <header className="workspaceHeader"><div className="top">
      <button className="brand" onClick={() => navigate('PACIENTE')}><img className="brandLogo" src={logo} alt="Salud Digna" width="166" height="59"/></button>
      <div className="headerRight"><span className="demo">Entorno de simulación</span>{personal && session && <button className="quiet" onClick={() => {setSession(null); setRegistration(null);}}>Cambiar sesión</button>}</div>
    </div><nav aria-label="Vistas de atención">
      {[['PACIENTE', 'Paciente', UserRound]].map(([id, name, Icon]) => <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={17}/>{name}</button>)}
    </nav></header>}

    {personal && !authorized ? <main className="patientAccess">
      <div className="patientAccessShell">
      <section className="patientAccessCard" aria-labelledby="patientAccessTitle">
        <h1 id="patientAccessTitle">Iniciar sesión</h1>
        <p>Consulta tus trámites y retómalos desde el último paso guardado.</p>
        {error && <p role="alert" className="message error">{error}</p>}
                <form onSubmit={signIn}>
          <button className="ticketOption" type="submit" disabled={busy}>
            <Ticket size={17}/> Continuar con ticket
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
            Continuar
          </button>
        </form>
      </section>
      </div>
    </main> : registration ? <WebCaseFlow key={registration.id} item={registration}
      busy={busy} error={error} onSave={saveCheckpoint}
      onBack={data => {if (data) saveCheckpoint(data, false, true); else {setRegistration(null); setScreen('procesos'); setError('');}}}/> :
      personal && screen === 'servicios' ? <ServicesHome onChoose={chooseService} busy={busy} error={error}/> :<main className="portalWorkspace">
      <section className="intro">
        <div><span className="eyebrow">{personal ? 'ATENCIÓN AL PACIENTE' : 'OPERACIÓN OMNICANAL'}</span>
          <h1>{personal ? "Mis procesos" : "Tablero de Call Center"}</h1>
          <p>{personal ? "Consulta y continúa tus trámites." : "Busca al paciente y retoma su atención."}</p></div>
      </section>
      {error && <p role="alert" className="message error">{error}</p>}
      {notice && <p role="status" className="message success">{notice}</p>}
      {!personal && authorized && <section className="panel patientFinder" aria-label="Buscador de pacientes">
        <form onSubmit={findPatients}><label>Buscar paciente<input required maxLength={200} value={patientQuery} onChange={e => {setPatientQuery(e.target.value); setPatientResults(null);}} placeholder="Nombre, CURP, teléfono con lada o identificador"/></label>
          <button className="primary" disabled={busy || !patientId || !patientQuery.trim()}>Buscar</button></form>
        {patientResults?.length === 0 && <p>No se encontraron pacientes.</p>}
        {patientResults?.length > 0 && <ul>{patientResults.map(patient => <li key={patient.id}><button className="quiet" onClick={() => filterPatient(patient)}>{patient.nombreCompleto} · {patient.id.slice(0, 8)}</button></li>)}</ul>}
        {patientFilter && <div className="actions"><strong>{patientFilter.nombreCompleto}</strong><button className="quiet" onClick={() => filterPatient(null)}>Ver todos los casos</button></div>}
      </section>}
      <CaseBoard cases={authorized ? cases : []} visibleCases={authorized ? visibleCases : []}
        search={search} onSearch={setSearch} channel={boardChannel} onChannel={setBoardChannel}
        channels={channels} channelName={channelName} service={service} titleFor={titleFor}
        personal={personal} authorized={authorized} role="ASESOR" busy={busy}
        onContinue={continueInWeb}/>
    </main>}
    {patientSignIn ? <footer className="patientFooter">
      <div><strong>Portal de atención</strong><p>Consulta y seguimiento de trámites</p></div>
      <div><strong>Canales</strong><p>Portal web · Call Center</p><a className="quiet staffFooterLink" href="?vista=operador">Acceso de operador</a></div>
      <small>Prototipo HackaTec · Entorno de simulación</small>
    </footer> : <footer>Prototipo HackaTec</footer>}
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
