'use client';

import { T } from '@/components/T';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

type Role = 'student' | 'teacher' | 'parent' | '';

export default function RegistrationPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState('');
  const [phone, setPhone] = useState('');
  const [className, setClassName] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [childName, setChildName] = useState('');
  const [childEmail, setChildEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const classOptions = ['7th', '8th', '9th'];
  const languageOptions = [
    'English',
    'Hindi',
    'Marathi',
    'Tamil',
    'Punjabi',
    'Bengali',
    'Assamese',
  ];
  const subjectOptions = ['Science', 'Maths', 'SSC'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!role) return alert('Please select a role.');
    if (role === 'teacher' && className.length === 0)
      return alert('Teachers must choose at least one class.');
    if (role === 'teacher' && !subject)
      return alert('Please select a subject.');
    if (role !== 'teacher' && !className[0])
      return alert('Please select a class.');
    if (role === 'parent' && (!childName || !childEmail))
      return alert("Please provide your child's name and email.");
    if ((role === 'teacher' || role === 'parent') && !phone)
      return alert('Please provide a phone number.');

    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(cred.user, { displayName: name });

      const userRef = doc(db, 'users', cred.user.uid);
      const base = {
        role,
        email,
        language,
        createdAt: serverTimestamp(),
      };

      if (role === 'teacher') {
        await setDoc(userRef, {
          ...base,
          fullName: name,
          className,
          subject,
          phoneNumber: phone,
        });
      } else if (role === 'student') {
        await setDoc(userRef, {
          ...base,
          fullName: name,
          className: className[0],
        });
      } else if (role === 'parent') {
        await setDoc(userRef, {
          ...base,
          fullName: name,
          className: className[0],
          childName,
          childEmail,
          phoneNumber: phone,
        });
      }

      await sendEmailVerification(cred.user);
      alert('✅ Registered successfully! Please verify your email.');
      router.push('/login');
    } catch (err: any) {
      console.error(err);
      alert('❌ ' + (err.message || 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  const toggleClass = (cls: string, checked: boolean) => {
    setClassName(prev => {
      const set = new Set(prev);
      if (checked) set.add(cls);
      else set.delete(cls);
      return Array.from(set);
    });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#F6E6FF] via-[#E2D6FF] to-[#D8D0FF] p-6">
      {/* 🎨 Cute Doodle Background Decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Blobs */}
        <div className="absolute top-10 left-10 w-40 h-40 bg-pink-200 rounded-full blur-3xl opacity-60 animate-pulse"></div>
        <div className="absolute bottom-20 right-16 w-48 h-48 bg-purple-200 rounded-full blur-3xl opacity-60 animate-bounce"></div>

        {/* Hand-drawn SVG curves */}
        <svg
          className="absolute top-0 left-0 w-full h-full opacity-30"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,150 Q150,100 300,150 T600,150 T900,150 T1200,150"
            stroke="#c7b5ff"
            fill="transparent"
            strokeWidth="2"
          />
          <path
            d="M0,400 Q150,450 300,400 T600,400 T900,400 T1200,400"
            stroke="#f7b9ff"
            fill="transparent"
            strokeWidth="2"
          />
        </svg>

        {/* Floating Doodles */}
        <div className="absolute top-10 right-20 text-4xl animate-spin-slow">📚</div>
        <div className="absolute bottom-16 left-20 text-4xl animate-bounce">✏</div>
        <div className="absolute top-1/2 left-1/4 text-4xl animate-pulse">🌟</div>
        <div className="absolute bottom-1/3 right-1/3 text-4xl animate-bounce">🎒</div>
      </div>

      {/* 🌸 Registration Card */}
      <div className="relative z-10 bg-white/90 backdrop-blur-xl shadow-2xl rounded-3xl w-full max-w-md p-8 border border-white/40">
        <h1 className="text-4xl font-extrabold text-center text-purple-700 mb-3">
          Vidya Setu
        </h1>
        <p className="text-center text-gray-500 mb-6">
          <T>Join the bridge to better learning</T> 🌱
        </p>

        {/* 🌼 Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as Role)}
              className="w-full p-2 border rounded-md"
              required
            >
              <option value="">Select your role</option>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="parent">Parent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Language
            </label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            >
              <option value="">Select a language</option>
              {languageOptions.map(l => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Class & Subject */}
          {role && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Class
              </label>
              {role === 'teacher' ? (
                <div className="flex gap-3">
                  {classOptions.map(cls => (
                    <label key={cls} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={className.includes(cls)}
                        onChange={e => toggleClass(cls, e.target.checked)}
                      />
                      {cls}
                    </label>
                  ))}
                </div>
              ) : (
                <select
                  value={className[0] || ''}
                  onChange={e => setClassName([e.target.value])}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="">Select class</option>
                  {classOptions.map(cls => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {role === 'teacher' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Subject
              </label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full p-2 border rounded-md"
                required
              >
                <option value="">Select subject</option>
                {subjectOptions.map(sub => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(role === 'teacher' || role === 'parent') && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
          )}

          {role === 'parent' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Child’s Name
                </label>
                <input
                  type="text"
                  value={childName}
                  onChange={e => setChildName(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Child’s Email
                </label>
                <input
                  type="email"
                  value={childEmail}
                  onChange={e => setChildEmail(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-2 bg-gradient-to-r from-purple-500 to-pink-400 text-white rounded-lg hover:brightness-110 transition"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}