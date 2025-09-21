

import { GoogleGenAI, Chat, Type } from "@google/genai";
import { DailyPlan, Meal, UserData, MacroData, Recipe, FoodItem } from '../types';

let aiInstance: GoogleGenAI | null = null;

const getAi = (): GoogleGenAI => {
    if (aiInstance) {
        return aiInstance;
    }
    // FIX: As per coding guidelines, the API key must be obtained from process.env.API_KEY. This also resolves the `import.meta.env` error.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API key not configured. Please set the API_KEY environment variable.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
    return aiInstance;
};


// Model for fast, conversational, or simple informational tasks.
const FAST_MODEL = 'gemini-2.5-flash';

// Model for complex data generation (plans, recipes, lists).
// Per user suggestion to use a "lite" model for expensive operations,
// we use 'gemini-2.5-flash' as it's the most cost-effective and fastest official model
// available in the SDK for these high-token tasks.
const DATA_GENERATION_MODEL = 'gemini-2.5-flash';

// Model for image generation tasks.
const IMAGE_GENERATION_MODEL = 'imagen-4.0-generate-001';


let chatInstance: Chat | null = null;

const macroDataSchema = {
    type: Type.OBJECT,
    properties: {
        calories: { type: Type.NUMBER, description: "Total de calorias." },
        carbs: { type: Type.NUMBER, description: "Total de carboidratos em gramas." },
        protein: { type: Type.NUMBER, description: "Total de proteínas em gramas." },
        fat: { type: Type.NUMBER, description: "Total de gorduras em gramas." },
    },
    required: ["calories", "carbs", "protein", "fat"]
};

const activityLogSchema = {
    type: Type.OBJECT,
    properties: {
        type: { type: Type.STRING, description: "O tipo de atividade física. Ex: 'Corrida', 'Musculação'." },
        duration: { type: Type.NUMBER, description: "A duração da atividade em minutos." },
        caloriesBurned: { type: Type.NUMBER, description: "O número de calorias queimadas." },
    },
    required: ["type", "duration", "caloriesBurned"]
};

const foodItemSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "O nome do alimento." },
        portion: { type: Type.STRING, description: "A porção do alimento, incluindo a medida caseira e o equivalente em gramas. Ex: '1 xícara (200g)', '2 fatias (50g)'." },
        calories: { type: Type.NUMBER, description: "As calorias estimadas para este alimento." },
        carbs: { type: Type.NUMBER, description: "Carboidratos em gramas." },
        protein: { type: Type.NUMBER, description: "Proteínas em gramas." },
        fat: { type: Type.NUMBER, description: "Gorduras em gramas." },
    },
    required: ["name", "portion", "calories", "carbs", "protein", "fat"]
};

const mealSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "Um ID único para a refeição (pode ser o nome da refeição em minúsculas)." },
        name: { type: Type.STRING, description: "O nome da refeição (ex: 'Café da Manhã')." },
        time: { type: Type.STRING, description: "O horário da refeição (ex: '08:00')." },
        totalCalories: { type: Type.NUMBER, description: "O total de calorias para esta refeição (soma das calorias dos itens)." },
        totalMacros: { ...macroDataSchema, description: "O total de macronutrientes para esta refeição (soma dos macros dos itens)." },
        items: {
            type: Type.ARRAY,
            description: "A lista de alimentos para esta refeição.",
            items: foodItemSchema
        }
    },
    required: ["id", "name", "time", "totalCalories", "totalMacros", "items"]
};

const dailyPlanSchema = {
    type: Type.OBJECT,
    properties: {
        date: { type: Type.STRING, description: "A data do plano no formato AAAA-MM-DD." },
        dayOfWeek: { type: Type.STRING, description: "O nome do dia da semana (ex: 'Segunda-feira')." },
        totalCalories: { type: Type.NUMBER, description: "O total de calorias para o dia todo (soma das calorias das refeições)." },
        totalMacros: { ...macroDataSchema, description: "O total de macronutrientes para o dia todo (soma dos macros das refeições)." },
        waterGoal: { type: Type.NUMBER, description: "A meta de água em litros. Se não informado, use 2.5." },
        meals: {
            type: Type.ARRAY,
            description: "A lista de refeições do dia.",
            items: mealSchema
        }
    },
    required: ["date", "dayOfWeek", "totalCalories", "totalMacros", "waterGoal", "meals"]
};

