import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  MessagesSquare,
  Users,
  BookOpen,
  Settings2,
  FlaskConical,
  Layers3,
  LogOut,
  Menu,
  X,
  ArrowRight,
} from "lucide-react";
import { adminToken, api, CHAT_KEY, json, setAdminToken } from "./api";
import { useBusiness, useLabels } from "./data";
import { ErrorNotice, Field, Loading, Notice, Submit } from "./ui";
const BusinessPage = lazy(() => import("./pages/Business"));
const Catalogue = lazy(() => import("./pages/Catalogue"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const Conversations = lazy(() => import("./pages/Conversations"));
const TestChat = lazy(() => import("./pages/TestChat"));

const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password."),
});
function Login({
  onLogin,
  expired,
}: {
  onLogin: () => void;
  expired: boolean;
}) {
  const [error, setError] = useState<unknown>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          assistly<span className="brand-dot">.</span>
        </div>
        <div>
          <h1>
            Your business,
            <br />
            in good order.
          </h1>
          <p>
            Manage appointments, keep your team’s availability up to date, and
            follow every customer conversation.
          </p>
        </div>
        <small>The Assistly workspace</small>
      </section>
      <section className="login-form">
        <div className="login-box">
          <h2>Welcome back</h2>
          <p>Sign in to your business workspace.</p>
          {expired && (
            <Notice kind="info">
              Your session ended. Sign in again to continue.
            </Notice>
          )}
          <form
            onSubmit={handleSubmit(async (values) => {
              setError(undefined);
              try {
                const result = await api<{ access_token: string }>(
                  "/auth/login",
                  json("POST", values),
                  "public",
                );
                setAdminToken(result.access_token);
                onLogin();
              } catch (e) {
                setError(e);
              }
            })}
          >
            <Field label="Username">
              <input
                autoComplete="username"
                autoFocus
                {...register("username")}
              />
              {errors.username && (
                <small className="field-error">{errors.username.message}</small>
              )}
            </Field>
            <Field label="Password">
              <input
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <small className="field-error">{errors.password.message}</small>
              )}
            </Field>
            <ErrorNotice error={error} />
            <Submit busy={isSubmitting}>
              Sign in <ArrowRight size={17} />
            </Submit>
          </form>
          <p className="quiet small">
            Use the administrator credentials configured for your business.
          </p>
        </div>
      </section>
    </div>
  );
}
export default function AdminApp() {
  const [authenticated, setAuthenticated] = useState(!!adminToken());
  const [expired, setExpired] = useState(false);
  const cache = useQueryClient();
  useEffect(() => {
    const end = () => {
      setAuthenticated(false);
      setExpired(true);
      sessionStorage.removeItem(CHAT_KEY);
      cache.clear();
    };
    window.addEventListener("assistly:expired", end);
    return () => window.removeEventListener("assistly:expired", end);
  }, [cache]);
  if (!authenticated)
    return (
      <Login
        expired={expired}
        onLogin={() => {
          setAuthenticated(true);
          setExpired(false);
        }}
      />
    );
  return (
    <Suspense fallback={<Loading />}>
      <Workspace
        logout={() => {
          setAdminToken(null);
          sessionStorage.removeItem(CHAT_KEY);
          cache.clear();
          setAuthenticated(false);
          setExpired(false);
        }}
      />
    </Suspense>
  );
}
function Workspace({ logout }: { logout: () => void }) {
  const business = useBusiness();
  const labels = useLabels();
  const [mobile, setMobile] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const links = [
    ["/appointments", CalendarDays, "Appointments"],
    ["/conversations", MessagesSquare, "Conversations"],
    ["/contacts", Users, `${labels.customer}s & leads`],
    ["/catalogue", Layers3, "Services & team"],
    ["/knowledge", BookOpen, "Knowledge"],
    ["/test-chat", FlaskConical, "Test chat"],
    ["/business", Settings2, "Business settings"],
  ] as const;
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobile(false);
      if (e.key === "Tab") {
        const items = focusable();
        const first = items[0];
        const last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", listener);
    return () => {
      window.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, [mobile]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 901px)");
    const changed = () => {
      if (desktop.matches) setMobile(false);
    };
    desktop.addEventListener("change", changed);
    return () => desktop.removeEventListener("change", changed);
  }, []);
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobile && (
        <button
          className="nav-backdrop"
          tabIndex={-1}
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        ref={sidebar}
        className={`sidebar ${mobile ? "open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="sidebar-brand">
          <div className="brand">
            assistly<span className="brand-dot">.</span>
          </div>
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <div className="business-chip">
          <div className="business-avatar">
            {business.data?.name.slice(0, 1) || "B"}
          </div>
          <div>
            <strong>{business.data?.name || "Your business"}</strong>
            <small>Business workspace</small>
          </div>
        </div>
        <div className="nav-label">MANAGE</div>
        <nav aria-label="Workspace">
          {links.map(([path, Icon, title]) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `${isActive ? "active" : ""} ${path === "/test-chat" ? "nav-group-separator" : ""}`
              }
              onClick={() => setMobile(false)}
            >
              <Icon size={19} />
              <span>{title}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="logout" onClick={logout}>
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>
      <div className="workspace-main" inert={mobile}>
        <div className="topbar">
          <div>
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span className="topbar-label">
              {business.data?.name || "Business workspace"}
            </span>
          </div>
          <div className="topbar-right">
            <span className="timezone">{labels.zone}</span>
            <span className="admin-avatar">A</span>
          </div>
        </div>
        <main id="main">
          <ErrorNotice error={business.error} />
          <Routes>
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/business" element={<BusinessPage />} />
            <Route path="/catalogue" element={<Catalogue />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/test-chat" element={<TestChat />} />
            <Route path="*" element={<Navigate replace to="/appointments" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
