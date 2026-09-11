import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/session";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function AccountPage() {
  const { user, profile } = await getCurrentUserProfile();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">
          {profile?.full_name} · {profile?.email}
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
