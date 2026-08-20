import React, { useState } from 'react';
import { UserSession, RecordRow } from '../types';

interface LoginModalProps {
  users: RecordRow[];
  onLoginSuccess: (user: UserSession) => void;
  onSignUpUser: (newUser: RecordRow) => Promise<boolean> | boolean;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  users,
  onLoginSuccess,
  onSignUpUser,
  showToast
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Login State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Sign Up State
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpFullname, setSignUpFullname] = useState('');
  const [signUpRole, setSignUpRole] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Quick helper to auto-populate username when typing email if username is empty
  const handleEmailChange = (val: string) => {
    setSignUpEmail(val);
    if (!signUpUsername || signUpUsername.trim() === '') {
      const suggested = val.split('@')[0]?.replace(/[^a-zA-Z0-9_.-]/g, '');
      if (suggested) {
        setSignUpUsername(suggested);
      }
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword) {
      showToast('Please enter your Email/Username and Password!', 'error');
      return;
    }

    setIsAuthenticating(true);
    setTimeout(() => {
      setIsAuthenticating(false);
      const targetIdentifier = loginIdentifier.trim().toLowerCase();

      // Match user strictly against registered users database by Username or Email
      const match = users.find(u => {
        const uName = String(u.Username ?? u.username ?? '').trim().toLowerCase();
        const uEmail = String(u.Email ?? u.email ?? '').trim().toLowerCase();
        return uName === targetIdentifier || (uEmail !== '' && uEmail === targetIdentifier);
      });

      if (match) {
        const expectedPassword = String(match.Password ?? match.password ?? '');
        if (expectedPassword === loginPassword) {
          const userObj: UserSession = {
            username: String(match.Username ?? match.username ?? loginIdentifier),
            fullname: String(match.Fullname ?? match.fullname ?? match.Username ?? loginIdentifier),
            role: String(match.Role ?? match.role ?? 'User'),
            email: match.Email ? String(match.Email) : undefined
          };
          onLoginSuccess(userObj);
          return;
        }
      }

      showToast('Invalid Email/Username or Password!', 'error');
    }, 400);
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = signUpEmail.trim().toLowerCase();
    const trimmedUsername = signUpUsername.trim();
    const trimmedFullname = signUpFullname.trim() || trimmedUsername;
    const trimmedRole = signUpRole.trim() || 'Staff';

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showToast('Invalid email address format! Example: user@silvercitydrilling.co.id', 'error');
      return;
    }

    // Validate username
    if (trimmedUsername.length < 3) {
      showToast('Username must be at least 3 characters!', 'error');
      return;
    }

    // Validate password
    if (signUpPassword.length < 4) {
      showToast('Password must be at least 4 characters!', 'error');
      return;
    }

    if (signUpPassword !== signUpConfirmPassword) {
      showToast('Passwords do not match! Please re-check.', 'error');
      return;
    }

    // Check duplicate email
    const duplicateEmail = users.some(u => {
      const uEmail = String(u.Email ?? u.email ?? '').trim().toLowerCase();
      return uEmail !== '' && uEmail === trimmedEmail;
    });

    if (duplicateEmail) {
      showToast(`Email "${trimmedEmail}" is already registered! Please sign in or use another email.`, 'error');
      return;
    }

    // Check duplicate username
    const duplicateUsername = users.some(u => {
      const uName = String(u.Username ?? u.username ?? '').trim().toLowerCase();
      return uName === trimmedUsername.toLowerCase();
    });

    if (duplicateUsername) {
      showToast(`Username "${trimmedUsername}" is already taken! Please choose a different username.`, 'error');
      return;
    }

    setIsRegistering(true);

    try {
      const newUser: RecordRow = {
        Username: trimmedUsername,
        Email: trimmedEmail,
        Password: signUpPassword,
        Role: trimmedRole,
        Fullname: trimmedFullname,
        UpdatedBy: 'Self-Registered (Email Sign Up)',
        CreatedAt: new Date().toISOString()
      };

      const success = await onSignUpUser(newUser);

      setIsRegistering(false);

      if (success) {
        showToast(`Account created successfully! Welcome, ${trimmedFullname}.`, 'success');
        const userObj: UserSession = {
          username: trimmedUsername,
          fullname: trimmedFullname,
          role: trimmedRole,
          email: trimmedEmail
        };
        onLoginSuccess(userObj);
      }
    } catch (err) {
      setIsRegistering(false);
      showToast('Failed to create account. Please try again.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-tr from-slate-950 via-slate-900 to-amber-950/30 backdrop-blur-2xl p-3 sm:p-4 overflow-y-auto">
      {/* Background glow ambiance */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-yellow-500/15 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 border border-white/20 dark:border-slate-800 space-y-5 relative z-10 shadow-yellow-500/10 max-h-[96vh] overflow-y-auto custom-scrollbar">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 text-yellow-400 border border-slate-700/50 shadow-lg mb-1">
            <img
              src="https://static.wixstatic.com/media/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png/v1/fill/w_357,h_100,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png"
              alt="Silver City Drilling Logo"
              className="h-7 object-contain"
            />
          </div>
          <h1 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Silver City ERP
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
            Warehouse & Drilling Operations Portal
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setAuthMode('login')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 ${
              authMode === 'login'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-right-to-bracket text-xs"></i>
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('signup')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 ${
              authMode === 'signup'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <i className="fa-solid fa-user-plus text-xs"></i>
            <span>Sign Up with Email</span>
          </button>
        </div>

        {/* MODE: SIGN IN */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Email or Username
              </label>
              <div className="relative">
                <i className="fa-solid fa-user-astronaut absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Enter your Email or Username"
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white dark:focus:bg-slate-800 transition shadow-xs"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <i className="fa-solid fa-lock absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-11 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white dark:focus:bg-slate-800 transition shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-1"
                  title={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fa-solid ${showLoginPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-3.5 bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-500 hover:to-amber-500 text-slate-950 font-black rounded-2xl text-xs shadow-lg shadow-yellow-400/25 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isAuthenticating ? (
                <><i className="fa-solid fa-circle-notch fa-spin"></i> Authenticating...</>
              ) : (
                <><i className="fa-solid fa-right-to-bracket text-sm"></i> Sign In to System</>
              )}
            </button>

            <div className="pt-2 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className="text-amber-600 dark:text-amber-400 font-extrabold hover:underline cursor-pointer"
                >
                  Create a new account with email &rarr;
                </button>
              </p>
            </div>
          </form>
        )}

        {/* MODE: SIGN UP WITH EMAIL */}
        {authMode === 'signup' && (
          <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-2.5">
              <i className="fa-solid fa-envelope-circle-check text-amber-600 dark:text-amber-400 text-base shrink-0"></i>
              <span>Register your company or personal email to create a new ERP account.</span>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <i className="fa-solid fa-envelope absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="email"
                  required
                  value={signUpEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="e.g. user@silvercitydrilling.co.id"
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white dark:focus:bg-slate-800 transition shadow-xs"
                />
              </div>
            </div>

            {/* Username & Fullname in 2 cols */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <i className="fa-solid fa-at absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    type="text"
                    required
                    value={signUpUsername}
                    onChange={(e) => setSignUpUsername(e.target.value)}
                    placeholder="Unique username"
                    className="w-full pl-11 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white dark:focus:bg-slate-800 transition shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <i className="fa-solid fa-id-card absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    type="text"
                    required
                    value={signUpFullname}
                    onChange={(e) => setSignUpFullname(e.target.value)}
                    placeholder="Your Full Name"
                    className="w-full pl-11 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white dark:focus:bg-slate-800 transition shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* Job Title / Role Manual Input */}
            <div>
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Job Title / Position (Role) <span className="text-slate-400 font-normal text-[10px]">(Type manually)</span>
              </label>
              <div className="relative">
                <i className="fa-solid fa-briefcase absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  value={signUpRole}
                  onChange={(e) => setSignUpRole(e.target.value)}
                  placeholder="e.g. Drilling Engineer, Materialman, Operator, Supervisor..."
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white dark:focus:bg-slate-800 transition shadow-xs"
                />
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <i className="fa-solid fa-lock absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    type={showSignUpPassword ? 'text' : 'password'}
                    required
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="Min 4 characters"
                    className="w-full pl-11 pr-9 py-2.5 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white dark:focus:bg-slate-800 transition shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-1"
                  >
                    <i className={`fa-solid ${showSignUpPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <i className="fa-solid fa-shield-halved absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    type={showSignUpPassword ? 'text' : 'password'}
                    required
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className={`w-full pl-11 pr-4 py-2.5 border rounded-2xl text-xs font-bold outline-none focus:ring-2 transition shadow-xs ${
                      signUpConfirmPassword && signUpPassword !== signUpConfirmPassword
                        ? 'border-rose-400 bg-rose-50/60 text-rose-900 focus:ring-rose-400 dark:bg-rose-950/40 dark:text-rose-200'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:ring-yellow-400 focus:bg-white dark:focus:bg-slate-800'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Password match indicator */}
            {signUpConfirmPassword && (
              <div className="text-[11px] font-bold">
                {signUpPassword === signUpConfirmPassword ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-check"></i> Passwords match
                  </span>
                ) : (
                  <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-xmark"></i> Passwords do not match
                  </span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 text-slate-950 font-black rounded-2xl text-xs shadow-lg shadow-amber-400/25 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isRegistering ? (
                <><i className="fa-solid fa-circle-notch fa-spin"></i> Creating Account...</>
              ) : (
                <><i className="fa-solid fa-user-check text-sm"></i> Create Account & Sign In</>
              )}
            </button>

            <div className="pt-2 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-amber-600 dark:text-amber-400 font-extrabold hover:underline cursor-pointer"
                >
                  Sign In here &rarr;
                </button>
              </p>
            </div>
          </form>
        )}

        <div className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-semibold border-t border-slate-100 dark:border-slate-800 pt-3">
          PT Silver City Drilling &bull; Enterprise Resource Planning
        </div>
      </div>
    </div>
  );
};