const weeklyPlanSchema = {
    type: Type.OBJECT,
    properties: {
        weekly_plan: {
            type: Type.ARRAY,
            description: "Uma lista de 7 planos diários, um para cada dia da semana.",
            items: dailyPlanSchema
        }
    },
    required: ['weekly_plan']
};

const recipeSchema = {
    type: Type.OBJECT,
    properties: {
        recipes: {
            type: Type.ARRAY,
            description: "Uma lista de receitas criativas, conforme o número solicitado.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "Um ID único para a receita, pode ser o título em kebab-case." },
                    title: { type: Type.STRING, description: "O título da receita." },
                    description: { type: Type.STRING, description: "Uma breve e convidativa descrição da receita (2-3 frases)." },
                    prepTime: { type: Type.STRING, description: "O tempo total de preparo estimado. Ex: 'Aprox. 30 min'." },
                    difficulty: { type: Type.STRING, enum: ['Fácil', 'Médio', 'Difícil'], description: "O nível de dificuldade." },
                    servings: { type: Type.STRING, description: "O rendimento da receita. Ex: '2 porções'." },
                    ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de ingredientes, incluindo quantidades." },
                    instructions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Passo-a-passo do modo de preparo." },
                    nutritionalInfo: {
                        type: Type.OBJECT,
                        properties: {
                            calories: { type: Type.STRING, description: "Faixa de calorias por porção. Ex: '350-450 kcal'." },
                            protein: { type: Type.STRING, description: "Quantidade de proteína por porção. Ex: '30g'." },
                            carbs: { type: Type.STRING, description: "Quantidade de carboidratos por porção. Ex: '25g'." },
                            fat: { type: Type.STRING, description: "Quantidade de gordura por porção. Ex: '15g'." }
                        },
                        required: ["calories", "protein", "carbs", "fat"]
                    },
                    imagePrompt: { type: Type.STRING, description: "CRÍTICO: Um prompt detalhado e otimizado para um gerador de imagens (como Midjourney ou DALL-E) para criar uma foto realista e apetitosa desta receita. Ex: 'food photography, a juicy grilled salmon fillet on a white plate with roasted asparagus spears and a lemon wedge, professional lighting, macro shot'." }
                },
                required: ["id", "title", "description", "prepTime", "difficulty", "servings", "ingredients", "instructions", "nutritionalInfo", "imagePrompt"]
            }
        }
    },
    required: ["recipes"]
};


export const getChatInstance = (): Chat => {
    if (!chatInstance) {
        const ai = getAi();
        chatInstance = ai.chats.create({
            model: FAST_MODEL,
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
    }
    return chatInstance;
};

export const sendMessageToAI = async (message: string) => {
    const chat = getChatInstance();
    try {
        const result = await chat.sendMessageStream({ message });
        return result;
    } catch (error) {
        console.error("Error sending message to AI:", error);
        throw new Error("Não foi possível comunicar com a IA. Tente novamente mais tarde.");
    }
};

export const parseMealPlanText = async (text: string): Promise<DailyPlan> => {
    try {
        const ai = getAi();
        const today = new Date();
        const tzoffset = today.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(today.getTime() - tzoffset)).toISOString().split('T')[0];

        const prompt = `Dada a data de hoje (${today.toLocaleDateString('pt-BR')}) e a seguinte dieta em texto markdown, extraia as informações e formate-as em JSON.
        - O campo 'date' DEVE ser a data de hoje no formato AAAA-MM-DD: ${localISOTime}.
        - O campo 'dayOfWeek' DEVE ser o dia da semana em português correspondente a essa data (ex: Segunda-feira).
        - O 'id' de cada refeição pode ser o nome da refeição em minúsculas e sem espaços (ex: 'cafedamanha').
        - Calcule os totais de calorias e macronutrientes para cada refeição e para o dia todo.
        - Para cada alimento, adicione a medida em gramas se não estiver presente. Ex: "1 fatia de pão" deve virar "1 fatia de pão (25g)".
        - Se a meta de água não for mencionada, use 2.5 como padrão para 'waterGoal'.
        
        Texto da dieta:
        ---
        ${text}
        ---
        `;
        const response = await ai.models.generateContent({
            model: DATA_GENERATION_MODEL,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: dailyPlanSchema,
              thinkingConfig: { thinkingBudget: 0 },
            },
         });
       
         const jsonText = response.text.trim();
         return JSON.parse(jsonText);

    } catch(error) {
        console.error("Error parsing meal plan with AI:", error);
        throw new Error("Não foi possível importar a dieta do chat. A IA não conseguiu analisar o texto.");
    }
};

