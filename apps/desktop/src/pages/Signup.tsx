// src/pages/Signup.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as API from "../Api";

export default function Signup({ onAuthed }: { onAuthed?: () => void }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const { error } = await API.signup(email, password);

    setLoading(false);
    if (error) return setErr(error.message);

    onAuthed?.();
    nav("/dashboard", { replace: true });
  }

  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-full max-w-xl bg-white rounded-md shadow-sm border border-slate-200 p-10">
        <div className="flex justify-center mb-6">
          <div className="h-10 w-10 rounded-full bg-white overflow-hidden flex items-center justify-center border border-slate-200">
            <img
              src="/logo.png"
              alt="CortexDocs AI Logo"
              className="h-14 w-14 object-contain"
              draggable={false}
            />
          </div>
        </div>
        <h1 className="text-3xl font-extrabold text-center text-slate-800">Sign Up</h1>

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Email Address
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="enter email address here..."
              className="w-full h-11 rounded-sm border border-slate-200 bg-slate-50 px-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="enter password here..."
                className="w-full h-11 rounded-sm border border-slate-200 bg-slate-50 px-4 pr-12 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {err}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-sm transition disabled:opacity-60"
          >
            {loading ? "Signing up..." : "Sign Up"}
          </button>

          <div className="pt-4 border-t border-slate-200 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 font-semibold hover:underline">
              Log In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
