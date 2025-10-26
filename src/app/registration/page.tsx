'use client';

import { T } from '@/components/T';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { User, Mail, Lock, Phone, UserCircle } from 'lucide-react';

type Role = 'student' | 'teacher' | 'parent' | '';

export default function VidyaSetuRegistration() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    role: '' as Role,
    name: '',
    email: '',
    password: '',
    language: '',
    phone: '',
    className: [] as string[],
    subject: '',
    childName: '',
    childEmail: '',
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSingleClassSelect = (value: string) => {
    setFormData(prev => ({ ...prev, className: value ? [value] : [] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!formData.role) return alert('Please select a role.');

    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      if (formData.name) {
        await updateProfile(cred.user, { displayName: formData.name });
      }

      const userRef = doc(db, 'users', cred.user.uid);
      await setDoc(userRef, {
        ...formData,
        createdAt: serverTimestamp(),
      });

      await sendEmailVerification(cred.user).catch(() => {});
      alert('✅ Registered successfully! Check your email for verification.');
      router.push('/login');
    } catch (err: any) {
      alert(`❌ ${err.message || 'Registration failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const classOptions = ['7th', '8th', '9th'];
  const languageOptions = ['English', 'Hindi', 'Marathi', 'Tamil', 'Punjabi'];
  const subjectOptions = ['Science', 'Maths', 'SSC'];

  const InputField = ({ icon: Icon, ...props }: any) => (
    <div className="relative">
      <Icon className="absolute left-3 top-3 text-[#ff7e5f]" size={18} />
      <input
        {...props}
        className={`w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:outline-none focus:ring-2 focus:ring-[#feb47b] bg-white/70 placeholder-gray-400 ${props.className || ''}`}
      />
    </div>
  );

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[#ffecd2] via-[#fcb69f] to-[#a1c4fd] p-6 overflow-hidden">

      {/* Background decorative images */}
      <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
        <img
          src="https://cdn-icons-png.flaticon.com/512/3135/3135755.png"
          className="absolute top-16 left-10 w-28 animate-float"
          alt="student"
        />
        <img
          src="https://cdn-icons-png.flaticon.com/512/1828/1828817.png"
          className="absolute bottom-16 right-10 w-24 animate-float-slow"
          alt="book"
        />
        <img
          src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png"
          className="absolute top-1/2 left-[10%] w-20 animate-float"
          alt="pencil"
        />
        <img
          src="https://cdn-icons-png.flaticon.com/512/3062/3062634.png"
          className="absolute bottom-10 left-1/4 w-28 animate-float-slow"
          alt="globe"
        />
      </div>

      {/* Floating blob effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-pink-300 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-blue-300 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      {/* Main Card */}
      <div className="relative z-10 bg-white/80 backdrop-blur-2xl shadow-2xl rounded-3xl w-full max-w-md p-8 border border-white/40 transition-all hover:scale-[1.02] hover:shadow-orange-300/50 duration-300">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-[#ff7e5f] to-[#feb47b] text-transparent bg-clip-text">
            Vidya Setu
          </h1>
          <p className="text-gray-600 mt-2 text-sm">
            <T>Join the bridge to better learning 🌈</T>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              <T>Select Role</T>
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ff7e5f] bg-white/70"
            >
              <option value="">Choose Role</option>
              <option value="student">🎓 Student</option>
              <option value="teacher">👩‍🏫 Teacher</option>
              <option value="parent">👨‍👩‍👧 Parent</option>
            </select>
          </div>

          {formData.role && (
            <>
              <InputField
                icon={UserCircle}
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Full Name"
                required
              />
              <InputField
                icon={Mail}
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email Address"
                required
              />
              <InputField
                icon={Lock}
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password (min 6 chars)"
                required
              />
            </>
          )}

          {formData.role === 'student' && (
            <>
              <select
                name="classNameSingle"
                value={formData.className[0] || ''}
                onChange={e => handleSingleClassSelect(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ff7e5f] bg-white/70"
              >
                <option value="">Select Class</option>
                {classOptions.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </>
          )}

          {formData.role === 'teacher' && (
            <>
              <select
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ff7e5f] bg-white/70"
              >
                <option value="">Select Subject</option>
                {subjectOptions.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <InputField
                icon={Phone}
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Phone Number"
                required
              />
            </>
          )}

          {formData.role === 'parent' && (
            <>
              <InputField
                icon={User}
                type="text"
                name="childName"
                value={formData.childName}
                onChange={handleChange}
                placeholder="Child's Name"
                required
              />
              <InputField
                icon={Mail}
                type="email"
                name="childEmail"
                value={formData.childEmail}
                onChange={handleChange}
                placeholder="Child's Email"
                required
              />
            </>
          )}

          {formData.role && (
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#ff7e5f] to-[#feb47b] text-white font-semibold rounded-lg py-3 mt-4 shadow-md hover:shadow-lg hover:brightness-110 transition-all duration-300 disabled:opacity-60"
            >
              {loading ? <T>Registering...</T> : <T>✨ Register Now ✨</T>}
            </button>
          )}
        </form>

        <p className="text-center text-gray-600 text-sm mt-6">
          <T>Already have an account?</T>{' '}
          <a href="/login" className="text-[#ff7e5f] font-semibold hover:underline">
            <T>Login</T>
          </a>
        </p>
      </div>

      {/* Floating animation */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-15px);
          }
        }
        .animate-float {
          animation: float 5s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float 7s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