export const regenerateDailyPlan = async (
    userData: UserData, 
    currentPlan: DailyPlan,
    numberOfMeals?: number
): Promise<DailyPlan> => {
    const objective = userData.weight > userData.weightGoal ? 'perda de peso' : userData.weight < userData.weightGoal ? 'ganho de massa' : 'manutenção de peso';

    const mealStructurePrompt = numberOfMeals
        ? `- Estrutura: Exatamente ${numberOfMeals} refeições logicamente distribuídas.`
        : `- Estrutura: Manter a mesma quantidade e nomes de refeições do plano anterior.`;

    const difficultyPrompt = userData.dietDifficulty === 'easy' 
        ? `- Modo Fácil: Priorizar simplicidade e alimentos comuns.`
        : userData.dietDifficulty === 'athlete'
        ? `- Modo Atleta: Dieta rica em proteínas de alta qualidade e carboidratos complexos.`
        : '';
    
    const adminInstructionPrompt = userData.adminSettings?.permanentPrompt
      ? `- Regra Permanente do Nutricionista (OBRIGATÓRIO): ${userData.adminSettings.permanentPrompt}`
      : '';

    const userProfileJSON = JSON.stringify({
        idade: userData.age, genero: userData.gender, altura: userData.height, peso: userData.weight,
        atividade: userData.activityLevel,
        objetivo: objective, meta_peso: userData.weightGoal,
        metas_diarias: { calorias: userData.macros.calories.goal, carboidratos: userData.macros.carbs.goal, proteinas: userData.macros.protein.goal, gorduras: userData.macros.fat.goal },
        preferencias: { dietas: userData.dietaryPreferences.diets.join(', ') || 'Nenhuma', restricoes: userData.dietaryPreferences.restrictions.join(', ') || 'Nenhuma' }
    });

    const prompt = `
Tarefa: Gerar um novo plano alimentar de um dia.
Saída: Apenas o objeto JSON, conforme o schema 'dailyPlanSchema'.
Regras:
- Criativo e diferente do plano anterior.
- Alinhar estritamente com o perfil e metas do usuário.
- Usar alimentos comuns no Brasil.
- Incluir porções em formato "medida caseira (gramas)", ex: "1 xícara (200g)".
- Manter date='${currentPlan.date}' e dayOfWeek='${currentPlan.dayOfWeek}'.
- Recalcular todos os totais de macros e calorias.
${mealStructurePrompt}
${difficultyPrompt}
${adminInstructionPrompt}

Perfil do Usuário: ${userProfileJSON}

Plano anterior para referência (evitar repetição):
${JSON.stringify({ meals: currentPlan.meals.map(m => m.name) })}
`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: DATA_GENERATION_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: dailyPlanSchema,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error regenerating daily plan with AI:", error);
        throw new Error("Não foi possível gerar uma nova dieta. A IA não conseguiu processar o pedido.");
    }
};

