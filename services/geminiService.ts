import { GoogleGenAI } from "@google/genai";
import { DailyPlan, Meal, UserData, MacroData, Recipe, FoodItem } from '../types';

// Use API_KEY as per latest guidelines.
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    console.error("API_KEY is not defined in environment variables. The application will not be able to connect to the AI service.");
}

const ai = new GoogleGenAI({apiKey: API_KEY!});
const model = 'gemini-2.5-flash';

// --- PROMPT ENGINEERING HELPERS ---

const buildUserProfile = (userData: UserData): string => `
### Dados do Usuário
- **Idade:** ${userData.age}
- **Gênero:** ${userData.gender}
- **Altura:** ${userData.height} cm
- **Peso Atual:** ${userData.weight} kg
- **Nível de Atividade:** ${userData.activityLevel}
- **Meta de Peso:** ${userData.weightGoal} kg
- **Preferências Dietéticas:** ${userData.dietaryPreferences?.diets?.join(', ') || 'Nenhuma'}
- **Restrições Alimentares:** ${userData.dietaryPreferences?.restrictions?.join(', ') || 'Nenhuma'}
- **Metas de Macros Diárias:**
  - Calorias: ${userData.macros.calories.goal} kcal
  - Proteínas: ${userData.macros.protein.goal} g
  - Carboidratos: ${userData.macros.carbs.goal} g
  - Gorduras: ${userData.macros.fat.goal} g
`;

const jsonResponseInstruction = (format: string): string => `
IMPORTANTE: Sua resposta DEVE ser um objeto JSON válido, sem nenhum texto adicional, markdown, ou explicação. Apenas o JSON. O formato deve ser:
${format}
`;

const handleJsonParsing = (text: string) => {
    try {
        // Gemini with JSON output can sometimes include markdown backticks
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (e) {
        console.error("Failed to parse JSON response from Gemini:", text);
        throw new Error("A IA retornou uma resposta em formato inválido.");
    }
}

const handleError = (error: any, context: string) => {
    console.error(`Error in Gemini service (${context}):`, error);
    throw new Error(`Erro de comunicação com a IA ao tentar ${context}. Verifique sua conexão e tente novamente.`);
}


// --- API FUNCTIONS ---

export const sendMessageToAI = async (message: string, history: any[]): Promise<string> => {
    const contents = history.map(h => ({
        role: h.sender === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: message }] });
    
    try {
        const response = await ai.models.generateContent({ model, contents });
        return response.text;
    } catch (error) {
        handleError(error, 'enviar mensagem ao chat');
    }
};

export const parseMealPlanText = async (text: string): Promise<DailyPlan> => {
    const prompt = `Converta o seguinte texto de um plano alimentar em um objeto JSON. ${jsonResponseInstruction('DailyPlan (definido no schema do app)')}\n\nTexto:\n${text}`;
    try {
        const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
        return handleJsonParsing(response.text);
    } catch (error) {
        handleError(error, 'importar dieta do chat');
    }
};

export const regenerateDailyPlan = async (userData: UserData, currentPlan: DailyPlan, numberOfMeals?: number): Promise<DailyPlan> => {
    const userProfile = buildUserProfile(userData);
    const prompt = `Com base no perfil do usuário, gere um novo plano alimentar para a data ${currentPlan.date}. ${numberOfMeals ? `O plano deve ter exatamente ${numberOfMeals} refeições.` : ''} ${userProfile} ${jsonResponseInstruction('DailyPlan')}`;
    try {
        const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
        return handleJsonParsing(response.text);
    } catch (error) {
        handleError(error, 'gerar nova dieta');
    }
};

export const adjustDailyPlanForMacro = async (userData: UserData, currentPlan: DailyPlan, macroToFix: keyof Omit<MacroData, 'calories'>): Promise<DailyPlan> => {
    const userProfile = buildUserProfile(userData);
    const prompt = `Ajuste este plano alimentar para se aproximar mais da meta de ${macroToFix}. Mantenha as calorias totais o mais próximo possível da meta. Plano original:\n${JSON.stringify(currentPlan)}\n${userProfile} ${jsonResponseInstruction('DailyPlan')}`;
    try {
        const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
        return handleJsonParsing(response.text);
    } catch (error) {
        handleError(error, `ajustar meta de ${macroToFix}`);
    }
};

export const generateWeeklyPlan = async (userData: UserData, weekStartDate: Date, observation?: string): Promise<Record<string, DailyPlan>> => {
    const userProfile = buildUserProfile(userData);
    const prompt = `Crie um plano alimentar para 7 dias, começando em ${new Date(weekStartDate).toISOString().split('T')[0]}. ${observation ? `Observação: ${observation}`: ''} ${userProfile} ${jsonResponseInstruction('Record<string, DailyPlan>')}`;
     try {
        const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
        return handleJsonParsing(response.text);
    } catch (error) {
        handleError(error, 'gerar dieta semanal');
    }
};

