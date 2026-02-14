import { Link, useLocation } from "react-router-dom";

type Props = {
  children: React.ReactNode;
  authed: boolean;
  onSignOut?: () => void;
};

export default function AppLayout({ children, authed, onSignOut }: Props) {
  const location = useLocation();

  const navLink = (to: string, label: string) => {
    const active = location.pathname.startsWith(to);
    return (
      <Link
        to={to}
        className={[
          "px-3 py-2 rounded-md text-sm font-semibold transition",
          active ? "text-white" : "text-white/80 hover:text-white",
        ].join(" ")}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <header className="h-14 bg-[#0d1b55] text-white flex items-center">
        <div className="w-full max-w-7xl mx-auto px-6 flex items-center gap-6">
          <div className="text-xl font-extrabold tracking-tight">CortexDocs AI</div>

          {authed && (
            <nav className="flex items-center gap-2 ml-6">
              {navLink("/chat", "Chat")}
              {navLink("/document", "Document")}
            </nav>
          )}

          <div className="ml-auto">
            {authed ? (
              <button
                onClick={onSignOut}
                className="inline-flex items-center gap-2 bg-emerald-200 text-emerald-900 hover:bg-emerald-300 px-4 py-2 rounded-full text-sm font-semibold transition"
              >
                <span className="text-base">⎋</span>
                Log Out
              </button>
            ) : (
              <div className="text-white/70 text-sm"> </div>
            )}
          </div>
        </div>
      </header>

      {/* Page */}
      <main className="w-full max-w-7xl mx-auto px-6 py-12">{children}</main>
    </div>
  );
}