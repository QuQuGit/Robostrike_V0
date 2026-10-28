import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "../lib/api";
import { useI18n } from "../i18n";
import { AuthShell, Field } from "./Login";

export function CheckEmail({ email }) {
  const { t, lang } = useI18n();
  const resend = async () => {
    await api.post("/auth/resend-verification", { email, lang });
    toast.success(t("auth.resent"));
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-4 rs-noise" data-testid="check-email">
      <div className="rs-panel rounded-sm p-8 w-full max-w-sm text-center space-y-4">
        <h1 className="font-display text-xl">{t("auth.checkEmail")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.checkEmailDesc", { email })}</p>
        <button data-testid="resend-verification" onClick={resend} className="text-sm text-[#f97316] hover:underline">{t("auth.resend")}</button>
        <p><Link to="/login" className="text-sm text-[#8b5cf6] hover:underline">{t("auth.backLogin")}</Link></p>
      </div>
    </div>
  );
}

export default function ForgotPassword() {
  const { t, lang } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email, lang });
      setSent(true);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell title={t("auth.forgotTitle")} onSubmit={submit} loading={loading || sent} cta={t("auth.forgotCta")}
      alt={<Link to="/login" className="text-[#8b5cf6] hover:underline">{t("auth.backLogin")}</Link>}>
      {sent ? <p className="text-sm text-green-400" data-testid="forgot-sent">{t("auth.forgotSent")}</p>
        : <Field testid="forgot-email" label={t("auth.email")} type="email" value={email} onChange={setEmail} />}
    </AuthShell>
  );
}
