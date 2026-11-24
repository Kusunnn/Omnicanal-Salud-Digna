namespace SaludDigna.Backend.Models.Consultations;

internal static class ConsultationCatalog
{
    private const string Initial = "inicio";

    private static readonly IReadOnlyList<ConsultationCheckpoint> AppointmentFlow = Array.AsReadOnly(
        new[]
        {
            Node(Initial, "Inicio", "cotizado", "requisitos"),
            Node("cotizado", "Cotización lista", "clinica-seleccionada"),
            Node("clinica-seleccionada", "Clínica seleccionada", "horario-seleccionado"),
            Node("horario-seleccionado", "Horario seleccionado", "cita-confirmada", "pago-pendiente"),
            Confirmed("cita-confirmada", "Cita simulada confirmada sin prepago", "resumen-cita"),
            Node("resumen-cita", "Ver resumen de cita"),
            Node("pago-pendiente", "Iniciar pago simulado", "pago-confirmado"),
            Confirmed("pago-confirmado", "Pago simulado confirmado", "cita-confirmada-con-pago"),
            Confirmed("cita-confirmada-con-pago", "Cita simulada confirmada con pago", "resumen-cita-con-pago"),
            Node("resumen-cita-con-pago", "Ver resumen de cita con pago"),
            Node("requisitos", "Consultar requisitos", "resumen-requisitos"),
            Node("resumen-requisitos", "Ver información del estudio")
        });

    private static readonly IReadOnlyList<ConsultationCheckpoint> LabFlow = Array.AsReadOnly(
        new[]
        {
            Node(Initial, "Estudio de laboratorio", "prerregistro", "consultar-estudios"),
            Node("prerregistro", "Iniciar prerregistro", "clinica-seleccionada"),
            Node("clinica-seleccionada", "Clínica seleccionada", "datos-revisados"),
            Node("datos-revisados", "Datos del prerregistro revisados", "prerregistro-confirmado"),
            Confirmed("prerregistro-confirmado", "Prerregistro simulado confirmado", "resumen-visita"),
            Node("resumen-visita", "Ver resumen de la visita"),
            Node("consultar-estudios", "Consultar estudios", "resumen-estudios"),
            Node("resumen-estudios", "Ver estudios disponibles en la simulación")
        });

    public static IReadOnlyList<ConsultationType> Types { get; } = Array.AsReadOnly(
        new[]
        {
            Service("laboratorio", "Laboratorio", LabFlow),
            Service("resonancia-magnetica", "Resonancia Magnética"),
            Service("electrocardiograma", "Electrocardiograma"),
            Service("lentes", "Lentes"),
            Service("nutricion", "Nutrición"),
            Service("tomografia", "Tomografía"),
            Service("ultrasonido", "Ultrasonido"),
            Service("papanicolaou", "Papanicolaou"),
            Service("rayos-x", "Rayos X"),
            Service("densitometria", "Densitometría"),
            Service("mastografia", "Mastografía"),
            Service("biopsia", "Biopsia"),
            Service("covid-19", "COVID-19")
        });

    private static ConsultationType Service(
        string id, string name, IReadOnlyList<ConsultationCheckpoint>? flow = null) =>
        new(id, name, Initial, flow ?? AppointmentFlow);

    private static ConsultationCheckpoint Node(string id, string name, params string[] next) =>
        new(id, name, Array.AsReadOnly(next));

    private static ConsultationCheckpoint Confirmed(string id, string name, params string[] next) =>
        new(id, name, Array.AsReadOnly(next), GuardadoInmediato: true);
}
