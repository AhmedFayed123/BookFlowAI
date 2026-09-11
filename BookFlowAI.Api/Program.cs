using BookFlowAI.Application;
using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Infrastructure;
using BookFlowAI.Infrastructure.Services;
using Microsoft.OpenApi.Models;
using Serilog;

namespace BookFlowAI.Api
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // =========================================================
            // 1. Serilog Configuration
            // =========================================================

            builder.Host.UseSerilog((context, loggerConfig) =>
                loggerConfig.ReadFrom.Configuration(context.Configuration));


            // =========================================================
            // 2. Register Application & Infrastructure Services
            // =========================================================

            builder.Services.AddApplicationServices();

            builder.Services.AddInfrastructureServices(
                builder.Configuration);


            // =========================================================
            // 3. AI Service HttpClient
            // =========================================================

            builder.Services.AddHttpClient<IAiServiceClient, AiServiceClient>(
                client =>
                {
                    // اسم الـ container في Docker Compose
                    client.BaseAddress = new Uri(
                        builder.Configuration["AiService:BaseUrl"]
                        ?? "http://ai_service:8000");
                });


            // =========================================================
            // 4. CORS Configuration
            // =========================================================

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("Frontend", policy =>
                {
                    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                        ?? new[] { "http://localhost:3000" };
                    policy.WithOrigins(allowedOrigins)
                        .AllowAnyHeader()
                        .AllowAnyMethod()
                        .AllowCredentials();
                });
            });


            // =========================================================
            // 5. Controllers & Endpoints
            // =========================================================

            builder.Services.AddControllers();

            builder.Services.AddHealthChecks();
            builder.Services.AddEndpointsApiExplorer();


            // =========================================================
            // 6. Swagger Configuration
            // =========================================================

            builder.Services.AddSwaggerGen(options =>
            {
                options.SwaggerDoc("v1", new OpenApiInfo
                {
                    Title = "BookFlowAI API",
                    Version = "v1"
                });

                options.AddSecurityDefinition(
                    "Bearer",
                    new OpenApiSecurityScheme
                    {
                        Name = "Authorization",
                        Type = SecuritySchemeType.Http,
                        Scheme = "Bearer",
                        BearerFormat = "JWT",
                        In = ParameterLocation.Header,
                        Description = "Enter your JWT token."
                    });

                options.AddSecurityRequirement(
                    new OpenApiSecurityRequirement
                    {
                        {
                            new OpenApiSecurityScheme
                            {
                                Reference = new OpenApiReference
                                {
                                    Type = ReferenceType.SecurityScheme,
                                    Id = "Bearer"
                                }
                            },
                            Array.Empty<string>()
                        }
                    });
            });


            // =========================================================
            // 7. SignalR
            // =========================================================

            builder.Services.AddSignalR();


            // =========================================================
            // Build Application
            // =========================================================

            var app = builder.Build();


            // =========================================================
            // HTTP Request Pipeline
            // =========================================================

            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();

                app.UseSwaggerUI(c =>
                {
                    c.SwaggerEndpoint(
                        "/swagger/v1/swagger.json",
                        "BookFlowAI API v1");
                });
            }


            // =========================================================
            // Serilog
            // =========================================================

            app.UseSerilogRequestLogging();


            // =========================================================
            // HTTPS
            // =========================================================

            app.UseHttpsRedirection();


            // =========================================================
            // CORS
            // =========================================================

            app.UseCors("Frontend");


            // =========================================================
            // Authentication & Authorization
            // =========================================================

            app.UseAuthentication();

            app.UseAuthorization();


            // =========================================================
            // Controllers
            // =========================================================

            app.MapControllers();
            app.MapHealthChecks("/healthz");
            app.MapHealthChecks("/readyz");

            // =========================================================
            // SignalR Hub
            // =========================================================

            app.MapHub<BookFlowAI.Api.Hubs.BookingHub>(
                "/hubs/bookings");


            // =========================================================
            // Automatic Database Migration & Seeding
            // =========================================================

            using (var scope = app.Services.CreateScope())
            {
                var dbContext =
                    scope.ServiceProvider
                        .GetRequiredService<
                            BookFlowAI.Infrastructure.ApplicationDbContext>();

                try
                {
                    await BookFlowAI.Infrastructure.Persistence
                        .DbInitializer
                        .SeedAsync(dbContext);
                }
                catch (Exception ex)
                {
                    var logger = scope.ServiceProvider
                        .GetRequiredService<ILogger<Program>>();

                    logger.LogError(ex,
                        "Database initialization failed during application startup.");

                    throw;
                }
            }


            // =========================================================
            // Run Application
            // =========================================================

            app.Run();
        }
    }
}
