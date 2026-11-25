import React, { useEffect, useRef, useState } from 'react';
import { webServices } from './ServicesHome';

export function StartPatientCaseDialog({ patient, busy, error, onStart, onCancel }) {
  const dialogRef = useRef(null);
  const [serviceId, setServiceId] = useState('');
  const [birthDate, setBirthDate] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return <dialog ref={dialogRef} className="deleteCaseDialog" aria-labelledby="start-patient-case-title"
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="start-patient-case-title">Iniciar trámite</h2>
    <p>Paciente: <strong>{patient.nombreCompleto}</strong></p>
    <form className="verifyPatientForm" onSubmit={event => {
      event.preventDefault();
      if (!busy && serviceId && birthDate) onStart(serviceId, birthDate);
    }}>
      <label>Servicio<select required value={serviceId} autoFocus disabled={busy}
        onChange={event => setServiceId(event.target.value)}>
        <option value="">Selecciona un servicio</option>
        {webServices.map(({ id, nombre }) => <option key={id} value={id}>{nombre}</option>)}
      </select></label>
      <label>Fecha de nacimiento<input required type="date" value={birthDate} disabled={busy}
        onChange={event => setBirthDate(event.target.value)}/></label>
      {error && <p role="alert" className="message error">{error}</p>}
      <div className="actions">
        <button type="button" className="quiet" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="submit" className="primary" disabled={busy || !serviceId || !birthDate}>
          {busy ? 'Abriendo prerregistro…' : 'Abrir prerregistro'}
        </button>
      </div>
    </form>
  </dialog>;
}
