using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaludDigna.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class CaseCheckpointVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "tipo_consulta_id",
                table: "cases",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "version",
                table: "cases",
                type: "integer",
                nullable: false,
                defaultValue: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "tipo_consulta_id",
                table: "cases");

            migrationBuilder.DropColumn(
                name: "version",
                table: "cases");
        }
    }
}
