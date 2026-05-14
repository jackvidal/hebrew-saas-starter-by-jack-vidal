import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen bg-secondary/40">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar fullName={user.fullName} email={user.email} />
        <main className="flex-1 overflow-x-auto p-6">{children}</main>
      </div>
    </div>
  );
}
