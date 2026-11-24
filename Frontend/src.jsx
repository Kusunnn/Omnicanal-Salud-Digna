import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronDown, MapPin, Search, Ticket, UserRound } from 'lucide-react';
import { CaseBoard } from './CaseBoard';
import { WebRegistration } from './WebRegistration';
import logo from './salud-digna-logo.png';
import './style.css';

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
const webDemoCase = {
  id: 'DEMO-WEB-01', patientId: demoPatient.id, tipoConsultaId: 'ultrasonido', pasoActual: 'prerregistro',
  estado: 'INTERRUMPIDO', ultimoCanal: 'WHATSAPP',
  datos: { estudio: 'Ultrasonido', clinica: 'Chihuahua Nueva España', parentesco: 'Para mí' },
};
function App() {
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('vista') === 'operador' ? 'OPERADOR' : 'PACIENTE');
  const [demoEmail, setDemoEmail] = useState('');
  const [session, setSession] = useState(null);
  const [cases, setCases] = useState([webDemoCase]);
  const [registration, setRegistration] = useState(null);
  const [search, setSearch] = useState('');
  const [boardChannel, setBoardChannel] = useState('');
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState(null);
  const [patientFilter, setPatientFilter] = useState(null);
  const [notice, setNotice] = useState('');

  const personal = view === 'PACIENTE';
  const authorized = !personal || session;
  const service = item => item.datos?.estudio ?? 'Consulta';
  const titleFor = item => item.estado === 'COMPLETADO' ? 'Prerregistro generado' : 'Prerregistro pendiente';

  function findPatients(event) {
    event.preventDefault();
    const query = searchablePatient(patientQuery);
    const match = Object.values(demoPatient).some(value => searchablePatient(value).includes(query));
    setPatientResults(query && match ? [demoPatient] : []);
  }

  function filterPatient(patient) {
    setPatientFilter(patient);
  }
  function navigate(next) {
    setView(next);
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
    setSession(true);
  }
  function continueInWeb(item) {
    const resumed = {
      ...item, ultimoCanal: 'WEB', estado: 'EN_PROGRESO',
      datos: { ...item.datos, estudio: item.datos?.estudio || service(item) },
    };
    setCases(current => current.map(existing => existing.id === resumed.id ? resumed : existing));
    setRegistration(resumed);
    setNotice('');
    window.scrollTo(0, 0);
  }
  const query = search.trim().toLowerCase();
  const visibleCases = cases.filter(item => (!patientFilter || item.patientId === patientFilter.id) && [item.id, item.patientId, service(item), item.datos?.estudio, item.datos?.clinica].some(value => value?.toLowerCase().includes(query)));

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
                <form onSubmit={signIn}>
          <button className="ticketOption" type="submit">
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
          <button className="patientSubmit" type="submit" disabled={!demoEmail.trim()}>
            Continuar
          </button>
        </form>
      </section>
      </div>
    </main> : registration ? <WebRegistration item={registration} operator={!personal}
      onBack={() => setRegistration(null)}
      onComplete={appointment => {
        const completed = { ...registration, estado: 'COMPLETADO', datos: { ...registration.datos, ...appointment } };
        setCases(current => current.map(item => item.id === completed.id ? completed : item));
        setRegistration(null);
        setNotice('Prerregistro simulado generado.');
      }}/> : <main className="portalWorkspace">
      <section className="intro">
        <div><span className="eyebrow">{personal ? 'ATENCIÓN AL PACIENTE' : 'OPERACIÓN OMNICANAL'}</span>
          <h1>{personal ? "Mis procesos" : "Tablero de Call Center"}</h1>
          <p>{personal ? "Consulta y continúa tus trámites." : "Busca al paciente y retoma su atención."}</p></div>
      </section>
      {notice && <p role="status" className="message success">{notice}</p>}
      {!personal && authorized && <section className="panel patientFinder" aria-label="Buscador de pacientes">
        <form onSubmit={findPatients}><label>Buscar paciente<input required maxLength={200} value={patientQuery} onChange={e => {setPatientQuery(e.target.value); setPatientResults(null);}} placeholder="Nombre, CURP, teléfono con lada o identificador"/></label>
          <button className="primary" disabled={!patientQuery.trim()}>Buscar</button></form>
        {patientResults?.length === 0 && <p>No se encontraron pacientes.</p>}
        {patientResults?.length > 0 && <ul>{patientResults.map(patient => <li key={patient.id}><button className="quiet" onClick={() => filterPatient(patient)}>{patient.nombreCompleto} · {patient.id.slice(0, 8)}</button></li>)}</ul>}
        {patientFilter && <div className="actions"><strong>{patientFilter.nombreCompleto}</strong><button className="quiet" onClick={() => filterPatient(null)}>Ver todos los casos</button></div>}
      </section>}
      <CaseBoard cases={authorized ? cases : []} visibleCases={authorized ? visibleCases : []}
        search={search} onSearch={setSearch} channel={boardChannel} onChannel={setBoardChannel}
        channels={channels} channelName={channelName} service={service} titleFor={titleFor}
        personal={personal} authorized={authorized} role="ASESOR"
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
