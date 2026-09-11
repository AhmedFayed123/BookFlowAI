using BookFlowAI.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BookFlowAI.Application.Common.Interfaces
{
    public interface IApplicationDbContext
    {
        DbSet<User> Users { get; }
        DbSet<BusinessCategory> BusinessCategories { get; }
        DbSet<Service> Services { get; }
        DbSet<StaffMember> StaffMembers { get; }
        DbSet<StaffService> StaffServices { get; }
        DbSet<Booking> Bookings { get; }
        DbSet<StaffSchedule> StaffSchedules { get; }
        DbSet<StaffTimeOffRequest> StaffTimeOffRequests { get; }
        DbSet<Review> Reviews { get; }
        DbSet<BusinessInfo> BusinessInfos { get; }
        DbSet<RefreshToken> RefreshTokens { get; }

        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}
