const { GoogleGenAI } = require("@google/genai");

// Per guidelines, API key must be from process.env.API_KEY
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY is not defined in environment variables.");
}

// Correct initialization
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- PROMPT ENGINEERING HELPERS ---
const buildUserProfile = (userData) => `
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

const jsonResponseInstruction = (format) => `
IMPORTANTE: Sua resposta DEVE ser um objeto JSON válido, sem nenhum texto adicional, markdown, ou explicação. Apenas o JSON. O formato deve ser:
${format}
`;


const generateAndParseJson = async (prompt) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        // The text is already a JSON string because of responseMimeType
        const text = response.text;
        // Sometimes the model still wraps in markdown
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (e) {
        console.error("Error generating or parsing JSON response from AI", e);
        console.error("Prompt that failed:", prompt);
        throw new Error("A IA retornou um formato de dados inválido. Tente novamente.");
    }
};


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { action, payload } = req.body;

    try {
        const userProfile = payload?.userData ? buildUserProfile(payload.userData) : '';

        switch (action) {
            case 'chatStream': {
                const { message, history } = payload;
                const chatHistory = history.map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                }));

                const chat = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    history: chatHistory
                });

                const resultStream = await chat.sendMessageStream({ message });

                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                
                for await (const chunk of resultStream) {
                    const responseChunk = {
                        text: chunk.text,
                        candidates: chunk.candidates,
                        promptFeedback: chunk.promptFeedback,
                    };
                    res.write(`data: ${JSON.stringify(responseChunk)}\n\n`);
                }
                return res.end();
            }

            case 'generateImageFromPrompt': {
                const response = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: payload.prompt,
                    config: {
                        numberOfImages: 1,
                        outputMimeType: 'image/jpeg'
                    }
                });
                
                const base64ImageBytes = response.generatedImages[0].image.imageBytes;
                return res.status(200).json(base64ImageBytes);
            }

            case 'analyzeMealFromImage': {
                const { imageDataUrl } = payload;
                const [header, base64Data] = imageDataUrl.split(',');
                if (!header || !base64Data) {
                    return res.status(400).json({ error: 'Formato de imagem inválido.' });
                }
                const mimeType = header.match(/:(.*?);/)[1];
                
                const prompt = `Analise esta imagem de uma refeição. Sua tarefa é retornar APENAS um objeto JSON com a estimativa de macronutrientes. ${jsonResponseInstruction('{ "calories": number, "carbs": number, "protein": number, "fat": number }')}`;
                
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [
                        { text: prompt },
                        { inlineData: { data: base64Data, mimeType } }
                    ]},
                    config: {
                        responseMimeType: "application/json"
                    }
                });
                const text = response.text;
                const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                return res.status(200).json(JSON.parse(cleanedText));
            }
            
            // Text/JSON Actions that use the helper
            case 'parseMealPlanText': {
                const prompt = `Converta o seguinte texto de um plano alimentar em um objeto JSON. ${jsonResponseInstruction('DailyPlan (conforme schema do app)')}\n\nTexto:\n${payload.text}`;
                const data = await generateAndParseJson(prompt);
                return res.status(200).json(data);
            }
            case 'regenerateDailyPlan': {
                const prompt = `Com base no perfil do usuário, gere um novo plano alimentar para a data ${payload.currentPlan.date}. ${payload.numberOfMeals ? `O plano deve ter exatamente ${payload.numberOfMeals} refeições.` : ''} ${userProfile} ${jsonResponseInstruction('DailyPlan')}`;
                const data = await generateAndParseJson(prompt);
                return res.status(200).json(data);
            }
            case 'adjustDailyPlanForMacro': {
                 const prompt = `Ajuste este plano alimentar para se aproximar mais da meta de ${payload.macroToFix}. Mantenha as calorias totais o mais próximo possível da meta. Plano original:\n${JSON.stringify(payload.currentPlan)}\n${userProfile} ${jsonResponseInstruction('DailyPlan')}`;
                 const data = await generateAndParseJson(prompt);
                 return res.status(200).json(data);
            }
            case 'generateWeeklyPlan': {
                const prompt = `Crie um plano alimentar para 7 dias, começando em ${new Date(payload.weekStartDate).toISOString().split('T')[0]}. ${payload.observation ? `Observação: ${payload.observation}`: ''} ${userProfile} ${jsonResponseInstruction('Record<string, DailyPlan>')}`;
                const data = await generateAndParseJson(prompt);
                return res.status(200).json(data);
            }
            case 'regenerateMealFromPrompt': {
                const prompt = `Regenere a refeição "${payload.meal.name}" com base na seguinte instrução: "${payload.promptStr}". ${userProfile} ${jsonResponseInstruction('Meal')}`;
                const data = await generateAndParseJson(prompt);
                return res.status(200).json(data);
            }
            case 'analyzeMealFromText': {
                 const prompt = `Analise esta descrição de uma refeição e retorne uma estimativa dos macronutrientes. ${jsonResponseInstruction('{ "calories": number, "carbs": number, "protein": number, "fat": number }')}\n\nDescrição: ${payload.description}`;
                 const data = await generateAndParseJson(prompt);
                 return res.status(200).json(data);
            }
            case 'getFoodSubstitution': {
                const prompt = `Sugira um substituto para o item "${payload.itemToSwap.name}" no contexto da refeição "${payload.mealContext.name}". O substituto deve ter macros similares. ${userProfile} ${jsonResponseInstruction('FoodItem')}`;
                const data = await generateAndParseJson(prompt);
                return res.status(200).json(data);
            }
            case 'findRecipes': {
                const prompt = `Encontre ${payload.numRecipes} receitas com base na busca: "${payload.query}". Para cada receita, forneça um prompt de imagem otimizado para um gerador de imagens. ${userProfile} ${jsonResponseInstruction('Recipe[]')}`;
                const data = await generateAndParseJson(prompt);
                return res.status(200).json(data);
            }
            case 'analyzeActivityFromText': {
                const prompt = `Analise o seguinte texto sobre uma atividade física e extraia o tipo, duração em minutos e calorias queimadas. ${jsonResponseInstruction('{ "type": string, "duration": number, "caloriesBurned": number }')}\n\nTexto: ${payload.description}`;
                const data = await generateAndParseJson(prompt);
                return res.status(200).json(data);
            }
            
            // Plain text actions
            case 'analyzeProgress': {
                const prompt = `Analise os dados de progresso do usuário e forneça um resumo motivacional com dicas. Fale diretamente com o usuário. ${userProfile}`;
                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
                return res.status(200).json(response.text);
            }
            case 'generateShoppingList': {
                const prompt = `Crie uma lista de compras detalhada e organizada por categorias (ex: Frutas, Vegetais, Carnes) com base no seguinte plano alimentar semanal:\n${JSON.stringify(payload.weekPlan)}`;
                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
                return res.status(200).json(response.text);
            }
            case 'getFoodInfo': {
                const prompt = `Responda à seguinte dúvida sobre alimentos de forma clara e concisa. Pergunta: "${payload.question}" ${payload.mealContext ? `Contexto da refeição: ${JSON.stringify(payload.mealContext)}` : ''}`;
                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
                return res.status(200).json(response.text);
            }

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }
    } catch (error) {
        console.error(`Error in action '${action}':`, error);
        return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}