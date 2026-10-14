import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { Cpu, Footprints, Crosshair, Globe } from "lucide-react";

export default function Landing() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();

  const feats = [
    { icon: Cpu, title: t("landing.f1"), desc: t("landing.f1d") },
    { icon: Footprints, title: t("landing.f2"), desc: t("landing.f2d") },
    { icon: Crosshair, title: t("landing.f3"), desc: t("landing.f3d") },
  ];

  return (
    <div className="min-h-screen rs-noise relative overflow-hidden" data-testid="landing-page">
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1636776732114-d38e40ac2837?crop=entropy&cs=srgb&fm=jpg&q=70&w=1600')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 75%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 75%)",
        }}
      />
      <div className="absolute top-5 right-5 z-10">
        <button
          data-testid="landing-lang"
          onClick={() => setLang(lang === "fr" ? "en" : "fr")}
          className="flex items-center gap-1 text-xs font-mono-rs text-muted-foreground hover:text-white"
        >
          <Globe size={14} /> {lang.toUpperCase()}
        </button>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-5 pt-28 pb-20">
        <p className="font-mono-rs text-[#f97316] uppercase tracking-[0.4em] text-xs mb-4">
          {t("app.tagline")}
        </p>
        <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl leading-none mb-6">
          ROBO<span className="text-[#f97316]">STRIKE</span>
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-xl mb-10">
          {t("landing.sub")}
        </p>
        <div className="flex gap-3">
          {user ? (
            <Link
              to="/home"
              data-testid="landing-enter"
              className="px-7 py-3 rounded-sm bg-[#f97316] text-black font-bold uppercase tracking-widest text-sm hover:bg-[#ea580c] rs-glow-orange"
            >
              {t("landing.enter")}
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                data-testid="landing-register"
                className="px-7 py-3 rounded-sm bg-[#f97316] text-black font-bold uppercase tracking-widest text-sm hover:bg-[#ea580c] rs-glow-orange"
              >
                {t("landing.enter")}
              </Link>
              <Link
                to="/login"
                data-testid="landing-login"
                className="px-7 py-3 rounded-sm border border-[#8b5cf6] text-[#8b5cf6] font-bold uppercase tracking-widest text-sm hover:bg-[#8b5cf6]/10"
              >
                {t("auth.login")}
              </Link>
            </>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-20">
          {feats.map((f, i) => (
            <div key={i} className="rs-panel rounded-sm p-5">
              <f.icon className="text-[#f97316] mb-3" size={22} />
              <h3 className="font-display text-base mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
