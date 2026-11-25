import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { casePath } from './backendClient';

const pageSize = 30;
const dateTime = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium', timeStyle: 'medium', timeZone: 'America/Mexico_City',
});

export function CaseTimelineDialog({ item, api, channelName, titleFor, onClose }) {
  const dialogRef = useRef(null);
  const startedOutside = useRef(false);
  const [events, setEvents] = useState([]);
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const path = casePath(item);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    let active = true;
    api(path + `/eventos?limite=${pageSize}&omitir=${offset}`)
      .then(page => {
        if (!active) return;
        setEvents(previous => offset ? [...page, ...previous.filter(event => !page.some(older => older.version === event.version && older.id === event.id))] : page);
        setMore(page.length === pageSize);
      })
      .catch(exception => { if (active) setError(exception.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, path, offset, retry]);

  function stepLabel(step) {
    return step && titleFor({ pasoActual: step }).replaceAll('-', ' ');
  }

  function isOutside(event) {
    if (event.target !== event.currentTarget) return false;
    const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
    return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
  }

  return <dialog ref={dialogRef} className="caseTimelineDialog" aria-labelledby="case-history-title"
    onPointerDown={event => { startedOutside.current = isOutside(event); }}
    onClick={event => {
      if (startedOutside.current && isOutside(event)) onClose();
      startedOutside.current = false;
    }}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="caseTimelineHeader">
      <div>
        <h2 id="case-history-title">Historial del folio #{item.id.slice(0, 8).toUpperCase()}</h2>
        <p>{item.datos?.estudio || item.tipoConsultaId}</p>
      </div>
      <button type="button" className="quiet" autoFocus onClick={onClose} aria-label="Cerrar historial"><X size={19}/></button>
    </header>
    <div className="caseTimelineBody">
      {loading && <p role="status">Cargando historial…</p>}
      {error && <div role="alert">
        <p className="message error">{error}</p>
        <button type="button" className="quiet" onClick={() => {
          setError(''); setLoading(true); setRetry(value => value + 1);
        }}>Reintentar</button>
      </div>}
      {more && !error && <button type="button" className="quiet" disabled={loading} onClick={() => {
        setLoading(true); setOffset(value => value + pageSize);
      }}>Ver eventos anteriores</button>}
      {!loading && !error && events.length === 0 && <p>Este trámite todavía no tiene eventos registrados.</p>}
      {events.length > 0 && <ol className="caseTimelineList">
        {events.map(event => {
          const previous = stepLabel(event.datos?.pasoAnterior);
          const current = stepLabel(event.datos?.pasoActual);
          return <li key={`${event.id}:${event.version}`}>
            <div className="caseTimelineMeta">
              <span className="checkpoint">{channelName(event.canal)}</span>
              <time dateTime={event.ocurridoAt}>{dateTime.format(new Date(event.ocurridoAt))}</time>
            </div>
            <strong>{event.resumen || event.tipoEvento}</strong>
            {current && <p>{previous && previous !== current ? `${previous} → ${current}` : current}</p>}
            {event.datos?.canalAnterior && event.datos.canalAnterior !== event.canal &&
              <p>Canal anterior: {channelName(event.datos.canalAnterior)}</p>}
            {event.datos?.camposActualizados?.length > 0 &&
              <p>Datos actualizados: {event.datos.camposActualizados.join(', ')}</p>}
            {!event.registradoAt && <small>Pendiente de sincronizar</small>}
          </li>;
        })}
      </ol>}
    </div>
  </dialog>;
}
