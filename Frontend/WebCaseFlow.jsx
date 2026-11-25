import React from 'react';
import { ChevronLeft, MapPin } from 'lucide-react';
import { WebRegistration } from './WebRegistration';

export function WebCaseFlow({ item, onBack, backRef, onSave, busy, error }) {
  const step = item.pasoActual;
  const review = ['pago-pendiente', 'pago-confirmado'].includes(step);
  if (['inicio', 'cotizado', 'clinica-seleccionada', 'horario-seleccionado'].includes(step)) {
    return <WebRegistration item={item} onBack={onBack} backRef={backRef} busy={busy} saveError={error}
      submitLabel="Confirmar cita simulada"
      onAutoSave={data => onSave(data, false)}
      onComplete={data => onSave(data, true)}/>;
  }
  return <main className="webRegister">
    <button ref={backRef} className="quiet" onClick={onBack} disabled={busy}><ChevronLeft size={17}/> Mis procesos</button>
    <div className="registerLayout">
      <aside className="registerInfo"><p className="eyebrow">ESTUDIOS Y CITAS</p><h1>{item.datos.estudio}</h1>
        <p>El avance de este trámite está disponible en los canales conectados.</p>
        {item.datos.clinica && <p className="registerClinic"><MapPin size={19}/>{item.datos.clinica}</p>}
      </aside>
      <section className="registrar panel">
        <div className="registerTab">{review ? 'Pago' : 'Estado del trámite'}</div>
        <div className="registerForm">
          {error && <p role="alert" className="message error">{error}</p>}
          {review ? <p>Continúa el paso de pago desde el canal donde se inició.</p> :
            <p>Consulta el estado de este trámite en Mis procesos.</p>}        </div>
      </section>
    </div>
  </main>;
}
