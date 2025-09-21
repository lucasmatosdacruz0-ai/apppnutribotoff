
import React, { useState } from 'react';
import { BowlIcon } from './icons/BowlIcon';

interface LoginViewProps {
    onLogin: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
    onRegister: (name: string, email: string, password: string) => Promise<{ success: boolean; message: string }>;
    onSkipLogin: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegister, onSkipLogin }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (isLoginView) {
            const result = await onLogin(email, password);
            if (!result.success) {
                setError(result.message);
            }
        } else {
            if (password !== confirmPassword) {
                setError('As senhas não coincidem.');
                setIsLoading(false);
                return;
            }
            const result = await onRegister(name, email, password);
             if (!result.success) {
                setError(result.message);
            }
        }
        setIsLoading(false);
    };

    const inputClasses = "w-full px-4 py-3 bg-slate-100 text-slate-900 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent";

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md">
                <div className="flex flex-col items-center gap-3 mb-8">
                    <div className="bg-brand-green p-3 rounded-full">
                        <BowlIcon className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="font-bold text-3xl text-slate-900">NutriBot Pro</h1>
                </div>
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">
                        {isLoginView ? 'Bem-vindo de volta!' : 'Crie sua conta'}
                    </h2>
                    <p className="text-slate-500 mb-6 text-center">
                        {isLoginView ? 'Insira seus dados para continuar.' : 'Preencha os campos para começar.'}
                    </p>
                    
                    {error && <div className="bg-red-100 border border-red-300 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLoginView && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" className={inputClasses} required />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className={inputClasses} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={inputClasses} required />
                        </div>
                        {!isLoginView && (
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Senha</label>
                                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputClasses} required />
                            </div>
                        )}
                        <button type="submit" disabled={isLoading} className="w-full py-3 bg-brand-green text-white font-semibold rounded-lg hover:bg-brand-green-dark transition-colors disabled:bg-slate-400">
                            {isLoading ? 'Carregando...' : (isLoginView ? 'Entrar' : 'Registrar')}
                        </button>
                    </form>

                    <div className="text-center mt-6">
                        <button onClick={() => { setIsLoginView(!isLoginView); setError(''); }} className="text-sm text-brand-green hover:underline font-medium">
                            {isLoginView ? 'Não tem uma conta? Registre-se' : 'Já tem uma conta? Faça login'}
                        </button>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200 text-center">
                        <button onClick={onSkipLogin} className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
                            Pular login (Desenvolvimento)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginView;
