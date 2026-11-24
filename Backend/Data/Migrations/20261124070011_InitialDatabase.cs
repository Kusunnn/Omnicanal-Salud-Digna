using System;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaludDigna.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialDatabase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "patients",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    nombre_completo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    telefono = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    curp = table.Column<string>(type: "character varying(18)", maxLength: 18, nullable: true),
                    correo = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_patients", x => x.id);
                    table.CheckConstraint("ck_patients_telefono", "telefono ~ '^[+][1-9][0-9]{1,14}$'");
                });

            migrationBuilder.CreateTable(
                name: "cases",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    estudio = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    clinica = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    paso_actual = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    estado = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "EN_PROGRESO"),
                    ultimo_canal = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    datos_parciales = table.Column<JsonElement>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cases", x => x.id);
                    table.CheckConstraint("ck_cases_datos_parciales", "jsonb_typeof(datos_parciales) = 'object'");
                    table.CheckConstraint("ck_cases_estado", "estado IN ('EN_PROGRESO', 'INTERRUMPIDO', 'COMPLETADO')");
                    table.CheckConstraint("ck_cases_ultimo_canal", "ultimo_canal IN ('WEB', 'WHATSAPP', 'CALL_CENTER')");
                    table.ForeignKey(
                        name: "FK_cases_patients_patient_id",
                        column: x => x.patient_id,
                        principalTable: "patients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    canal = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    tipo_evento = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    resumen_legible = table.Column<string>(type: "text", nullable: false),
                    payload_json = table.Column<JsonElement>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_events", x => x.id);
                    table.CheckConstraint("ck_events_canal", "canal IN ('WEB', 'WHATSAPP', 'CALL_CENTER')");
                    table.CheckConstraint("ck_events_payload", "jsonb_typeof(payload_json) = 'object'");
                    table.ForeignKey(
                        name: "FK_events_cases_case_id",
                        column: x => x.case_id,
                        principalTable: "cases",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.Sql("""
                CREATE FUNCTION set_case_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    NEW.updated_at := statement_timestamp();
                    RETURN NEW;
                END;
                $$;

                CREATE TRIGGER cases_set_updated_at
                BEFORE UPDATE ON cases
                FOR EACH ROW EXECUTE FUNCTION set_case_updated_at();
                """);

            migrationBuilder.CreateIndex(
                name: "ix_cases_patient_estado_updated_at",
                table: "cases",
                columns: new[] { "patient_id", "estado", "updated_at" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "ix_events_case_created_at",
                table: "events",
                columns: new[] { "case_id", "created_at", "id" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "ix_patients_telefono",
                table: "patients",
                column: "telefono");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "events");

            migrationBuilder.DropTable(
                name: "cases");

            migrationBuilder.Sql("DROP FUNCTION set_case_updated_at();");

            migrationBuilder.DropTable(
                name: "patients");
        }
    }
}