export const adjustDailyPlanForMacro = async (
    userData: UserData,
    currentPlan: DailyPlan,
    macroToFix: keyof Omit<MacroData, 'calories'>
): Promise<DailyPlan> => {
    const currentMacroValue = currentPlan.totalMacros[macroToFix];
    const goalMacroValue = userData.macros[macroToFix].goal;
    const difference = goalMacroValue - currentMacroValue;
    const macroName = { protein: 'proteína', carbs: 'carboidratos', fat: 'gordura' }[macroToFix];
    const objective = userData.weight > userData.weightGoal ? 'perder peso' : 'ganhar massa';

    const difficultyPrompt = userData.dietDifficulty === 'easy'
      ? `- Modo Fácil: Prefira substituições/adições simples.`
      : userData.dietDifficulty === 'athlete'
      ? `- Modo Atleta: Ajuste usando fontes de proteína magra ou carboidratos complexos.`
      : '';
      
    const adminInstructionPrompt = userData.adminSettings?.permanentPrompt
      ? `- Regra Permanente do Nutricionista (OBRIGATÓRIO): ${userData.adminSettings.permanentPrompt}`
      : '';

    const userContextJSON = JSON.stringify({
      objetivo: objective,
      metas_diarias: { calorias: userData.macros.calories.goal, proteinas: userData.macros.protein.goal, carboidratos: userData.macros.carbs.goal, gorduras: userData.macros.fat.goal }
    });

    const prompt = `
Tarefa: Ajuste cirúrgico em um plano alimentar para corrigir uma meta de macronutriente.
Saída: JSON completo e atualizado do plano, schema 'dailyPlanSchema'.

Problema:
- Ajustar: ${macroName}.
- Meta: ${goalMacroValue.toFixed(1)}g.
- Atual: ${currentMacroValue.toFixed(1)}g.
- Ação: ${difference > 0 ? `Adicionar ~${difference.toFixed(1)}g` : `Remover ~${Math.abs(difference).toFixed(1)}g`} de ${macroName}.

Regras:
- Faça a MENOR mudança possível. Não regenere a dieta inteira.
- Priorize: 1) Ajustar porção; 2) Substituir item; 3) Adicionar item pequeno.
- Minimize o impacto nas outras metas (calorias, etc.).
- Recalcule os totais da refeição modificada e do dia.
${difficultyPrompt}
${adminInstructionPrompt}

Contexto do Usuário: ${userContextJSON}

Plano para Modificar:
${JSON.stringify(currentPlan, null, 2)}
`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: DATA_GENERATION_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: dailyPlanSchema,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error adjusting daily plan with AI:", error);
        throw new Error(`Não foi possível ajustar a meta de ${macroName}. A IA não conseguiu processar o pedido.`);
    }
};


