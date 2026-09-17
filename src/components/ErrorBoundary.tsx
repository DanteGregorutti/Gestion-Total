/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Algo salió mal. Por favor, intenta de nuevo.";
      let isQuotaError = false;
      let upgradeUrl = "https://console.firebase.google.com/project/gen-lang-client-0541830840/firestore/databases/ai-studio-652f59b5-f778-46a4-9179-69839296fc8f/data?openUpgradeDialog=true";
      
      try {
        if (this.state.error?.message) {
          const rawMsg = this.state.error.message;
          if (rawMsg.includes('Quota exceeded') || rawMsg.includes('Quota limit exceeded')) {
            isQuotaError = true;
            errorMessage = "Se ha superado el límite gratuito diario de lecturas en Firestore para este proyecto. La cuota se reinicia automáticamente cada día o podés habilitar el plan Blaze en Firebase Console para continuar sin interrupciones.";
          } else {
            const parsedError = JSON.parse(rawMsg);
            if (parsedError.error && (parsedError.error.includes('Quota exceeded') || parsedError.error.includes('Quota limit exceeded'))) {
              isQuotaError = true;
              errorMessage = "Se ha superado el límite gratuito diario de lecturas en Firestore para este proyecto. La cuota se reinicia automáticamente cada día o podés habilitar el plan Blaze en Firebase Console para continuar sin interrupciones.";
            } else if (parsedError.error && parsedError.error.includes('insufficient permissions')) {
              errorMessage = "No tienes permisos suficientes para realizar esta acción.";
            }
          }
        }
      } catch (e) {
        // Not a JSON error, use default
      }

      if (isQuotaError) {
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white p-8 rounded-[32px] shadow-xl border border-amber-100 max-w-lg w-full text-center">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Límite Diario de Firestore Superado</h2>
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">{errorMessage}</p>
              
              <div className="flex flex-col gap-3">
                <a
                  href={upgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-amber-600 text-white font-semibold rounded-2xl hover:bg-amber-700 transition-colors inline-block text-center shadow-sm"
                >
                  Abrir Firebase Console para Ampliar Cuota
                </a>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-2xl hover:bg-gray-200 transition-colors"
                >
                  Reintentar / Recargar
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                El contador gratuito de lecturas diarias de Google Cloud se restablece a las 00:00 (hora del Pacífico).
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[32px] shadow-xl border border-gray-100 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Ups! Algo salió mal</h2>
            <p className="text-gray-500 mb-8">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
