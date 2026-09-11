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
        public DbSet<BusinessCategory> BusinessCategories => Set<BusinessCategory>();
        public DbSet<Service> Services => Set<Service>();
        public DbSet<StaffMember> StaffMembers => Set<StaffMember>();
        public DbSet<StaffService> StaffServices => Set<StaffService>();
        public DbSet<Booking> Bookings => Set<Booking>();
        public DbSet<StaffSchedule> StaffSchedules => Set<StaffSchedule>();
        public DbSet<StaffTimeOffRequest> StaffTimeOffRequests => Set<StaffTimeOffRequest>();
        public DbSet<Review> Reviews => Set<Review>();
        public DbSet<BusinessInfo> BusinessInfos => Set<BusinessInfo>();
        public DbSet<KnowledgeDocument> KnowledgeDocuments => Set<KnowledgeDocument>();
        public DbSet<KnowledgeChunk> KnowledgeChunks => Set<KnowledgeChunk>();
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

            modelBuilder.Entity<BusinessCategory>(entity =>
            {
                entity.HasIndex(category => category.Name).IsUnique();
                entity.HasIndex(category => category.Slug).IsUnique();
                entity.Property(category => category.Name).HasMaxLength(120);
                entity.Property(category => category.Slug).HasMaxLength(140);
                entity.Property(category => category.Description).HasMaxLength(500);
            });

            modelBuilder.Entity<Service>(entity =>
            {
                entity.Property(service => service.Name).HasMaxLength(160);
                entity.Property(service => service.Description).HasMaxLength(1000);
                entity.HasOne(service => service.BusinessCategory)
                    .WithMany(category => category.Services)
                    .HasForeignKey(service => service.BusinessCategoryId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<StaffService>(entity =>
            {
                entity.HasKey(assignment => new { assignment.StaffId, assignment.ServiceId });
                entity.HasOne(assignment => assignment.Staff)
                    .WithMany(staff => staff.StaffServices)
                    .HasForeignKey(assignment => assignment.StaffId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(assignment => assignment.Service)
                    .WithMany(service => service.StaffServices)
                    .HasForeignKey(assignment => assignment.ServiceId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<StaffSchedule>()
                .HasIndex(schedule => new { schedule.StaffId, schedule.DayOfWeek, schedule.StartTime, schedule.EndTime })
                .IsUnique();

            modelBuilder.Entity<StaffTimeOffRequest>(entity =>
            {
                entity.Property(request => request.Reason).HasMaxLength(500);
                entity.Property(request => request.Status).HasMaxLength(20);
                entity.Property(request => request.AdminComment).HasMaxLength(500);
                entity.HasIndex(request => new { request.StaffId, request.Date, request.Status });
                entity.HasOne(request => request.Staff)
                    .WithMany(staff => staff.TimeOffRequests)
                    .HasForeignKey(request => request.StaffId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<User>().HasIndex(user => user.Email).IsUnique();

            modelBuilder.Entity<KnowledgeDocument>(entity =>
            {
                entity.Property(document => document.Title).HasMaxLength(200);
                entity.Property(document => document.SourceType).HasMaxLength(50);
                entity.Property(document => document.SourceName).HasMaxLength(200);
                entity.HasMany(document => document.Chunks)
                    .WithOne(chunk => chunk.KnowledgeDocument)
                    .HasForeignKey(chunk => chunk.KnowledgeDocumentId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<KnowledgeChunk>(entity =>
            {
                entity.Property(chunk => chunk.Content).HasColumnType("nvarchar(max)");
                entity.Property(chunk => chunk.EmbeddingJson).HasColumnType("nvarchar(max)");
                entity.HasIndex(chunk => new { chunk.KnowledgeDocumentId, chunk.ChunkIndex }).IsUnique();
            });

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
