import React, { useState } from 'react';
import { UserSession, RecordRow } from '../types';

interface LoginModalProps {
  users: RecordRow[];
  onLoginSuccess: (user: UserSession) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ users, onLoginSuccess, showToast }) => {
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setTimeout(() => {
      setIsAuthenticating(false);
      const targetUsername = loginUsername.trim().toLowerCase();
      
      // Match user strictly against registered users database
      const match = users.find(u => {
        const uName = String(u.Username ?? u.username ?? '').trim().toLowerCase();
        return uName === targetUsername;
      });

      if (match) {
        const expectedPassword = String(match.Password ?? match.password ?? '');
        if (expectedPassword === loginPassword) {
          const userObj: UserSession = {
            username: String(match.Username ?? match.username ?? loginUsername),
            fullname: String(match.Fullname ?? match.fullname ?? match.Username ?? loginUsername),
            role: String(match.Role ?? match.role ?? 'User')
          };
          onLoginSuccess(userObj);
          return;
        }
      }

      showToast('Username atau Password tidak terdaftar / salah!', 'error');
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-tr from-slate-950 via-slate-900 to-amber-950/30 backdrop-blur-2xl p-3 sm:p-4 overflow-y-auto">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-yellow-500/15 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

      <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-10 border border-white/20 space-y-6 sm:space-y-8 relative z-10 shadow-yellow-500/10 max-h-[95vh] overflow-y-auto">
        <div className="text-center space-y-3">
          <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 text-yellow-400 border border-slate-700/50 shadow-lg mb-1">
            <img
              src="https://static.wixstatic.com/media/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png/v1/fill/w_357,h_100,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/6daabc_acbf1201bd204e28becacd2ce16a7fb5~mv2.png"
              alt="Silver City Drilling Logo"
              className="h-8 object-contain"
            />
          </div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">Silver City ERP</h1>
          <p className="text-xs text-slate-500 font-bold">Secure corporate warehouse & operations portal</p>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">Username</label>
            <div className="relative">
              <i className="fa-solid fa-user absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Enter username (e.g. admin)"
                className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-2xl text-xs bg-slate-50/70 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <i className="fa-solid fa-lock absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-2xl text-xs bg-slate-50/70 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition shadow-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-500 hover:to-amber-500 text-slate-900 font-black rounded-2xl text-xs shadow-lg shadow-yellow-400/25 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isAuthenticating ? (
              <><i className="fa-solid fa-circle-notch fa-spin"></i> Verifying...</>
            ) : (
              <><i className="fa-solid fa-right-to-bracket text-sm"></i> Authenticate & Login</>
            )}
          </button>
        </form>

        <div className="text-center text-[10px] text-slate-400 font-semibold border-t border-slate-100 pt-4">
          PT Silver City Drilling &bull; Enterprise Resource Planning
        </div>
      </div>
    </div>
  );
};
