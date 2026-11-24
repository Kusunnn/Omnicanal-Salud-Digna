using Microsoft.EntityFrameworkCore;
using SaludDigna.Backend.Models;

namespace SaludDigna.Backend.Data;

public sealed class SaludDignaDbContext(DbContextOptions<SaludDignaDbContext> options)
    : DbContext(options)
{
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<PatientCase> Cases => Set<PatientCase>();
    public DbSet<CaseEvent> Events => Set<CaseEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Patient>(patient =>
        {
            patient.ToTable("patients", table =>
                table.HasCheckConstraint("ck_patients_telefono", "telefono ~ '^[+][1-9][0-9]{1,14}$'"));
            patient.Property(p => p.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            patient.Property(p => p.NombreCompleto).HasColumnName("nombre_completo").HasMaxLength(200);
            patient.Property(p => p.Telefono).HasColumnName("telefono").HasMaxLength(16);
            patient.Property(p => p.Curp).HasColumnName("curp").HasMaxLength(18);
            patient.Property(p => p.Correo).HasColumnName("correo").HasMaxLength(254);
            patient.Property(p => p.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            patient.HasIndex(p => p.Telefono).HasDatabaseName("ix_patients_telefono");
        });

        modelBuilder.Entity<PatientCase>(patientCase =>
        {
            patientCase.ToTable("cases", table =>
            {
                table.HasCheckConstraint("ck_cases_estado",
                    "estado IN ('EN_PROGRESO', 'INTERRUMPIDO', 'COMPLETADO')");
                table.HasCheckConstraint("ck_cases_ultimo_canal",
                    "ultimo_canal IN ('WEB', 'WHATSAPP', 'CALL_CENTER')");
                table.HasCheckConstraint("ck_cases_datos_parciales",
                    "jsonb_typeof(datos_parciales) = 'object'");
            });
            patientCase.Property(c => c.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            patientCase.Property(c => c.PatientId).HasColumnName("patient_id");
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
                table.HasCheckConstraint("ck_events_canal", "canal IN ('WEB', 'WHATSAPP', 'CALL_CENTER')");
                table.HasCheckConstraint("ck_events_payload", "jsonb_typeof(payload_json) = 'object'");
            });
            caseEvent.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            caseEvent.Property(e => e.CaseId).HasColumnName("case_id");
            caseEvent.Property(e => e.Canal).HasColumnName("canal").HasMaxLength(20);
            caseEvent.Property(e => e.TipoEvento).HasColumnName("tipo_evento").HasMaxLength(80);
            caseEvent.Property(e => e.ResumenLegible).HasColumnName("resumen_legible").HasColumnType("text");
            caseEvent.Property(e => e.PayloadJson).HasColumnName("payload_json").HasColumnType("jsonb")
                .HasDefaultValueSql("'{}'::jsonb");
            caseEvent.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            caseEvent.HasOne<PatientCase>().WithMany().HasForeignKey(e => e.CaseId)
                .OnDelete(DeleteBehavior.Restrict);
            caseEvent.HasIndex(e => new { e.CaseId, e.CreatedAt, e.Id })
                .IsDescending(false, true, true).HasDatabaseName("ix_events_case_created_at");
        });
    }
}
