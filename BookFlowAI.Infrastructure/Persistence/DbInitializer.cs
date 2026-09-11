using BookFlowAI.Domain.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace BookFlowAI.Infrastructure.Persistence
{
    public static class DbInitializer
    {
        public static async Task SeedAsync(ApplicationDbContext context)
        {
            var database = context.Database;

            try
            {
                var canConnect = await database.CanConnectAsync();

                if (!canConnect)
                {
                    await database.MigrateAsync();
                }
                else
                {
                    var pendingMigrations = (await database.GetPendingMigrationsAsync()).ToList();
                    if (pendingMigrations.Count > 0)
                    {
                        await database.MigrateAsync();
                    }
                }
            }
            catch (Exception ex) when (IsExistingDatabaseOrSchemaError(ex))
            {
                // The database/schema already exists; this is safe during repeated container startups.
            }

            await SeedUsersAsync(context);
            await SeedCatalogAsync(context);
            await SeedStaffAsync(context);
            await SeedBusinessKnowledgeAsync(context);
        }

        private static async Task SeedUsersAsync(ApplicationDbContext context)
        {
            var users = new[]
            {
                new { Name = "System Admin", Email = "admin@bookflow.com", Password = "Admin@123456", Role = "Admin", Phone = "01000000000" },
                new { Name = "Dr. Maya Hassan", Email = "maya.provider@bookflow.com", Password = "Provider@123", Role = "Staff", Phone = "01000000001" },
                new { Name = "Omar Nabil", Email = "omar.provider@bookflow.com", Password = "Provider@123", Role = "Staff", Phone = "01000000002" },
                new { Name = "Lina Farid", Email = "lina.provider@bookflow.com", Password = "Provider@123", Role = "Staff", Phone = "01000000003" },
                new { Name = "Demo Customer", Email = "customer@bookflow.com", Password = "Customer@123", Role = "Customer", Phone = "01000000004" }
            };

            var existingEmails = await context.Users.Select(user => user.Email).ToListAsync();
            foreach (var item in users.Where(item => !existingEmails.Contains(item.Email)))
            {
                context.Users.Add(new User
                {
                    Name = item.Name,
                    Email = item.Email,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(item.Password),
                    Role = item.Role,
                    PhoneNumber = item.Phone
                });
            }
            await context.SaveChangesAsync();
        }

        private static async Task SeedCatalogAsync(ApplicationDbContext context)
        {
            var categories = new[]
            {
                ("Medical Clinics", "medical-clinics", "Healthcare appointments and clinical services."),
                ("Beauty & Wellness", "beauty-wellness", "Personal care, beauty, and wellness services."),
                ("Professional Coaching", "professional-coaching", "Career and personal development sessions."),
                ("Auto Care", "auto-care", "Vehicle inspection, repair, and maintenance services."),
                ("Fitness", "fitness", "Training, classes, and fitness assessments."),
                ("Consultation Services", "consultation-services", "Specialist and professional advisory sessions.")
            };

            var existingSlugs = await context.BusinessCategories.Select(category => category.Slug).ToListAsync();
            foreach (var item in categories.Where(item => !existingSlugs.Contains(item.Item2)))
            {
                context.BusinessCategories.Add(new BusinessCategory
                {
                    Name = item.Item1,
                    Slug = item.Item2,
                    Description = item.Item3,
                    IsActive = true
                });
            }
            await context.SaveChangesAsync();

            var categoryIds = await context.BusinessCategories.ToDictionaryAsync(category => category.Slug, category => category.Id);
            var services = new[]
            {
                ("General Health Consultation", "A focused consultation with a qualified healthcare provider.", 450m, 45, "medical-clinics"),
                ("Wellness Assessment", "A personalized wellness assessment and care plan.", 300m, 60, "beauty-wellness"),
                ("Career Strategy Session", "One-to-one career planning and actionable coaching.", 550m, 60, "professional-coaching"),
                ("Vehicle Diagnostic", "Comprehensive vehicle inspection and diagnostic report.", 350m, 45, "auto-care"),
                ("Personal Training Session", "Goal-oriented individual training with a certified provider.", 250m, 60, "fitness"),
                ("Business Consultation", "Expert consultation for operational and growth decisions.", 700m, 60, "consultation-services")
            };

            var existingNames = await context.Services.Select(service => service.Name).ToListAsync();
            foreach (var item in services.Where(item => !existingNames.Contains(item.Item1)))
            {
                context.Services.Add(new Service
                {
                    Name = item.Item1,
                    Description = item.Item2,
                    Price = item.Item3,
                    DurationInMinutes = item.Item4,
                    BusinessCategoryId = categoryIds[item.Item5],
                    IsActive = true
                });
            }
            await context.SaveChangesAsync();
        }

        private static async Task SeedStaffAsync(ApplicationDbContext context)
        {
            var providerEmails = new[]
            {
                "maya.provider@bookflow.com",
                "omar.provider@bookflow.com",
                "lina.provider@bookflow.com"
            };
            var users = await context.Users.Where(user => providerEmails.Contains(user.Email)).ToDictionaryAsync(user => user.Email);
            var profiles = new[]
            {
                (Email: providerEmails[0], Specialties: "Healthcare and wellness consultations", Services: new[] { "General Health Consultation", "Wellness Assessment" }),
                (Email: providerEmails[1], Specialties: "Professional coaching and business advisory", Services: new[] { "Career Strategy Session", "Business Consultation" }),
                (Email: providerEmails[2], Specialties: "Vehicle care and personal fitness", Services: new[] { "Vehicle Diagnostic", "Personal Training Session" })
            };
            var serviceIds = await context.Services.ToDictionaryAsync(service => service.Name, service => service.Id);

            foreach (var profile in profiles)
            {
                var user = users[profile.Email];
                var staff = await context.StaffMembers
                    .Include(item => item.Schedules)
                    .Include(item => item.StaffServices)
                    .FirstOrDefaultAsync(item => item.UserId == user.Id);
                if (staff is null)
                {
                    staff = new StaffMember
                    {
                        UserId = user.Id,
                        Specialties = profile.Specialties,
                        WorkingHours = "Monday-Friday 09:00-17:00",
                        IsAvailable = true
                    };
                    context.StaffMembers.Add(staff);
                    await context.SaveChangesAsync();
                }

                if (staff.Schedules.Count == 0)
                {
                    foreach (var day in new[] { DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday })
                        context.StaffSchedules.Add(new StaffSchedule { StaffId = staff.Id, DayOfWeek = day, StartTime = TimeSpan.FromHours(9), EndTime = TimeSpan.FromHours(17) });
                }

                var assignedIds = staff.StaffServices.Select(item => item.ServiceId).ToHashSet();
                foreach (var serviceName in profile.Services)
                {
                    var serviceId = serviceIds[serviceName];
                    if (!assignedIds.Contains(serviceId))
                        context.StaffServices.Add(new StaffService { StaffId = staff.Id, ServiceId = serviceId });
                }
            }
            await context.SaveChangesAsync();
        }

        private static async Task SeedBusinessKnowledgeAsync(ApplicationDbContext context)
        {
            var entries = new[]
            {
                ("Platform", "BookFlowAI supports configurable service businesses across healthcare, wellness, coaching, automotive care, fitness, and consulting."),
                ("BookingPolicy", "Appointments can be scheduled only with available providers assigned to the selected service and within their working shifts."),
                ("CancellationPolicy", "Customers should cancel or reschedule as early as possible. Business-specific rules can be configured in the knowledge base.")
            };
            var existing = await context.BusinessInfos.Select(info => info.Category).ToListAsync();
            foreach (var item in entries.Where(item => !existing.Contains(item.Item1)))
                context.BusinessInfos.Add(new BusinessInfo { Category = item.Item1, Content = item.Item2 });
            await context.SaveChangesAsync();
        }

        private static bool IsExistingDatabaseOrSchemaError(Exception ex)
        {
            if (ex is SqlException sqlException)
            {
                return sqlException.Number == 1801
                    || sqlException.Number == 2714
                    || sqlException.Number == 4060
                    || sqlException.Number == 911;
            }

            var message = ex.Message ?? string.Empty;
            return message.Contains("already exists", StringComparison.OrdinalIgnoreCase)
                || message.Contains("database", StringComparison.OrdinalIgnoreCase)
                    && message.Contains("exists", StringComparison.OrdinalIgnoreCase);
        }
    }
}
