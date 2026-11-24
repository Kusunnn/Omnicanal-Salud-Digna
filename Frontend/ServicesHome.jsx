import React from 'react';
import { Activity, ScanLine } from 'lucide-react';

export const webServices = [
  { id: 'ultrasonido', nombre: 'Ultrasonido', Icon: Activity },
  { id: 'rayos-x', nombre: 'Rayos X', Icon: ScanLine },
];

export function ServicesHome({ onChoose, busy, error }) {
  return <main className="servicesHome">
    <section className="servicesHero">
      <div className="servicesHeroInner">
        <div><p className="eyebrow">PORTAL DEL PACIENTE</p><h1>Agenda tu próximo estudio</h1>
        <p>Selecciona un servicio y continúa tu cita a tu ritmo.</p>
        <a href="#servicios" className="servicesJump">Explorar servicios</a></div>
        <div className="servicesIllustration" aria-hidden="true"><ScanLine size={76} strokeWidth={1.2}/></div>
      </div>
    </section>
    <section id="servicios" className="servicesCatalog">
      <h2>Servicios disponibles</h2>
      {error && <p role="alert" className="message error">{error}</p>}
      <div className="serviceChoices">{webServices.map(({ id, nombre, Icon }) =>
        <button key={id} className="serviceChoice" disabled={busy} onClick={() => onChoose(id, nombre)}>
          <Icon size={27}/><strong>{nombre}</strong><span>Iniciar trámite</span>
        </button>
      )}</div>
    </section>
  </main>;
}
