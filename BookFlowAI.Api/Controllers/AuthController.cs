using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace BookFlowAI.Api.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(
            [FromBody] RegisterRequest request)
        {
            var result = await _authService.RegisterAsync(request);

            return Ok(new
            {
                success = true,
                message = "تم إنشاء الحساب بنجاح.",
                data = result
            });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(
            [FromBody] LoginRequest request)
        {
            var result = await _authService.LoginAsync(request);

            if (result == null)
            {
                return Unauthorized(new
                {
                    success = false,
                    message = "البريد الإلكتروني أو كلمة المرور غير صحيحة."
                });
            }

            return Ok(new
            {
                success = true,
                message = "تم تسجيل الدخول بنجاح.",
                data = result
            });
        }

        [HttpPost("refresh-token")]
        public async Task<IActionResult> RefreshToken(
            [FromBody] RefreshTokenRequest request)
        {
            var result = await _authService.RefreshTokenAsync(request);

            return Ok(new
            {
                success = true,
                message = "تم تحديث التوكن بنجاح.",
                data = result
            });
        }

        [HttpPost("revoke-token")]
        public async Task<IActionResult> RevokeToken(
            [FromBody] string token)
        {
            var result = await _authService.RevokeTokenAsync(token);

            return result
                ? Ok(new
                {
                    success = true,
                    message = "تم إلغاء Refresh Token بنجاح."
                })
                : BadRequest(new
                {
                    success = false,
                    message = "التوكن غير صالح أو تم إلغاؤه مسبقاً."
                });
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout(
            [FromBody] string refreshToken)
        {
            var result = await _authService.RevokeTokenAsync(refreshToken);

            return result
                ? Ok(new
                {
                    success = true,
                    message = "تم تسجيل الخروج بنجاح."
                })
                : BadRequest(new
                {
                    success = false,
                    message = "التوكن غير صالح."
                });
        }
    }
}