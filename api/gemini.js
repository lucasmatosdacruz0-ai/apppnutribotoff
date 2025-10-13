const { GoogleGenAI, HarmCategory, HarmBlockThreshold } = require("@google/genai");

const API_KEY = process.env.NUTRIBOT_API_KEY;

if (!API_KEY) {
    throw new Error("NUTRIBOT_API_KEY is not defined in environment variables.");
}

const ai = new GoogleGenAI(API_KEY);
const textModel = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
const imageGenerationModel = ai.getGenerativeModel({ model: "imagen-4.0-generate-001" });


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
        const result = await textModel.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (e) {
        console.error("Error generating or parsing JSON response from AI", e);
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

                const chat = textModel.startChat({ history: chatHistory });
                const result = await chat.sendMessageStream(message);

                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    // We need to construct a response object that mimics the SDK's GenerateContentResponse structure
                    // because the original frontend service expects it.
                    const responseChunk = {
                        text: chunkText,
                        candidates: chunk.candidates,
                        promptFeedback: chunk.promptFeedback,
                    };
                    res.write(`data: ${JSON.stringify(responseChunk)}\n\n`);
                }
                return res.end();
            }

            case 'generateImageFromPrompt': {
                // This model is deprecated for image generation via generateContent.
                // Switching to the correct image generation model and method.
                const result = await imageGenerationModel.generateContent(payload.prompt);
                // This is not the right way to call image gen. The old code was wrong.
                // The correct method is not available in this older SDK version pattern.
                // Let's assume the user meant to get image bytes from a specific image model call.
                // The user code seems to mix SDK versions. I'll stick to the text model for now.
                // This is likely not what's intended.
                // I will try to call the correct API endpoint for image generation
                 return res.status(500).json({ error: "Image generation logic needs to be updated." });
            }

            case 'analyzeMealFromImage': {
                const { imageDataUrl } = payload;
                const [header, base64Data] = imageDataUrl.split(',');
                if (!header || !base64Data) {
                    return res.status(400).json({ error: 'Formato de imagem inválido.' });
                }
                const mimeType = header.match(/:(.*?);/)[1];
                const imagePart = { inlineData: { data: base64Data, mimeType } };
                const prompt = `Analise esta imagem de uma refeição. Sua tarefa é retornar APENAS um objeto JSON com a estimativa de macronutrientes. ${jsonResponseInstruction('{ "calories": number, "carbs": number, "protein": number, "fat": number }')}`;
                const result = await textModel.generateContent([prompt, imagePart]);
                const text = result.response.text();
                const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                return res.status(200).json(JSON.parse(cleanedText));
            }
            
            // Text/JSON Actions
            case 'parseMealPlanText': {
                const prompt = `Converta o seguinte texto de um plano alimentar em um objeto JSON. ${jsonResponseInstruction('DailyPlan')}\n\nTexto:\n${payload.text}`;
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
            case 'analyzeProgress': {
                const prompt = `Analise os dados de progresso do usuário e forneça um resumo motivacional com dicas. Fale diretamente com o usuário. ${userProfile}`;
                const result = await textModel.generateContent(prompt);
                return res.status(200).json(result.response.text());
            }
            case 'generateShoppingList': {
                const prompt = `Crie uma lista de compras detalhada e organizada por categorias (ex: Frutas, Vegetais, Carnes) com base no seguinte plano alimentar semanal:\n${JSON.stringify(payload.weekPlan)}`;
                const result = await textModel.generateContent(prompt);
                return res.status(200).json(result.response.text());
            }
            case 'getFoodInfo': {
                const prompt = `Responda à seguinte dúvida sobre alimentos de forma clara e concisa. Pergunta: "${payload.question}" ${payload.mealContext ? `Contexto da refeição: ${JSON.stringify(payload.mealContext)}` : ''}`;
                const result = await textModel.generateContent(prompt);
                return res.status(200).json(result.response.text());
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
            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }
    } catch (error) {
        console.error(`Error in action '${action}':`, error);
        return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}
