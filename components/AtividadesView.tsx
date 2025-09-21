import React, { useState, useMemo, FC } from 'react';
import { UserData, UserDataHandlers, ActivityLog } from '../types';
import { ActivityIcon } from './icons/ActivityIcon';
import { FireIcon } from './icons/FireIcon';
import { ClockIcon } from './icons/ClockIcon';
import LogActivityModal from './LogActivityModal';
import { PlusIcon } from './icons/PlusIcon';

interface AtividadesViewProps {
    userData: UserData;
    handlers: UserDataHandlers;
}

const ActivityCard: FC<{ log: ActivityLog }> = ({ log }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-lime-100">
                <ActivityIcon className="w-6 h-6 text-lime-600" />
            </div>
            <div>
                <p className="font-bold text-slate-800">{log.type}</p>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                        <ClockIcon className="w-4 h-4"/> 
                        <span>{log.duration} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                       <FireIcon className="w-4 h-4"/>
                       <span>{log.caloriesBurned} kcal</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
);


const AtividadesView: React.FC<AtividadesViewProps> = ({ userData, handlers }) => {
    const [isActivityModalOpen, setActivityModalOpen] = useState(false);
    
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    const todaysLogs = useMemo(() => {
        return userData.activityLogs
            .filter(log => log.date === todayStr)
            .sort((a, b) => parseInt(b.id) - parseInt(a.id));
    }, [userData.activityLogs, todayStr]);

    const totalCaloriesBurnedToday = useMemo(() => {
        return todaysLogs.reduce((sum, log) => sum + log.caloriesBurned, 0);
    }, [todaysLogs]);
    
    const totalDurationToday = useMemo(() => {
        return todaysLogs.reduce((sum, log) => sum + log.duration, 0);
    }, [todaysLogs]);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Minhas Atividades</h2>
                    <p className="text-slate-500">Registre e acompanhe seus exercícios diários.</p>
                </div>
                 <button 
                    onClick={() => setActivityModalOpen(true)}
                    className="w-full sm:w-auto bg-lime-600 hover:bg-lime-700 text-white font-semibold py-2.5 px-5 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors"
                >
                    <PlusIcon className="w-5 h-5"/>
                    Registrar Atividade
                </button>
            </header>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                 <h3 className="font-bold text-lg text-slate-800 mb-4">Resumo de Hoje</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div className="bg-slate-50 p-4 rounded-xl border">
                        <p className="text-3xl font-bold text-lime-600">{todaysLogs.length}</p>
                        <p className="text-sm font-medium text-slate-600">{todaysLogs.length === 1 ? 'Atividade' : 'Atividades'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border">
                        <p className="text-3xl font-bold text-lime-600">{totalDurationToday}</p>
                        <p className="text-sm font-medium text-slate-600">Minutos Totais</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border">
                        <p className="text-3xl font-bold text-lime-600">{totalCaloriesBurnedToday}</p>
                        <p className="text-sm font-medium text-slate-600">Calorias Queimadas</p>
                    </div>
                 </div>
            </div>

            <div>
                <h3 className="font-bold text-lg text-slate-800 mb-4">Registros de Hoje</h3>
                {todaysLogs.length > 0 ? (
                    <div className="space-y-4">
                        {todaysLogs.map(log => <ActivityCard key={log.id} log={log} />)}
                    </div>
                ) : (
                    <div className="text-center p-10 bg-white rounded-2xl border border-gray-100">
                        <ActivityIcon className="w-16 h-16 text-slate-300 mx-auto mb-4"/>
                        <p className="font-semibold text-slate-500">Nenhuma atividade registrada hoje.</p>
                        <p className="text-sm text-slate-400">Clique no botão acima para adicionar seu primeiro exercício do dia!</p>
                    </div>
                )}
            </div>

            {isActivityModalOpen && (
                <LogActivityModal 
                    onClose={() => setActivityModalOpen(false)} 
                    onLogActivity={handlers.handleLogActivity} 
                />
            )}
        </div>
    );
};

export default AtividadesView;
