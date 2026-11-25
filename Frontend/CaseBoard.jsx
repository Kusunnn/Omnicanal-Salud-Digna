import React from 'react';
import { LayoutDashboard, LockKeyhole, Monitor, MapPin, Search, Stethoscope, Trash2 } from 'lucide-react';

const columns = [
  { id: 'EN_PROGRESO', title: 'En proceso', color: 'progress' },
  { id: 'INTERRUMPIDO', title: 'Incompletos', color: 'paused' },
  { id: 'COMPLETADO', title: 'Completados', color: 'done' },
];

export function CaseBoard({ cases, visibleCases, search, onSearch, channel, onChannel,
  channels, channelName, service, titleFor, authorized, role, busy, personal, admin = false,
  onContinue, onDelete }) {
  return <section className="board" aria-label="Canvas de casos">
    <div className="boardToolbar">
      <div className="boardTitle"><LayoutDashboard size={20}/><div><h2>{personal ? "Mis casos" : "Casos de atención"}</h2>
        <p>{authorized ? (admin ? cases.length : cases.filter(item => item.estado !== 'COMPLETADO').length) + ' casos visibles' : personal ? 'Acceso del paciente' : 'Acceso para asesor y administrador'}</p>
      </div></div>
      {authorized ? !personal && <div className="boardFilters">
        {!personal && <label className="boardSearch"><Search size={17}/><input aria-label="Buscar casos" placeholder="Estudio, clínica o folio" value={search} onChange={event => onSearch(event.target.value)}/></label>}
        <select aria-label="Último canal" value={channel} onChange={event => onChannel(event.target.value)}>
          <option value="">Todos los canales</option>
          {channels.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div> : <a className="primary boardLogin" href="#acceso"><LockKeyhole size={16}/>Acceder al tablero</a>}
    </div>
    <div className={"boardLanes" + (admin ? "" : " boardLanesTwo")}>
      {columns.filter(column => admin || column.id !== "COMPLETADO").map(column => {
        const items = visibleCases.filter(item => item.estado === column.id && (personal || !channel || item.ultimoCanal === channel));
        return <section className={'boardLane ' + column.color} key={column.id} aria-label={column.title}>
          <div className="laneHeading"><h3><i aria-hidden="true"/>{column.title}</h3><span>{authorized ? items.length : '—'}</span></div>
          {items.length === 0 && <p className="laneEmpty">{authorized ? 'Sin casos en esta columna' : 'Inicia sesión para ver los casos'}</p>}
          {items.map(item => <article className="boardCard" key={item.id}>
            <div className="cardMeta"><span>{channelName(item.ultimoCanal)}</span><small>#{item.id.slice(0, 8).toUpperCase()}</small></div>
            <div className="cardOpen"><Stethoscope size={16}/><strong>{item.datos?.estudio || service(item)}</strong></div>
            <p className="cardStep">{titleFor(item)}</p>
            {item.datos?.clinica && <p className="cardClinic"><MapPin size={14}/>{item.datos.clinica}</p>}
            {item.datos?.fecha && <p className="cardClinic">{item.datos.fecha}{item.datos.horario ? ' · ' + item.datos.horario.slice(0, 5) : ''}</p>}
            {(personal || role === 'ASESOR' || role === 'ADMIN') && item.estado !== 'COMPLETADO' && <button className="quiet cardContinue" onClick={() => onContinue(item)} disabled={busy}><Monitor size={15}/> Continuar en Web</button>}
            {onDelete && item.estado !== 'COMPLETADO' && <button type="button" className="quiet cardDelete" onClick={() => onDelete(item)} disabled={busy}><Trash2 size={14}/> Eliminar</button>}
          </article>)}
        </section>;
      })}
    </div>
  </section>;
}
