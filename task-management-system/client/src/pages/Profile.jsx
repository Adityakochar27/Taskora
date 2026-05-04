import { useEffect, useState } from 'react';
import { UserPlus, X, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { userService } from '../services/index.js';
import ContactPicker from '../components/ContactPicker.jsx';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    password: '',
  });
  const [saving, setSaving] = useState(false);

  // Contacts state
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [pickerValue, setPickerValue] = useState('');

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSave = async (e) => {
    e.preventDefault();
    const payload = { name: form.name, phone: form.phone };
    if (form.password) {
      if (form.password.length < 8) return toast.error('Password must be at least 8 chars');
      payload.password = form.password;
    }
    setSaving(true);
    try {
      const res = await userService.update(user._id, payload);
      setUser(res.user);
      localStorage.setItem('tf_user', JSON.stringify(res.user));
      setForm((f) => ({ ...f, password: '' }));
      toast.success('Profile updated');
    } catch { /* toasted */ }
    finally { setSaving(false); }
  };

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await userService.listContacts(user._id);
      setContacts(res.data || []);
    } catch { /* toasted */ }
    finally { setLoadingContacts(false); }
  };

  useEffect(() => { loadContacts(); /* eslint-disable-next-line */ }, [user?._id]);

  const addContact = async (uid) => {
    if (!uid) return;
    if (contacts.some((c) => String(c._id) === String(uid))) {
      toast('Already in your contacts');
      return;
    }
    try {
      await userService.addContacts(user._id, [uid]);
      toast.success('Added to contacts');
      setPickerValue('');
      loadContacts();
    } catch { /* toasted */ }
  };

  const removeContact = async (cid) => {
    try {
      await userService.removeContact(user._id, cid);
      setContacts((cs) => cs.filter((c) => String(c._id) !== String(cid)));
      toast.success('Removed from contacts');
    } catch { /* toasted */ }
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500">Manage your account details.</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xl font-semibold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-slate-900">{user?.name}</div>
            <div className="text-sm text-slate-500">{user?.email}</div>
            <span className="badge bg-brand-50 text-brand-700 mt-1">{user?.role}</span>
          </div>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" name="name" value={form.name} onChange={onChange} required />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" name="phone" placeholder="+919876543210" value={form.phone} onChange={onChange} />
            <p className="text-xs text-slate-500 mt-1">Used for WhatsApp notifications and inbound task creation.</p>
          </div>
          <div>
            <label className="label">New password (leave blank to keep current)</label>
            <input className="input" type="password" name="password" value={form.password} onChange={onChange} minLength={8} />
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Manage contacts */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Users size={16} /> Your contacts
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These appear by default when you assign tasks or pick people. You can still
              reach the rest of the org via the "Show everyone" toggle on any picker.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="label">Add a contact</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <ContactPicker
                value={pickerValue}
                onChange={(uid) => {
                  setPickerValue(uid);
                  addContact(uid);
                }}
                placeholder="Search the full org…"
                excludeIds={[user._id, ...contacts.map((c) => c._id)]}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tip: tap "Show everyone" inside the dropdown to reach people not yet in your contacts.
          </p>
        </div>

        {loadingContacts ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : contacts.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-6 border border-dashed border-slate-200 rounded-lg">
            <UserPlus className="mx-auto mb-2 text-slate-400" size={20} />
            You haven't added any contacts yet. Add the people you collaborate with most.
          </div>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <li
                key={c._id}
                className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg"
              >
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm font-medium shrink-0">
                  {c.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{c.name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {c.role}{c.department?.name ? ` · ${c.department.name}` : ''} · {c.email}
                  </div>
                </div>
                <button
                  onClick={() => removeContact(c._id)}
                  className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                  title="Remove from contacts"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
