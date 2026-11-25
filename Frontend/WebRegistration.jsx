import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ClipboardList, MapPin, MessageCircle } from 'lucide-react';

const localClinics = ['Chihuahua Nueva España', 'Culiacán Centro', 'Clínica Demo'];
const localTimes = ['08:00', '09:30', '11:00'];

function registrationDraft(data) {
  return {
    nombres: data?.nombres ?? '',
    apellidoPaterno: data?.apellidoPaterno ?? '',
    apellidoMaterno: data?.apellidoMaterno ?? '',
    nacimiento: data?.nacimiento ?? null,
    sexo: data?.sexo ?? null,
    correo: data?.correo ?? '',
    whatsapp: data?.whatsapp ?? '',
  };
}

export function WebRegistration({ item, onBack, onComplete, operator = false, backRef, busy = false, saveError, onAutoSave, submitLabel = "Generar prerregistro" }) {
  const [recipient, setRecipient] = useState(item.datos.parentesco ?? '');
  const forSelf = /^para m[ií]$/i.test(recipient);
  const [clinic, setClinic] = useState(item.datos.clinica ?? '');
  const [clinics, setClinics] = useState(localClinics);
  const [horarios, setHorarios] = useState(localTimes);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/clinicas', { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(options => { if (Array.isArray(options) && !controller.signal.aborted) setClinics(options.map(option => option.nombre)); })
      .catch(() => {});
    fetch('/api/horarios', { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(options => { if (Array.isArray(options) && !controller.signal.aborted) setHorarios(options); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const [date, setDate] = useState(item.datos.fecha ?? '');
  const [time, setTime] = useState(item.datos.horario?.slice(0, 5) ?? '');
  const [draft, setDraft] = useState(() => registrationDraft(item.datos.prerregistro));
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const attempted = useRef(null);
  const saveRef = useRef(onAutoSave);
  saveRef.current = onAutoSave;
  const timer = useRef(null);
  const draftKey = JSON.stringify([clinic, date, time, recipient, draft]);
  const savedKey = JSON.stringify([
    item.datos.clinica ?? '', item.datos.fecha ?? '', item.datos.horario?.slice(0, 5) ?? '',
    item.datos.parentesco ?? '', registrationDraft(item.datos.prerregistro),
  ]);
  const hasChanges = draftKey !== savedKey;

  useEffect(() => {
    if (!hasChanges) {
      attempted.current = null;
      return;
    }
    if (busy || !saveRef.current || attempted.current === draftKey) return;
    timer.current = window.setTimeout(() => {
      attempted.current = draftKey;
      saveRef.current(progressData());
    }, 850);
    return () => window.clearTimeout(timer.current);
  }, [draftKey, hasChanges, busy]);

  function progressData() {
    const appointment = Object.fromEntries(Object.entries({
      clinica: clinic, fecha: date, horario: time, parentesco: recipient,
    }).filter(([, value]) => value));
    return { ...appointment, prerregistro: draft };
  }

  function setField(field, value) {
    setDraft(previous => ({ ...previous, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    if (draft.whatsapp.trim() !== confirmation.trim()) {
      setError('Los números de WhatsApp deben coincidir.');
      return;
    }
    window.clearTimeout(timer.current);
    onComplete(progressData());
  }

  return <main className={operator ? "webRegister staffRegistration" : "webRegister"}>
    <button ref={backRef} className="quiet" onClick={() => {window.clearTimeout(timer.current); onBack(hasChanges ? progressData() : undefined);}} disabled={busy}><ChevronLeft size={17}/> {operator ? "Volver al tablero" : "Mis procesos"}</button>
    <div className="registerLayout">
      <aside className="registerInfo">
        <p className="eyebrow">ESTUDIOS Y CITAS</p>
        <h1>{item.datos.estudio}</h1>
        <p>Completa el prerregistro de tu estudio y elige cuándo quieres acudir a la clínica.</p>
        <div className="registerSummaryCard">
          <MessageCircle size={24}/>
          <div><strong>{operator ? "Prerregistro del paciente" : "Prerregistro del estudio"}</strong><p>{item.datos.clinica ? "La clínica ya está seleccionada." : "La clínica está pendiente."}</p></div>
        </div>
        <h2>Datos de tu cita</h2>
        <p className="registerClinic"><MapPin size={19}/>{item.datos.clinica || "Clínica pendiente"}</p>
        <p>Selecciona fecha y horario para continuar. Usa datos ficticios en esta simulación.</p>
      </aside>
      <section className="registrar panel">
        <div className="registerTab"><ClipboardList size={22}/> Prerregistro</div>
        <form className="registerForm" onSubmit={submit}>
          <fieldset className="registerSex">
            <legend>¿Para quién es el estudio?</legend>
            <label><input type="radio" name="destinatario" value="Para mí" checked={forSelf}
              onChange={() => setRecipient('Para mí')} required/> Para mí</label>
            <label><input type="radio" name="destinatario" value="Para otra persona" checked={Boolean(recipient) && !forSelf}
              onChange={() => setRecipient('Para otra persona')} required/> Para otra persona</label>
          </fieldset>
          <label>Clínica<select required value={clinic} onChange={e => setClinic(e.target.value)}>
            <option value="">Selecciona una clínica</option>
            {clinics.map(nombre => <option key={nombre}>{nombre}</option>)}
            {clinic && !clinics.includes(clinic) && <option>{clinic}</option>}
          </select></label>
          <h2>Elige fecha y horario</h2>
          <div className="fieldGrid">
            <label>Fecha<input required type="date" value={date} onChange={e => setDate(e.target.value)}/></label>
            <label>Horario<select required value={time} onChange={e => setTime(e.target.value)}><option value="">Selecciona un horario</option>{horarios.map(hora => <option key={hora}>{hora}</option>)}{time && !horarios.includes(time) && <option>{time}</option>}</select></label>
          </div>
          <hr/>
          <h2>Datos de la persona que se hará el estudio</h2>
          <div className="fieldGrid">
            <label>Nombre(s)<input required name="nombres" maxLength={100} value={draft.nombres} onChange={e => setField('nombres', e.target.value)} placeholder="Nombre(s)"/></label>
            <label>Apellido paterno<input required name="apellidoPaterno" maxLength={100} value={draft.apellidoPaterno} onChange={e => setField('apellidoPaterno', e.target.value)} placeholder="Apellido paterno"/></label>
            <label>Apellido materno (opcional)<input name="apellidoMaterno" maxLength={100} value={draft.apellidoMaterno} onChange={e => setField('apellidoMaterno', e.target.value)} placeholder="Apellido materno"/></label>
            <label>Fecha de nacimiento<input required name="nacimiento" type="date" value={draft.nacimiento ?? ''} onChange={e => setField('nacimiento', e.target.value || null)}/></label>
          </div>
          <fieldset className="registerSex"><legend>Sexo</legend>
            {['Mujer', 'Hombre'].map(option => <label key={option}><input type="radio" name="sexo" value={option} checked={draft.sexo === option} onChange={() => setField('sexo', option)} required/>{option}</label>)}
          </fieldset>
          <label>Correo electrónico<input required type="email" maxLength={254} placeholder="nombre@ejemplo.com" value={draft.correo} onChange={e => setField('correo', e.target.value)}/></label>
          <div className="fieldGrid">
            <label>WhatsApp<input required type="tel" maxLength={32} value={draft.whatsapp} onChange={e => {setField('whatsapp', e.target.value); setError('');}}/></label>
            <label>Confirma WhatsApp<input required type="tel" value={confirmation} onChange={e => {setConfirmation(e.target.value); setError('');}}/></label>
          </div>
          <h2>Resumen</h2>
          <dl className="registerReceipt"><div><dt>Estudio</dt><dd>{item.datos.estudio}</dd></div><div><dt><CalendarDays size={15}/> Fecha y horario</dt><dd>{date ? [date, time].filter(Boolean).join(' · ') : 'Por seleccionar'}</dd></div><div><dt>Precio</dt><dd>Simulado</dd></div></dl>
          {(error || saveError) && <p role="alert" className="message error">{error || saveError}</p>}
          {(busy || hasChanges) && <p role="status">{busy ? "Guardando avance…" : "Cambios por guardar"}</p>}
          <div className="actions registerSubmit">
            <button className="patientSubmit" disabled={busy}>{submitLabel}</button>
          </div>
        </form>
      </section>
    </div>
  </main>;
}
