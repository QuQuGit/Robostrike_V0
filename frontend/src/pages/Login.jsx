import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";

export default function Login() {
  const { t } = useI18n();
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.token, data.user);
      nav("/home");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return <AuthShell title={t("auth.login")} onSubmit={submit} loading={loading}
    cta={t("auth.loginCta")} alt={<Link to="/register" className="text-[#8b5cf6] hover:underline" data-testid="to-register">{t("auth.toRegister")}</Link>}>
    <Field testid="login-email" label={t("auth.email")} type="email" value={email} onChange={setEmail} />
    <Field testid="login-password" label={t("auth.password")} type="password" value={password} onChange={setPassword} />
  </AuthShell>;
}

export function AuthShell({ title, children, onSubmit, loading, cta, alt }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 rs-noise" data-testid="auth-page">
      <form onSubmit={onSubmit} className="rs-panel rounded-sm p-8 w-full max-w-sm">
        <Link to="/" className="font-display font-black text-2xl text-[#f97316] block mb-6">
          ROBO<span className="text-white">STRIKE</span>
        </Link>
        <h1 className="font-display text-xl mb-5">{title}</h1>
        <div className="space-y-4">{children}</div>
        <button
          data-testid="auth-submit"
          disabled={loading}
          className="w-full mt-6 py-2.5 rounded-sm bg-[#f97316] text-black font-bold uppercase tracking-widest text-sm hover:bg-[#ea580c] disabled:opacity-50"
        >
          {cta}
        </button>
        <p className="mt-4 text-sm text-center text-muted-foreground">{alt}</p>
      </form>
    </div>
  );
}

export function Field({ label, type, value, onChange, testid }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-mono-rs">{label}</span>
      <input
        data-testid={testid}
        type={type}
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-[#1c1c22] border border-border rounded-sm px-3 py-2 text-sm focus:border-[#f97316] outline-none"
      />
    </label>
  );
}
