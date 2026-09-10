using BCrypt.Net;
using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using BookFlowAI.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace BookFlowAI.Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly IApplicationDbContext _context;
        private readonly IConfiguration _config;

        public AuthService(
            IApplicationDbContext context,
            IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // =========================================================
        // REGISTER
        // =========================================================

        public async Task<AuthResponse> RegisterAsync(
            RegisterRequest request)
        {
            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            {
                throw new Exception("البريد الإلكتروني مُسجل بالفعل.");
            }

            var user = new User
            {
                Name = request.Name,
                Email = request.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = "Customer",
                PhoneNumber = request.PhoneNumber
            };

            _context.Users.Add(user);

            // حفظ المستخدم أولاً للحصول على Id
            await _context.SaveChangesAsync();

            return await GenerateAuthResponseAsync(user);
        }

        // =========================================================
        // CREATE USER BY ADMIN
        // =========================================================

        public async Task<bool> CreateUserByAdminAsync(
            CreateUserByAdminRequest request)
        {
            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            {
                return false;
            }

            var user = new User
            {
                Name = request.Name,
                Email = request.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = request.Role,
                PhoneNumber = request.PhoneNumber
            };

            _context.Users.Add(user);

            await _context.SaveChangesAsync();

            return true;
        }

        // =========================================================
        // LOGIN
        // =========================================================

        public async Task<AuthResponse?> LoginAsync(
            LoginRequest request)
        {
            var user = await _context.Users
                .Include(u => u.RefreshTokens)
                .FirstOrDefaultAsync(u => u.Email == request.Email);

            // المستخدم غير موجود
            if (user == null)
            {
                return null;
            }

            // كلمة المرور غير صحيحة
            var passwordValid = BCrypt.Net.BCrypt.Verify(
                request.Password,
                user.PasswordHash
            );

            if (!passwordValid)
            {
                return null;
            }

            return await GenerateAuthResponseAsync(user);
        }

        // =========================================================
        // REFRESH TOKEN
        // =========================================================

        public async Task<AuthResponse> RefreshTokenAsync(
            RefreshTokenRequest request)
        {
            var user = await _context.Users
                .Include(u => u.RefreshTokens)
                .FirstOrDefaultAsync(
                    u => u.RefreshTokens.Any(
                        t => t.Token == request.RefreshToken));

            if (user == null)
            {
                throw new Exception("توكن غير صالح.");
            }

            var refreshToken = user.RefreshTokens
                .Single(t => t.Token == request.RefreshToken);

            if (!refreshToken.IsActive)
            {
                throw new Exception("منتهي الصلاحية أو تم إلغاؤه.");
            }

            // إلغاء الـ Refresh Token القديم
            refreshToken.RevokedOn = DateTime.UtcNow;

            return await GenerateAuthResponseAsync(user);
        }

        // =========================================================
        // REVOKE TOKEN
        // =========================================================

        public async Task<bool> RevokeTokenAsync(string token)
        {
            var user = await _context.Users
                .Include(u => u.RefreshTokens)
                .FirstOrDefaultAsync(
                    u => u.RefreshTokens.Any(
                        t => t.Token == token));

            if (user == null)
            {
                return false;
            }

            var refreshToken = user.RefreshTokens
                .Single(t => t.Token == token);

            if (!refreshToken.IsActive)
            {
                return false;
            }

            refreshToken.RevokedOn = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return true;
        }

        // =========================================================
        // GET CURRENT USER
        // =========================================================

        public async Task<UserProfileResponse> GetCurrentUserAsync(
            int userId)
        {
            var user = await _context.Users.FindAsync(userId);

            if (user == null)
            {
                throw new Exception("المستخدم غير موجود.");
            }

            return new UserProfileResponse
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                PhoneNumber = user.PhoneNumber
            };
        }

        // =========================================================
        // UPDATE PROFILE
        // =========================================================

        public async Task<bool> UpdateProfileAsync(
            int userId,
            UpdateProfileRequest request)
        {
            var user = await _context.Users.FindAsync(userId);

            if (user == null)
            {
                return false;
            }

            user.Name = request.Name;
            user.PhoneNumber = request.PhoneNumber;

            await _context.SaveChangesAsync();

            return true;
        }

        // =========================================================
        // CHANGE PASSWORD
        // =========================================================

        public async Task<bool> ChangePasswordAsync(
            int userId,
            ChangePasswordRequest request)
        {
            var user = await _context.Users.FindAsync(userId);

            if (user == null)
            {
                return false;
            }

            var currentPasswordValid =
                BCrypt.Net.BCrypt.Verify(
                    request.CurrentPassword,
                    user.PasswordHash);

            if (!currentPasswordValid)
            {
                return false;
            }

            user.PasswordHash =
                BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

            await _context.SaveChangesAsync();

            return true;
        }

        // =========================================================
        // GENERATE AUTH RESPONSE
        // =========================================================

        private async Task<AuthResponse> GenerateAuthResponseAsync(
            User user)
        {
            var jwtToken = CreateJwtToken(user);

            var refreshToken = GenerateRefreshToken();

            user.RefreshTokens.Add(refreshToken);

            await _context.SaveChangesAsync();

            return new AuthResponse
            {
                Token = jwtToken,
                RefreshToken = refreshToken.Token,
                RefreshTokenExpiration = refreshToken.ExpiresOn,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role
            };
        }

        // =========================================================
        // CREATE JWT TOKEN
        // =========================================================

        private string CreateJwtToken(User user)
        {
            var secretKey = _config["JwtSettings:Secret"];

            if (string.IsNullOrEmpty(secretKey))
            {
                throw new InvalidOperationException(
                    "لم يتم العثور على المفتاح JwtSettings:Secret في ملف appsettings.json.");
            }

            var claims = new[]
            {
                new Claim(
                    ClaimTypes.NameIdentifier,
                    user.Id.ToString()),

                new Claim(
                    ClaimTypes.Email,
                    user.Email),

                new Claim(
                    ClaimTypes.Name,
                    user.Name),

                new Claim(
                    ClaimTypes.Role,
                    user.Role)
            };

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(secretKey));

            var credentials = new SigningCredentials(
                key,
                SecurityAlgorithms.HmacSha256);

            var expiryInMinutes =
                double.TryParse(
                    _config["JwtSettings:ExpiryInMinutes"],
                    out var exp)
                    ? exp
                    : 60;

            var token = new JwtSecurityToken(
                issuer: _config["JwtSettings:Issuer"],
                audience: _config["JwtSettings:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(
                    expiryInMinutes),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler()
                .WriteToken(token);
        }

        // =========================================================
        // GENERATE REFRESH TOKEN
        // =========================================================

        private static RefreshToken GenerateRefreshToken()
        {
            var randomNumber = new byte[64];

            using var rng =
                RandomNumberGenerator.Create();

            rng.GetBytes(randomNumber);

            return new RefreshToken
            {
                Token = Convert.ToBase64String(randomNumber),
                ExpiresOn = DateTime.UtcNow.AddDays(7)
            };
        }
    }
}