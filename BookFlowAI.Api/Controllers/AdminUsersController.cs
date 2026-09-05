using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BookFlowAI.Api.Controllers
{
    [Authorize(Roles = "Admin")] // متاح فقط للأدمن
    [ApiController]
    [Route("api/admin/users")]
    public class AdminUsersController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AdminUsersController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserByAdminRequest request)
        {
            var result = await _authService.CreateUserByAdminAsync(request);
            return result
                ? Ok(new { message = "تم إنشاء الحساب بنجاح." })
                : BadRequest("البريد الإلكتروني مُسجل بالفعل.");
        }
    }
}