

import { DailyPlan, Meal, UserData, MacroData, Recipe, FoodItem } from '../types';

// Centralized error handler for API calls
const handleApiError = async (response: Response, context: string): Promise<Error> => {
    let errorMessage = `Ocorreu um erro em '${context}'. Tente novamente.`;
    try {
        const errorData = await response.json();
        if (errorData.error) {
            // Use the specific error message from the serverless function
            errorMessage = errorData.error;
        } else if (response.status === 429) {
            errorMessage = "Você atingiu o limite de requisições. Por favor, tente novamente mais tarde.";
        }
    } catch (e) {
        // Fallback if the response is not JSON
        errorMessage = `Erro de comunicação com o servidor (${response.status} ${response.statusText}). Verifique sua conexão.`;
    }
    console.error(`Error during API call in '${context}':`, errorMessage);
    return new Error(errorMessage);
};

// Generic function to call the Netlify serverless function for non-streaming responses
const callApi = async (action: string, payload: any, context: string) => {
    try {
        const response = await fetch('/.netlify/functions/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
        });

        if (!response.ok) {
            throw await handleApiError(response, context);
        }

        const result = await response.json();
        return result.data;
    } catch (error) {
        if (error instanceof Error) {
            throw error; // Re-throw already processed errors
        }
        console.error(`Network or unexpected error in '${context}':`, error);
        throw new Error(`Erro de rede ao tentar '${context}'. Verifique sua conexão com a internet.`);
    }
};

// Special handler for streaming chat responses
export async function* sendMessageToAI(message: string, history: any[]): AsyncGenerator<any, void, unknown> {
    try {
        const response = await fetch('/.netlify/functions/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'chatStream',
                payload: { message, history }
            })
        });

        if (!response.ok || !response.body) {
            throw await handleApiError(response, "enviar mensagem ao chat");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n').filter(line => line.trim());
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    if (jsonStr) {
                        yield JSON.parse(jsonStr);
                    }
                }
            }
        }
    } catch (error) {
         if (error instanceof Error) {
            throw error;
        }
        console.error("Streaming chat error:", error);
        throw new Error("Ocorreu um erro ao comunicar com o chat.");
    }
}


export const parseMealPlanText = (text: string): Promise<DailyPlan> => callApi('parseMealPlanText', { text }, "importar dieta do chat");

export const regenerateDailyPlan = (userData: UserData, currentPlan: DailyPlan, numberOfMeals?: number): Promise<DailyPlan> => callApi('regenerateDailyPlan', { userData, currentPlan, numberOfMeals }, "gerar nova dieta");

export const adjustDailyPlanForMacro = (userData: UserData, currentPlan: DailyPlan, macroToFix: keyof Omit<MacroData, 'calories'>): Promise<DailyPlan> => callApi('adjustDailyPlanForMacro', { userData, currentPlan, macroToFix }, `ajustar meta de ${macroToFix}`);

export const generateWeeklyPlan = (userData: UserData, weekStartDate: Date, observation?: string): Promise<Record<string, DailyPlan>> => callApi('generateWeeklyPlan', { userData, weekStartDate, observation }, "gerar dieta semanal");

export const regenerateMealFromPrompt = (prompt: string, meal: Meal, userData: UserData): Promise<Meal> => callApi('regenerateMealFromPrompt', { prompt, meal, userData }, "regenerar refeição");

export const analyzeMealFromText = (description: string): Promise<MacroData> => callApi('analyzeMealFromText', { description }, "analisar refeição por texto");

export const analyzeMealFromImage = (imageDataUrl: string): Promise<MacroData> => callApi('analyzeMealFromImage', { imageDataUrl }, "analisar refeição por imagem");

export const analyzeProgress = (userData: UserData): Promise<string> => callApi('analyzeProgress', { userData }, "analisar progresso");

export const generateShoppingList = (weekPlan: DailyPlan[]): Promise<string> => callApi('generateShoppingList', { weekPlan }, "gerar lista de compras");

export const getFoodInfo = (question: string, mealContext?: Meal): Promise<string> => callApi('getFoodInfo', { question, mealContext }, "obter informação de alimento");

export const getFoodSubstitution = (itemToSwap: FoodItem, mealContext: Meal, userData: UserData): Promise<FoodItem> => callApi('getFoodSubstitution', { itemToSwap, mealContext, userData }, "encontrar substituto para alimento");

export const generateImageFromPrompt = (prompt: string): Promise<string> => callApi('generateImageFromPrompt', { prompt }, "gerar imagem");

export const findRecipes = (query: string, userData: UserData, numRecipes: number = 3): Promise<Recipe[]> => callApi('findRecipes', { query, userData, numRecipes }, "buscar receitas");

export const analyzeActivityFromText = (description: string): Promise<{ type: string; duration: number; caloriesBurned: number; }> => callApi('analyzeActivityFromText', { description }, "analisar atividade por texto");
