'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Avatar from '@/components/Avatar';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import { toast, confirmDialog } from '@/components/Toast';
import { CHURCH_SHORT_NAME } from '@/config';
import {
  ArrowLeft, Edit, Trash2, Phone, Mail, Heart,
  AlertTriangle, Pill, Stethoscope, UserPlus, Plus,
  Camera, CheckCircle2, Circle, Sparkles, Users, Award, Star
} from 'lucide-react';

interface Student {
  id: number; first_name: string; last_name: string;
  date_of_birth?: string; grade?: string; group_id?: number;
  group_name?: string; group_color?: string; photo_url?: string; notes?: string;
  is_new_student?: number; enrolled_date?: string; family_id?: number;
  gender?: string; shirt_size?: string; school?: string;
  sacraments_received?: string; photo_release?: number; parents_are_members?: number;
  sacrament_prep?: string;
}
interface MedicalInfo {
  food_allergies?: string; allergies?: string; conditions?: string;
  special_needs?: string; medications?: string;
  doctor_name?: string; doctor_phone?: string; insurance_info?: string; notes?: string;
}
interface Contact {
  id: number; first_name: string; last_name: string;
  relationship: string; phone?: string; email?: string;
  is_primary: number; can_pickup: number;
}
interface AttendanceRecord {
  id: number; date: string; check_in_time?: string; check_out_time?: string;
}
interface ServiceLog {
  id: number; event_name: string; date: string;
  base_points: number; leadership_bonus: number; reflection_bonus: number; bonus_points: number;
  notes?: string; logged_by_name?: string;
}
interface ScholarshipTier { min: number; label: string; amount: number; }
interface Permissions {
  can_view_medical: number; can_view_contacts: number;
  can_edit_students: number; can_take_attendance: number;
}
interface FamilyMember {
  id: number; first_name: string; last_name: string;
  group_name?: string; group_color?: string;
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [student, setStudent] = useState<Student | null>(null);
  const [medical, setMedical] = useState<MedicalInfo | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [perms, setPerms] = useState<Permissions | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [serviceLogs, setServiceLogs] = useState<ServiceLog[]>([]);
  const [serviceTotal, setServiceTotal] = useState(0);
  const [serviceTier, setServiceTier] = useState<ScholarshipTier | null>(null);
  const [tab, setTab] = useState<'info' | 'medical' | 'contacts' | 'attendance' | 'service'>('info');
  const [loading, setLoading] = useState(true);

  const [editStudent, setEditStudent] = useState(false);
  const [editMedical, setEditMedical] = useState(false);
  const [addContact, setAddContact] = useState(false);
  const [groups, setGroups] = useState<{ id: number; name: string; color: string }[]>([]);

  const [studentForm, setStudentForm] = useState<Record<string, string>>({});
  const [medicalForm, setMedicalForm] = useState<Record<string, string>>({});
  const [contactForm, setContactForm] = useState({
    first_name: '', last_name: '', relationship: 'parent',
    phone: '', email: '', is_primary: false, can_pickup: true,
  });
  const [saving, setSaving] = useState(false);

