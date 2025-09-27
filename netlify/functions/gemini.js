
import { GoogleGenAI, Type } from "@google/genai";

// --- Gemini API Setup ---
let aiInstance;
const getAi = () => {
    if (aiInstance) return aiInstance;
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("A chave da API do Gemini (API_KEY) não foi encontrada nas variáveis de ambiente do Netlify.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
    return aiInstance;
};

// Centralized error handler for Gemini API calls on the server-side
const handleGeminiError = (error, context) => {
    console.error(`Error during Gemini API call in '${context}':`, error);
    let errorMessage = `Ocorreu um erro em '${context}'. Tente novamente.`;

    if (error instanceof Error) {
        if (error.message.includes('API key not valid') || error.message.includes('API_KEY_INVALID')) {
            errorMessage = "Erro de Autenticação: A chave da API é inválida. Verifique a variável de ambiente (API_KEY) no seu painel do Netlify e faça o deploy novamente.";
        } else if (error.message.includes('fetch failed') || error.message.toLowerCase().includes('network')) {
            errorMessage = "Erro de Rede: O servidor não conseguiu conectar ao serviço de IA.";
        } else if (error.message.includes('429')) {
             errorMessage = "Você atingiu o limite de requisições para a API. Por favor, verifique seu plano e uso no Google AI Studio e tente novamente mais tarde.";
        } else if (error.message.includes('SAFETY')) {
            errorMessage = "A sua solicitação ou a resposta da IA foi bloqueada por questões de segurança. Tente reformular seu pedido com outras palavras.";
        } else if (error.message.includes('Invalid JSON response')) {
             errorMessage = "A IA retornou uma resposta em formato inválido. Tente novamente, talvez com um pedido mais simples.";
        } else {
            errorMessage = `Ocorreu um erro inesperado ao comunicar com a IA. Por favor, tente novamente. Detalhe: ${error.message}`;
        }
    }
    
    return new Error(errorMessage);
};

// --- Models & Schemas ---
const FAST_MODEL = 'gemini-2.5-flash';
const DATA_GENERATION_MODEL = 'gemini-2.5-flash';
const IMAGE_GENERATION_MODEL = 'imagen-4.0-generate-001';

const macroDataSchema = {};
const activityLogSchema = {};
const foodItemSchema = {};
const mealSchema = {};
const dailyPlanSchema = {};
const weeklyPlanSchema = {};
const recipeSchema = {};

Object.assign(macroDataSchema, { type: Type.OBJECT, properties: { calories: { type: Type.NUMBER }, carbs: { type: Type.NUMBER }, protein: { type: Type.NUMBER }, fat: { type: Type.NUMBER } }, required: ["calories", "carbs", "protein", "fat"] });
Object.assign(activityLogSchema, { type: Type.OBJECT, properties: { type: { type: Type.STRING }, duration: { type: Type.NUMBER }, caloriesBurned: { type: Type.NUMBER } }, required: ["type", "duration", "caloriesBurned"] });
Object.assign(foodItemSchema, { type: Type.OBJECT, properties: { name: { type: Type.STRING }, portion: { type: Type.STRING }, calories: { type: Type.NUMBER }, carbs: { type: Type.NUMBER }, protein: { type: Type.NUMBER }, fat: { type: Type.NUMBER } }, required: ["name", "portion", "calories", "carbs", "protein", "fat"] });
Object.assign(mealSchema, { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, time: { type: Type.STRING }, totalCalories: { type: Type.NUMBER }, totalMacros: macroDataSchema, items: { type: Type.ARRAY, items: foodItemSchema } }, required: ["id", "name", "time", "totalCalories", "totalMacros", "items"] });
Object.assign(dailyPlanSchema, { type: Type.OBJECT, properties: { date: { type: Type.STRING }, dayOfWeek: { type: Type.STRING }, totalCalories: { type: Type.NUMBER }, totalMacros: macroDataSchema, waterGoal: { type: Type.NUMBER }, meals: { type: Type.ARRAY, items: mealSchema } }, required: ["date", "dayOfWeek", "totalCalories", "totalMacros", "waterGoal", "meals"] });
Object.assign(weeklyPlanSchema, { type: Type.OBJECT, properties: { weekly_plan: { type: Type.ARRAY, items: dailyPlanSchema } }, required: ['weekly_plan'] });
Object.assign(recipeSchema, { type: Type.OBJECT, properties: { recipes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, title: { type: Type.STRING }, description: { type: Type.STRING }, prepTime: { type: Type.STRING }, difficulty: { type: Type.STRING, enum: ['Fácil', 'Médio', 'Difícil'] }, servings: { type: Type.STRING }, ingredients: { type: Type.ARRAY, items: { type: Type.STRING } }, instructions: { type: Type.ARRAY, items: { type: Type.STRING } }, nutritionalInfo: { type: Type.OBJECT, properties: { calories: { type: Type.STRING }, protein: { type: Type.STRING }, carbs: { type: Type.STRING }, fat: { type: Type.STRING } }, required: ["calories", "protein", "carbs", "fat"] }, imagePrompt: { type: Type.STRING } }, required: ["id", "title", "description", "prepTime", "difficulty", "servings", "ingredients", "instructions", "nutritionalInfo", "imagePrompt"] } } }, required: ["recipes"] });

