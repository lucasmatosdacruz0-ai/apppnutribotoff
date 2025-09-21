import React, { useState, FC } from 'react';
import { View } from '../types';
import { LockIcon } from './icons/LockIcon';

interface AdminAccessSectionProps {
    setActiveView: (view: View) => void;
}

const AdminAccessSection: FC<AdminAccessSectionProps> = ({setActiveView}) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const ADMIN_PASSWORD = 'nutripro2024';

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            setError('');
            setActiveView('Admin');
        } else {
            setError('Senha incorreta. Acesso negado.');
            setPassword('');
        }
    }

    return (
        <div className="mt-12 pt-8 border-t-2 border-dashed border-slate-300">
            <div className="max-w-md mx-auto bg-slate-100 p-6 rounded-xl border border-slate-200 theme-athlete:bg-slate-800 theme-athlete:border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                    <LockIcon className="w-6 h-6 text-slate-500" />
                    <h3 className="text-lg font-bold text-slate-800">Acesso Restrito do Nutricionista</h3>
                </div>
                <p className="text-sm text-slate-600 mb-4">Esta área é para profissionais de saúde. Insira a senha para gerenciar as configurações avançadas do paciente.</p>
                <form onSubmit={handleLogin} className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Senha de acesso"
                        className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
                        aria-label="Senha de acesso do nutricionista"
                    />
                    <button type="submit" className="px-5 py-2 bg-slate-700 text-white font-semibold rounded-md hover:bg-slate-800 transition-colors">
                        Entrar
                    </button>
                </form>
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
            </div>
        </div>
    );
};

export default AdminAccessSection;