using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaludDigna.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class PatientDemographicsAndRequiredCurp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "curp",
                table: "patients",
                type: "character varying(18)",
                maxLength: 18,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(18)",
                oldMaxLength: 18,
                oldNullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "fecha_nacimiento",
                table: "patients",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "lugar_nacimiento",
                table: "patients",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sexo",
                table: "patients",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "fecha_nacimiento",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "lugar_nacimiento",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "sexo",
                table: "patients");

            migrationBuilder.AlterColumn<string>(
                name: "curp",
                table: "patients",
                type: "character varying(18)",
                maxLength: 18,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(18)",
                oldMaxLength: 18);
        }
    }
}
