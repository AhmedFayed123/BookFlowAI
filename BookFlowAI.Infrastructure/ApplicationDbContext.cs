using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BookFlowAI.Infrastructure
{
    public class ApplicationDbContext : DbContext, IApplicationDbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users => Set<User>();
        public DbSet<Service> Services => Set<Service>();
        public DbSet<StaffMember> StaffMembers => Set<StaffMember>();
        public DbSet<Booking> Bookings => Set<Booking>();
        public DbSet<StaffSchedule> StaffSchedules => Set<StaffSchedule>();
        public DbSet<Review> Reviews => Set<Review>();
        public DbSet<BusinessInfo> BusinessInfos => Set<BusinessInfo>();
        public DbSet<RefreshToken> RefreshTokens { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Booking Relationships
            modelBuilder.Entity<Booking>()
                .HasOne(b => b.Customer)
                .WithMany(u => u.Bookings)
                .HasForeignKey(b => b.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Booking>()
                .HasOne(b => b.Staff)
                .WithMany(s => s.Bookings)
                .HasForeignKey(b => b.StaffId)
                .OnDelete(DeleteBehavior.Restrict);

            // StaffMember <-> User (1:1)
            modelBuilder.Entity<StaffMember>()
                .HasOne(s => s.User)
                .WithOne(u => u.StaffMember)
                .HasForeignKey<StaffMember>(s => s.UserId);

            // Precision for Price
            modelBuilder.Entity<Service>()
                .Property(s => s.Price)
                .HasPrecision(18, 2);

            // RefreshToken Relationship
            modelBuilder.Entity<RefreshToken>(entity =>
            {
                entity.HasOne(rt => rt.User)
                      .WithMany(u => u.RefreshTokens)
                      .HasForeignKey(rt => rt.UserId)
                      .OnDelete(DeleteBehavior.Restrict);
            });
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return base.SaveChangesAsync(cancellationToken);
        }
    }
}