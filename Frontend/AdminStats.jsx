import React from 'react';
import { Activity, BarChart3, CircleCheck, Layers3 } from 'lucide-react';

function counts(items, keyOf) {
  const totals = new Map();
  for (const item of items) {
    const key = keyOf(item);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
}

function Breakdown({ title, rows, total, empty }) {
  return <section className="panel adminBreakdown">
    <h2>{title}</h2>
    {rows.length ? <ol>{rows.map(([name, count]) => <li key={name}>
      <div><span>{name}</span><strong>{count}</strong></div>
      <meter min="0" max={total} value={count} aria-label={name}/>
    </li>)}</ol> : <p>{empty}</p>}
  </section>;
}

export function AdminStats({ cases, titleFor, channelName }) {
  const completed = cases.filter(item => item.estado === 'COMPLETADO').length;
  const pending = cases.filter(item => item.estado !== 'COMPLETADO');
  const steps = counts(pending, titleFor);
  const incomplete = pending.filter(item => item.estado === 'INTERRUMPIDO').length;
  const metrics = [
    [Layers3, 'Casos consultados', cases.length],
    [Activity, 'Pendientes', pending.length],
    [CircleCheck, 'Completados', completed],
    [BarChart3, 'Incompletos', incomplete],
  ];

  return <section className="adminStats" aria-label="Estadísticas de atención">
    <div className="adminMetrics">{metrics.map(([Icon, title, value]) =>
      <div className="panel adminMetric" key={title}><Icon size={20}/><span>{title}</span><strong>{value}</strong></div>
    )}</div>
    <div className="adminBreakdowns">
      <Breakdown title="Dónde quedó el avance pendiente" rows={steps} total={pending.length} empty="No hay trámites pendientes."/>
      <Breakdown title="Casos por último canal" rows={counts(cases, item => channelName(item.ultimoCanal) || 'Sin canal')} total={cases.length} empty="Todavía no hay casos."/>
    </div>
    <p className="adminScope">Los pasos muestran el último checkpoint conocido de los casos pendientes, hasta 100 casos recientes.</p>
  </section>;
}
