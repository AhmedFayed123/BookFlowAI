"use client";

import { useCallback, useEffect, useState } from "react";
import ActionIcon from "../../../components/ui/ActionIcon";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import WorkspaceShell from "../../../components/ui/WorkspaceShell";
import AsyncState, { buttonClass, cardClass, fieldClass } from "../../../components/ui/AsyncState";
import { useToast } from "../../../components/ui/ToastProvider";
import { businessCategoriesApi, servicesApi, type BusinessCategoryDto, type ServiceDto, type UpdateBusinessCategoryDto, type UpdateServiceDto } from "../../../lib/api";

const emptyService = (): UpdateServiceDto => ({ businessCategoryId: 0, name: "", description: "", price: 0, durationInMinutes: 30, isActive: true, imageUrl: "" });
const emptyCategory = (): UpdateBusinessCategoryDto => ({ name: "", slug: "", description: "", isActive: true });

export default function CatalogPage() {
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [categories, setCategories] = useState<BusinessCategoryDto[]>([]);
  const [service, setService] = useState(emptyService);
  const [category, setCategory] = useState(emptyCategory);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [serviceResult, categoryResult] = await Promise.all([servicesApi.getServices(), businessCategoriesApi.getAll(true)]);
      setServices(serviceResult); setCategories(categoryResult);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load the catalog."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const saveService = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!service.name.trim() || service.businessCategoryId < 1) { toast("Enter a service name and select an active category.", "warning"); return; }
    setSaving(true);
    try {
      if (serviceId !== null) await servicesApi.update(serviceId, { ...service, imageUrl: service.imageUrl?.trim() || null });
      else await servicesApi.create({ name: service.name, description: service.description, businessCategoryId: service.businessCategoryId, price: service.price, durationInMinutes: service.durationInMinutes, imageUrl: service.imageUrl?.trim() || null });
      toast("Service saved.", "success"); setService(emptyService()); setServiceId(null); await load();
    } catch (caught) { toast(caught instanceof Error ? caught.message : "Unable to save service.", "error"); }
    finally { setSaving(false); }
  };

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      if (categoryId !== null) await businessCategoriesApi.update(categoryId, category);
      else await businessCategoriesApi.create({ name: category.name, slug: category.slug, description: category.description });
      toast("Category saved.", "success"); setCategory(emptyCategory()); setCategoryId(null); await load();
    } catch (caught) { toast(caught instanceof Error ? caught.message : "Unable to save category.", "error"); }
    finally { setSaving(false); }
  };

  const archive = async (kind: "service" | "category", id: number) => {
    if (!window.confirm(`Archive this ${kind}? It will no longer appear in the public catalog.`)) return;
    setSaving(true);
    try {
      if (kind === "service") { await servicesApi.remove(id); if (serviceId === id) { setServiceId(null); setService(emptyService()); } }
      else { await businessCategoriesApi.remove(id); if (categoryId === id) { setCategoryId(null); setCategory(emptyCategory()); } }
      toast(`${kind === "service" ? "Service" : "Category"} archived.`, "success"); await load();
    } catch (caught) { toast(caught instanceof Error ? caught.message : "Unable to archive item.", "error"); }
    finally { setSaving(false); }
  };

  return <ProtectedRoute requiredRole="Admin"><WorkspaceShell role="Admin" eyebrow="Service operations" title="Services & categories" description="Keep your offering clear, current, and easy to book.">
    <AsyncState loading={loading} error={error} retry={() => void load()} />
    {!loading && !error && <>
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveService} className={cardClass}>
          <h2 className="text-xl font-semibold">{serviceId ? "Edit service" : "Add service"}</h2>
          <label className="block text-sm font-medium">Service name<input required value={service.name} onChange={(event) => setService({ ...service, name: event.target.value })} className={fieldClass} /></label>
          <label className="block text-sm font-medium">Category<select required value={service.businessCategoryId || ""} onChange={(event) => setService({ ...service, businessCategoryId: Number(event.target.value) })} className={fieldClass}><option value="">Choose category</option>{categories.filter((item) => item.isActive || item.id === service.businessCategoryId).map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : " (archived)"}</option>)}</select></label>
          <label className="block text-sm font-medium">Description<textarea value={service.description} onChange={(event) => setService({ ...service, description: event.target.value })} className={fieldClass} /></label>
          <label className="block text-sm font-medium">Image URL <span className="font-normal text-slate-500">(optional)</span><input type="url" maxLength={500} value={service.imageUrl ?? ""} onChange={(event) => setService({ ...service, imageUrl: event.target.value })} placeholder="https://example.com/service.jpg" className={fieldClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Use a public image URL. Images that cannot load use the category artwork automatically.</span></label>
          {service.imageUrl?.trim() && <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-slate-200 bg-slate-100"><img key={service.imageUrl} src={service.imageUrl} alt="Service image preview" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} className="h-full w-full object-cover" /><span className="absolute bottom-2 left-2 rounded-full bg-slate-950/60 px-2.5 py-1 text-xs font-medium text-white">Image preview</span></div>}
          <div className="grid grid-cols-2 gap-4"><label className="text-sm font-medium">Price<input required type="number" min="0" step="0.01" value={service.price} onChange={(event) => setService({ ...service, price: Number(event.target.value) })} className={fieldClass} /></label><label className="text-sm font-medium">Duration (minutes)<input required type="number" min="1" step="1" value={service.durationInMinutes} onChange={(event) => setService({ ...service, durationInMinutes: Number(event.target.value) })} className={fieldClass} /></label></div>
          <div className="flex gap-3"><button disabled={saving} className={buttonClass}><ActionIcon action="save" />{saving ? "Saving…" : "Save service"}</button>{serviceId && <button type="button" onClick={() => { setServiceId(null); setService(emptyService()); }} className="text-sm text-slate-600"><ActionIcon action="cancel" />Cancel edit</button>}</div>
        </form>
        <form onSubmit={saveCategory} className={cardClass}>
          <h2 className="text-xl font-semibold">{categoryId ? "Edit category" : "Add category"}</h2>
          <label className="block text-sm font-medium">Category name<input required value={category.name} onChange={(event) => setCategory({ ...category, name: event.target.value })} className={fieldClass} /></label>
          <label className="block text-sm font-medium">Slug<input value={category.slug ?? ""} placeholder="Generated from name if empty" onChange={(event) => setCategory({ ...category, slug: event.target.value })} className={fieldClass} /></label>
          <label className="block text-sm font-medium">Category description<textarea value={category.description ?? ""} onChange={(event) => setCategory({ ...category, description: event.target.value })} className={fieldClass} /></label>
          {categoryId && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={category.isActive} onChange={(event) => setCategory({ ...category, isActive: event.target.checked })} />Active category</label>}
          <div className="flex gap-3"><button disabled={saving} className={buttonClass}><ActionIcon action="save" />{saving ? "Saving…" : "Save category"}</button>{categoryId && <button type="button" onClick={() => { setCategoryId(null); setCategory(emptyCategory()); }} className="text-sm text-slate-600"><ActionIcon action="cancel" />Cancel edit</button>}</div>
        </form>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cardClass}><h2 className="text-lg font-semibold">Active services</h2><p className="text-xs leading-5 text-slate-500">The API lists active services in active categories only. Archived services are retained in SQL but cannot be listed here with the current API.</p>{services.length === 0 && <p className="text-sm text-slate-500">No active services yet.</p>}{services.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><div><p className="font-medium">{item.name}</p><p className="text-xs text-slate-500">{item.businessCategoryName} · ${item.price.toFixed(2)} · {item.durationInMinutes} min</p></div><div className="flex gap-3 text-sm"><button disabled={saving} onClick={() => { setServiceId(item.id); setService({ name: item.name, description: item.description, businessCategoryId: item.businessCategoryId, price: item.price, durationInMinutes: item.durationInMinutes, isActive: item.isActive, imageUrl: item.imageUrl ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="font-medium text-emerald-800"><ActionIcon action="edit" />Edit</button><button disabled={saving} onClick={() => void archive("service", item.id)} className="text-rose-700"><ActionIcon action="archive" />Archive</button></div></div>)}</section>
        <section className={cardClass}><h2 className="text-lg font-semibold">All categories</h2>{categories.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><div><p className="font-medium">{item.name}</p><p className="text-xs text-slate-500">{item.slug} · {item.isActive ? "Active" : "Archived"}</p></div><div className="flex gap-3 text-sm"><button disabled={saving} onClick={() => { setCategoryId(item.id); setCategory({ name: item.name, slug: item.slug, description: item.description, isActive: item.isActive }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="font-medium text-emerald-800"><ActionIcon action="edit" />Edit</button>{item.isActive && <button disabled={saving} onClick={() => void archive("category", item.id)} className="text-rose-700"><ActionIcon action="archive" />Archive</button>}</div></div>)}</section>
      </div>
    </>}
  </WorkspaceShell></ProtectedRoute>;
}
