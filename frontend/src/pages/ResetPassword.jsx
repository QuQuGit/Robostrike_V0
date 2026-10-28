import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { AuthShell, Field } from "./Login";

export function VerifyEmail() {
  const { t } = useI18n();
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [failed, setFailed] = useState(false);
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    api.post("/auth/verify-email", { token: params.get("token") || "" })
      .then(({ data }) => {
        login(data.token, data.user);
        toast.success(t("auth.verified"));
        nav("/home");
      })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 rs-noise" data-testid="verify-email-page">
      <div className="rs-panel rounded-sm p-8 w-full max-w-sm text-center space-y-4">
        <p className={failed ? "text-red-400" : "text-muted-foreground"} data-testid="verify-status">
          {failed ? t("auth.badLink") : t("auth.verifying")}
        </p>
        {failed && <Link to="/login" className="text-sm text-[#8b5cf6] hover:underline">{t("auth.backLogin")}</Link>}
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token: params.get("token") || "", password });
      toast.success(t("auth.resetDone"));
      nav("/login");
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(d === "invalid_or_expired_token" ? t("auth.badLink") : formatApiError(d));
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell title={t("auth.resetTitle")} onSubmit={submit} loading={loading} cta={t("auth.resetCta")}
      alt={<Link to="/login" className="text-[#8b5cf6] hover:underline">{t("auth.backLogin")}</Link>}>
      <Field testid="reset-password" label={`${t("auth.password")} (${t("auth.pwHint")})`} type="password" value={password} onChange={setPassword} />
    </AuthShell>
  );
}
