using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaludDigna.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class OmnichannelIdentityAndTimeline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_events_case_created_at",
                table: "events");

            migrationBuilder.DropCheckConstraint(
                name: "ck_events_canal",
                table: "events");

            migrationBuilder.DropCheckConstraint(
                name: "ck_cases_ultimo_canal",
                table: "cases");

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM patients WHERE btrim(curp) = '')
                       OR EXISTS (
                           SELECT upper(btrim(curp)) FROM patients
                           GROUP BY upper(btrim(curp)) HAVING count(*) > 1
                       ) THEN
                        RAISE EXCEPTION 'Corrige CURP vacías o duplicadas antes de aplicar la migración.';
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM patients
                        WHERE upper(btrim(sexo)) NOT IN ('H', 'M', 'X', 'FEMENINO', 'MASCULINO')
                    ) THEN
                        RAISE EXCEPTION 'Hay valores de sexo que requieren revisión antes de aplicar la migración.';
                    END IF;
                END $$;

                UPDATE patients SET curp = upper(btrim(curp)) WHERE curp <> upper(btrim(curp));
                UPDATE patients
                SET sexo = CASE upper(btrim(sexo))
                    WHEN 'FEMENINO' THEN 'M'
                    WHEN 'MASCULINO' THEN 'H'
                    ELSE upper(btrim(sexo))
                END
                WHERE sexo IS NOT NULL AND sexo NOT IN ('H', 'M', 'X');
                """);

            migrationBuilder.AlterColumn<string>(
                name: "sexo",
                table: "patients",
                type: "character(1)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldNullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "curp_validada_at",
                table: "patients",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nivel_identidad",
                table: "patients",
                type: "character varying(24)",
                maxLength: 24,
                nullable: false,
                defaultValue: "BASICO");

            migrationBuilder.AddColumn<DateTime>(
                name: "updated_at",
                table: "patients",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.AddColumn<string>(
                name: "actor_id",
                table: "events",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "case_version",
                table: "events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "interaccion_id",
                table: "events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "modo_persistencia",
                table: "events",
                type: "character varying(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "INMEDIATO");

            migrationBuilder.AddColumn<DateTime>(
                name: "ocurrido_at",
                table: "events",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.AddColumn<DateTime>(
                name: "created_at",
                table: "cases",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.AddColumn<DateOnly>(
                name: "fecha_cita",
                table: "cases",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "flujo_version",
                table: "cases",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "horario_cita",
                table: "cases",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "inicio_cita_at",
                table: "cases",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "parentesco_paciente",
                table: "cases",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "solicitante_patient_id",
                table: "cases",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "solicitante_telefono",
                table: "cases",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE patients SET updated_at = created_at;
                CREATE TRIGGER patients_set_updated_at
                    BEFORE UPDATE ON patients
                    FOR EACH ROW EXECUTE FUNCTION set_case_updated_at();

                UPDATE events
                SET ocurrido_at = CASE
                    WHEN payload_json->>'ocurridoAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
                    THEN (payload_json->>'ocurridoAt')::timestamptz
                    ELSE created_at
                END,
                case_version = CASE
                    WHEN payload_json->>'version' ~ '^[0-9]{1,9}$'
                    THEN (payload_json->>'version')::integer
                END;

                ALTER TABLE cases DISABLE TRIGGER cases_set_updated_at;
                UPDATE cases c
                SET created_at = COALESCE(
                        (SELECT min(e.ocurrido_at) FROM events e WHERE e.case_id = c.id), c.updated_at),
                    parentesco_paciente = CASE
                        WHEN length(c.datos_parciales->>'parentesco') <= 80
                        THEN c.datos_parciales->>'parentesco'
                    END,
                    fecha_cita = CASE
                        WHEN c.datos_parciales->>'fecha' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                        THEN (c.datos_parciales->>'fecha')::date
                    END,
                    horario_cita = CASE
                        WHEN c.datos_parciales->>'horario' ~ '^[0-9]{2}:[0-9]{2}(:[0-9]{2}([.][0-9]+)?)?$'
                        THEN (c.datos_parciales->>'horario')::time
                    END;
                ALTER TABLE cases ENABLE TRIGGER cases_set_updated_at;
                """);

            migrationBuilder.CreateTable(
                name: "biometric_verifications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    proveedor = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    referencia_externa = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    verificada_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    revocada_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_biometric_verifications", x => x.id);
                    table.ForeignKey(
                        name: "FK_biometric_verifications_patients_patient_id",
                        column: x => x.patient_id,
                        principalTable: "patients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ux_patients_curp",
                table: "patients",
                column: "curp",
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_patients_curp",
                table: "patients",
                sql: "curp <> '' AND curp = upper(btrim(curp))");

            migrationBuilder.AddCheckConstraint(
                name: "ck_patients_nivel_identidad",
                table: "patients",
                sql: "nivel_identidad IN ('BASICO', 'CURP_VALIDADA', 'BIOMETRICO_CLINICA')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_patients_sexo",
                table: "patients",
                sql: "sexo IN ('H', 'M', 'X')");

            migrationBuilder.CreateIndex(
                name: "ix_events_case_ocurrido_at",
                table: "events",
                columns: new[] { "case_id", "ocurrido_at", "id" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "ux_events_case_interaccion",
                table: "events",
                columns: new[] { "case_id", "interaccion_id" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_events_canal",
                table: "events",
                sql: "canal IN ('WEB', 'WHATSAPP', 'CALL_CENTER', 'APP', 'CLINICA')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_events_modo_persistencia",
                table: "events",
                sql: "modo_persistencia IN ('INMEDIATO', 'LOTE')");

            migrationBuilder.CreateIndex(
                name: "IX_cases_solicitante_patient_id",
                table: "cases",
                column: "solicitante_patient_id");

            migrationBuilder.AddCheckConstraint(
                name: "ck_cases_ultimo_canal",
                table: "cases",
                sql: "ultimo_canal IN ('WEB', 'WHATSAPP', 'CALL_CENTER', 'APP', 'CLINICA')");

            migrationBuilder.CreateIndex(
                name: "IX_biometric_verifications_patient_id",
                table: "biometric_verifications",
                column: "patient_id");

            migrationBuilder.CreateIndex(
                name: "IX_biometric_verifications_proveedor_referencia_externa",
                table: "biometric_verifications",
                columns: new[] { "proveedor", "referencia_externa" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_cases_patients_solicitante_patient_id",
                table: "cases",
                column: "solicitante_patient_id",
                principalTable: "patients",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_cases_patients_solicitante_patient_id",
                table: "cases");

            migrationBuilder.DropTable(
                name: "biometric_verifications");

            migrationBuilder.DropIndex(
                name: "ux_patients_curp",
                table: "patients");

            migrationBuilder.DropCheckConstraint(
                name: "ck_patients_curp",
                table: "patients");

            migrationBuilder.DropCheckConstraint(
                name: "ck_patients_nivel_identidad",
                table: "patients");

            migrationBuilder.DropCheckConstraint(
                name: "ck_patients_sexo",
                table: "patients");

            migrationBuilder.DropIndex(
                name: "ix_events_case_ocurrido_at",
                table: "events");

            migrationBuilder.DropIndex(
                name: "ux_events_case_interaccion",
                table: "events");

            migrationBuilder.DropCheckConstraint(
                name: "ck_events_canal",
                table: "events");

            migrationBuilder.DropCheckConstraint(
                name: "ck_events_modo_persistencia",
                table: "events");

            migrationBuilder.DropIndex(
                name: "IX_cases_solicitante_patient_id",
                table: "cases");

            migrationBuilder.DropCheckConstraint(
                name: "ck_cases_ultimo_canal",
                table: "cases");

            migrationBuilder.DropColumn(
                name: "curp_validada_at",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "nivel_identidad",
                table: "patients");

            migrationBuilder.Sql("DROP TRIGGER patients_set_updated_at ON patients;");

            migrationBuilder.DropColumn(
                name: "updated_at",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "actor_id",
                table: "events");

            migrationBuilder.DropColumn(
                name: "case_version",
                table: "events");

            migrationBuilder.DropColumn(
                name: "interaccion_id",
                table: "events");

            migrationBuilder.DropColumn(
                name: "modo_persistencia",
                table: "events");

            migrationBuilder.DropColumn(
                name: "ocurrido_at",
                table: "events");

            migrationBuilder.DropColumn(
                name: "created_at",
                table: "cases");

            migrationBuilder.DropColumn(
                name: "fecha_cita",
                table: "cases");

            migrationBuilder.DropColumn(
                name: "flujo_version",
                table: "cases");

            migrationBuilder.DropColumn(
                name: "horario_cita",
                table: "cases");

            migrationBuilder.DropColumn(
                name: "inicio_cita_at",
                table: "cases");

            migrationBuilder.DropColumn(
                name: "parentesco_paciente",
                table: "cases");

            migrationBuilder.DropColumn(
                name: "solicitante_patient_id",
                table: "cases");

            migrationBuilder.DropColumn(
                name: "solicitante_telefono",
                table: "cases");

            migrationBuilder.AlterColumn<string>(
                name: "sexo",
                table: "patients",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character(1)",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_events_case_created_at",
                table: "events",
                columns: new[] { "case_id", "created_at", "id" },
                descending: new[] { false, true, true });

            migrationBuilder.AddCheckConstraint(
                name: "ck_events_canal",
                table: "events",
                sql: "canal IN ('WEB', 'WHATSAPP', 'CALL_CENTER')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_cases_ultimo_canal",
                table: "cases",
                sql: "ultimo_canal IN ('WEB', 'WHATSAPP', 'CALL_CENTER')");
        }
    }
}
