import AdminShell from '@/components/AdminShell';
import AuthGate from '@/components/AuthGate';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AdminShell>{children}</AdminShell>
    </AuthGate>
  );
}
