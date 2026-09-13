using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookFlowAI.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInstaPayVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_StaffId",
                table: "Bookings");

            migrationBuilder.AddColumn<string>(
                name: "InstaPayRefNumber",
                table: "Bookings",
                type: "nvarchar(12)",
                maxLength: 12,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LockExpiresAt",
                table: "Bookings",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentStatus",
                table: "Bookings",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentVerificationNote",
                table: "Bookings",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaymentVerifiedAt",
                table: "Bookings",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PaymentVerifiedBy",
                table: "Bookings",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceiptImageUrl",
                table: "Bookings",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_InstaPayRefNumber",
                table: "Bookings",
                column: "InstaPayRefNumber",
                unique: true,
                filter: "[InstaPayRefNumber] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_PaymentStatus_LockExpiresAt",
                table: "Bookings",
                columns: new[] { "PaymentStatus", "LockExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_StaffId_DateTime",
                table: "Bookings",
                columns: new[] { "StaffId", "DateTime" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_InstaPayRefNumber",
                table: "Bookings");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_PaymentStatus_LockExpiresAt",
                table: "Bookings");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_StaffId_DateTime",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "InstaPayRefNumber",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "LockExpiresAt",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "PaymentStatus",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "PaymentVerificationNote",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "PaymentVerifiedAt",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "PaymentVerifiedBy",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ReceiptImageUrl",
                table: "Bookings");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_StaffId",
                table: "Bookings",
                column: "StaffId");
        }
    }
}
