/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LayoutGrid, Mail, Lock, User, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

export default function Login() {
  const { login, loginWithGoogle, register, resendVerification, resetPassword } = useAuth();
  const { t } = useSettings();
  const [isRegister, setIsRegister] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleResendVerification = async () => {
    setIsResending(true);
    setError(null);
    try {
      await resendVerification(formData.email, formData.password);
      setSuccess('Se ha enviado un nuevo correo de verificación. Por favor, revisa tu bandeja de entrada.');
    } catch (err: any) {
      console.error('Resend error:', err);
      setError(err.message === 'already_verified' ? 'Tu email ya está verificado. Intenta iniciar sesión.' : 'Error al enviar el correo. Verifica tus credenciales.');
    } finally {
      setIsResending(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      setError('Por favor, ingresa tu correo electrónico.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await resetPassword(formData.email);
      setSuccess('Se ha enviado un enlace para restablecer tu contraseña a tu correo.');
      setIsForgot(false);
    } catch (err: any) {
      console.error('Reset error:', err);
      setError('Error al enviar el correo de recuperación. Verifica el email ingresado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (isRegister) {
        await register(formData.email, formData.password, formData.name);
        setSuccess('¡Registro exitoso! Por favor, verifica tu correo electrónico antes de iniciar sesión.');
        setIsRegister(false);
      } else {
        await login(formData.email, formData.password);
      }
    } catch (err: any) {
      // Don't log expected auth errors as errors to avoid cluttering console
      if (err.code !== 'auth/popup-closed-by-user') {
        console.warn('Auth interaction:', err.code || err.message);
      }
      
      if (err.message === 'email_not_verified') {
        setError('email_not_verified');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError(t('invalid_credentials'));
      } else if (err.code === 'auth/email-already-in-use') {
        setError('email_already_in_use');
      } else {
        setError(isRegister ? t('register_error') : t('login_error'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-4 overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[440px] relative z-10"
      >
        <div className="bg-[#121214] border border-white/10 rounded-[32px] p-8 md:p-12 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-600/20">
              <LayoutGrid className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Gestión Total</h1>
            <p className="text-gray-400 text-center">
              {isForgot ? 'Recuperar Cuenta' : isRegister ? t('register') : t('login')}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm text-center">
              {error === 'email_not_verified' ? (
                <div className="flex flex-col gap-3">
                  <p>{t('email_not_verified')}</p>
                  <button 
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isResending}
                    className="text-indigo-400 hover:text-indigo-300 font-bold underline underline-offset-4 disabled:opacity-50"
                  >
                    {isResending ? 'Enviando...' : 'Reenviar correo de verificación'}
                  </button>
                </div>
              ) : error === 'email_already_in_use' ? (
                <div className="flex flex-col gap-3">
                  <p>{t('email_already_in_use')}</p>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsRegister(false);
                      setError(null);
                    }}
                    className="text-indigo-400 hover:text-indigo-300 font-bold underline underline-offset-4"
                  >
                    {t('login')}
                  </button>
                </div>
              ) : error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm text-center flex items-center justify-center gap-2">
              <CheckCircle2 size={16} />
              {success}
            </div>
          )}

          <form onSubmit={isForgot ? handleResetPassword : handleSubmit} className="space-y-5">
            {isRegister && !isForgot && (
              <div className="space-y-1.5">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                <Input 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Juan Pérez"
                  icon={<User size={18} />}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-14 rounded-2xl"
                />
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">{t('email')}</label>
              <Input 
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="email@ejemplo.com"
                icon={<Mail size={18} />}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-14 rounded-2xl"
              />
            </div>

            {!isForgot && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('password')}</label>
                  {!isRegister && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsForgot(true);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {t('forgot_password')}
                    </button>
                  )}
                </div>
                <Input 
                  required
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="••••••••"
                  icon={<Lock size={18} />}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-14 rounded-2xl"
                />
              </div>
            )}

            <Button 
              type="submit"
              isLoading={isLoading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20 h-14 mt-8"
            >
              {isForgot ? 'Enviar Enlace' : isRegister ? t('register') : t('login')}
              <ArrowRight size={18} />
            </Button>

            <div className="pt-6 text-center flex flex-col gap-3">
              {isForgot ? (
                <button 
                  type="button"
                  onClick={() => setIsForgot(false)}
                  className="text-sm font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Volver al inicio de sesión
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-sm font-bold text-gray-400 hover:text-white transition-colors"
                >
                  {isRegister ? t('have_account') : t('no_account')}
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            &copy; 2026 Gestión Total. Todos los derechos reservados.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