const getUserContextForPrompt = (userData) => {
    const { macros, dietaryPreferences, adminSettings, weight, weightGoal, age, gender, height, activityLevel } = userData;
    const objective = weight > weightGoal ? 'perda de peso' : weight < weightGoal ? 'ganho de massa' : 'manutenção de peso';
    const userContext = {
        objetivo,
        metas_diarias: { calorias: macros.calories.goal, proteinas: macros.protein.goal, carboidratos: macros.carbs.goal, gorduras: macros.fat.goal },
        preferencias: { dietas: dietaryPreferences.diets.join(', ') || 'Nenhuma', restricoes: dietaryPreferences.restrictions.join(', ') || 'Nenhuma' },
        dados_pessoais: { idade: age, genero: gender, altura: height, peso: weight, nivel_atividade: activityLevel },
    };
    const adminInstructionPrompt = adminSettings?.permanentPrompt ? `\n- Regra Permanente do Nutricionista (OBRIGATÓRIO SEGUIR): ${adminSettings.permanentPrompt}` : '';
    return { userContextJSON: JSON.stringify(userContext), adminInstructionPrompt };
};

// --- API Logic Functions ---
const apiFunctions = {
    chatStream: async ({ message, history }) => {
        const ai = getAi();
        const chat = ai.chats.create({
            model: FAST_MODEL,
            history: history,
            config: {
                systemInstruction: `Você é o NutriBot, um assistente nutricionista de IA. Suas respostas devem ser em português do Brasil, sempre bem estruturadas, claras e agradáveis de ler, mas sem usar muitos tokens. Utilize Markdown para formatar suas respostas da seguinte maneira:

- **Títulos e Seções:** Use headings (ex: \`## Título\`) para organizar o conteúdo.
- **Destaques:** Use negrito (\`**texto**\`) para enfatizar informações importantes.
- **Listas:** Use listas com marcadores (\`- Item 1\`) para itens como ingredientes ou dicas.
- **Tabelas:** SEMPRE que fornecer uma dieta, lista de compras ou dados comparativos, apresente as informações em uma tabela Markdown para máxima clareza.
- **Emojis:** Use emojis de forma moderada e apropriada para tornar a conversa amigável (🥑, 💪, 💧).
- **Seleção de Alimentos:** Ao sugerir alimentos ou criar planos, dê preferência a ingredientes que são comuns na dieta brasileira e fáceis de encontrar em supermercados no Brasil.
- **Macros e Metas:** Ao criar dietas, esforce-se para atingir as metas de calorias e macronutrientes do usuário.
- **Gramatura:** Sempre inclua a porção em gramas junto da medida caseira. Exemplo: "1 xícara de arroz (200g)".

Seja conciso, mas completo, focando em fornecer valor prático ao usuário.`,
            },
        });
        return chat.sendMessageStream({ message });
    },
    parseMealPlanText: async ({ text }) => {
        const ai = getAi();
        const prompt = `Analise o seguinte texto, que contém um plano alimentar, e extraia os dados estruturados. A saída DEVE ser um único objeto JSON que corresponda ao schema 'dailyPlanSchema'. Texto para analisar: "${text}"`;
        const response = await ai.models.generateContent({ model: DATA_GENERATION_MODEL, contents: prompt, config: { responseMimeType: "application/json", responseSchema: dailyPlanSchema } });
        return JSON.parse(response.text);
    },
    regenerateDailyPlan: async ({ userData, currentPlan, numberOfMeals }) => {
        const ai = getAi();
        const { userContextJSON, adminInstructionPrompt } = getUserContextForPrompt(userData);
        const mealCountPrompt = numberOfMeals ? `A nova dieta deve ter exatamente ${numberOfMeals} refeições.` : `A nova dieta deve ter ${currentPlan.meals.length} refeições.`;
        const prompt = `
            Tarefa: Gerar uma nova dieta diária para o usuário.
            Saída: JSON, schema 'dailyPlanSchema'.
            Contexto do Usuário: ${userContextJSON}
            Regras:
            - Criar uma dieta COMPLETAMENTE NOVA e diferente da anterior.
            - A data do plano deve ser a mesma da anterior: ${currentPlan.date}.
            - ${mealCountPrompt}
            - Os nomes das refeições devem ser padrão (Ex: Café da Manhã, Almoço).
            - As calorias e macros totais devem se aproximar ao máximo das metas do usuário.
            ${adminInstructionPrompt}`;
        const response = await ai.models.generateContent({ model: DATA_GENERATION_MODEL, contents: prompt, config: { responseMimeType: "application/json", responseSchema: dailyPlanSchema } });
        return JSON.parse(response.text);
    },
    adjustDailyPlanForMacro: async ({ userData, currentPlan, macroToFix }) => {
        const ai = getAi();
        const { userContextJSON, adminInstructionPrompt } = getUserContextForPrompt(userData);
        const prompt = `
            Tarefa: Ajustar a dieta diária existente para melhorar a meta do macronutriente '${macroToFix}'.
            Saída: JSON, schema 'dailyPlanSchema'.
            Contexto do Usuário: ${userContextJSON}
            Dieta Atual: ${JSON.stringify(currentPlan)}
            Regras:
            - Modifique a dieta atual fazendo o mínimo de trocas possível para aproximar o total de '${macroToFix}' da meta do usuário.
            - Mantenha as calorias totais o mais próximo possível da meta.
            - Mantenha a mesma data e número de refeições.
            ${adminInstructionPrompt}`;
        const response = await ai.models.generateContent({ model: DATA_GENERATION_MODEL, contents: prompt, config: { responseMimeType: "application/json", responseSchema: dailyPlanSchema } });
        return JSON.parse(response.text);
    },
    generateWeeklyPlan: async ({ userData, weekStartDate, observation }) => {
        const ai = getAi();
        const { userContextJSON, adminInstructionPrompt } = getUserContextForPrompt(userData);
        const observationPrompt = observation ? `Observação do usuário para esta semana: "${observation}"` : '';
        const prompt = `
            Tarefa: Gerar um plano alimentar para 7 dias.
            Saída: JSON, schema 'weeklyPlanSchema'.
            Contexto do Usuário: ${userContextJSON}
            Data de Início da Semana: ${new Date(weekStartDate).toISOString().split('T')[0]}
            ${observationPrompt}
            Regras:
            - Gerar um plano para 7 dias consecutivos, começando na data de início.
            - Variedade é crucial: não repita refeições principais em dias seguidos.
            - As calorias e macros de cada dia devem se aproximar das metas do usuário.
            - As datas e dias da semana devem estar corretos para cada um dos 7 dias.
            ${adminInstructionPrompt}`;
        const response = await ai.models.generateContent({ model: DATA_GENERATION_MODEL, contents: prompt, config: { responseMimeType: "application/json", responseSchema: weeklyPlanSchema } });
        const parsed = JSON.parse(response.text);
        return (parsed.weekly_plan || []).reduce((acc, day) => {
            acc[day.date] = day;
            return acc;
        }, {});
    },
    regenerateMealFromPrompt: async ({ prompt, meal, userData }) => {
        const ai = getAi();
        const { userContextJSON, adminInstructionPrompt } = getUserContextForPrompt(userData);
        const requestPrompt = `
            Tarefa: Recriar uma refeição com base na instrução do usuário.
            Saída: JSON, schema 'mealSchema'.
            Contexto do Usuário: ${userContextJSON}
            Refeição Original: ${JSON.stringify(meal)}
            Instrução do Usuário: "${prompt}"
            Regras:
            - A nova refeição deve seguir a instrução e ter calorias e macros similares à original, a menos que a instrução peça o contrário.
            - Mantenha o mesmo ID e nome da refeição original.
            - O horário ('time') deve ser mantido.
            ${adminInstructionPrompt}`;
        const response = await ai.models.generateContent({ model: DATA_GENERATION_MODEL, contents: requestPrompt, config: { responseMimeType: "application/json", responseSchema: mealSchema } });
        return JSON.parse(response.text);
    },
    analyzeMealFromText: async ({ description }) => {
        const ai = getAi();
        const prompt = `Analise a descrição desta refeição e estime os macronutrientes. Responda apenas com o JSON. Descrição: "${description}"`;
        const response = await ai.models.generateContent({ model: FAST_MODEL, contents: prompt, config: { responseMimeType: "application/json", responseSchema: macroDataSchema } });
        return JSON.parse(response.text);
    },
    analyzeMealFromImage: async ({ imageDataUrl }) => {
        const ai = getAi();
        const base64Data = imageDataUrl.split(',')[1];
        const imagePart = { inlineData: { mimeType: 'image/jpeg', data: base64Data } };
        const textPart = { text: "Analise a imagem desta refeição e estime os macronutrientes. Se não conseguir identificar, retorne zero para todos. Responda apenas com o JSON." };
        const response = await ai.models.generateContent({ model: FAST_MODEL, contents: { parts: [imagePart, textPart] }, config: { responseMimeType: "application/json", responseSchema: macroDataSchema } });
        return JSON.parse(response.text);
    },
    analyzeProgress: async ({ userData }) => {
        const ai = getAi();
        const prompt = `Com base nos dados do usuário, faça um resumo motivacional sobre sua evolução. Destaque pontos fortes, sugira áreas para melhorar e dê dicas para continuar progredindo. Use um tom amigável e encorajador. Dados: ${JSON.stringify(userData)}`;
        const response = await ai.models.generateContent({ model: FAST_MODEL, contents: prompt });
        return response.text;
    },
    generateShoppingList: async ({ weekPlan }) => {
        const ai = getAi();
        const prompt = `Crie uma lista de compras detalhada e organizada por categorias (ex: Frutas, Legumes, Carnes, Laticínios) para o seguinte plano alimentar semanal. Some as quantidades de ingredientes idênticos. Plano: ${JSON.stringify(weekPlan)}`;
        const response = await ai.models.generateContent({ model: FAST_MODEL, contents: prompt });
        return response.text;
    },
    getFoodInfo: async ({ question, mealContext }) => {
        const ai = getAi();
        const contextPrompt = mealContext ? `O usuário está vendo esta refeição: ${JSON.stringify(mealContext)}.` : '';
        const prompt = `Responda à seguinte dúvida sobre alimentos de forma clara e concisa. ${contextPrompt} Pergunta: "${question}"`;
        const response = await ai.models.generateContent({ model: FAST_MODEL, contents: prompt });
        return response.text;
    },
    getFoodSubstitution: async ({ itemToSwap, mealContext, userData }) => {
        const ai = getAi();
        const { userContextJSON, adminInstructionPrompt } = getUserContextForPrompt(userData);
        const prompt = `
            Tarefa: Encontrar um substituto saudável para um alimento.
            Saída: JSON, schema 'foodItemSchema'.
            Contexto do Usuário: ${userContextJSON}
            Contexto da Refeição: ${JSON.stringify(mealContext)}
            Alimento para Trocar: ${JSON.stringify(itemToSwap)}
            Regras:
            - Encontre um substituto com calorias e macronutrientes o mais próximo possível do original.
            - O substituto deve fazer sentido no contexto da refeição.
            - Respeite as preferências do usuário.
            ${adminInstructionPrompt}`;
        const response = await ai.models.generateContent({ model: DATA_GENERATION_MODEL, contents: prompt, config: { responseMimeType: "application/json", responseSchema: foodItemSchema } });
        return JSON.parse(response.text);
    },
    findRecipes: async ({ query, userData, numRecipes }) => {
        const ai = getAi();
        const { userContextJSON, adminInstructionPrompt } = getUserContextForPrompt(userData);
        const prompt = `
            Tarefa: Encontrar ${numRecipes} receita(s) criativa(s).
            Saída: JSON, schema 'recipeSchema'.
            Busca do Usuário: "${query}"
            Contexto do Perfil: ${userContextJSON}
            Regras:
            - Relevância máxima com a busca do usuário.
            - Adaptar receitas para serem saudáveis e respeitar o perfil.
            - Priorizar ingredientes comuns no Brasil.
            - Para cada receita, criar um 'imagePrompt' detalhado e otimizado para IA de imagem (estilo fotografia de comida realista, apetitosa, alta qualidade).
            ${adminInstructionPrompt}`;
        
        const response = await ai.models.generateContent({ model: DATA_GENERATION_MODEL, contents: prompt, config: { responseMimeType: "application/json", responseSchema: recipeSchema, thinkingConfig: { thinkingBudget: 0 } } });
        const parsed = JSON.parse(response.text);
        return parsed.recipes || [];
    },
    generateImageFromPrompt: async ({ prompt }) => {
        const ai = getAi();
        const response = await ai.models.generateImages({
            model: IMAGE_GENERATION_MODEL,
            prompt: `Crie uma imagem realista e de alta qualidade com base na seguinte descrição: ${prompt}. Estilo de fotografia de alimentos, iluminação profissional, fundo desfocado.`,
            config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '1:1' },
        });
        if (response.generatedImages?.[0]?.image?.imageBytes) {
            return `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
        }
        throw new Error("A IA não retornou nenhuma imagem.");
    },
    analyzeActivityFromText: async ({ description }) => {
        const ai = getAi();
        const prompt = `Analise a descrição desta atividade física e estime o tipo, duração em minutos e calorias queimadas. Responda apenas com o JSON. Descrição: "${description}"`;
        const response = await ai.models.generateContent({ model: FAST_MODEL, contents: prompt, config: { responseMimeType: "application/json", responseSchema: activityLogSchema } });
        return JSON.parse(response.text);
    },
};

// --- Netlify Function Handler ---
export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const { action, payload } = JSON.parse(event.body);

        if (action === 'chatStream') {
            const streamResult = await apiFunctions.chatStream(payload);
            
            // This is how you handle streaming responses in Netlify functions
            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of streamResult) {
                            controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
                        }
                    } catch (e) {
                        console.error("Stream error in handler:", e);
                        const processedError = handleGeminiError(e, action);
                        controller.enqueue(`data: ${JSON.stringify({ error: processedError.message })}\n\n`);
                    } finally {
                        controller.close();
                    }
                }
            });
            
            return {
                statusCode: 200,
                headers: { 
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
                body: stream,
            };

        } else if (apiFunctions[action]) {
            const data = await apiFunctions[action](payload);
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data }),
            };
        } else {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action' }) };
        }

    } catch (error) {
        const { action } = JSON.parse(event.body || '{}');
        const processedError = handleGeminiError(error, action || 'handler');
        console.error("Handler error:", processedError);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: processedError.message }),
        };
    }
};
