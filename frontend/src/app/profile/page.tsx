"use client";

import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { updateProfile, uploadAvatar } from "@/lib/api";
import { useSession } from "@/lib/SessionProvider";

export default function ProfilePage() {
  const { user, isDemo, updateUser } = useSession();
  const [displayName, setDisplayName] = useState(user.display_name);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatar_url,
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isDemo) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Sign in to manage your profile.
      </div>
    );
  }

  const initials = user.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please select an image file." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image must be under 5 MB." });
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      let newAvatarUrl = user.avatar_url;

      if (avatarFile) {
        newAvatarUrl = await uploadAvatar(user.id, avatarFile);
      }

      const updates: Record<string, string | null> = {};
      if (displayName.trim() !== user.display_name) {
        updates.display_name = displayName.trim();
      }
      if (newAvatarUrl !== user.avatar_url) {
        updates.avatar_url = newAvatarUrl;
      }

      if (Object.keys(updates).length > 0) {
        await updateProfile(updates);
        updateUser({
          ...(updates.display_name ? { display_name: updates.display_name } : {}),
          ...(updates.avatar_url !== undefined
            ? { avatar_url: updates.avatar_url }
            : {}),
        });
      }

      setAvatarFile(null);
      setMessage({ type: "success", text: "Profile updated!" });
    } catch (err) {
      console.error("Profile save error:", err);
      setMessage({ type: "error", text: "Failed to update profile." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <section className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your display name and profile photo
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative"
            >
              <div className="flex size-24 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted text-2xl font-medium text-muted-foreground">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="size-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera size={24} className="text-white" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              Click to upload a photo
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="display-name"
              className="text-sm font-medium"
            >
              Display Name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Andrew ID</label>
            <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {user.andrew_id}
            </p>
          </div>

          {message && (
            <p
              className={`text-sm ${message.type === "success" ? "text-green-600" : "text-destructive"}`}
            >
              {message.text}
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (!avatarFile && displayName.trim() === user.display_name)}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner className="size-4" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
