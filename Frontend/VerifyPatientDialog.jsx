import React, { useEffect, useRef, useState } from 'react';

export function VerifyPatientDialog({ item, busy, error, onVerify, onCancel }) {
  const ref = useRef(null);
  const [birthDate, setBirthDate] = useState('');

  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return <dialog ref={ref} className="deleteCaseDialog" aria-labelledby="verify-patient-title"
    onCancel={event => {event.preventDefault(); if (!busy) onCancel();}}>
    <h2 id="verify-patient-title">Verificar al paciente</h2>
    <p>Pide la fecha de nacimiento de la persona a cuyo perfil está asociado el trámite #{item.id.slice(0, 8).toUpperCase()}. Si el estudio es para otra persona, usa la fecha del perfil donde se registró el folio.</p>
    <form className="verifyPatientForm" onSubmit={event => {event.preventDefault(); if (birthDate && !busy) onVerify(birthDate);}}>
      <label>Fecha de nacimiento del perfil registrado<input required type="date" value={birthDate} autoFocus
        disabled={busy} onChange={event => setBirthDate(event.target.value)}/></label>
      {error && <p role="alert" className="message error">{error}</p>}
      <div className="actions">
        <button className="quiet" type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="primary" disabled={busy || !birthDate}>{busy ? 'Verificando…' : 'Verificar y continuar'}</button>
      </div>
    </form>
  </dialog>;
}
