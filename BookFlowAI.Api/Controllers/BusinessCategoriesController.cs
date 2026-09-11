using System.Text.RegularExpressions;
using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using BookFlowAI.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookFlowAI.Api.Controllers;

[ApiController]
[Route("api/business-categories")]
public partial class BusinessCategoriesController : ControllerBase
{
    private readonly IApplicationDbContext _context;

    public BusinessCategoriesController(IApplicationDbContext context) => _context = context;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BusinessCategoryDto>>> GetAll([FromQuery] bool includeInactive = false)
    {
        var query = _context.BusinessCategories.AsNoTracking();
        if (!includeInactive || !User.IsInRole("Admin"))
        {
            query = query.Where(category => category.IsActive);
        }

        return Ok(await query.OrderBy(category => category.Name)
            .Select(category => new BusinessCategoryDto(
                category.Id, category.Name, category.Slug, category.Description, category.IsActive))
            .ToListAsync());
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<BusinessCategoryDto>> Create(CreateBusinessCategoryDto request)
    {
        var name = request.Name.Trim();
        var slug = ToSlug(string.IsNullOrWhiteSpace(request.Slug) ? name : request.Slug);
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(slug))
        {
            return BadRequest(new { message = "Category name and slug are required." });
        }

        if (await _context.BusinessCategories.AnyAsync(category => category.Name == name || category.Slug == slug))
        {
            return Conflict(new { message = "A category with the same name or slug already exists." });
        }

        var category = new BusinessCategory
        {
            Name = name,
            Slug = slug,
            Description = request.Description?.Trim() ?? string.Empty
        };
        _context.BusinessCategories.Add(category);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new { id = category.Id },
            new BusinessCategoryDto(category.Id, category.Name, category.Slug, category.Description, category.IsActive));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, UpdateBusinessCategoryDto request)
    {
        var category = await _context.BusinessCategories.FindAsync(id);
        if (category is null) return NotFound(new { message = "Category not found." });

        var name = request.Name.Trim();
        var slug = ToSlug(string.IsNullOrWhiteSpace(request.Slug) ? name : request.Slug);
        if (await _context.BusinessCategories.AnyAsync(item => item.Id != id && (item.Name == name || item.Slug == slug)))
        {
            return Conflict(new { message = "A category with the same name or slug already exists." });
        }

        category.Name = name;
        category.Slug = slug;
        category.Description = request.Description?.Trim() ?? string.Empty;
        category.IsActive = request.IsActive;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await _context.BusinessCategories.FindAsync(id);
        if (category is null) return NotFound(new { message = "Category not found." });

        category.IsActive = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static string ToSlug(string value) =>
        InvalidSlugCharacters().Replace(value.Trim().ToLowerInvariant().Replace(' ', '-'), "-").Trim('-');

    [GeneratedRegex("[^a-z0-9-]+")]
    private static partial Regex InvalidSlugCharacters();
}