export const generateWeeklyPlan = async (userData: UserData, weekStartDate: Date, observation?: string): Promise<Record<string, DailyPlan>> => {
    const objective = userData.weight > userData.weightGoal ? 'perda de peso' : userData.weight < userData.weightGoal ? 'ganho de massa' : 'manutenção de peso';

    const dateStrings = Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(weekStartDate);
        date.setDate(date.getDate() + i);
        return date.toISOString().split('T')[0];
    });

    const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    
    const difficultyPrompt = userData.dietDifficulty === 'easy' 
        ? `- Modo Fácil: Priorizar simplicidade e alimentos comuns.`
        : userData.dietDifficulty === 'athlete'
        ? `- Modo Atleta: Dietas ricas em proteínas de alta qualidade e carboidratos complexos.`
        : '';

    const adminInstructionPrompt = userData.adminSettings?.permanentPrompt
      ? `- Regra Permanente do Nutricionista (OBRIGATÓRIO): ${userData.adminSettings.permanentPrompt}`
      : '';
      
    const observationPrompt = observation
      ? `- Observação do Usuário (IMPORTANTE): ${observation}`
      : '';

    const userProfileJSON = JSON.stringify({
        objetivo: objective, meta_peso: userData.weightGoal,
        metas_diarias: { calorias: userData.macros.calories.goal, carboidratos: userData.macros.carbs.goal, proteinas: userData.macros.protein.goal, gorduras: userData.macros.fat.goal },
        preferencias: { dietas: userData.dietaryPreferences.diets.join(', ') || 'Nenhuma', restricoes: userData.dietaryPreferences.restrictions.join(', ') || 'Nenhuma' },
        perfil_base: { idade: userData.age, genero: userData.gender, altura: userData.height, peso: userData.weight, atividade: userData.activityLevel }
    });

    const prompt = `
Tarefa: Gerar plano alimentar variado para 7 dias.
Saída: JSON, schema 'weeklyPlanSchema'.
Regras:
- Para as datas: ${dateStrings.join(', ')}.
- Início em ${dateStrings[0]} (${dayNames[weekStartDate.getDay()]}).
- Alinhar estritamente com o perfil e metas do usuário.
- Refeições variadas a cada dia.
- Usar alimentos comuns no Brasil.
- Incluir porções em formato "medida caseira (gramas)".
- Recalcular totais de macros e calorias para cada dia.
${difficultyPrompt}
${adminInstructionPrompt}
${observationPrompt}

Perfil do Usuário: ${userProfileJSON}
`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: DATA_GENERATION_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: weeklyPlanSchema,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });

        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText);
        const dailyPlans: DailyPlan[] = parsedResponse.weekly_plan;
        
        const planRecord: Record<string, DailyPlan> = {};
        dailyPlans.forEach(plan => {
            if (plan.date) {
                planRecord[plan.date] = plan;
            }
        });
        return planRecord;

    } catch (error) {
        console.error("Error generating weekly plan with AI:", error);
        throw new Error("Não foi possível gerar uma dieta semanal. A IA não conseguiu processar o pedido.");
    }
};


export const regenerateMealFromPrompt = async (prompt: string, meal: Meal, userData: UserData): Promise<Meal> => {
     const objective = userData.weight > userData.weightGoal ? 'perda de peso' : userData.weight < userData.weightGoal ? 'ganho de massa' : 'manutenção de peso';

    const difficultyPrompt = userData.dietDifficulty === 'easy'
      ? `- **Modo Fácil:** O usuário prefere simplicidade.`
      : userData.dietDifficulty === 'athlete'
      ? `- **Modo Atleta:** Dê preferência a alimentos ricos em proteína e carboidratos de qualidade para esta refeição.`
      : '';
    
    const adminInstructionPrompt = userData.adminSettings?.permanentPrompt
      ? `- **Regra Permanente do Nutricionista (OBRIGATÓRIO):** ${userData.adminSettings.permanentPrompt}`
      : '';

    const systemPrompt = `Você é um especialista em nutrição. Sua tarefa é regenerar uma refeição com base no pedido do usuário, alinhando-a perfeitamente ao perfil dele.
- Responda APENAS com um objeto JSON válido que corresponda ao esquema fornecido. Não inclua nenhum texto ou markdown extra.

**Contexto do Usuário:**
- **Perfil Físico:** Idade: ${userData.age}, Gênero: ${userData.gender}, Altura: ${userData.height}cm, Peso: ${userData.weight}kg.
- **Objetivo Geral:** ${objective}
- **Metas Diárias:** Calorias: ${userData.macros.calories.goal}kcal, Proteínas: ${userData.macros.protein.goal}g, Carboidratos: ${userData.macros.carbs.goal}g, Gorduras: ${userData.macros.fat.goal}g.
- **Preferências:** Dietas (${userData.dietaryPreferences.diets.join(', ') || 'Nenhuma'}), Restrições (${userData.dietaryPreferences.restrictions.join(', ') || 'Nenhuma'}).

**Pedido do Usuário para esta refeição:** "${prompt}"

**Instruções para a Nova Refeição:**
${difficultyPrompt}
${adminInstructionPrompt}
- Analise a refeição original: ${JSON.stringify(meal, null, 2)}.
- Com base no pedido do usuário e no contexto dele, crie uma nova lista de itens para a refeição.
- Tente manter o total de calorias da nova refeição próximo ao da original (${meal.totalCalories} kcal), mas priorize o alinhamento com o pedido e as metas diárias.
- **Importante:** Ao escolher novos alimentos, dê preferência a ingredientes comuns na dieta brasileira.
- **Gramatura:** Para cada alimento, forneça a porção em medida caseira E o equivalente em gramas (ex: "1 xícara (200g)").
- **CRUCIAL:** Recalcule os campos 'totalCalories' e 'totalMacros' da refeição para refletir as novas escolhas.
- Mantenha os campos 'id', 'name' e 'time' da refeição original, a menos que o usuário peça explicitamente para alterá-los.`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: DATA_GENERATION_MODEL,
            contents: systemPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: mealSchema,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error regenerating meal with AI:", error);
        throw new Error("Não foi possível regenerar a refeição. A IA não conseguiu processar o pedido.");
    }
};

