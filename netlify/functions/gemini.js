// O tempo de execução Node.js 18+ da Netlify fornece busca globalmente.
// Isso remove uma dependência que pode não ser empacotada corretamente.

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
    throw new Error("GOOGLE_API_KEY is not defined in environment variables.");
}

const API_BASE_URL = 'https://generativelanguage.googleapis.com';

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

// --- API CALL LOGIC ---

async function handleApiCall(url, body, context) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error(`Error from Gemini API in '${context}':`, errorBody);
            const errorMessage = errorBody?.error?.message || `HTTP error ${response.status}`;
            return { statusCode: 500, body: JSON.stringify({ error: `Erro da IA: ${errorMessage}` }) };
        }
        
        const data = await response.json();
        
        // Logic for standard text/json responses
        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
            const text = data.candidates[0].content.parts[0].text;
            try {
                // Attempt to parse if it looks like JSON
                const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                return { statusCode: 200, body: JSON.stringify({ data: JSON.parse(cleanedText) }) };
            } catch {
                // Return as plain text if not valid JSON
                return { statusCode: 200, body: JSON.stringify({ data: text }) };
            }
        }
        
        // Logic for image generation responses
        if (data.generatedImages) {
            return { statusCode: 200, body: JSON.stringify({ data: data.generatedImages[0].image.imageBytes }) };
        }

        throw new Error("Formato de resposta da IA inesperado.");

    } catch (err) {
        console.error(`Error in function '${context}':`, err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
}

// --- MAIN HANDLER ---

export async function handler(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { action, payload } = JSON.parse(event.body);
    let prompt, body, url, model;

    const userProfile = payload.userData ? buildUserProfile(payload.userData) : '';

    switch (action) {
        // --- STREAMING ACTIONS ---
        case 'chatStream': {
            const { message, history } = payload;
            const model = 'gemini-2.5-flash';
            const url = `${API_BASE_URL}/v1beta/models/${model}:streamGenerateContent?key=${API_KEY}`;
            
            const contents = history.map(h => ({
                role: h.sender === 'user' ? 'user' : 'model',
                parts: [{ text: h.text }]
            }));
            contents.push({ role: 'user', parts: [{ text: message }]});

            const body = { contents };

            const geminiResponse = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            
            // Forward the stream directly to the client
            return {
                statusCode: 200,
                headers: { 
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
                body: geminiResponse.body,
            };
        }

        // --- IMAGE GENERATION ACTIONS ---
        case 'generateImageFromPrompt':
            model = 'imagen-4.0-generate-001';
            url = `${API_BASE_URL}/v1/models/${model}:generateImages?key=${API_KEY}`;
            body = { 
                prompt: payload.prompt,
                config: { numberOfImages: 1, outputMimeType: 'image/jpeg' }
            };
            return handleApiCall(url, body, action);

        // --- MULTIMODAL ACTIONS ---
        case 'analyzeMealFromImage': {
            model = 'gemini-2.5-flash';
            url = `${API_BASE_URL}/v1beta/models/${model}:generateContent?key=${API_KEY}`;
            const { imageDataUrl } = payload;
            const [header, base64Data] = imageDataUrl.split(',');
            if (!header || !base64Data) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Formato de imagem inválido.'})};
            }
            const mimeType = header.match(/:(.*?);/)[1];
            
            prompt = `Analise esta imagem de uma refeição. Sua tarefa é retornar APENAS um objeto JSON com a estimativa de macronutrientes. ${jsonResponseInstruction('{ "calories": number, "carbs": number, "protein": number, "fat": number }')}`;
            
            body = {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType, data: base64Data } }
                    ]
                }],
                generationConfig: { responseMimeType: "application/json" }
            };
            return handleApiCall(url, body, action);
        }
            
        // --- TEXT/JSON ACTIONS ---
        default: {
            model = 'gemini-2.5-flash';
            url = `${API_BASE_URL}/v1beta/models/${model}:generateContent?key=${API_KEY}`;
            body = { generationConfig: { responseMimeType: "application/json" }};
            let plainTextResponse = false;

            switch (action) {
                case 'parseMealPlanText':
                    prompt = `Converta o seguinte texto de um plano alimentar em um objeto JSON. ${jsonResponseInstruction('DailyPlan (definido no schema do app)')}\n\nTexto:\n${payload.text}`;
                    break;
                
                case 'regenerateDailyPlan':
                    prompt = `Com base no perfil do usuário, gere um novo plano alimentar para a data ${payload.currentPlan.date}. ${payload.numberOfMeals ? `O plano deve ter exatamente ${payload.numberOfMeals} refeições.` : ''} ${userProfile} ${jsonResponseInstruction('DailyPlan')}`;
                    break;
                
                case 'adjustDailyPlanForMacro':
                    prompt = `Ajuste este plano alimentar para se aproximar mais da meta de ${payload.macroToFix}. Mantenha as calorias totais o mais próximo possível da meta. Plano original:\n${JSON.stringify(payload.currentPlan)}\n${userProfile} ${jsonResponseInstruction('DailyPlan')}`;
                    break;
                
                case 'generateWeeklyPlan':
                    prompt = `Crie um plano alimentar para 7 dias, começando em ${payload.weekStartDate.toISOString().split('T')[0]}. ${payload.observation ? `Observação: ${payload.observation}`: ''} ${userProfile} ${jsonResponseInstruction('Record<string, DailyPlan>')}`;
                    break;
                
                case 'regenerateMealFromPrompt':
                    prompt = `Regenere a refeição "${payload.meal.name}" com base na seguinte instrução: "${payload.prompt}". ${userProfile} ${jsonResponseInstruction('Meal')}`;
                    break;

                case 'analyzeMealFromText':
                    prompt = `Analise esta descrição de uma refeição e retorne uma estimativa dos macronutrientes. ${jsonResponseInstruction('{ "calories": number, "carbs": number, "protein": number, "fat": number }')}\n\nDescrição: ${payload.description}`;
                    break;

                case 'analyzeProgress':
                    plainTextResponse = true;
                    body = {};
                    prompt = `Analise os dados de progresso do usuário e forneça um resumo motivacional com dicas. Fale diretamente com o usuário. ${userProfile}`;
                    break;
                
                case 'generateShoppingList':
                    plainTextResponse = true;
                    body = {};
                    prompt = `Crie uma lista de compras detalhada e organizada por categorias (ex: Frutas, Vegetais, Carnes) com base no seguinte plano alimentar semanal:\n${JSON.stringify(payload.weekPlan)}`;
                    break;

                case 'getFoodInfo':
                    plainTextResponse = true;
                    body = {};
                    prompt = `Responda à seguinte dúvida sobre alimentos de forma clara e concisa. Pergunta: "${payload.question}" ${payload.mealContext ? `Contexto da refeição: ${JSON.stringify(payload.mealContext)}` : ''}`;
                    break;

                case 'getFoodSubstitution':
                    prompt = `Sugira um substituto para o item "${payload.itemToSwap.name}" no contexto da refeição "${payload.mealContext.name}". O substituto deve ter macros similares. ${userProfile} ${jsonResponseInstruction('FoodItem')}`;
                    break;

                case 'findRecipes':
                    prompt = `Encontre ${payload.numRecipes} receitas com base na busca: "${payload.query}". Para cada receita, forneça um prompt de imagem otimizado para um gerador de imagens. ${userProfile} ${jsonResponseInstruction('Recipe[]')}`;
                    break;

                case 'analyzeActivityFromText':
                    prompt = `Analise o seguinte texto sobre uma atividade física e extraia o tipo, duração em minutos e calorias queimadas. ${jsonResponseInstruction('{ "type": string, "duration": number, "caloriesBurned": number }')}\n\nTexto: ${payload.description}`;
                    break;

                default:
                    return { statusCode: 400, body: JSON.stringify({ error: `Ação desconhecida: ${action}` }) };
            }
            
            body.contents = [{ parts: [{ text: prompt }] }];
            if (plainTextResponse) {
                delete body.generationConfig;
            }
            return handleApiCall(url, body, action);
        }
    }
}