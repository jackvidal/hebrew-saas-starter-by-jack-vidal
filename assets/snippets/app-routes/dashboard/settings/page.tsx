import { requireUser } from "@/lib/auth";
import { SettingsForm } from "@/components/settings/settings-form";
import { t } from "@/i18n/he";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
      <SettingsForm
        defaultFullName={user.fullName ?? ""}
        defaultCalOrganizerEmail={user.calOrganizerEmail ?? ""}
        defaultWhatsappNumber={user.whatsappNumber ?? ""}
        defaultWassenderToken={user.wassenderToken ?? ""}
        email={user.email}
      />
    </div>
  );
}