export const analyzeMealFromText = async (description: string): Promise<MacroData> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: DATA_GENERATION_MODEL,
            contents: `Analise a seguinte refeição e retorne as informações nutricionais estimadas em formato JSON. Seja o mais preciso possível. Refeição: "${description}"`,
            config: {
              responseMimeType: "application/json",
              responseSchema: macroDataSchema,
               thinkingConfig: { thinkingBudget: 0 },
            },
         });
       
         const jsonText = response.text.trim();
         return JSON.parse(jsonText);

    } catch(error) {
        console.error("Error analyzing meal with AI:", error);
        throw new Error("Não foi possível analisar a refeição. Verifique a descrição e tente novamente.");
    }
};

export const analyzeMealFromImage = async (imageDataUrl: string): Promise<MacroData> => {
    const parts = imageDataUrl.split(',');
    if (parts.length !== 2) throw new Error("Formato de URL de dados de imagem inválido.");
    const mimeType = parts[0].split(';')[0].split(':')[1];
    const base64Data = parts[1];

    const imagePart = {
      inlineData: { mimeType, data: base64Data },
    };

    const textPart = {
        text: `Analise a refeição nesta imagem e retorne as informações nutricionais estimadas em formato JSON. Seja o mais preciso possível, considerando ingredientes comuns no Brasil. O JSON deve seguir o schema fornecido.`
    };

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: DATA_GENERATION_MODEL,
            contents: { parts: [imagePart, textPart] },
            config: {
              responseMimeType: "application/json",
              responseSchema: macroDataSchema,
              thinkingConfig: { thinkingBudget: 0 },
            },
         });
       
         const jsonText = response.text.trim();
         return JSON.parse(jsonText);

    } catch(error) {
        console.error("Error analyzing meal from image with AI:", error);
        throw new Error("Não foi possível analisar a imagem. Tente uma foto mais clara ou com menos itens.");
    }
};

export const analyzeProgress = async (userData: UserData): Promise<string> => {
    const prompt = `
    Você é um coach de saúde e bem-estar. Analise os dados de progresso do usuário e forneça um resumo motivacional e construtivo.

    **Dados do Usuário:**
    - **Nome:** ${userData.name}
    - **Objetivo de Peso:** Meta de ${userData.weightGoal.toFixed(1)} kg.
    - **Peso Inicial:** ${userData.initialWeight.toFixed(1)} kg.
    - **Peso Atual:** ${userData.weight.toFixed(1)} kg.
    - **Histórico de Peso (últimos 30 registros):** 
      ${(userData.weightHistory || []).slice(-30).map(h => `- ${new Date(h.date).toLocaleDateString('pt-BR')}: ${h.weight.toFixed(1)} kg`).join('\n ')}

    **Sua Tarefa:**
    1.  **Comece com uma saudação amigável** usando o nome do usuário.
    2.  **Analise a jornada do peso:** Calcule a alteração total de peso desde o início. Comente sobre a tendência geral (perda, ganho, manutenção).
    3.  **Destaque as Vitórias:** Encontre pontos positivos. O usuário está sendo consistente? Houve uma queda/aumento significativo recente? Celebre qualquer progresso.
    4.  **Ofereça Insights e Dicas:** Com base na tendência, ofereça 1 ou 2 dicas práticas e acionáveis. Se estiver perdendo peso, sugira como manter o ritmo. Se estiver estagnado, sugira como quebrar o platô. Se estiver ganhando, dê dicas para ganho de massa magra.
    5.  **Termine com uma mensagem de encorajamento,** reforçando que a jornada é uma maratona, não uma corrida.

    Use Markdown para formatar a resposta, incluindo negrito e listas para melhor legibilidade. Use um tom positivo e de apoio.
    `;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: DATA_GENERATION_MODEL,
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error analyzing progress with AI:", error);
        throw new Error("Não foi possível gerar a análise de progresso no momento.");
    }
};

