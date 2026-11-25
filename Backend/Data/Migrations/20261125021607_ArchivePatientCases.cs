using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaludDigna.Backend.Data.Migrations
{
    public partial class ArchivePatientCases : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "archived_at",
                table: "cases",
                type: "timestamp with time zone",
                nullable: true);
        }
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "cases");
        }
    }
}
