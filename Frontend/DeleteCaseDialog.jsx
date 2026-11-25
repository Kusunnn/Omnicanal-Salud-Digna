import React, { useEffect, useRef } from 'react';

export function DeleteCaseDialog({ item, title, channel, onCancel, onDelete, busy, error }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);

  return <dialog ref={ref} className="deleteCaseDialog" aria-labelledby="delete-case-title"
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="delete-case-title">¿Seguro que quieres eliminar este trámite?</h2>
    <p>Se quitará de tus pendientes y ya no podrás continuarlo desde el portal.</p>
    <dl className="deleteCasePreview">
      <div><dt>Estudio</dt><dd>{item.datos?.estudio || item.tipoConsultaId}</dd></div>
      <div><dt>Folio</dt><dd>{item.id.slice(0, 8).toUpperCase()}</dd></div>
      <div><dt>Paso guardado</dt><dd>{title}</dd></div>
      <div><dt>Último canal</dt><dd>{channel}</dd></div>
      {item.datos?.clinica && <div><dt>Clínica</dt><dd>{item.datos.clinica}</dd></div>}
      {item.datos?.fecha && <div><dt>Fecha</dt><dd>{item.datos.fecha}</dd></div>}
    </dl>
    {error && <p className="message error" role="alert">{error}</p>}
    <div className="actions"><button className="quiet" type="button" autoFocus disabled={busy} onClick={onCancel}>Conservar trámite</button>
      <button className="deleteCaseConfirm" type="button" disabled={busy} onClick={onDelete}>{busy ? 'Eliminando…' : 'Eliminar trámite'}</button></div>
  </dialog>;
}
