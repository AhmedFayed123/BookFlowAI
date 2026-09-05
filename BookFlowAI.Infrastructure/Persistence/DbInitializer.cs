using BookFlowAI.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BookFlowAI.Infrastructure.Persistence
{
    public static class DbInitializer
    {
        public static async Task SeedAsync(ApplicationDbContext context)
        {
            // إنشاء قاعدة البيانات لو لم تكن موجودة
            await context.Database.MigrateAsync();

            // إضافة أدمن رئيسي لو لم يكن هناك أدمن
            if (!await context.Users.AnyAsync(u => u.Role == "Admin"))
            {
                var adminUser = new User
                {
                    Name = "System Admin",
                    Email = "admin@bookflow.com",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123456"),
                    Role = "Admin",
                    PhoneNumber = "01000000000"
                };

                context.Users.Add(adminUser);
                await context.SaveChangesAsync();
            }
        }
    }
}