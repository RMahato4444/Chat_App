import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await login(form); navigate('/', { replace: true }); }
    catch (err) { setError(err?.response?.data?.message || 'Unable to log in.'); }
    finally { setBusy(false); }
  };

  return <AuthLayout title="Welcome back" subtitle="Sign in with your GlassChat username.">
    <form onSubmit={submit} className="space-y-4">
      <label className="block"><span className="text-xs text-white/55">Username</span><input required value={form.username} onChange={e=>setForm({...form, username:e.target.value})} className="mt-2 w-full rounded-2xl glass-soft px-4 py-3 outline-none focus:border-emerald-300/40" placeholder="rahul_@123" /></label>
      <label className="block"><span className="text-xs text-white/55">Password</span><input required type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="mt-2 w-full rounded-2xl glass-soft px-4 py-3 outline-none focus:border-emerald-300/40" placeholder="••••••••" /></label>
      {error && <p className="rounded-xl bg-rose-500/10 border border-rose-400/15 px-3 py-2 text-xs text-rose-200">{error}</p>}
      <button disabled={busy} className="w-full rounded-2xl bg-emerald-400 text-[#05240f] font-bold py-3.5 disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <p className="text-center text-sm text-white/45 mt-6">New here? <Link className="text-aqua hover:underline" to="/signup">Create an account</Link></p>
  </AuthLayout>;
}
