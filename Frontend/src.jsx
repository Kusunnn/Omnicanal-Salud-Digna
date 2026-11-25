import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronDown, MapPin, Search, Ticket, UserRound } from 'lucide-react';
import { CaseBoard } from './CaseBoard';
import { AdminStats } from './AdminStats';
import { DeleteCaseDialog } from './DeleteCaseDialog';
import { VerifyPatientDialog } from './VerifyPatientDialog';
import { WebCaseFlow } from './WebCaseFlow';
import { ServicesHome, webServices } from './ServicesHome';
import { api as backendApi, casesPath, casePath } from './backendClient';
import { demoApi } from './demoClient';
import logo from './salud-digna-logo.png';
import './style.css';

const backendEnabled = import.meta.env.VITE_USE_BACKEND === 'true';

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
  const [view] = useState(() => {
    const route = new URLSearchParams(window.location.search).get('vista');
    return route === 'admin' ? 'ADMIN' : route === 'operador' ? 'OPERADOR' : 'PACIENTE';
  });
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
  const admin = view === 'ADMIN';
  const api = backendEnabled
    ? (path, method, body) => backendApi(path, method, body, admin ? '/admin-api' : '/api')
    : demoApi;
  const backRef = useRef(null);
  const destination = useRef(null);
  const [caseToDelete, setCaseToDelete] = useState(null);
  const [caseToVerify, setCaseToVerify] = useState(null);
  const [nextService, setNextService] = useState(null);
  const authorized = admin ? session?.rol === 'ADMIN' : !personal || session?.rol === 'PACIENTE';
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
    if ((admin ? !authorized : !patientId) || registration || busy) return;
    let active = true;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const result = await api(admin ? '/tablero/casos?limite=100' : casesPath(patientId) + '?incluirCompletados=true');
        if (active) setCases(result);
      } catch (exception) {
        if (active) setError(exception.message);
      } finally { pending = false; }
    }
    void refresh();
    const timer = setInterval(refresh, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [admin, authorized, patientId, registration, busy]);

  useEffect(() => {
    if (admin && !session) {
      void run(async () => setSession(await api(backendEnabled ? '/demo/session' : '/demo/identidad/personal', 'POST', { rol: 'ADMIN' })));
    } else if (!personal && !admin && !session) {
      void run(async () => setSession(await demoSession()));
    }
  }, [personal, admin, session]);

  function findPatients(event) {
    event.preventDefault();
    const query = searchablePatient(patientQuery);
    const match = Object.values(demoPatient).some(value => searchablePatient(value).includes(query));
    setPatientResults(query && match && patientId ? [{ ...demoPatient, id: patientId }] : []);
  }

  function filterPatient(patient) {
    setPatientFilter(patient);
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

  useEffect(() => {
    if (!nextService || registration || busy) return;
    setNextService(null);
    chooseService(nextService.tipoConsultaId, nextService.estudio);
  }, [nextService, registration, busy]);

  function openPatientScreen(screenName) {
    if (busy) return;
    setServicesOpen(false);
    setError('');
    if (registration) {
      destination.current = screenName;
      backRef.current?.click();
    } else setScreen(screenName);
  }

  function returnToLogin() {
    if (busy) return;
    if (registration) {
      destination.current = 'login';
      backRef.current?.click();
    } else window.location.assign('./');
  }

  function closeRegistration(defaultScreen = 'procesos') {
    const screenName = destination.current ?? defaultScreen;
    destination.current = null;
    if (screenName === 'login') { window.location.assign('./'); return; }
    setRegistration(null);
    setScreen(screenName);
  }

  function deleteCase() {
    if (!caseToDelete || busy) return;
    void run(async () => {
      await api(casePath(caseToDelete), 'DELETE');
      setCases(current => current.filter(item => item.id !== caseToDelete.id));
      setCaseToDelete(null);
      setNotice('Trámite eliminado de tus pendientes.');
    });
  }

  function selectService(tipoConsultaId, estudio) {
    if (busy) return;
    if (!registration) return chooseService(tipoConsultaId, estudio);
    setServicesOpen(false);
    setNextService({ tipoConsultaId, estudio });
    backRef.current?.click();
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

  function continueInWeb(item, birthDate) {
    void run(async () => {
      if (!personal && !admin) {
        await api(casePath(item) + '/verificar-fecha-nacimiento', 'POST', { fechaNacimiento: birthDate });
      }
      let current = await api(casePath(item));
      if (current.ultimoCanal !== 'WEB' && current.estado !== 'COMPLETADO') {
        current = await api(casePath(item) + '/retomar', 'POST', {
          canal: 'WEB', versionEsperada: current.version, interaccionId: crypto.randomUUID(),
        });
      }
      updateCase(current);
      setCaseToVerify(null);
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
      closeRegistration();
      setNotice(confirm ? 'Cita simulada confirmada.' : 'Avance guardado. Puedes continuar después.');
      window.scrollTo(0, 0);
    });
  }
  const query = search.trim().toLowerCase();
  const confirmedSteps = ['cita-confirmada', 'cita-confirmada-con-pago', 'resumen-cita', 'resumen-cita-con-pago',
    'resumen-requisitos', 'resumen-visita', 'resumen-estudios'];
  const boardCases = cases.map(item => confirmedSteps.includes(item.pasoActual) ? { ...item, estado: 'COMPLETADO' } : item);
  const visibleCases = boardCases.filter(item => (!patientFilter || item.patientId === patientFilter.id) && [item.id, item.patientId, service(item), item.datos?.estudio, item.datos?.clinica].some(value => value?.toLowerCase().includes(query)));

  const hasPendingCases = cases.some(item => item.patientId === patientId && item.estado !== 'COMPLETADO'
    && !['cita-confirmada', 'cita-confirmada-con-pago', 'resumen-cita', 'resumen-cita-con-pago',
      'resumen-requisitos', 'resumen-visita', 'resumen-estudios'].includes(item.pasoActual));
  const patientSignIn = personal && !authorized;
  return <>
    {personal || registration ? <header className="portalMasthead">
      <div className="portalTopLine"><div className="portalHeaderInner">
        <button type="button" className="logoHome" aria-label="Salud Digna, volver al inicio de sesión" onClick={returnToLogin} disabled={busy}><img src={logo} className="portalLogo" alt=""/></button>
        <div className="portalClinic"><MapPin size={16}/><div><strong>Selecciona una clínica</strong><small>Consulta disponibilidad</small></div><ChevronDown size={14}/></div>
        <div className="portalAudiences"><span className="portalAudienceActive"><UserRound size={14}/> Pacientes</span><span>Personal de atención</span></div>
      </div></div>
      <div className="portalHeaderInner portalMenu">
        <div className="portalSearch"><span>Buscar estudios o paquetes</span><Search size={16}/></div>
        <div className="portalMenuItems">
                    {session ? <button type="button" className="portalTextAction" disabled={busy}
            onClick={() => openPatientScreen('servicios')}
            aria-current={!registration && screen === 'servicios' ? 'page' : undefined}>Inicio</button> : <span>Inicio</span>}
          {personal && session ? <div className="portalServicesMenu" onBlur={event => {
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
                <button type="button" disabled={busy} onClick={() => selectService(id, nombre)}><Icon size={17}/>{nombre}</button>
              </li>)}
            </ul>
          </div> : <span>Servicios <ChevronDown size={13}/></span>}
          <span>Clínicas</span>
                    {patientSignIn ? <span className="portalMenuActive"><UserRound size={15}/> Iniciar sesión</span> :
            <button className="portalTextAction" disabled={busy} onClick={() => openPatientScreen('procesos')}><UserRound size={15}/> Pendientes{hasPendingCases && <span className="pendingDot" role="img" aria-label="Hay trámites pendientes"/>}</button>}

        </div>
      </div>
    </header> : <header className="workspaceHeader"><div className="top">
      <button type="button" className="logoHome" aria-label="Salud Digna, volver al inicio de sesión" onClick={returnToLogin} disabled={busy}><img className="brandLogo" src={logo} alt="" width="166" height="59"/></button>
      <div className="headerRight"><span className="demo">Entorno de simulación</span>{personal && session && <button className="quiet" onClick={() => {setSession(null); setRegistration(null);}}>Cambiar sesión</button>}</div>
    </div></header>}

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
    </main> : registration ? <WebCaseFlow key={registration.id} item={registration} operator={!personal}
      busy={busy} error={error} onSave={saveCheckpoint} backRef={backRef}
      onBack={data => {if (data) saveCheckpoint(data, false, true); else {closeRegistration(); setError('');}}}/> :
      personal && screen === 'servicios' ? <ServicesHome onChoose={chooseService} busy={busy} error={error}/> :<main className={personal ? "portalWorkspace" : "portalWorkspace staffWorkspace"}>
      <section className="intro">
        <div><span className="eyebrow">{personal ? 'ATENCIÓN AL PACIENTE' : 'OPERACIÓN OMNICANAL'}</span>
          <h1>{personal ? "Mis procesos" : admin ? "Panel de administración" : "Tablero de Call Center"}</h1>
          <p>{personal ? "Consulta y continúa tus trámites." : admin ? "Revisa el avance por paso y canal, y continúa los casos pendientes." : "Busca al paciente y retoma su atención."}</p></div>
      </section>
      {error && <p role="alert" className="message error">{error}</p>}
      {notice && <p role="status" className="message success">{notice}</p>}
      {!personal && !admin && authorized && <section className="panel patientFinder" aria-label="Buscador de pacientes">
        <form onSubmit={findPatients}><label>Buscar paciente<input required maxLength={200} value={patientQuery} onChange={e => {setPatientQuery(e.target.value); setPatientResults(null);}} placeholder="Nombre, CURP, teléfono con lada o identificador"/></label>
          <button className="primary" disabled={busy || !patientId || !patientQuery.trim()}>Buscar</button></form>
        {patientResults?.length === 0 && <p>No se encontraron pacientes.</p>}
        {patientResults?.length > 0 && <ul>{patientResults.map(patient => <li key={patient.id}><button className="quiet" onClick={() => filterPatient(patient)}>{patient.nombreCompleto} · {patient.id.slice(0, 8)}</button></li>)}</ul>}
        {patientFilter && <div className="actions"><strong>{patientFilter.nombreCompleto}</strong><button className="quiet" onClick={() => filterPatient(null)}>Ver todos los casos</button></div>}
      </section>}
      {admin && !authorized ? <p role="status">{busy ? "Conectando con el tablero…" : "La sesión de administración local no está disponible."}</p> : <>
      {admin && <AdminStats cases={boardCases} titleFor={titleFor} channelName={channelName}/>}
      <CaseBoard cases={authorized ? boardCases : []} visibleCases={authorized ? visibleCases : []}
        search={search} onSearch={setSearch} channel={boardChannel} onChannel={setBoardChannel}
        channels={channels} channelName={channelName} service={service} titleFor={titleFor}
        personal={personal} admin={admin} authorized={authorized} role={admin ? "ADMIN" : "ASESOR"} busy={busy}
                onContinue={item => {
                  if (personal || admin) continueInWeb(item);
                  else {setError(''); setCaseToVerify(item);}
                }} onDelete={personal || admin ? item => {setError(''); setCaseToDelete(item);} : undefined}/></>}
      {caseToVerify && <VerifyPatientDialog item={caseToVerify} error={error} busy={busy}
        onCancel={() => {setCaseToVerify(null); setError('');}}
        onVerify={date => continueInWeb(caseToVerify, date)}/>}
      {caseToDelete && <DeleteCaseDialog item={caseToDelete} title={titleFor(caseToDelete)} channel={channelName(caseToDelete.ultimoCanal)}
        busy={busy} error={error} onCancel={() => {setCaseToDelete(null); setError('');}} onDelete={deleteCase}/>}
    </main>}
    {patientSignIn ? <footer className="patientFooter">
      <div><strong>Portal de atención</strong><p>Consulta y seguimiento de trámites</p></div>
      <div><strong>Canales</strong><p>Portal web · Call Center</p><a className="quiet staffFooterLink" href="?vista=operador">Acceso de operador</a> <a className="quiet staffFooterLink" href="?vista=admin">Administración</a></div>
      <small>Prototipo HackaTec · Entorno de simulación</small>
    </footer> : <footer className={!personal ? "internalFooter" : undefined}><span>Prototipo HackaTec</span>{!personal && !registration && <a className="quiet staffFooterLink" href="./">Volver a inicio</a>}</footer>}
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
