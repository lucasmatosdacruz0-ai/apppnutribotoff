import React, { useState } from 'react';
import Modal from './Modal';
import { ActivityLog } from '../types';
import { analyzeActivityFromText } from '../services/geminiService';
import { ClipboardPasteIcon } from './icons/ClipboardPasteIcon';

interface LogActivityModalProps {
    onClose: () => void;
    onLogActivity: (activity: Omit<ActivityLog, 'id' | 'date'>) => void;
}

const LogActivityModal: React.FC<LogActivityModalProps> = ({ onClose, onLogActivity }) => {
    const [type, setType] = useState('');
    const [duration, setDuration] = useState('');
    const [caloriesBurned, setCaloriesBurned] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [showManualPaste, setShowManualPaste] = useState(false);
    const [manualPasteText, setManualPasteText] = useState('');

    const handlePasteAndAnalyze = async () => {
        if (!navigator.clipboard?.readText) {
            setSyncError("Seu navegador não suporta a colagem automática.");
            setShowManualPaste(true);
            return;
        }

        setIsSyncing(true);
        setSyncError(null);

        try {
            const text = await navigator.clipboard.readText();
            if (!text.trim()) {
                setSyncError("Nenhum texto encontrado na sua área de transferência. Cole manualmente abaixo.");
                setIsSyncing(false);
                setShowManualPaste(true);
                return;
            }
            
            const result = await analyzeActivityFromText(text);
            setType(result.type);
            setDuration(result.duration.toString());
            setCaloriesBurned(result.caloriesBurned.toString());
        } catch (e) {
            if (e instanceof Error && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) {
                 setSyncError("A colagem automática falhou devido à permissão. Sem problemas, cole o texto manualmente abaixo.");
            } else {
                 setSyncError(e instanceof Error ? e.message : 'Ocorreu um erro desconhecido ao analisar o texto.');
            }
            setShowManualPaste(true);
        } finally {
            setIsSyncing(false);
        }
    };
    
    const handleManualAnalyze = async () => {
        if (!manualPasteText.trim()) {
            setSyncError("Por favor, cole o resumo da sua atividade na caixa de texto.");
            return;
        }

        setIsSyncing(true);
        setSyncError(null);

        try {
            const result = await analyzeActivityFromText(manualPasteText);
            setType(result.type);
            setDuration(result.duration.toString());
            setCaloriesBurned(result.caloriesBurned.toString());
            setSyncError(null); // Clear error on success
        } catch (e) {
            setSyncError(e instanceof Error ? e.message : 'Ocorreu um erro desconhecido ao analisar o texto.');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const durationNum = parseInt(duration, 10);
        const caloriesNum = parseInt(caloriesBurned, 10);

        if (type.trim() && !isNaN(durationNum) && !isNaN(caloriesNum) && durationNum > 0 && caloriesNum > 0) {
            onLogActivity({
                type,
                duration: durationNum,
                caloriesBurned: caloriesNum,
            });
            onClose();
        }
    };

    const inputClasses = "w-full px-3 py-2 bg-white text-slate-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-green focus:border-brand-green";

    return (
        <Modal title="Registrar Atividade Física" isOpen={true} onClose={onClose} size="lg">
             <div className="space-y-4">
                <div>
                    <h3 className="text-base font-semibold text-slate-800 mb-2">Sincronização Inteligente</h3>
                    <p className="text-sm text-slate-500 mb-3">No seu app FocoTotal, copie o resumo da atividade. Em seguida, clique no botão abaixo para colar e analisar com IA.</p>
                    
                     {!showManualPaste && (
                        <button
                            type="button"
                            onClick={handlePasteAndAnalyze}
                            disabled={isSyncing}
                            className="w-full px-4 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:bg-gray-400 flex justify-center items-center gap-2 transition-colors"
                        >
                            <ClipboardPasteIcon className="w-5 h-5"/>
                            {isSyncing ? 'Analisando...' : 'Colar Atividade do FocoTotal'}
                        </button>
                    )}

                    {syncError && <p className="text-yellow-800 bg-yellow-50 border border-yellow-200 p-2 rounded-lg text-sm mt-3 text-center">{syncError}</p>}
                    
                    {showManualPaste && (
                        <div className="mt-3 space-y-2">
                             <textarea
                                value={manualPasteText}
                                onChange={(e) => setManualPasteText(e.target.value)}
                                placeholder="Cole o resumo da sua atividade aqui..."
                                rows={3}
                                className={inputClasses}
                            />
                            <button
                                type="button"
                                onClick={handleManualAnalyze}
                                disabled={isSyncing}
                                className="w-full px-4 py-2 bg-slate-700 text-white font-semibold rounded-md hover:bg-slate-800 disabled:bg-gray-400 flex justify-center items-center gap-2 transition-colors"
                            >
                                {isSyncing ? 'Analisando...' : 'Analisar Texto Manualmente'}
                            </button>
                        </div>
                    )}
                </div>
                 <div className="flex items-center gap-4">
                    <hr className="flex-grow border-t border-gray-200" />
                    <span className="text-sm font-semibold text-slate-400">OU</span>
                    <hr className="flex-grow border-t border-gray-200" />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                 <div>
                    <label htmlFor="activity-type" className="block text-sm font-medium text-slate-700 mb-1">
                        Tipo de Atividade
                    </label>
                    <input
                        id="activity-type"
                        type="text"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        placeholder="Ex: Corrida, Musculação, Yoga"
                        className={inputClasses}
                        required
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="activity-duration" className="block text-sm font-medium text-slate-700 mb-1">
                            Duração (minutos)
                        </label>
                        <input
                            id="activity-duration"
                            type="number"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            placeholder="Ex: 60"
                            className={inputClasses}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="activity-calories" className="block text-sm font-medium text-slate-700 mb-1">
                            Calorias Queimadas
                        </label>
                        <input
                            id="activity-calories"
                            type="number"
                            value={caloriesBurned}
                            onChange={(e) => setCaloriesBurned(e.target.value)}
                            placeholder="Ex: 350"
                            className={inputClasses}
                            required
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-slate-800 rounded-md hover:bg-gray-300">
                        Cancelar
                    </button>
                    <button type="submit" className="px-4 py-2 bg-lime-600 text-white rounded-md hover:bg-lime-700">
                        Salvar Atividade
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default LogActivityModal;