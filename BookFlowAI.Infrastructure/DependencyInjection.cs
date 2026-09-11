using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BookFlowAI.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
        {
            // 1. تسجيل DbContext في قاعدة البيانات
            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseSqlServer(
                    configuration.GetConnectionString("DefaultConnection"),
                    sql => sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));

            // 2. ربط الواجهة IApplicationDbContext بـ ApplicationDbContext
            services.AddScoped<IApplicationDbContext>(provider =>
                provider.GetRequiredService<ApplicationDbContext>());

            // 3. تسجيل خدمة المصادقة AuthService
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<IEmbeddingService, EmbeddingService>();
            // داخل Infrastructure/DependencyInjection.cs
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.RequireHttpsMetadata = false;
                options.SaveToken = true;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    // Read JWT settings from configuration section 'JwtSettings' (appsettings.json)
                    // Keys: Secret, Issuer, Audience
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(GetJwtSecret(configuration))),
                    ValidateIssuer = true,
                    ValidIssuer = configuration["JwtSettings:Issuer"],
                    ValidateAudience = true,
                    ValidAudience = configuration["JwtSettings:Audience"],
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                };
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        if (!string.IsNullOrEmpty(accessToken)
                            && context.HttpContext.Request.Path.StartsWithSegments("/hubs/bookings"))
                            context.Token = accessToken;
                        return Task.CompletedTask;
                    }
                };
            });

            return services;
        }

        private static string GetJwtSecret(IConfiguration configuration)
        {
            var secret = configuration["JwtSettings:Secret"];
            if (string.IsNullOrWhiteSpace(secret))
            {
                throw new ArgumentException("JWT secret is not configured. Set 'JwtSettings:Secret' in configuration (appsettings.json).");
            }

            // Ensure secret meets minimum byte length for symmetric key
            if (Encoding.UTF8.GetByteCount(secret) < 32)
            {
                throw new ArgumentException("JWT secret must be at least 32 bytes long.");
            }

            return secret;
        }
    }
}
