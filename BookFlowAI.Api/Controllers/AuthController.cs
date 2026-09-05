using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace BookFlowAI.Api.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController: ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
            => Ok(await _authService.RegisterAsync(request));

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
            => Ok(await _authService.LoginAsync(request));

        [HttpPost("refresh-token")]
        public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
            => Ok(await _authService.RefreshTokenAsync(request));
        [HttpPost("revoke-token")]
        public async Task<IActionResult> RevokeToken([FromBody] string token)
        {
            var result = await _authService.RevokeTokenAsync(token);
            return result
                ? Ok(new { message = "تم إلغاء Refresh Token بنجاح." })
                : BadRequest("التوكن غير صالح أو تم إلغاؤه مسبقاً.");
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout([FromBody] string refreshToken)
        {
            var result = await _authService.RevokeTokenAsync(refreshToken);
            return result ? Ok(new { message = "تم تسجيل الخروج بنجاح." }) : BadRequest("التوكن غير صالح.");
        }
    }
}
