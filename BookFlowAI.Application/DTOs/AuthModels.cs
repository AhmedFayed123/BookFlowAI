using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BookFlowAI.Application.DTOs
{
    public record RegisterRequest(string Name, string Email, string Password, string? PhoneNumber);
    public record LoginRequest(string Email, string Password);
    public record RefreshTokenRequest(string AccessToken, string RefreshToken);
    public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
    public record UpdateProfileRequest(string Name, string? PhoneNumber);
    public record CreateUserByAdminRequest(string Name, string Email, string Password, string Role, string? PhoneNumber);

    public class AuthResponse
    {
        public string Token { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
        public DateTime RefreshTokenExpiration { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    public class UserProfileResponse
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
    }
}
