using Microsoft.EntityFrameworkCore;
using SaludDigna.Backend.Models;

namespace SaludDigna.Backend.Data;

public sealed class SaludDignaDbContext(DbContextOptions<SaludDignaDbContext> options)
    : DbContext(options)
{
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<BiometricVerification> BiometricVerifications => Set<BiometricVerification>();
    public DbSet<PatientCase> Cases => Set<PatientCase>();
    public DbSet<CaseEvent> Events => Set<CaseEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Patient>(patient =>
        {
            patient.ToTable("patients", table =>
            {
                table.HasCheckConstraint("ck_patients_telefono", "telefono ~ '^[+][1-9][0-9]{1,14}$'");
                table.HasCheckConstraint("ck_patients_sexo", "sexo IN ('H', 'M', 'X')");
                table.HasCheckConstraint("ck_patients_curp", "curp <> '' AND curp = upper(btrim(curp))");
                table.HasCheckConstraint("ck_patients_nivel_identidad",
                    "nivel_identidad IN ('BASICO', 'CURP_VALIDADA', 'BIOMETRICO_CLINICA')");
            });
            patient.Property(p => p.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            patient.Property(p => p.NombreCompleto).HasColumnName("nombre_completo").HasMaxLength(200);
            patient.Property(p => p.Telefono).HasColumnName("telefono").HasMaxLength(16);
            patient.Property(p => p.Curp).HasColumnName("curp").HasMaxLength(18).IsRequired();
            patient.Property(p => p.FechaNacimiento).HasColumnName("fecha_nacimiento");
            patient.Property(p => p.LugarNacimiento).HasColumnName("lugar_nacimiento").HasMaxLength(100);
            patient.Property(p => p.Sexo).HasColumnName("sexo").HasColumnType("character(1)");
            patient.Property(p => p.Correo).HasColumnName("correo").HasMaxLength(254);
            patient.Property(p => p.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            patient.Property(p => p.NivelIdentidad).HasColumnName("nivel_identidad").HasMaxLength(24)
                .HasDefaultValue("BASICO");
            patient.Property(p => p.CurpValidadaAt).HasColumnName("curp_validada_at");
            patient.Property(p => p.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()")
                .ValueGeneratedOnAddOrUpdate();
            patient.HasIndex(p => p.Curp).IsUnique().HasDatabaseName("ux_patients_curp");
            patient.HasIndex(p => p.Telefono).HasDatabaseName("ix_patients_telefono");
        });

        modelBuilder.Entity<BiometricVerification>(verification =>
        {
            verification.ToTable("biometric_verifications");
            verification.Property(item => item.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            verification.Property(item => item.PatientId).HasColumnName("patient_id");
            verification.Property(item => item.Proveedor).HasColumnName("proveedor").HasMaxLength(80);
            verification.Property(item => item.ReferenciaExterna).HasColumnName("referencia_externa").HasMaxLength(200);
            verification.Property(item => item.VerificadaAt).HasColumnName("verificada_at");
            verification.Property(item => item.RevocadaAt).HasColumnName("revocada_at");
            verification.HasOne<Patient>().WithMany().HasForeignKey(item => item.PatientId)
                .OnDelete(DeleteBehavior.Restrict);
            verification.HasIndex(item => new { item.Proveedor, item.ReferenciaExterna }).IsUnique();
        });

        modelBuilder.Entity<PatientCase>(patientCase =>
        {
            patientCase.ToTable("cases", table =>
            {
                table.HasCheckConstraint("ck_cases_estado",
                    "estado IN ('EN_PROGRESO', 'INTERRUMPIDO', 'COMPLETADO')");
                table.HasCheckConstraint("ck_cases_ultimo_canal",
                    "ultimo_canal IN ('WEB', 'WHATSAPP', 'CALL_CENTER', 'APP', 'CLINICA')");
                table.HasCheckConstraint("ck_cases_datos_parciales",
                    "jsonb_typeof(datos_parciales) = 'object'");
            });
            patientCase.Property(c => c.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            patientCase.Property(c => c.PatientId).HasColumnName("patient_id");
            patientCase.Property(c => c.TipoConsultaId).HasColumnName("tipo_consulta_id").HasMaxLength(40);
            patientCase.Property(c => c.FlujoVersion).HasColumnName("flujo_version").HasDefaultValue(1);
            patientCase.Property(c => c.SolicitantePatientId).HasColumnName("solicitante_patient_id");
            patientCase.Property(c => c.SolicitanteTelefono).HasColumnName("solicitante_telefono").HasMaxLength(16);
            patientCase.Property(c => c.ParentescoPaciente).HasColumnName("parentesco_paciente").HasMaxLength(80);
            patientCase.Property(c => c.FechaCita).HasColumnName("fecha_cita");
            patientCase.Property(c => c.HorarioCita).HasColumnName("horario_cita");
            patientCase.Property(c => c.InicioCitaAt).HasColumnName("inicio_cita_at");
            patientCase.Property(c => c.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            patientCase.HasOne<Patient>().WithMany().HasForeignKey(c => c.SolicitantePatientId)
                .OnDelete(DeleteBehavior.Restrict);
            patientCase.Property(c => c.Version).HasColumnName("version").HasDefaultValue(1).IsConcurrencyToken();
            patientCase.Property(c => c.Estudio).HasColumnName("estudio").HasMaxLength(180);
            patientCase.Property(c => c.Clinica).HasColumnName("clinica").HasMaxLength(180);
            patientCase.Property(c => c.PasoActual).HasColumnName("paso_actual").HasMaxLength(80);
            patientCase.Property(c => c.Estado).HasColumnName("estado").HasMaxLength(20)
                .HasDefaultValue("EN_PROGRESO");
            patientCase.Property(c => c.UltimoCanal).HasColumnName("ultimo_canal").HasMaxLength(20);
            patientCase.Property(c => c.DatosParciales).HasColumnName("datos_parciales").HasColumnType("jsonb")
                .HasDefaultValueSql("'{}'::jsonb");
            patientCase.Property(c => c.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()")
                .ValueGeneratedOnAddOrUpdate();
            patientCase.HasOne<Patient>().WithMany().HasForeignKey(c => c.PatientId)
                .OnDelete(DeleteBehavior.Restrict);
            patientCase.HasIndex(c => new { c.PatientId, c.Estado, c.UpdatedAt })
                .IsDescending(false, false, true).HasDatabaseName("ix_cases_patient_estado_updated_at");
        });

        modelBuilder.Entity<CaseEvent>(caseEvent =>
        {
            caseEvent.ToTable("events", table =>
            {
                table.HasCheckConstraint("ck_events_canal", "canal IN ('WEB', 'WHATSAPP', 'CALL_CENTER', 'APP', 'CLINICA')");
                table.HasCheckConstraint("ck_events_modo_persistencia", "modo_persistencia IN ('INMEDIATO', 'LOTE')");
                table.HasCheckConstraint("ck_events_payload", "jsonb_typeof(payload_json) = 'object'");
            });
            caseEvent.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            caseEvent.Property(e => e.CaseId).HasColumnName("case_id");
            caseEvent.Property(e => e.Canal).HasColumnName("canal").HasMaxLength(20);
            caseEvent.Property(e => e.TipoEvento).HasColumnName("tipo_evento").HasMaxLength(80);
            caseEvent.Property(e => e.ResumenLegible).HasColumnName("resumen_legible").HasColumnType("text");
            caseEvent.Property(e => e.PayloadJson).HasColumnName("payload_json").HasColumnType("jsonb")
                .HasDefaultValueSql("'{}'::jsonb");
            caseEvent.Property(e => e.OcurridoAt).HasColumnName("ocurrido_at").HasDefaultValueSql("now()");
            caseEvent.Property(e => e.CaseVersion).HasColumnName("case_version");
            caseEvent.Property(e => e.InteraccionId).HasColumnName("interaccion_id");
            caseEvent.Property(e => e.ActorId).HasColumnName("actor_id").HasMaxLength(80);
            caseEvent.Property(e => e.ModoPersistencia).HasColumnName("modo_persistencia").HasMaxLength(12)
                .HasDefaultValue("INMEDIATO");
            caseEvent.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            caseEvent.HasOne<PatientCase>().WithMany().HasForeignKey(e => e.CaseId)
                .OnDelete(DeleteBehavior.Restrict);
            caseEvent.HasIndex(e => new { e.CaseId, e.OcurridoAt, e.Id })
                .IsDescending(false, true, true).HasDatabaseName("ix_events_case_ocurrido_at");
            caseEvent.HasIndex(e => new { e.CaseId, e.InteraccionId }).IsUnique()
                .HasDatabaseName("ux_events_case_interaccion");
        });
    }
}
