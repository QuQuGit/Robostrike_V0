import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { AuthShell, Field } from "./Login";

export default function Register() {
  const { t } = useI18n();
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", { email, username, password });
      login(data.token, data.user);
      nav("/home");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t("auth.register")}
      onSubmit={submit}
      loading={loading}
      cta={t("auth.registerCta")}
      alt={<Link to="/login" className="text-[#8b5cf6] hover:underline" data-testid="to-login">{t("auth.toLogin")}</Link>}
    >
      <Field testid="register-username" label={t("auth.username")} type="text" value={username} onChange={setUsername} />
      <Field testid="register-email" label={t("auth.email")} type="email" value={email} onChange={setEmail} />
      <Field testid="register-password" label={t("auth.password")} type="password" value={password} onChange={setPassword} />
    </AuthShell>
  );
}
