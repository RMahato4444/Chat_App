import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';

const USERNAME_RE = /^[A-Za-z0-9_@]+$/;

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (form.username.length < 3 || form.username.length > 24 || !USERNAME_RE.test(form.username)) return setError('Username: 3-24 characters using only letters, numbers, _ and @.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    setBusy(true);
    try { await signup({ username: form.username, password: form.password }); navigate('/', { replace: true }); }
    catch (err) { setError(err?.response?.data?.message || 'Unable to create account.'); }
    finally { setBusy(false); }
  };

  return <AuthLayout title="Create your account" subtitle="Your username is searchable so other people can invite you.">
    <form onSubmit={submit} className="space-y-4">
      <label className="block"><span className="text-xs text-white/55">Username</span><input required value={form.username} onChange={e=>setForm({...form, username:e.target.value})} className="mt-2 w-full rounded-2xl bg-white/5 border border-white/8 px-4 py-3 outline-none focus:border-aqua/50" placeholder="letters_numbers@only" /></label>
      <p className="text-[11px] text-white/30 -mt-2">Allowed: A-Z, a-z, 0-9, underscore (_) and @. Case is displayed as entered; usernames are matched case-insensitively.</p>
      <label className="block"><span className="text-xs text-white/55">Password</span><input required type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="mt-2 w-full rounded-2xl bg-white/5 border border-white/8 px-4 py-3 outline-none focus:border-aqua/50" placeholder="At least 8 characters" /></label>
      <label className="block"><span className="text-xs text-white/55">Confirm password</span><input required type="password" value={form.confirmPassword} onChange={e=>setForm({...form, confirmPassword:e.target.value})} className="mt-2 w-full rounded-2xl bg-white/5 border border-white/8 px-4 py-3 outline-none focus:border-aqua/50" /></label>
      {error && <p className="rounded-xl bg-rose-500/10 border border-rose-400/15 px-3 py-2 text-xs text-rose-200">{error}</p>}
      <button disabled={busy} className="w-full rounded-2xl bg-aqua text-ink font-bold py-3.5 disabled:opacity-50">{busy ? 'Creating…' : 'Create account'}</button>
    </form>
    <p className="text-center text-sm text-white/45 mt-6">Already registered? <Link className="text-aqua hover:underline" to="/login">Sign in</Link></p>
  </AuthLayout>;
}
