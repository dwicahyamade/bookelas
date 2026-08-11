import { LoginForm } from "@/components/admin/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-sand px-4">
      <div className="w-full max-w-sm rounded-2xl bg-paper p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-ink">Masuk Admin</h1>
        <p className="mb-6 text-sm text-ink/60">Gunakan kata sandi admin untuk mengelola booking.</p>
        <LoginForm />
      </div>
    </main>
  );
}