export const regenerateMealFromPrompt = async (prompt: string, meal: Meal, userData: UserData): Promise<Meal> => {
    const userProfile = buildUserProfile(userData);
    const promptContent = `Regenere a refeição "${meal.name}" com base na seguinte instrução: "${prompt}". ${userProfile} ${jsonResponseInstruction('Meal')}`;
     try {
        const response = await ai.models.generateContent({ model, contents: promptContent, config: { responseMimeType: "application/json" } });
        return handleJsonParsing(response.text);
    } catch (error) {
        handleError(error, 'regenerar refeição');
    }
};

export const analyzeMealFromText = async (description: string): Promise<MacroData> => {
    const prompt = `Analise esta descrição de uma refeição e retorne uma estimativa dos macronutrientes. ${jsonResponseInstruction('{ "calories": number, "carbs": number, "protein": number, "fat": number }')}\n\nDescrição: ${description}`;
     try {
        const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
        return handleJsonParsing(response.text);
    } catch (error) {
        handleError(error, 'analisar refeição por texto');
    }
};

export const analyzeMealFromImage = async (imageDataUrl: string): Promise<MacroData> => {
    const [header, base64Data] = imageDataUrl.split(',');
    if (!header || !base64Data) throw new Error('Formato de imagem inválido.');
    
    const mimeTypeMatch = header.match(/:(.*?);/);
    if (!mimeTypeMatch || !mimeTypeMatch[1]) throw new Error('Não foi possível extrair o mimeType da imagem.');
    
    const mimeType = mimeTypeMatch[1];
    const prompt = `Analise esta imagem de uma refeição. Sua tarefa é retornar APENAS um objeto JSON com a estimativa de macronutrientes. ${jsonResponseInstruction('{ "calories": number, "carbs": number, "protein": number, "fat": number }')}`;
    
    const contents = { parts: [
        { text: prompt },
        { inlineData: { mimeType, data: base64Data } }
    ]};

    try {
        const response = await ai.models.generateContent({ model, contents, config: { responseMimeType: "application/json" } });
        return handleJsonParsing(response.text);
    } catch (error) {
        handleError(error, 'analisar refeição por imagem');
    }
};

export const analyzeProgress = async (userData: UserData): Promise<string> => {
    const userProfile = buildUserProfile(userData);
    const prompt = `Analise os dados de progresso do usuário e forneça um resumo motivacional com dicas. Fale diretamente com o usuário. ${userProfile}`;
    try {
        const response = await ai.models.generateContent({ model, contents: prompt });
        return response.text;
    } catch (error) {
        handleError(error, 'analisar progresso');
    }
};

export const generateShoppingList = async (weekPlan: DailyPlan[]): Promise<string> => {
    const prompt = `Crie uma lista de compras detalhada e organizada por categorias (ex: Frutas, Vegetais, Carnes) com base no seguinte plano alimentar semanal:\n${JSON.stringify(weekPlan)}`;
    try {
        const response = await ai.models.generateContent({ model, contents: prompt });
        return response.text;
    } catch (error) {
        handleError(error, 'gerar lista de compras');
    }
};

export const getFoodInfo = async (question: string, mealContext?: Meal): Promise<string> => {
    const prompt = `Responda à seguinte dúvida sobre alimentos de forma clara e concisa. Pergunta: "${question}" ${mealContext ? `Contexto da refeição: ${JSON.stringify(mealContext)}` : ''}`;
     try {
        const response = await ai.models.generateContent({ model, contents: prompt });
        return response.text;
    } catch (error) {
        handleError(error, 'obter informação de alimento');
    }
};

export const getFoodSubstitution = async (itemToSwap: FoodItem, mealContext: Meal, userData: UserData): Promise<FoodItem> => {
    const userProfile = buildUserProfile(userData);
    const prompt = `Sugira um substituto para o item "${itemToSwap.name}" no contexto da refeição "${mealContext.name}". O substituto deve ter macros similares. ${userProfile} ${jsonResponseInstruction('FoodItem')}`;
     try {
        const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
        return handleJsonParsing(response.text);
    } catch (error) {
        handleError(error, 'encontrar substituto para alimento');
    }
};

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: { numberOfImages: 1, outputMimeType: 'image/jpeg' }
        });
        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;
    } catch (error) {
        handleError(error, 'gerar imagem da receita');
    }
};

export const findRecipes = async (query: string, userData: UserData, numRecipes: number = 3): Promise<Recipe[]> => {
    const userProfile = buildUserProfile(userData);
    const prompt = `Encontre ${numRecipes} receitas com base na busca: "${query}". Para cada receita, forneça um prompt de imagem otimizado para um gerador de imagens. ${userProfile} ${jsonResponseInstruction('Recipe[]')}`;
    try {
        const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
        return handleJsonParsing(response.text);
    } catch (error) {
        handleError(error, 'buscar receitas');
    }
};

export const analyzeActivityFromText = async (description: string): Promise<{ type: string; duration: number; caloriesBurned: number; }> => {
    const prompt = `Analise o seguinte texto sobre uma atividade física e extraia o tipo, duração em minutos e calorias queimadas. ${jsonResponseInstruction('{ "type": string, "duration": number, "caloriesBurned": number }')}\n\nTexto: ${description}`;
    try {
        const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
        return handleJsonParsing(response.text);
    } catch (error) {
        handleError(error, 'analisar atividade por texto');
    }
};
