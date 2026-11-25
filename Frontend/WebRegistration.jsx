import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ClipboardList, MapPin, MessageCircle } from 'lucide-react';

export function WebRegistration({ item, onBack, onComplete, operator = false, backRef, busy = false, saveError, onAutoSave, submitLabel = "Generar prerregistro" }) {
  const [clinic, setClinic] = useState(item.datos.clinica ?? '');
  const [date, setDate] = useState(item.datos.fecha ?? '');
  const [time, setTime] = useState(item.datos.horario?.slice(0, 5) ?? '');
  const [sex, setSex] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const attempted = useRef(null);
  const saveRef = useRef(onAutoSave);
  saveRef.current = onAutoSave;
  const timer = useRef(null);
  const draftKey = JSON.stringify([clinic, date, time]);
  const savedKey = JSON.stringify([item.datos.clinica ?? '', item.datos.fecha ?? '', item.datos.horario?.slice(0, 5) ?? '']);
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
    return Object.fromEntries(Object.entries({ clinica: clinic, fecha: date, horario: time }).filter(([, value]) => value));
  }

  function submit(event) {
    event.preventDefault();
    if (phone.trim() !== confirmation.trim()) {
      setError('Los números de WhatsApp deben coincidir.');
      return;
    }
    window.clearTimeout(timer.current);
    onComplete(progressData());
  }

  return <main className="webRegister">
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
          <label>Clínica<select required value={clinic} onChange={e => setClinic(e.target.value)}>
            <option value="">Selecciona una clínica</option>
            <option>Chihuahua Nueva España</option><option>Culiacán Centro</option>
            {item.datos.clinica && !['Chihuahua Nueva España', 'Culiacán Centro'].includes(item.datos.clinica) && <option>{item.datos.clinica}</option>}
          </select></label>
          <h2>Elige fecha y horario</h2>
          <div className="fieldGrid">
            <label>Fecha<input required type="date" value={date} onChange={e => setDate(e.target.value)}/></label>
            <label>Horario<select required value={time} onChange={e => setTime(e.target.value)}><option value="">Selecciona un horario</option><option value="08:00">08:00</option><option value="09:30">09:30</option><option value="11:00">11:00</option></select></label>
          </div>
          <hr/>
          <h2>Datos personales</h2>
          <div className="fieldGrid">
            <label>Nombre(s)<input required name="nombres" placeholder="Nombre(s)"/></label>
            <label>Apellido paterno<input required name="apellidoPaterno" placeholder="Apellido paterno"/></label>
            <label>Apellido materno (opcional)<input name="apellidoMaterno" placeholder="Apellido materno"/></label>
            <label>Fecha de nacimiento<input required name="nacimiento" type="date"/></label>
          </div>
          <fieldset className="registerSex"><legend>Sexo</legend>
            {['Mujer', 'Hombre'].map(option => <label key={option}><input type="radio" name="sexo" value={option} checked={sex === option} onChange={() => setSex(option)} required/>{option}</label>)}
          </fieldset>
          <label>Correo electrónico<input required type="email" placeholder="nombre@ejemplo.com"/></label>
          <div className="fieldGrid">
            <label>WhatsApp<input required type="tel" value={phone} onChange={e => {setPhone(e.target.value); setError('');}}/></label>
            <label>Confirma WhatsApp<input required type="tel" value={confirmation} onChange={e => {setConfirmation(e.target.value); setError('');}}/></label>
          </div>
          <h2>Resumen</h2>
          <dl className="registerReceipt"><div><dt>Estudio</dt><dd>{item.datos.estudio}</dd></div><div><dt><CalendarDays size={15}/> Fecha y horario</dt><dd>{date ? [date, time].filter(Boolean).join(' · ') : 'Por seleccionar'}</dd></div><div><dt>Precio</dt><dd>Simulado</dd></div></dl>
          <label className="registerConsent"><input required type="checkbox"/> Confirmo que estoy usando datos ficticios.</label>
          {(error || saveError) && <p role="alert" className="message error">{error || saveError}</p>}
          <p role="status">{busy ? "Guardando avance…" : hasChanges ? "Cambios por guardar" : "El avance se guarda automáticamente."}</p>
          <div className="actions registerSubmit">
            <button className="patientSubmit" disabled={busy}>{submitLabel}</button>
          </div>
        </form>
      </section>
    </div>
  </main>;
}
