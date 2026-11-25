import React, { useState } from 'react';
import { ChevronLeft, MapPin } from 'lucide-react';
import { WebRegistration } from './WebRegistration';

const appointmentStatus = {
  'horario-seleccionado': {
    title: 'Pago y confirmación',
    description: 'Elige cómo pagar para confirmar tu cita.',
    actions: [
      { next: 'pago-pendiente', label: 'Pagar en línea' },
      { next: 'cita-confirmada', label: 'Confirmar y pagar en clínica' },
    ],
  },
  'pago-pendiente': {
    title: 'Pago pendiente',
    description: 'Completa el pago simulado para poder confirmar tu cita.',
    actions: [{ next: 'pago-confirmado', label: 'Completar pago simulado' }],
  },
  'pago-confirmado': {
    title: 'Pago confirmado',
    description: 'Tu pago simulado está registrado. Ya puedes confirmar la cita.',
    actions: [{ next: 'cita-confirmada-con-pago', label: 'Confirmar cita' }],
  },
  'cita-confirmada': { title: 'Cita confirmada', description: 'Tu cita quedó confirmada. El pago se realiza en la clínica.' },
  'cita-confirmada-con-pago': { title: 'Cita confirmada', description: 'Tu cita con pago simulado quedó confirmada.' },
  'resumen-cita': { title: 'Resumen de cita', description: 'Tu cita está confirmada. El pago se realiza en la clínica.' },
  'resumen-cita-con-pago': { title: 'Resumen de cita', description: 'Tu cita y el pago simulado están confirmados.' },
};

export function WebCaseFlow({ item, onBack, backRef, onSave, onAdvance, busy, error, operator = false }) {
  const step = item.pasoActual;
  const [review, setReview] = useState(step === 'horario-seleccionado');
  const showRegistration = ['inicio', 'cotizado', 'clinica-seleccionada'].includes(step)
    || (step === 'horario-seleccionado' && !review);
  const status = appointmentStatus[step] ?? {
    title: 'Estado del trámite',
    description: item.estado === 'COMPLETADO' ? 'Este trámite quedó completado.' : 'Consulta el avance registrado para este trámite.',
  };
  const details = [item.datos.fecha, item.datos.horario?.slice(0, 5)].filter(Boolean).join(' · ');
  if (showRegistration) {
    return <WebRegistration item={item} operator={operator} onBack={onBack} backRef={backRef} busy={busy} saveError={error}
      submitLabel="Continuar al pago"
      onAutoSave={data => onSave(data, false)}
      onComplete={async data => {
        if (await onSave(data, true)) setReview(true);
      }}/>;
  }
  return <main className={operator ? "webRegister staffRegistration" : "webRegister"}>
    <button ref={backRef} className="quiet" onClick={() => onBack()} disabled={busy}><ChevronLeft size={17}/> {operator ? "Volver al tablero" : "Mis procesos"}</button>
    <div className="registerLayout">
      <aside className="registerInfo"><p className="eyebrow">ESTUDIOS Y CITAS</p><h1>{item.datos.estudio}</h1>
        <p>El avance de este trámite está disponible en los canales conectados.</p>
        {item.datos.clinica && <p className="registerClinic"><MapPin size={19}/>{item.datos.clinica}</p>}
      </aside>
      <section className="registrar panel">
        <div className="registerTab">{status.title}</div>
        <div className="registerForm">
          {error && <p role="alert" className="message error">{error}</p>}
          <p>{status.description}</p>
          {details && <dl className="registerReceipt"><div><dt>Fecha y horario</dt><dd>{details}</dd></div></dl>}
          {item.estado !== 'COMPLETADO' && status.actions && <div className="actions registerSubmit">
            {status.actions.map(({ next, label }, index) => <button key={next} type="button"
              className={index === 0 ? 'patientSubmit' : 'quiet'} disabled={busy}
              onClick={() => onAdvance(next)}>{label}</button>)}
          </div>}
          {step === 'horario-seleccionado' && <button type="button" className="quiet" disabled={busy}
            onClick={() => setReview(false)}>Editar prerregistro</button>}
        </div>
      </section>
    </div>
  </main>;
}