export const generateShoppingList = async (weekPlan: DailyPlan[]): Promise<string> => {
    const prompt = `Você é um assistente de organização de compras. Sua tarefa é criar uma lista de compras consolidada e organizada a partir de uma dieta semanal.

**Dieta da Semana:**
${JSON.stringify(weekPlan, null, 2)}

**Sua Tarefa (CRÍTICO):**
1.  **Analise todos os itens** de todas as refeições de todos os dias do plano fornecido.
2.  **Generalize Itens Similares:** Combine variações do mesmo ingrediente em um único item genérico, somando suas quantidades. Por exemplo, 'feijão carioca' e 'feijão preto' devem ser combinados e listados simplesmente como 'Feijão'. Faça o mesmo para outros itens como 'arroz branco' e 'arroz integral' (listar como 'Arroz'), ou 'maçã fuji' e 'maçã gala' (listar como 'Maçã').
3.  **Agregue as quantidades** dos ingredientes já generalizados. Some todas as porções do mesmo alimento (ex: "Frango" na segunda + "Frango" na quarta). Se as unidades forem diferentes (ex: g e ml), mantenha-as separadas ou faça a conversão mais lógica.
4.  **Organize a lista final em categorias de supermercado** para facilitar as compras. Use as seguintes categorias e adicione outras se necessário:
    - ## 🍎 Hortifrúti (Frutas, Verduras, Legumes)
    - ## 🥩 Açougue e Peixaria
    - ## 🧀 Laticínios e Frios
    - ## 🍞 Padaria e Cereais
    - ## 🥫 Mercearia (Grãos, Enlatados, Óleos, Temperos, etc.)
    - ## ❄️ Congelados
    - ## 💧 Bebidas
5.  **Formate a saída** usando Markdown, com os títulos das categorias em H2 (##) e os itens da lista com marcadores (-). Para cada item, coloque a quantidade total e o nome do item. Ex: "- 500g de Filé de Frango".

Seja claro, conciso e organizado. A lista deve ser prática para o usuário levar ao supermercado.
`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: DATA_GENERATION_MODEL,
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating shopping list with AI:", error);
        throw new Error("Não foi possível gerar a lista de compras no momento.");
    }
};

export const getFoodInfo = async (question: string, mealContext?: Meal): Promise<string> => {
    const contextPrompt = mealContext
      ? `A pergunta do usuário pode ser sobre um alimento dentro do contexto da seguinte refeição: ${mealContext.name}, que contém: ${mealContext.items.map(i => i.name).join(', ')}. Use este contexto para enriquecer sua resposta se for relevante.`
      : '';

    const prompt = `Você é um assistente de nutrição prestativo e amigável. Responda à seguinte pergunta do usuário sobre alimentos de forma clara, concisa, e fácil de entender. Sua resposta deve ser em português do Brasil. Use Markdown para formatar a resposta se ajudar na clareza (listas, negrito).
${contextPrompt}

Pergunta do usuário: "${question}"`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error getting food info with AI:", error);
        throw new Error("Não foi possível obter a informação no momento.");
    }
};

