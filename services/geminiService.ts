import { DailyPlan, Meal, UserData, MacroData, Recipe, FoodItem, Message } from '../types';
import type { GenerateContentResponse } from "@google/genai";

async function postToApi(action: string, payload: object) {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
    throw new Error(errorData.error || 'Failed to fetch from API');
  }

  return response.json();
}


export async function* sendMessageToAI(message: string, history: Message[]): AsyncGenerator<GenerateContentResponse, void, unknown> {
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chatStream', payload: { message, history } })
    });

    if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown streaming error occurred.' }));
        throw new Error(errorData.error || 'Failed to get stream from API');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; 

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonString = line.substring(6);
                if (jsonString) {
                    try {
                        yield JSON.parse(jsonString) as GenerateContentResponse;
                    } catch (e) {
                        console.error('Failed to parse stream chunk:', jsonString);
                    }
                }
            }
        }
    }
}

export const parseMealPlanText = (text: string): Promise<DailyPlan> => {
    return postToApi('parseMealPlanText', { text });
};

export const regenerateDailyPlan = (userData: UserData, currentPlan: DailyPlan, numberOfMeals?: number): Promise<DailyPlan> => {
    return postToApi('regenerateDailyPlan', { userData, currentPlan, numberOfMeals });
};

export const adjustDailyPlanForMacro = (userData: UserData, currentPlan: DailyPlan, macroToFix: keyof Omit<MacroData, 'calories'>): Promise<DailyPlan> => {
    return postToApi('adjustDailyPlanForMacro', { userData, currentPlan, macroToFix });
};

export const generateWeeklyPlan = (userData: UserData, weekStartDate: Date, observation?: string): Promise<Record<string, DailyPlan>> => {
    return postToApi('generateWeeklyPlan', { userData, weekStartDate, observation });
};

export const regenerateMealFromPrompt = (promptStr: string, meal: Meal, userData: UserData): Promise<Meal> => {
    return postToApi('regenerateMealFromPrompt', { promptStr, meal, userData });
};

export const analyzeMealFromText = (description: string): Promise<MacroData> => {
    return postToApi('analyzeMealFromText', { description });
};

export const analyzeMealFromImage = async (imageDataUrl: string): Promise<MacroData> => {
    return postToApi('analyzeMealFromImage', { imageDataUrl });
};

export const analyzeProgress = async (userData: UserData): Promise<string> => {
    return postToApi('analyzeProgress', { userData });
};

export const generateShoppingList = async (weekPlan: DailyPlan[]): Promise<string> => {
     return postToApi('generateShoppingList', { weekPlan });
};

export const getFoodInfo = async (question: string, mealContext?: Meal): Promise<string> => {
    return postToApi('getFoodInfo', { question, mealContext });
};

export const getFoodSubstitution = (itemToSwap: FoodItem, mealContext: Meal, userData: UserData): Promise<FoodItem> => {
    return postToApi('getFoodSubstitution', { itemToSwap, mealContext, userData });
};

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    return postToApi('generateImageFromPrompt', { prompt });
};

export const findRecipes = (query: string, userData: UserData, numRecipes: number = 3): Promise<Recipe[]> => {
    return postToApi('findRecipes', { query, userData, numRecipes });
};

export const analyzeActivityFromText = (description: string): Promise<{ type: string; duration: number; caloriesBurned: number; }> => {
    return postToApi('analyzeActivityFromText', { description });
};
