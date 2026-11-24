import React from 'react';
import { ArrowUpRight, Headset, LayoutDashboard, LockKeyhole, Monitor, MapPin, RefreshCw, Search, Stethoscope } from 'lucide-react';

const columns = [
  { id: 'EN_PROGRESO', title: 'En progreso', color: 'progress' },
  { id: 'INTERRUMPIDO', title: 'Interrumpidos', color: 'paused' },
  { id: 'COMPLETADO', title: 'Completados', color: 'done' },
];

export function CaseBoard({ cases, visibleCases, search, onSearch, channel, onChannel,
  channels, channelName, service, titleFor, selected, authorized, role, busy, personal,
  onRefresh, onOpen, onContinue }) {
  return <section className="board" aria-label="Canvas de casos">
    <div className="boardToolbar">
      <div className="boardTitle"><LayoutDashboard size={20}/><div><h2>{personal ? "Mis casos" : "Casos de atención"}</h2>
        <p>{authorized ? cases.length + ' casos cargados' : personal ? 'Acceso del paciente' : 'Acceso para asesor y administrador'}</p>
      </div></div>
      {authorized ? <div className="boardFilters">
        {!personal && <label className="boardSearch"><Search size={17}/><input aria-label="Buscar casos" placeholder="Estudio, clínica o folio" value={search} onChange={event => onSearch(event.target.value)}/></label>}
        <select aria-label="Último canal" value={channel} onChange={event => onChannel(event.target.value)}>
          <option value="">Todos los canales</option>
          {channels.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <button className="quiet" onClick={onRefresh} disabled={busy}><RefreshCw size={16}/>Actualizar</button>
      </div> : <a className="primary boardLogin" href="#acceso"><LockKeyhole size={16}/>Acceder al tablero</a>}
    </div>
    <div className="boardLanes">
      {columns.map(column => {
        const items = visibleCases.filter(item => item.estado === column.id && (!channel || item.ultimoCanal === channel));
        return <section className={'boardLane ' + column.color} key={column.id} aria-label={column.title}>
          <div className="laneHeading"><h3><i aria-hidden="true"/>{column.title}</h3><span>{authorized ? items.length : '—'}</span></div>
          {items.length === 0 && <p className="laneEmpty">{authorized ? 'Sin casos en esta columna' : 'Inicia sesión para ver los casos'}</p>}
          {items.map(item => <article className={'boardCard ' + (selected?.id === item.id ? 'selected' : '')} key={item.id}>
            <div className="cardMeta"><span>{channelName(item.ultimoCanal)}</span><small>#{item.id.slice(0, 8).toUpperCase()}</small></div>
            <button className="cardOpen" onClick={() => onOpen(item)} disabled={busy}>
              <Stethoscope size={18}/><strong>{item.datos?.estudio || service(item)}</strong><ArrowUpRight size={16}/>
            </button>
            <p className="cardStep">{titleFor(item)}</p>
            {item.datos?.clinica && <p className="cardClinic"><MapPin size={14}/>{item.datos.clinica}</p>}
            {item.datos?.fecha && <p className="cardClinic">{item.datos.fecha}{item.datos.horario ? ' · ' + item.datos.horario.slice(0, 5) : ''}</p>}
            {(personal || role === 'ASESOR') && item.estado !== 'COMPLETADO' && <button className="quiet cardContinue" onClick={() => onContinue(item, personal ? 'WEB' : 'CALL_CENTER')} disabled={busy}>{personal ? <Monitor size={16}/> : <Headset size={16}/>} {personal ? "Continuar en Web" : "Continuar en Call Center"}</button>}
          </article>)}
        </section>;
      })}
    </div>
  </section>;
}
