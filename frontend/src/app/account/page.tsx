"use client";

import { KeyRound } from "lucide-react";
import ActionIcon from "../../components/ui/ActionIcon";
import { useEffect, useState } from "react";
import ProtectedRoute from "../../components/auth/ProtectedRoute";
import WorkspaceShell from "../../components/ui/WorkspaceShell";
import { useToast } from "../../components/ui/ToastProvider";
import AsyncState, { buttonClass, fieldClass } from "../../components/ui/AsyncState";
import { accountApi, type UserProfileResponse } from "../../lib/api";

export default function AccountPage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    void accountApi.getProfile()
      .then((result) => { setProfile(result); setName(result.name); setPhoneNumber(result.phoneNumber ?? ""); })
      .catch((error: unknown) => setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load your account.",
      }));
  }, []);

  const updateProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !name.trim()) return;
    setProfileSaving(true); setProfileError(null);
    try {
      if (!await accountApi.updateProfile({ name: name.trim(), phoneNumber: phoneNumber.trim() || null })) throw new Error("Profile could not be updated.");
      const updated = { ...profile, name: name.trim(), phoneNumber: phoneNumber.trim() || null };
      setProfile(updated);
      window.localStorage.setItem("bookflow_user", JSON.stringify(updated));
      window.dispatchEvent(new Event("bookflow:profile-updated"));
      toast("Profile updated.", "success");
    } catch (caught) { setProfileError(caught instanceof Error ? caught.message : "Unable to update profile."); }
    finally { setProfileSaving(false); }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);

    if (newPassword.length < 8) {
      setNotice({ type: "error", message: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ type: "error", message: "New password and confirmation do not match." });
      return;
    }
    if (currentPassword === newPassword) {
      setNotice({ type: "error", message: "Choose a password different from your current password." });
      return;
    }

    setSaving(true);
    try {
      await accountApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice({ type: "success", message: "Password changed successfully." });
      toast("Password changed successfully.", "success");
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to change your password." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      {profile ? (
        <WorkspaceShell
          role={profile.role}
          eyebrow="Account security"
          title="Your account"
          description="Review your profile and keep your sign-in credentials secure."
        >
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <section className="surface-card rounded-2xl p-6 shadow-sm">
              <p className="text-xs font-semibold tracking-wide text-emerald-700">Profile</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">{profile.name}</h2>
              <p className="mt-1 text-slate-500">{profile.email}</p>
              <span className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{profile.role}</span>
              <form onSubmit={updateProfile} className="mt-6 space-y-4 border-t border-slate-100 pt-5">
                <label className="block text-sm font-medium">Display name<input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className={fieldClass} /></label>
                <label className="block text-sm font-medium">Phone number<input type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} autoComplete="tel" className={fieldClass} /></label>
                {profileError && <p role="alert" className="text-sm text-rose-700">{profileError}</p>}
                <button disabled={profileSaving} className={buttonClass}><ActionIcon action="save" />{profileSaving ? "Saving…" : "Save profile"}</button>
              </form>
            </section>

            <form onSubmit={changePassword} className="surface-card rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><KeyRound className="h-5 w-5" /></span>
                <div><h2 className="text-xl font-semibold text-slate-950">Change password</h2><p className="text-sm text-slate-500">Use at least 8 characters.</p></div>
              </div>

              {notice && <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{notice.message}</div>}

              <div className="mt-5 grid gap-4">
                <label className="text-sm font-semibold text-slate-700">Current password<input required autoComplete="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
                <label className="text-sm font-semibold text-slate-700">New password<input required minLength={8} autoComplete="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
                <label className="text-sm font-semibold text-slate-700">Confirm new password<input required minLength={8} autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
              </div>
              <button disabled={saving} className="mt-5 rounded-xl button-primary px-5 py-3 text-sm font-semibold text-white transition-all duration-200 ease-in-out hover:brightness-110 disabled:opacity-50"><ActionIcon action="save" />{saving ? "Updating..." : "Update password"}</button>
            </form>
          </div>
        </WorkspaceShell>
      ) : (
        <div className="hero-canvas flex min-h-screen items-center justify-center bg-background px-4"><div className="w-full max-w-2xl"><AsyncState loading={!notice?.message} error={notice?.message} /></div></div>
      )}
    </ProtectedRoute>
  );
}