export const getFoodSubstitution = async (itemToSwap: FoodItem, mealContext: Meal, userData: UserData): Promise<FoodItem> => {
    const prompt = `
    Tarefa: Encontrar um substituto para um item alimentar.
    Saída: APENAS o objeto JSON do novo item, conforme o schema 'foodItemSchema'.
    
    Contexto:
    - Usuário quer trocar: ${itemToSwap.name} (${itemToSwap.portion}).
    - Dentro da refeição: "${mealContext.name}".
    - Outros itens na refeição: ${mealContext.items.filter(i => i.name !== itemToSwap.name).map(i => i.name).join(', ') || 'Nenhum'}.
    - Preferências do usuário: Dietas (${userData.dietaryPreferences.diets.join(', ') || 'Nenhuma'}), Restrições (${userData.dietaryPreferences.restrictions.join(', ') || 'Nenhuma'}).

    Regras:
    1.  Encontre UM substituto nutricionalmente similar (calorias, macros).
    2.  O substituto deve ser um alimento comum no Brasil e fazer sentido no contexto da refeição.
    3.  A porção do novo item deve ser clara, com medida caseira e gramas.
    4.  Calcule os macros e calorias para o novo item.
    `;

    try {
        const ai = getAi();
         const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: foodItemSchema,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error getting food substitution with AI:", error);
        throw new Error("Não foi possível encontrar um substituto.");
    }
}

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateImages({
            model: IMAGE_GENERATION_MODEL,
            prompt: `Crie uma imagem realista e de alta qualidade com base na seguinte descrição: ${prompt}. Estilo de fotografia de alimentos, iluminação profissional, fundo desfocado.`,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image.imageBytes) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        } else {
            throw new Error("A IA não retornou nenhuma imagem.");
        }
    } catch(error) {
        console.error("Error generating image with AI:", error);
        if (error instanceof Error && error.message.includes('SAFETY')) {
             throw new Error("Não foi possível gerar a imagem devido às políticas de segurança. Tente um prompt diferente.");
        }
        throw new Error("Não foi possível gerar a imagem no momento.");
    }
};

export const findRecipes = async (query: string, userData: UserData, numRecipes: number = 3): Promise<Recipe[]> => {
    const objective = userData.weight > userData.weightGoal ? 'perda de peso' : userData.weight < userData.weightGoal ? 'ganho de massa' : 'manutenção de peso';
    
    const adminInstructionPrompt = userData.adminSettings?.permanentPrompt
      ? `- Regra Permanente do Nutricionista (OBRIGATÓRIO): ${userData.adminSettings.permanentPrompt}`
      : '';

    const userContextJSON = JSON.stringify({
        objetivo: objective,
        preferencias: { dietas: userData.dietaryPreferences.diets.join(', ') || 'Nenhuma', restricoes: userData.dietaryPreferences.restrictions.join(', ') || 'Nenhuma' }
    });

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
${adminInstructionPrompt}
`;

    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: DATA_GENERATION_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: recipeSchema,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });

        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText);
        return parsedResponse.recipes || [];

    } catch (error) {
        console.error("Error finding recipes with AI:", error);
        throw new Error("Não foi possível encontrar receitas. A IA não conseguiu processar o pedido.");
    }
};

export const analyzeActivityFromText = async (description: string): Promise<{ type: string; duration: number; caloriesBurned: number; }> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: `Analise o seguinte resumo de atividade física e extraia as informações em formato JSON. O resumo pode vir de apps como Strava ou Apple Fitness. Exemplo: "Corrida da manhã - 5.2 km em 31 minutos. Gasto calórico de 350 kcal."
            
            Resumo: "${description}"`,
            config: {
              responseMimeType: "application/json",
              responseSchema: activityLogSchema,
              thinkingConfig: { thinkingBudget: 0 },
            },
         });
       
         const jsonText = response.text.trim();
         return JSON.parse(jsonText);

    } catch(error) {
        console.error("Error analyzing activity with AI:", error);
        throw new Error("Não foi possível analisar a atividade. Verifique a descrição e tente novamente.");
    }
};