  // Photo upload
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/students/${id}`).then(r => r.json()),
      fetch('/api/groups').then(r => r.json()),
    ]).then(([sd, grps]) => {
      if (sd.student) {
        setStudent(sd.student);
        setPerms(sd.permissions);
        setStudentForm({
          first_name: sd.student.first_name,
          last_name: sd.student.last_name,
          date_of_birth: sd.student.date_of_birth || '',
          grade: sd.student.grade || '',
          group_id: sd.student.group_id?.toString() || '',
          photo_url: sd.student.photo_url || '',
          notes: sd.student.notes || '',
          is_new_student: sd.student.is_new_student?.toString() || '0',
          gender: sd.student.gender || '',
          shirt_size: sd.student.shirt_size || '',
          school: sd.student.school || '',
          sacraments_received: sd.student.sacraments_received || '',
          photo_release: sd.student.photo_release?.toString() || '0',
          parents_are_members: sd.student.parents_are_members?.toString() || '0',
          sacrament_prep: sd.student.sacrament_prep || '',
        });
      }
      setGroups(Array.isArray(grps) ? grps : []);
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!perms) return;
    if (perms.can_view_medical) {
      fetch(`/api/students/${id}/medical`).then(r => r.json()).then(m => {
        setMedical(m);
        setMedicalForm({
          food_allergies: m.food_allergies || '',
          allergies: m.allergies || '',
          conditions: m.conditions || '',
          special_needs: m.special_needs || '',
          medications: m.medications || '',
          doctor_name: m.doctor_name || '',
          doctor_phone: m.doctor_phone || '',
          insurance_info: m.insurance_info || '',
          notes: m.notes || '',
        });
      });
    }
    if (perms.can_view_contacts) {
      fetch(`/api/students/${id}/contacts`).then(r => r.json()).then(setContacts);
    }
    fetch(`/api/attendance?student_id=${id}&limit=10`).then(r => r.json())
      .then(data => setAttendance(Array.isArray(data) ? data : []));
    fetch(`/api/service/student/${id}`).then(r => r.json()).then(data => {
      if (data.logs) setServiceLogs(data.logs);
      if (data.total !== undefined) setServiceTotal(data.total);
      if (data.tier) setServiceTier(data.tier);
    }).catch(() => {});
  }, [id, perms]);

  // Load family members when student is available
  useEffect(() => {
    if (student?.family_id) {
      fetch(`/api/families/${student.family_id}`).then(r => r.json()).then(data => {
        if (data.students) {
          setFamilyMembers(data.students.filter((m: FamilyMember) => m.id !== id));
        }
      }).catch(() => {});
    }
  }, [student, id]);

  async function saveStudent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...studentForm,
          group_id: studentForm.group_id ? Number(studentForm.group_id) : null,
          is_new_student: Number(studentForm.is_new_student),
        }),
      });
      if (!res.ok) throw new Error();
      const group = groups.find(g => g.id === Number(studentForm.group_id));
      setStudent(prev => prev ? {
        ...prev, ...studentForm,
        group_id: studentForm.group_id ? Number(studentForm.group_id) : undefined,
        group_name: group?.name,
        group_color: group?.color,
        is_new_student: Number(studentForm.is_new_student),
      } : prev);
      setEditStudent(false);
      toast.success('Student profile saved');
    } catch {
      toast.error('Could not save changes — please try again');
    } finally {
      setSaving(false);
    }
  }

  async function saveMedical(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${id}/medical`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(medicalForm),
      });
      if (!res.ok) throw new Error();
      setMedical(medicalForm);
      setEditMedical(false);
      toast.success('Medical information saved');
    } catch {
      toast.error('Could not save medical info — please try again');
    } finally {
      setSaving(false);
    }
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/students/${id}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...contactForm,
        is_primary: contactForm.is_primary ? 1 : 0,
        can_pickup: contactForm.can_pickup ? 1 : 0,
      }),
    });
    if (res.ok) {
      const { id: newId } = await res.json();
      setContacts(prev => [...prev, {
        id: newId, ...contactForm,
        is_primary: contactForm.is_primary ? 1 : 0,
        can_pickup: contactForm.can_pickup ? 1 : 0,
      }]);
      setAddContact(false);
      setContactForm({ first_name: '', last_name: '', relationship: 'parent', phone: '', email: '', is_primary: false, can_pickup: true });
      toast.success('Contact added');
    } else {
      toast.error('Could not add contact — please try again');
    }
    setSaving(false);
  }

  async function deleteContact(contactId: number) {
    const ok = await confirmDialog({
      title: 'Remove contact?',
      message: 'This contact will be removed from the student\'s profile.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
    if (res.ok) {
      setContacts(prev => prev.filter(c => c.id !== contactId));
      toast.success('Contact removed');
    } else {
      toast.error('Could not remove contact');
    }
  }

  async function archiveStudent() {
    const ok = await confirmDialog({
      title: 'Archive this student?',
      message: 'They will no longer appear in active lists. Their records are kept and they can be restored later.',
      confirmLabel: 'Archive',
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Student archived');
      router.push('/students');
    } else {
      toast.error('Could not archive student');
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await fetch(`/api/students/${id}/photo`, { method: 'POST', body: formData });
      if (res.ok) {
        const { photo_url } = await res.json();
        setStudent(prev => prev ? { ...prev, photo_url } : prev);
        toast.success('Photo updated');
      } else {
        toast.error('Could not upload photo — try a smaller image');
      }
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!student) {
    return (
      <AppShell>
        <div className="text-center py-16 text-gray-400">Student not found</div>
      </AppShell>
    );
  }

  // Onboarding checklist
  const hasPhoto = !!student.photo_url;
  const hasGroup = !!student.group_id;
  const hasMedical = !!(medical?.allergies || medical?.conditions || medical?.medications || medical?.doctor_name);
  const hasContacts = contacts.length > 0;
  const hasDOB = !!student.date_of_birth;
  const checklistItems = [
    { label: 'Profile photo uploaded', done: hasPhoto },
    { label: 'Assigned to a group', done: hasGroup },
    { label: 'Medical info filled', done: hasMedical },
    { label: 'Emergency contact added', done: hasContacts },
    { label: 'Date of birth set', done: hasDOB },
  ];
  const checklistDone = checklistItems.filter(c => c.done).length;
  const checklistPct = Math.round((checklistDone / checklistItems.length) * 100);

  const SERVICE_ELIGIBLE_GRADES = ['6', '7', '8', '9', '10', '11', '12'];
  const isServiceEligible = student?.grade ? SERVICE_ELIGIBLE_GRADES.includes(student.grade) : false;

  const tabs = [
    { id: 'info', label: 'Info' },
    ...(perms?.can_view_medical ? [{ id: 'medical', label: 'Medical' }] : []),
    ...(perms?.can_view_contacts ? [{ id: 'contacts', label: 'Contacts' }] : []),
    { id: 'attendance', label: 'Attendance' },
    ...(isServiceEligible ? [{ id: 'service', label: `Service${serviceTotal > 0 ? ` · ${serviceTotal}pts` : ''}` }] : []),
  ] as { id: typeof tab; label: string }[];

  return (
    <AppShell>
      <div className="space-y-5 max-w-3xl">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Student Profile</h1>
        </div>

        <div className="card p-6 flex items-center gap-5">
          {/* Avatar with photo upload overlay */}
          <div className="relative flex-shrink-0">
            <Avatar
              name={`${student.first_name} ${student.last_name}`}
              photoUrl={student.photo_url}
              size="xl"
              color={student.group_color}
            />
            {perms?.can_edit_students && (
              <>
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary-500 hover:bg-primary-700 text-white flex items-center justify-center shadow-lg transition-colors"
                  title="Upload photo"
                >
                  {photoUploading
                    ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Camera size={14} />}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-900">
                {student.first_name} {student.last_name}
              </h2>
              {student.is_new_student === 1 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                  <Sparkles size={11} /> New
                </span>
              )}
              {student.sacrament_prep && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                  ✝ Prep: {student.sacrament_prep}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {student.grade && <span className="text-sm text-gray-500">Grade {student.grade}</span>}
              {student.group_name && <Badge label={student.group_name} color={student.group_color} />}
              {student.date_of_birth && (
                <span className="text-sm text-gray-400">
                  DOB: {new Date(student.date_of_birth + 'T00:00:00').toLocaleDateString()}
                </span>
              )}
            </div>
            {student.notes && <p className="text-sm text-gray-500 mt-2">{student.notes}</p>}
          </div>
          {perms?.can_edit_students && (
            <div className="flex gap-2">
              <button onClick={() => setEditStudent(true)} title="Edit student"
                className="btn-icon text-gray-500">
                <Edit size={16} />
              </button>
              <button onClick={archiveStudent} title="Archive student"
                className="btn-icon text-red-400 hover:bg-red-50">
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="flex border-b border-gray-200 gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0
                ${tab === t.id
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <div className="space-y-4">
            <div className="card p-6 space-y-3">
              <h3 className="font-semibold text-gray-900">Basic Information</h3>
              <InfoRow label="Full Name" value={`${student.first_name} ${student.last_name}`} />
              <InfoRow label="Date of Birth" value={student.date_of_birth ? new Date(student.date_of_birth + 'T00:00:00').toLocaleDateString() : '—'} />
              <InfoRow label="Gender" value={student.gender || '—'} />
              <InfoRow label="Grade" value={student.grade ? (student.grade === 'K' ? 'Kindergarten' : `Grade ${student.grade}`) : '—'} />
              <InfoRow label="School" value={student.school || '—'} />
              <InfoRow label="Ministry Group" value={student.group_name || '—'} />
              <InfoRow label="Shirt Size" value={student.shirt_size || '—'} />
              <InfoRow label="Enrolled" value={student.enrolled_date ? new Date(student.enrolled_date + 'T00:00:00').toLocaleDateString() : '—'} />
              {student.notes && <InfoRow label="Notes" value={student.notes} />}
            </div>

            {/* Sacraments + parish info */}
            {(student.sacraments_received || student.photo_release !== undefined || student.parents_are_members !== undefined) && (
              <div className="card p-6 space-y-3">
                <h3 className="font-semibold text-gray-900">Parish Information</h3>
                {student.sacraments_received && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1.5">Sacraments Received</p>
                    <div className="flex flex-wrap gap-2">
                      {student.sacraments_received.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                        <span key={s} className="px-3 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full border border-primary-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <InfoRow label="Sacramental Prep" value={student.sacrament_prep ? `Enrolled — ${student.sacrament_prep}` : 'Not enrolled'} />
                <InfoRow label="Photo Release" value={student.photo_release ? 'Yes — approved' : 'No — not approved'} />
                <InfoRow label={`Parents are ${CHURCH_SHORT_NAME} members`} value={student.parents_are_members ? 'Yes' : 'No'} />
              </div>
            )}

            {/* Onboarding checklist (only for new students) */}
            {student.is_new_student === 1 && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles size={16} className="text-emerald-500" /> Onboarding Checklist
                  </h3>
                  <span className="text-sm font-medium text-emerald-600">{checklistPct}% complete</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${checklistPct}%` }}
                  />
                </div>
                <div className="space-y-2.5">
                  {checklistItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {item.done
                        ? <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                        : <Circle size={18} className="text-gray-300 flex-shrink-0" />}
                      <span className={`text-sm ${item.done ? 'text-gray-700 line-through' : 'text-gray-500'}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Family members */}
            {familyMembers.length > 0 && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <Users size={16} className="text-primary-500" /> Family Members
                </h3>
                <div className="space-y-2">
                  {familyMembers.map(m => (
                    <div key={m.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{m.first_name} {m.last_name}</p>
                      </div>
                      {m.group_name && <Badge label={m.group_name} color={m.group_color} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'medical' && (
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Medical Information</h3>
              {perms?.can_edit_students && (
                <button onClick={() => setEditMedical(true)}
                  className="flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-700">
                  <Edit size={14} /> Edit
                </button>
              )}
            </div>
            <MedicalSection icon={<AlertTriangle size={16} className="text-orange-500" />}
              label="Food Allergies" value={medical?.food_allergies} />
            <MedicalSection icon={<AlertTriangle size={16} className="text-red-500" />}
              label="Medical Allergies" value={medical?.allergies} />
            <MedicalSection icon={<Heart size={16} className="text-pink-500" />}
              label="Medical Conditions" value={medical?.conditions} />
            <MedicalSection icon={<Pill size={16} className="text-blue-500" />}
              label="Medications" value={medical?.medications} />
            <MedicalSection icon={<Sparkles size={16} className="text-purple-500" />}
              label="Special Learning Needs" value={medical?.special_needs} />
            <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-400 flex items-center gap-1">
                  <Stethoscope size={13} /> Doctor
                </p>
                <p className="text-sm text-gray-700 mt-0.5">{medical?.doctor_name || '—'}</p>
                {medical?.doctor_phone && (
                  <a href={`tel:${medical.doctor_phone}`} className="text-sm text-primary-500 flex items-center gap-1">
                    <Phone size={12} /> {medical.doctor_phone}
                  </a>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Insurance</p>
                <p className="text-sm text-gray-700 mt-0.5">{medical?.insurance_info || '—'}</p>
              </div>
            </div>
            {medical?.notes && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-400">Additional Notes</p>
                <p className="text-sm text-gray-700 mt-0.5">{medical.notes}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'contacts' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Parent / Guardian Contacts</h3>
              {perms?.can_edit_students && (
                <button onClick={() => setAddContact(true)}
                  className="btn-filled !px-4 !py-2 text-sm">
                  <UserPlus size={14} /> Add Contact
                </button>
              )}
            </div>
            {contacts.length === 0 ? (
              <div className="card py-10 text-center">
                <Phone size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-medium text-gray-500">No parent or emergency contacts yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  {perms?.can_edit_students
                    ? 'Tap "Add Contact" above so someone can be reached in an emergency'
                    : 'Ask an admin to add contact information for this student'}
                </p>
              </div>
            ) : contacts.map(c => (
              <div key={c.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900">{c.first_name} {c.last_name}</p>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                        {c.relationship}
                      </span>
                      {c.is_primary === 1 && (
                        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">Primary</span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {c.phone && (
                        <div className="flex items-center gap-2">
                          <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-500">
                            <Phone size={13} /> {c.phone}
                          </a>
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-full text-xs font-medium transition-colors"
                          >
                            <Phone size={11} /> Call
                          </a>
                        </div>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-500">
                          <Mail size={13} /> {c.email}
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {c.can_pickup ? 'Authorized for pickup' : 'Not authorized for pickup'}
                    </p>
                  </div>
                  {perms?.can_edit_students && (
                    <button onClick={() => deleteContact(c.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'attendance' && (
          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Recent Attendance</h3>
            </div>
            {attendance.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-500">No check-ins yet</p>
                <p className="text-xs text-gray-400 mt-1">This student hasn&apos;t been checked in — their history will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {attendance.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(a.date + 'T00:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-400">
                        In: {a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        {a.check_out_time && ` · Out: ${new Date(a.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                    <span className={`w-2 h-2 rounded-full ${a.check_in_time ? 'bg-green-500' : 'bg-gray-200'}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'service' && (
          <div className="space-y-4">
            {/* Points summary card */}
            <div className={`rounded-xl p-5 flex items-center gap-5 ${serviceTier ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex-shrink-0">
                {serviceTotal >= 125 ? <span className="text-4xl">🏆</span>
                : serviceTotal >= 75  ? <span className="text-4xl">🥇</span>
                : serviceTotal >= 50  ? <span className="text-4xl">🥈</span>
                : serviceTotal >= 25  ? <span className="text-4xl">🥉</span>
                : <Award size={36} className="text-gray-300" />}
              </div>
              <div className="flex-1">
                <p className="text-3xl font-bold text-gray-900">{serviceTotal} <span className="text-base font-normal text-gray-400">points</span></p>
                <p className="text-sm font-medium text-gray-600 mt-0.5">
                  {serviceTier ? `${serviceTier.label} Earned` : 'No scholarship yet · earn 25 pts for $25 off an event'}
                </p>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full bg-amber-500 transition-all"
                    style={{ width: `${Math.min((serviceTotal / 125) * 100, 100)}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {serviceTotal < 125 ? `${125 - serviceTotal} pts to Full Event · ` : ''}
                  {serviceLogs.length} service entr{serviceLogs.length === 1 ? 'y' : 'ies'}
                </p>
              </div>
              {perms?.can_edit_students && (
                <a href={`/service/log?student=${id}`}
                  className="btn-filled flex-shrink-0 flex items-center gap-1.5 text-sm">
                  <Plus size={14} /> Log Service
                </a>
              )}
            </div>

            {/* Scholarship tiers reference */}
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Scholarship Tiers</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                {[['🥉', '25 pts', '$25 off event'], ['🥈', '50 pts', '$50 off event'],
                  ['🥇', '75 pts', '$75 off event'], ['🏆', '125 pts', 'Full event covered']].map(([icon, pts, reward]) => (
                  <div key={pts} className="flex items-center gap-2">
                    <span>{icon}</span><span className="font-semibold">{pts}</span><span className="text-gray-400">— {reward}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Service log */}
            <div className="card">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Service History</h3>
              </div>
              {serviceLogs.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-gray-500">No service hours logged yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    When this teen volunteers at a parish event, tap &ldquo;Log Service&rdquo; above to award points
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {serviceLogs.map(log => {
                    const total = log.base_points + (log.leadership_bonus * 5) + (log.reflection_bonus * 3) + log.bonus_points;
                    return (
                      <div key={log.id} className="flex items-start justify-between px-5 py-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{log.event_name}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(log.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            {log.leadership_bonus ? ' · Leadership +5' : ''}
                            {log.reflection_bonus ? ' · Reflection +3' : ''}
                            {log.bonus_points > 0 ? ` · Bonus +${log.bonus_points}` : ''}
                          </p>
                          {log.notes && <p className="text-xs text-gray-400 italic mt-0.5">{log.notes}</p>}
                        </div>
                        <span className="flex-shrink-0 text-sm font-bold text-primary-600">+{total} pts</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {editStudent && (
        <Modal title="Edit Student" onClose={() => setEditStudent(false)} size="lg">
          <form onSubmit={saveStudent} className="space-y-4">
            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="First Name" value={studentForm.first_name} onChange={v => setStudentForm(p => ({ ...p, first_name: v }))} required />
              <FormField label="Last Name" value={studentForm.last_name} onChange={v => setStudentForm(p => ({ ...p, last_name: v }))} required />
            </div>

            {/* DOB, Gender */}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Date of Birth" type="date" value={studentForm.date_of_birth} onChange={v => setStudentForm(p => ({ ...p, date_of_birth: v }))} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select value={studentForm.gender} onChange={e => setStudentForm(p => ({ ...p, gender: e.target.value }))}
                  className="field-outlined bg-white">
                  <option value="">Select</option>
                  {['Male', 'Female', 'Prefer not to say'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {/* Grade, School */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                <select value={studentForm.grade} onChange={e => setStudentForm(p => ({ ...p, grade: e.target.value }))}
                  className="field-outlined bg-white">
                  <option value="">Select grade</option>
                  {['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(g => (
                    <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>
                  ))}
                </select>
              </div>
              <FormField label="School" value={studentForm.school} onChange={v => setStudentForm(p => ({ ...p, school: v }))} />
            </div>

            {/* Ministry Group, Shirt Size */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ministry Group</label>
                <select value={studentForm.group_id} onChange={e => setStudentForm(p => ({ ...p, group_id: e.target.value }))}
                  className="field-outlined bg-white">
                  <option value="">No group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shirt Size</label>
                <select value={studentForm.shirt_size} onChange={e => setStudentForm(p => ({ ...p, shirt_size: e.target.value }))}
                  className="field-outlined bg-white">
                  <option value="">Select</option>
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Youth S', 'Youth M', 'Youth L'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Sacraments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sacraments Received</label>
              <div className="flex flex-wrap gap-3">
                {['Baptism', 'First Communion', 'Reconciliation', 'Confirmation'].map(s => {
                  const current = (studentForm.sacraments_received || '').split(',').map(x => x.trim()).filter(Boolean);
                  const checked = current.includes(s);
                  return (
                    <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={e => {
                        const next = e.target.checked ? [...current, s] : current.filter(x => x !== s);
                        setStudentForm(p => ({ ...p, sacraments_received: next.join(', ') }));
                      }} className="rounded" />
                      {s}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Sacramental prep enrollment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sacramental Prep</label>
              <select value={studentForm.sacrament_prep || ''} onChange={e => setStudentForm(p => ({ ...p, sacrament_prep: e.target.value }))}
                className="field-outlined bg-white">
                <option value="">Not enrolled</option>
                <option value="First Communion">First Communion Prep</option>
                <option value="Confirmation">Confirmation Prep</option>
                <option value="OCIC">OCIC (OCIA for children)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Enrolled students are watched for missed classes — an alert appears on the dashboard
                if they miss more than 75% of their group&apos;s sessions
              </p>
            </div>

            {/* Checkboxes */}
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={studentForm.photo_release === '1'}
                  onChange={e => setStudentForm(p => ({ ...p, photo_release: e.target.checked ? '1' : '0' }))} className="rounded" />
                Photo release approved
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={studentForm.parents_are_members === '1'}
                  onChange={e => setStudentForm(p => ({ ...p, parents_are_members: e.target.checked ? '1' : '0' }))} className="rounded" />
                Parents are {CHURCH_SHORT_NAME} members
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={studentForm.is_new_student === '1'}
                  onChange={e => setStudentForm(p => ({ ...p, is_new_student: e.target.checked ? '1' : '0' }))} className="rounded" />
                Mark as new student
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={studentForm.notes} onChange={e => setStudentForm(p => ({ ...p, notes: e.target.value }))}
                rows={2} className="field-outlined resize-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditStudent(false)} className="btn-outlined flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-filled flex-1">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editMedical && (
        <Modal title="Edit Medical Information" onClose={() => setEditMedical(false)} size="lg">
          <form onSubmit={saveMedical} className="space-y-4">
            {([
              ['food_allergies',  'Food Allergies'],
              ['allergies',       'Medical Allergies (medicine, environmental)'],
              ['conditions',      'Medical Conditions'],
              ['special_needs',   'Special Learning Needs / Additional Support'],
              ['medications',     'Current Medications & Dosage'],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <textarea
                  value={medicalForm[key] || ''}
                  onChange={e => setMedicalForm(p => ({ ...p, [key]: e.target.value }))}
                  rows={2}
                  placeholder="None known"
                  className="field-outlined resize-none"
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Doctor's Name" value={medicalForm.doctor_name} onChange={v => setMedicalForm(p => ({ ...p, doctor_name: v }))} />
              <FormField label="Doctor's Phone" value={medicalForm.doctor_phone} onChange={v => setMedicalForm(p => ({ ...p, doctor_phone: v }))} />
            </div>
            <FormField label="Insurance Information" value={medicalForm.insurance_info} onChange={v => setMedicalForm(p => ({ ...p, insurance_info: v }))} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
              <textarea value={medicalForm.notes || ''} onChange={e => setMedicalForm(p => ({ ...p, notes: e.target.value }))}
                rows={2} className="field-outlined resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditMedical(false)} className="btn-outlined flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-filled flex-1">
                {saving ? 'Saving...' : 'Save Medical Info'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {addContact && (
        <Modal title="Add Contact" onClose={() => setAddContact(false)}>
          <form onSubmit={saveContact} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="First Name" value={contactForm.first_name} onChange={v => setContactForm(p => ({ ...p, first_name: v }))} required />
              <FormField label="Last Name" value={contactForm.last_name} onChange={v => setContactForm(p => ({ ...p, last_name: v }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Relationship<span className="text-red-500">*</span></label>
              <select value={contactForm.relationship} onChange={e => setContactForm(p => ({ ...p, relationship: e.target.value }))}
                className="field-outlined bg-white">
                {['parent', 'guardian', 'grandparent', 'aunt/uncle', 'sibling', 'emergency', 'other'].map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            <FormField label="Phone Number" value={contactForm.phone} onChange={v => setContactForm(p => ({ ...p, phone: v }))} />
            <FormField label="Email Address" type="email" value={contactForm.email} onChange={v => setContactForm(p => ({ ...p, email: v }))} />
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={contactForm.is_primary}
                  onChange={e => setContactForm(p => ({ ...p, is_primary: e.target.checked }))}
                  className="rounded" />
                Primary contact
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={contactForm.can_pickup}
                  onChange={e => setContactForm(p => ({ ...p, can_pickup: e.target.checked }))}
                  className="rounded" />
                Authorized for pickup
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setAddContact(false)} className="btn-outlined flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-filled flex-1">
                {saving ? 'Saving...' : 'Add Contact'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="text-sm text-gray-400 w-32 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-700">{value}</span>
    </div>
  );
}

function MedicalSection({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 flex items-center gap-1">{icon} {label}</p>
      <p className={`text-sm mt-0.5 ${value ? 'text-gray-700' : 'text-gray-400'}`}>{value || 'None reported'}</p>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="field-outlined"
      />
    </div>
  );
}

// Suppress unused import warnings
const _Plus = Plus;
void _Plus;
