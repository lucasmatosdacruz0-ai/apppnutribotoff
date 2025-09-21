

import React, { useState, useEffect, FC, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatView from './components/ChatView';
import ProfileView from './components/ProfileView';
import OnboardingFlow from './components/OnboardingFlow';
import PlanoAlimentarView from './components/PlanoAlimentarView';
import FavoritesView from './components/FavoritesView';
import FeaturesView from './components/FeaturesView';
import ProgressView from './components/ProgressView';
// FIX: Import ActivityLog and AtividadesView
import { View, UserData, UserDataHandlers, MacroData, Message, DailyPlan, DietDifficulty, NotificationState, Meal, Recipe, RecipesViewState, FoodItem, PlanKey, DailyUsage, WeeklyUsage, UpsellModalState, ActivityLog } from './types';
import AtividadesView from './components/AtividadesView';
import BottomNav from './components/BottomNav';
import { calculateNewMacroGoals } from './components/calculations';
import ErrorBoundary from './components/ErrorBoundary';
import FlameOverlay from './components/FlameOverlay';
import { HomeIcon } from './components/icons/HomeIcon';
import LoginView from './components/LoginView';

import * as geminiService from './services/geminiService';
import { generateMockMealPlan } from './components/mockMealPlan';
import { sanitizeDailyPlan, sanitizeMeal } from './components/utils/sanitizers';
import ShoppingListModal from './components/ShoppingListModal';
import RecipesView from './components/RecipesView';
import AdminView from './components/AdminView';
import AchievementsView from './components/AchievementsView';
import { ALL_ACHIEVEMENTS, getAchievementProgress } from './constants/achievements';
import { calculateXPForLevel } from './components/utils/xpUtils';
import StartTutorialModal from './components/StartTutorialModal';
import Tutorial from './components/Tutorial';
import { TUTORIAL_STEPS } from './constants/tutorialSteps';
import { QuestionMarkCircleIcon } from './components/icons/QuestionMarkCircleIcon';
import SubscriptionBlockView from './components/SubscriptionBlockView';
import SubscriptionModal from './components/SubscriptionModal';
import ManageSubscriptionView from './components/ManageSubscriptionView';
import { ALL_FEATURES, PLANS } from './constants/plans';
import UpsellModal from './components/UpsellModal';


const LoadingSpinner: FC<{className?: string}> = ({ className }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const Toast: FC<{ notification: NotificationState }> = ({ notification }) => {
    if (!notification) return null;

    const isAchievement = notification.message.includes('🎉');
    const isXP = notification.message.includes('XP');
    
    let toastClass = 'bg-slate-900 text-white theme-athlete:bg-red-500/90 theme-athlete:backdrop-blur-sm theme-athlete:border theme-athlete:border-red-400';

    if (isAchievement) {
        toastClass = 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-yellow-500';
    } else if (isXP) {
        toastClass = 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-purple-600';
    }

    return (
      <div 
        className={`fixed bottom-8 right-8 z-50 py-3 px-5 rounded-lg shadow-2xl flex items-center gap-4 animate-slideInUp ${toastClass}`}
      >
          {notification.type === 'loading' && <LoadingSpinner className="w-5 h-5" />}
          <p className="font-semibold text-sm">{notification.message}</p>
      </div>
    );
};

const XP_AMOUNTS = {
    DAY_COMPLETE: 50,
    STREAK_BONUS_3: 100,
    STREAK_BONUS_7: 250,
    LOG_MEAL: 15,
    PLAN_GENERATED: 40,
    // FIX: Add XP amount for logging an activity
    LOG_ACTIVITY: 20,
};

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Week starts on Monday
  return new Date(d.setDate(diff));
};


const defaultDailyUsage: DailyUsage = {
    date: new Date().toISOString().split('T')[0],
    dailyPlanGenerations: 0, dayRegenerations: 0, chatImports: 0,
    macroAdjustments: 0, progressAnalyses: 0, chatInteractions: 0,
    itemSwaps: 0, mealAnalysesText: 0, mealAnalysesImage: 0,
};

const defaultWeeklyUsage: WeeklyUsage = {
    weekStartDate: getStartOfWeek(new Date()).toISOString().split('T')[0],
    weeklyPlanGenerations: 0, shoppingLists: 0, recipeSearches: 0, imageGen: 0,
};

const defaultUserData: UserData = {
    isRegistered: false,
    name: 'Visitante',
    email: '',
    profilePicture: null,
    age: 30,
    gender: 'male',
    height: 175,
    activityLevel: 'sedentary',
    initialWeight: 75,
    weight: 75,
    weightHistory: [],
    weightGoal: 70,
    water: 0,
    waterGoal: 2.5,
    waterReminders: { enabled: false, times: ["09:00", "12:00", "15:00", "18:00"] },
    mealReminders: { enabled: false },
    macros: {
        calories: { current: 0, goal: 2000 },
        carbs: { current: 0, goal: 250 },
        protein: { current: 0, goal: 150 },
        fat: { current: 0, goal: 70 },
    },
    dietaryPreferences: {
        diets: [],
        restrictions: [],
    },
    dietDifficulty: 'normal',
    streak: 0,
    completedDays: [],
    achievements: [],
    hasGeneratedPlan: false,
    level: 1,
    xp: 0,
    waterStreak: 0,
    totalRecipesGenerated: 0,
    imagesGeneratedCount: 0,
    athleteModeUsed: false,
    perfectDaysCount: 0,
    featuredAchievementId: null,
    hasCompletedTutorial: false,
    adminSettings: {
        permanentPrompt: '',
    },
    isSubscribed: false,
    trialEndDate: new Date().toISOString(),
    freeImagesGenerated: 0,
    currentPlan: null,
    billingCycle: null,
    dailyUsage: { ...defaultDailyUsage },
    weeklyUsage: { ...defaultWeeklyUsage },
    purchasedUses: {},
    // FIX: Add activityLogs to default user data
    activityLogs: [],
};

interface FullUserSession {
    userData: UserData;
    mealPlan: Record<string, DailyPlan> | null;
    favoritePlans: DailyPlan[];
    favoriteRecipes: Recipe[];
    chatMessages: Message[];
    lastMealPlanText: string | null;
    recipesViewState: RecipesViewState;
}

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<string | null>(() => {
        try { return localStorage.getItem('nutribot_currentUser'); } catch { return null; }
    });

    // All user-specific states
    const [userData, setUserData] = useState<UserData>(defaultUserData);
    const [mealPlan, setMealPlan] = useState<Record<string, DailyPlan> | null>(null);
    const [favoritePlans, setFavoritePlans] = useState<DailyPlan[]>([]);
    const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
    const [chatMessages, setChatMessages] = useState<Message[]>([]);
    const [lastMealPlanText, setLastMealPlanText] = useState<string | null>(null);
    const [recipesViewState, setRecipesViewState] = useState<RecipesViewState>({
        activeTab: 'search', query: '', recipes: [], recipeImageCache: {},
    });

    // App-wide non-user states
    const [activeView, setActiveView] = useState<View>('Dashboard');
    const [notification, setNotification] = useState<NotificationState>(null);
    const [isPlanProcessing, setIsPlanProcessing] = useState(false);
    const [isShoppingListModalOpen, setIsShoppingListModalOpen] = useState(false);
    const [shoppingListContent, setShoppingListContent] = useState('');
    const [showFlameAnimation, setShowFlameAnimation] = useState(false);
    const [isTutorialActive, setIsTutorialActive] = useState(false);
    const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
    const [showStartTutorialModal, setShowStartTutorialModal] = useState(false);
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    const [upsellModalState, setUpsellModalState] = useState<UpsellModalState>({ isOpen: false, featureKey: null, featureText: null });

    // Load user data on currentUser change
    useEffect(() => {
        if (currentUser) {
            try {
                const allUsers = JSON.parse(localStorage.getItem('nutribot_users') || '{}');
                const userSession: FullUserSession | undefined = allUsers[currentUser];

                if (userSession && userSession.userData) {
                    let loadedUserData = userSession.userData;

                    // FIX: Ensure activityLogs exists on loaded data
                    if (!loadedUserData.activityLogs) {
                        loadedUserData.activityLogs = [];
                    }

                    // --- MACRO GOAL MIGRATION ---
                    // Recalculate macros on load to ensure they are up-to-date with the latest logic.
                    // This prevents stale data from being used.
                    if (loadedUserData.isRegistered) {
                        const newCalculatedMacros = calculateNewMacroGoals(loadedUserData);
                        const { calories, carbs, protein, fat } = loadedUserData.macros;
                        if (
                            newCalculatedMacros.calories.goal !== calories.goal ||
                            newCalculatedMacros.carbs.goal !== carbs.goal ||
                            newCalculatedMacros.protein.goal !== protein.goal ||
                            newCalculatedMacros.fat.goal !== fat.goal
                        ) {
                            loadedUserData = {
                                ...loadedUserData,
                                macros: {
                                    calories: { ...calories, goal: newCalculatedMacros.calories.goal },
                                    carbs: { ...carbs, goal: newCalculatedMacros.carbs.goal },
                                    protein: { ...protein, goal: newCalculatedMacros.protein.goal },
                                    fat: { ...fat, goal: newCalculatedMacros.fat.goal },
                                }
                            };
                        }
                    }
                    // --- END MIGRATION ---

                    setUserData(loadedUserData);
                    setMealPlan(userSession.mealPlan || null);
                    setFavoritePlans(userSession.favoritePlans || []);
                    setFavoriteRecipes(userSession.favoriteRecipes || []);
                    setChatMessages(userSession.chatMessages || []);
                    setLastMealPlanText(userSession.lastMealPlanText || null);
                    setRecipesViewState(userSession.recipesViewState || { activeTab: 'search', query: '', recipes: [], recipeImageCache: {} });
                } else {
                     // This could happen if a user is registered but has no data yet.
                    setUserData({ ...defaultUserData, email: currentUser, name: currentUser.split('@')[0] });
                }
            } catch (e) {
                console.error("Failed to load user session:", e);
                // Handle potential corrupted data
                handleLogout();
            }
        }
    }, [currentUser]);

    // Save all user data whenever a piece of it changes
    useEffect(() => {
        if (!currentUser) return;
        try {
            const allUsers = JSON.parse(localStorage.getItem('nutribot_users') || '{}');
            const newSessionData: FullUserSession = {
                userData, mealPlan, favoritePlans, favoriteRecipes, chatMessages, lastMealPlanText, recipesViewState
            };
            allUsers[currentUser] = newSessionData;
            localStorage.setItem('nutribot_users', JSON.stringify(allUsers));
        } catch (e) {
            console.error("Failed to save user session data:", e);
        }
    }, [userData, mealPlan, favoritePlans, favoriteRecipes, chatMessages, lastMealPlanText, recipesViewState, currentUser]);
    
    
  const isAthleteMode = userData.dietDifficulty === 'athlete';
  const theme = isAthleteMode ? 'theme-athlete' : 'theme-light';
  const mainBgClass = isAthleteMode ? '' : 'bg-slate-50';

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Effect to reset daily/weekly usage counters
  useEffect(() => {
    setUserData(prev => {
        const todayStr = new Date().toISOString().split('T')[0];
        const startOfWeekStr = getStartOfWeek(new Date()).toISOString().split('T')[0];
        
        const currentDailyUsage = prev.dailyUsage || defaultDailyUsage;
        const currentWeeklyUsage = prev.weeklyUsage || defaultWeeklyUsage;

        let needsUpdate = false;
        const newDailyUsage = { ...currentDailyUsage };
        const newWeeklyUsage = { ...currentWeeklyUsage };

        if (currentDailyUsage.date !== todayStr) {
            needsUpdate = true;
            Object.keys(newDailyUsage).forEach(key => {
                if (key !== 'date') {
                   (newDailyUsage as any)[key] = 0;
                }
            });
            newDailyUsage.date = todayStr;
        }

        if (currentWeeklyUsage.weekStartDate !== startOfWeekStr) {
            needsUpdate = true;
            Object.keys(newWeeklyUsage).forEach(key => {
                if (key !== 'weekStartDate') {
                    (newWeeklyUsage as any)[key] = 0;
                }
            });
            newWeeklyUsage.weekStartDate = startOfWeekStr;
        }
        
        if (needsUpdate) {
            return {
                ...prev,
                dailyUsage: newDailyUsage,
                weeklyUsage: newWeeklyUsage,
            };
        }
        return prev;
    });
  }, []);


  const showNotification = (notif: NotificationState) => {
      setNotification(notif);
  };
  
    const handleAddXP = (amount: number, reason: string) => {
        if (amount <= 0) return;

        const xpMultiplier = userData.isSubscribed ? 1.5 : 1.0;
        const finalAmount = Math.round(amount * xpMultiplier);

        let message = `+${finalAmount} XP: ${reason}`;
        if (userData.isSubscribed && xpMultiplier > 1) {
            message += ` (Bônus Pro x${xpMultiplier}!)`;
        }

        showNotification({type: 'info', message: message});
        setTimeout(() => showNotification(null), 2500);

        setUserData(prev => {
            let newXP = prev.xp + finalAmount;
            let newLevel = prev.level;
            let xpForNextLevel = calculateXPForLevel(newLevel);

            if (newXP >= xpForNextLevel) {
                // Level up!
                newLevel++;
                newXP = newXP - xpForNextLevel; // Carry over remaining XP
                
                // Show level up notification after the XP gain notification
                setTimeout(() => {
                    setShowFlameAnimation(true); // Re-using the flame for level up
                    showNotification({ type: 'success', message: `🎉 LEVEL UP! Você alcançou o Nível ${newLevel}!` });
                    setTimeout(() => setShowFlameAnimation(false), 2000);
                    setTimeout(() => showNotification(null), 4000);
                }, 2600);
            }
            
            return { ...prev, level: newLevel, xp: newXP };
        });
    };

    const handleOpenUpsellModal = (featureKey: string, featureText: string) => {
        setUpsellModalState({ isOpen: true, featureKey, featureText });
    };

    const handleCheckAndIncrementUsage = (featureKey: string, amount: number = 1): boolean => {
        const isFirstPlanGeneration = !userData.hasGeneratedPlan && (featureKey === 'dailyPlanGenerations' || featureKey === 'weeklyPlanGenerations');
        if (isFirstPlanGeneration) {
            return true; // Allow the first one for free without incrementing
        }

        const isTrial = !userData.isSubscribed && new Date(userData.trialEndDate) > new Date();
        const planKey = userData.isSubscribed && userData.currentPlan ? userData.currentPlan : 'basic';
        const plan = isTrial ? PLANS.pro : PLANS[planKey];

        const feature = plan.features.find((f: any) => f.key === featureKey);
        
        if (!feature || feature.available === false) {
            showNotification({ type: 'error', message: `O recurso "${feature?.text || ''}" não está disponível no seu plano.` });
            handleOpenUpsellModal(featureKey, feature?.text || 'recurso');
            return false;
        }

        if (feature.limit === Infinity) {
            return true; // Unlimited feature
        }

        // 1. Check plan limit
        const usageData = feature.period === 'week' ? userData.weeklyUsage : userData.dailyUsage;
        const currentUsage = (usageData as any)[featureKey] || 0;

        if (currentUsage + amount <= feature.limit) {
            setUserData(prev => {
                const newUsageData = feature.period === 'week' ? { ...prev.weeklyUsage } : { ...prev.dailyUsage };
                (newUsageData as any)[featureKey] = ((newUsageData as any)[featureKey] || 0) + amount;
                
                return {
                    ...prev,
                    ...(feature.period === 'week' ? { weeklyUsage: newUsageData as WeeklyUsage } : { dailyUsage: newUsageData as DailyUsage }),
                };
            });
             if (featureKey === 'recipeSearches') {
                 setUserData(prev => ({ ...prev, totalRecipesGenerated: prev.totalRecipesGenerated + amount }));
            }
            return true;
        }

        // 2. Check purchased uses
        const purchasedUsage = userData.purchasedUses?.[featureKey] || 0;
        if (purchasedUsage >= amount) {
            setUserData(prev => ({
                ...prev,
                purchasedUses: {
                    ...prev.purchasedUses,
                    [featureKey]: (prev.purchasedUses?.[featureKey] || 0) - amount,
                }
            }));
            return true;
        }

        // 3. Out of uses, trigger upsell
        handleOpenUpsellModal(featureKey, feature.text);
        showNotification({ type: 'error', message: `Limite de "${feature.text}" (${feature.value}) atingido.` });
        return false;
    };


  const processAIRequest = async (
    requestFn: () => Promise<any>,
    options: { loadingMessage: string, successMessage: string, isPlanGeneration?: boolean }
  ): Promise<any> => {
      setIsPlanProcessing(true);
      showNotification({ type: 'loading', message: options.loadingMessage });
      try {
          const response = await requestFn();
          
          if (options.isPlanGeneration) {
              setUserData(prev => ({ ...prev, hasGeneratedPlan: true }));
              handleAddXP(XP_AMOUNTS.PLAN_GENERATED, "Geração de plano com IA");
          }

          showNotification({ type: 'success', message: options.successMessage });
          setTimeout(() => showNotification(null), 3000);
          return response;
      } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
          showNotification({ type: 'error', message: errorMessage });
          setTimeout(() => showNotification(null), 5000);
          throw e;
      } finally {
          setIsPlanProcessing(false);
      }
  };

  const handleGenerateWeeklyPlan = async (startDate: Date, observation?: string) => {
    if (!handleCheckAndIncrementUsage('weeklyPlanGenerations')) return;
    try {
        const planRecord = await processAIRequest(
            () => geminiService.generateWeeklyPlan(userData, startDate, observation),
            { loadingMessage: 'A IA está gerando uma dieta para a semana toda...', successMessage: 'Dieta semanal gerada!', isPlanGeneration: true }
        );

        const sanitizedRecord: Record<string, DailyPlan> = {};
        for(const dateKey in planRecord) {
            const sanitized = sanitizeDailyPlan(planRecord[dateKey]);
            if (sanitized) {
                sanitizedRecord[dateKey] = sanitized;
            }
        }
        setMealPlan(prev => ({ ...(prev ?? {}), ...sanitizedRecord }));
    } catch(e) { console.error("Failed to generate weekly plan", e); }
  };
  
  const handleGenerateDailyPlan = async (date: Date) => {
      if (!handleCheckAndIncrementUsage('dailyPlanGenerations')) return;
      try {
          const planData = await processAIRequest(
              () => geminiService.regenerateDailyPlan(userData, generateMockMealPlan(date, true)),
              { loadingMessage: 'Gerando sua dieta diária...', successMessage: 'Dieta gerada com sucesso!', isPlanGeneration: true }
          );
          const sanitizedPlan = sanitizeDailyPlan(planData);
          if (sanitizedPlan) {
              setMealPlan(prev => ({...(prev ?? {}), [sanitizedPlan.date]: sanitizedPlan}));
          } else {
              showNotification({type: 'error', message: 'A IA retornou uma dieta inválida.'});
          }
      } catch (e) { console.error("Failed to generate daily plan", e); }
  };
  
  const handleImportPlanFromChat = async (text: string) => {
      if (!handleCheckAndIncrementUsage('chatImports')) return;
      try {
        const planData = await processAIRequest(
            () => geminiService.parseMealPlanText(text),
            { loadingMessage: 'Importando dieta do chat...', successMessage: 'Dieta importada!', isPlanGeneration: true }
        );
        const sanitizedPlan = sanitizeDailyPlan(planData);
        if (sanitizedPlan) {
            setMealPlan(prev => ({...(prev ?? {}), [sanitizedPlan.date]: sanitizedPlan}));
            setActiveView('Dieta');
        } else {
            showNotification({type: 'error', message: 'A IA não conseguiu analisar o texto do chat.'});
        }
      } catch(e) { console.error("Failed to import plan", e); }
  };
  
  const handleRegenerateDay = async (date: string, mealCount?: number) => {
      if (!handleCheckAndIncrementUsage('dayRegenerations')) return;
      const currentDayPlan = mealPlan ? mealPlan[date] : null;
      if (!currentDayPlan) return;
      try {
        const planData = await processAIRequest(
            () => geminiService.regenerateDailyPlan(userData, currentDayPlan, mealCount),
            { loadingMessage: 'A IA está recriando sua dieta...', successMessage: 'Dieta atualizada!', isPlanGeneration: true }
        );
        const sanitizedPlan = sanitizeDailyPlan(planData);
        if (sanitizedPlan) {
            setMealPlan(prev => ({...(prev ?? {}), [sanitizedPlan.date]: sanitizedPlan}));
        } else {
            showNotification({type: 'error', message: 'A IA retornou uma dieta inválida.'});
        }
      } catch (e) { console.error("Failed to regenerate day", e); }
  };
  
  const handleAdjustDayForMacro = async (date: string, macro: keyof Omit<MacroData, 'calories'>) => {
      if (!handleCheckAndIncrementUsage('macroAdjustments')) return;
      const currentDayPlan = mealPlan ? mealPlan[date] : null;
      if (!currentDayPlan) return;
      try {
          const planData = await processAIRequest(
              () => geminiService.adjustDailyPlanForMacro(userData, currentDayPlan, macro),
              { loadingMessage: `Ajustando ${macro}...`, successMessage: 'Dieta ajustada!' }
          );
          const sanitizedPlan = sanitizeDailyPlan(planData);
          if (sanitizedPlan) {
              setMealPlan(prev => ({...(prev ?? {}), [sanitizedPlan.date]: sanitizedPlan}));
          } else {
              showNotification({type: 'error', message: 'A IA retornou uma dieta inválida.'});
          }
      } catch (e) { console.error("Failed to adjust macro", e); }
  };
  
  const handleRegenerateMeal = async (date: string, mealId: string, prompt: string) => {
      if (!handleCheckAndIncrementUsage('itemSwaps')) return;
      const currentDayPlan = mealPlan ? mealPlan[date] : null;
      const originalMeal = currentDayPlan?.meals.find(m => m.id === mealId);
      if (!originalMeal) return;
      try {
          const mealData = await processAIRequest(
              () => geminiService.regenerateMealFromPrompt(prompt, originalMeal, userData),
              { loadingMessage: 'A IA está recriando sua refeição...', successMessage: 'Refeição atualizada!'}
          );
          const sanitizedMeal = sanitizeMeal(mealData);
          if (sanitizedMeal && currentDayPlan) {
            const updatedMeals = currentDayPlan.meals.map(m => m.id === sanitizedMeal.id ? sanitizedMeal : m);
            const updatedPlan = sanitizeDailyPlan({ ...currentDayPlan, meals: updatedMeals });
            if (updatedPlan) {
                setMealPlan(prev => ({ ...prev, [date]: updatedPlan }));
            }
          } else {
            showNotification({type: 'error', message: 'A IA retornou uma refeição inválida.'});
          }
      } catch (e) { console.error("Failed to regenerate meal", e); }
  };
  
  const handleUpdateMeal = (date: string, updatedMeal: Meal) => {
    const currentDayPlan = mealPlan ? mealPlan[date] : null;
    if (!currentDayPlan) return;
    const updatedMeals = currentDayPlan.meals.map(m => m.id === updatedMeal.id ? updatedMeal : m);
    const updatedPlan = sanitizeDailyPlan({ ...currentDayPlan, meals: updatedMeals });
    if(updatedPlan) {
        setMealPlan(prev => ({ ...prev, [date]: updatedPlan }));
    }
  };

  const handleSwapItem = async (date: string, mealId: string, itemToSwap: FoodItem) => {
      if (!handleCheckAndIncrementUsage('itemSwaps')) return;
      const currentDayPlan = mealPlan ? mealPlan[date] : null;
      const mealContext = currentDayPlan?.meals.find(m => m.id === mealId);
      if (!currentDayPlan || !mealContext) return;
      
      showNotification({ type: 'loading', message: `Trocando ${itemToSwap.name}...` });
      try {
          const newItem = await geminiService.getFoodSubstitution(itemToSwap, mealContext, userData);
          
          const updatedMeals = currentDayPlan.meals.map(meal => {
              if (meal.id === mealId) {
                  const newItems = meal.items.map(item => item.name === itemToSwap.name ? newItem : item);
                  return sanitizeMeal({ ...meal, items: newItems }) as Meal;
              }
              return meal;
          });

          const updatedPlan = sanitizeDailyPlan({ ...currentDayPlan, meals: updatedMeals });
          if (updatedPlan) {
              setMealPlan(prev => ({ ...prev, [date]: updatedPlan }));
              showNotification({ type: 'success', message: 'Item trocado com sucesso!'});
          }
          
      } catch(e) {
          const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
          showNotification({ type: 'error', message: errorMessage });
      } finally {
          setTimeout(() => showNotification(null), 3000);
      }
  };

  const handleGenerateShoppingList = async (weekPlan: DailyPlan[]) => {
    if (!handleCheckAndIncrementUsage('shoppingLists')) return;
    try {
        const list = await processAIRequest(
            () => geminiService.generateShoppingList(weekPlan),
            { loadingMessage: 'Gerando sua lista de compras...', successMessage: 'Lista de compras pronta!' }
        );
        setShoppingListContent(list);
        setIsShoppingListModalOpen(true);
    } catch (e) {
        console.error("Failed to generate shopping list", e);
    }
  };

  const handleRecipesGenerated = (count: number) => {
      // Usage is checked and incremented in RecipesView now
  };

    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        
        const lastCompletedDayStr = userData.completedDays.length > 0 ? userData.completedDays[userData.completedDays.length - 1] : null;

        if (lastCompletedDayStr) {
            const lastCompletedDate = new Date(lastCompletedDayStr + 'T00:00:00.000Z');
            
            if (lastCompletedDate.getTime() < yesterday.getTime()) {
                setUserData(prev => ({ ...prev, streak: 0, waterStreak: 0 }));
            }
        }
  }, []);

    // Achievement checking logic
    useEffect(() => {
        const newlyUnlocked: (typeof ALL_ACHIEVEMENTS[0])[] = [];
        for (const achievement of ALL_ACHIEVEMENTS) {
            if (!userData.achievements.includes(achievement.id)) {
                const progress = getAchievementProgress(userData, achievement, { favoriteRecipesCount: favoriteRecipes.length });
                if (progress.unlocked) {
                    newlyUnlocked.push(achievement);
                }
            }
        }

        if (newlyUnlocked.length > 0) {
            setUserData(prev => ({
                ...prev,
                achievements: [...prev.achievements, ...newlyUnlocked.map(a => a.id)],
            }));

            newlyUnlocked.forEach((ach, index) => {
                setTimeout(() => {
                    showNotification({ type: 'success', message: `🎉 Conquista: ${ach.title}` });
                    handleAddXP(ach.xpReward ?? 0, `Conquista: ${ach.title}`);
                    setTimeout(() => showNotification(null), 3000);
                }, index * 4000); // Stagger notifications
            });
        }
    }, [userData, favoriteRecipes.length]);


  const handleToggleFavoritePlan = (plan: DailyPlan) => {
    setFavoritePlans(prev => {
        const isFavorite = prev.some(p => p.date === plan.date);
        if (isFavorite) {
            return prev.filter(p => p.date !== plan.date);
        } else {
            return [...prev, plan].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
    });
  };

  const handleUpdateFavoritePlan = (updatedPlan: DailyPlan) => {
    setFavoritePlans(prev =>
      prev.map(p => (p.date === updatedPlan.date ? updatedPlan : p))
    );
  };
  
  const handleToggleFavoriteRecipe = (recipe: Recipe) => {
    setFavoriteRecipes(prev => {
        const isFavorite = prev.some(r => r.id === recipe.id);
        if (isFavorite) {
            return prev.filter(r => r.id !== recipe.id);
        } else {
            return [...prev, recipe];
        }
    });
  };

  const handleUseFavoriteAsToday = (favoritePlan: DailyPlan) => {
    const today = new Date();
    const todayKey = today.toISOString().split('T')[0];
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const todayDayOfWeek = dayNames[today.getDay()];

    const planForToday: DailyPlan = JSON.parse(JSON.stringify(favoritePlan));
    
    planForToday.date = todayKey;
    planForToday.dayOfWeek = todayDayOfWeek;

    setMealPlan(prev => ({
      ...prev,
      [todayKey]: planForToday,
    }));
    setActiveView('Dieta');
  };

  const handleRegistrationComplete = (data: Partial<UserData>) => {
    const finalData = { ...userData, ...data, isRegistered: true, hasCompletedTutorial: false };
    if (finalData.weight && (!finalData.weightHistory || finalData.weightHistory.length === 0)) {
        finalData.weightHistory = [{ date: new Date().toISOString(), weight: finalData.weight }];
    }
    setUserData(finalData);
    setShowStartTutorialModal(true);
  };
  
  const handleSetFeaturedAchievement = (id: string | null) => {
      setUserData(prev => ({ ...prev, featuredAchievementId: id }));
  };

    const startTutorial = () => {
        setTutorialStepIndex(0);
        setIsTutorialActive(true);
        const firstStepView = TUTORIAL_STEPS[0].view;
        setActiveView(firstStepView);
    };

    const skipTutorial = () => {
        setIsTutorialActive(false);
        setUserData(prev => ({ ...prev, hasCompletedTutorial: true }));
    };

    const nextTutorialStep = () => {
        if (tutorialStepIndex < TUTORIAL_STEPS.length - 1) {
            const nextStepIndex = tutorialStepIndex + 1;
            const nextStep = TUTORIAL_STEPS[nextStepIndex];
            setActiveView(nextStep.view);
            setTutorialStepIndex(nextStepIndex);
        } else {
            skipTutorial();
        }
    };

    const prevTutorialStep = () => {
        if (tutorialStepIndex > 0) {
            const prevStepIndex = tutorialStepIndex - 1;
            const prevStep = TUTORIAL_STEPS[prevStepIndex];
            setActiveView(prevStep.view);
            setTutorialStepIndex(prevStepIndex);
        }
    };
    
    const handleSubscription = (plan: PlanKey, billingCycle: 'monthly' | 'annual') => {
        setUserData(prev => ({ 
            ...prev, 
            isSubscribed: true,
            currentPlan: plan,
            billingCycle: billingCycle,
        }));
        showNotification({ type: 'success', message: 'Assinatura ativada! Bem-vindo(a) ao Pro.' });
        setTimeout(() => showNotification(null), 3000);
    };
    
    const handleChangeSubscription = (newPlan: PlanKey) => {
        setUserData(prev => ({
            ...prev,
            currentPlan: newPlan
        }));
         showNotification({ type: 'success', message: `Seu plano foi alterado para ${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}.` });
        setTimeout(() => showNotification(null), 3000);
        setActiveView('Conta');
    };

    const handleCancelSubscription = () => {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() - 1); // Expire trial immediately

        setUserData(prev => ({
            ...prev,
            isSubscribed: false,
            currentPlan: null,
            billingCycle: null,
            trialEndDate: trialEndDate.toISOString(), // Expire the subscription status
        }));
        showNotification({ type: 'info', message: 'Sua assinatura foi cancelada.' });
        setTimeout(() => showNotification(null), 3000);
        setActiveView('Conta');
    };

    const handleOpenSubscriptionModal = () => {
        setIsSubscriptionModalOpen(true);
    };

    const handlePurchaseFeaturePack = (featureKey: string, packSize: number, price: number) => {
        setUserData(prev => ({
            ...prev,
            purchasedUses: {
                ...prev.purchasedUses,
                [featureKey]: (prev.purchasedUses?.[featureKey] || 0) + packSize,
            }
        }));
        setUpsellModalState({ isOpen: false, featureKey: null, featureText: null });
        showNotification({ type: 'success', message: `Pacote de ${packSize} usos comprado por R$${price.toFixed(2)}!` });
        setTimeout(() => showNotification(null), 3000);
    };

    const handleLogout = () => {
        if (window.confirm("Você tem certeza que quer sair?")) {
            localStorage.removeItem('nutribot_currentUser');
            setCurrentUser(null);
            // Reset all states to default to ensure a clean slate for the next login
            setUserData(defaultUserData);
            setMealPlan(null);
            setFavoritePlans([]);
            setFavoriteRecipes([]);
            setChatMessages([]);
            setLastMealPlanText(null);
            setRecipesViewState({ activeTab: 'search', query: '', recipes: [], recipeImageCache: {} });
            setActiveView('Dashboard');
        }
    };

    const handleLogin = async (email: string, password: string): Promise<{ success: boolean, message: string }> => {
        try {
            const allUsers = JSON.parse(localStorage.getItem('nutribot_users') || '{}');
            if (allUsers[email]) {
                localStorage.setItem('nutribot_currentUser', email);
                setCurrentUser(email);
                return { success: true, message: "Login bem-sucedido!" };
            }
            return { success: false, message: "E-mail ou senha inválidos." };
        } catch (e) {
            return { success: false, message: "Ocorreu um erro. Tente novamente." };
        }
    };

    const handleRegister = async (name: string, email: string, password: string): Promise<{ success: boolean, message: string }> => {
        try {
            const allUsers = JSON.parse(localStorage.getItem('nutribot_users') || '{}');
            if (allUsers[email]) {
                return { success: false, message: "Este e-mail já está em uso." };
            }
            
            const newUser: FullUserSession = {
                userData: { ...defaultUserData, name, email },
                mealPlan: null,
                favoritePlans: [],
                favoriteRecipes: [],
                chatMessages: [],
                lastMealPlanText: null,
                recipesViewState: { activeTab: 'search', query: '', recipes: [], recipeImageCache: {} },
            };
            allUsers[email] = newUser;
            localStorage.setItem('nutribot_users', JSON.stringify(allUsers));
            
            // Automatically log in the new user
            return await handleLogin(email, password);
        } catch (e) {
            return { success: false, message: "Ocorreu um erro durante o registro." };
        }
    };

    const handleSkipLogin = () => {
        const guestEmail = 'guest@nutribot.dev';
        try {
            const allUsers = JSON.parse(localStorage.getItem('nutribot_users') || '{}');
            if (!allUsers[guestEmail]) {
                const guestUser: FullUserSession = {
                    userData: { ...defaultUserData, name: 'Convidado', email: guestEmail, isRegistered: true },
                    mealPlan: null,
                    favoritePlans: [],
                    favoriteRecipes: [],
                    chatMessages: [],
                    lastMealPlanText: null,
                    recipesViewState: { activeTab: 'search', query: '', recipes: [], recipeImageCache: {} },
                };
                allUsers[guestEmail] = guestUser;
                localStorage.setItem('nutribot_users', JSON.stringify(allUsers));
            }
            
            localStorage.setItem('nutribot_currentUser', guestEmail);
            setCurrentUser(guestEmail);

        } catch (e) {
            console.error("Failed to set up guest user:", e);
        }
    };


  const handlers: UserDataHandlers = {
      updateUserData: (data) => {
          setUserData(prev => {
              const criticalKeys: (keyof UserData)[] = ['age', 'gender', 'height', 'activityLevel', 'weight', 'weightGoal'];
              
              const needsRecalculation = criticalKeys.some(key => 
                  data.hasOwnProperty(key) && (data as any)[key] !== (prev as any)[key]
              );

              if (needsRecalculation) {
                  const updatedUserDataForCalc = { ...prev, ...data };
                  const newMacros = calculateNewMacroGoals(updatedUserDataForCalc);
                  
                  return {
                      ...prev,
                      ...data,
                      macros: {
                          calories: { current: prev.macros.calories.current, goal: newMacros.calories.goal },
                          carbs: { current: prev.macros.carbs.current, goal: newMacros.carbs.goal },
                          protein: { current: prev.macros.protein.current, goal: newMacros.protein.goal },
                          fat: { current: prev.macros.fat.current, goal: newMacros.fat.goal },
                      }
                  };
              } else {
                  return { ...prev, ...data };
              }
          });
      },
      addWater: (amount) => {
          setUserData(prev => ({ ...prev, water: Math.max(0, prev.water + amount) }));
      },
      handleLogMeal: (mealMacros: MacroData) => {
          handleAddXP(XP_AMOUNTS.LOG_MEAL, 'Refeição registrada');
          setUserData(prev => ({
              ...prev,
              macros: {
                  ...prev.macros,
                  calories: { ...prev.macros.calories, current: prev.macros.calories.current + Math.round(mealMacros.calories) },
                  carbs: { ...prev.macros.carbs, current: prev.macros.carbs.current + Math.round(mealMacros.carbs) },
                  protein: { ...prev.macros.protein, current: prev.macros.protein.current + Math.round(mealMacros.protein) },
                  fat: { ...prev.macros.fat, current: prev.macros.fat.current + Math.round(mealMacros.fat) },
              }
          }));
      },
      handleUpdateWeight: (newWeight: number) => {
          setUserData(prev => {
              const newHistoryEntry = { date: new Date().toISOString(), weight: newWeight };
              const todayStr = new Date().toISOString().split('T')[0];
              const existingEntryIndex = (prev.weightHistory || []).findIndex(entry => entry.date.startsWith(todayStr));
              
              let newHistory = [...(prev.weightHistory || [])];
              if (existingEntryIndex !== -1) {
                  newHistory[existingEntryIndex] = newHistoryEntry;
              } else {
                  newHistory.push(newHistoryEntry);
              }
              newHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

              const updatedUserDataForCalc = { ...prev, weight: newWeight, weightHistory: newHistory };
              const newMacros = calculateNewMacroGoals(updatedUserDataForCalc);

              return {
                  ...updatedUserDataForCalc,
                  macros: {
                    calories: { current: prev.macros.calories.current, goal: newMacros.calories.goal },
                    carbs: { current: prev.macros.carbs.current, goal: newMacros.carbs.goal },
                    protein: { current: prev.macros.protein.current, goal: newMacros.protein.goal },
                    fat: { current: prev.macros.fat.current, goal: newMacros.fat.goal },
                  }
              };
          });
      },
      handleChangeDietDifficulty: (difficulty: DietDifficulty) => {
          setUserData(prev => {
              const updatedUserDataForCalc = { ...prev, dietDifficulty: difficulty };
              const newMacros = calculateNewMacroGoals(updatedUserDataForCalc);
              
              let athleteModeNowUsed = prev.athleteModeUsed;
              if (difficulty === 'athlete' && !prev.athleteModeUsed) {
                  setShowFlameAnimation(true);
                  setTimeout(() => setShowFlameAnimation(false), 2000);
                  athleteModeNowUsed = true;
              }

              return {
                  ...prev,
                  dietDifficulty: difficulty,
                  athleteModeUsed: athleteModeNowUsed,
                  macros: {
                    calories: { current: prev.macros.calories.current, goal: newMacros.calories.goal },
                    carbs: { current: prev.macros.carbs.current, goal: newMacros.carbs.goal },
                    protein: { current: prev.macros.protein.current, goal: newMacros.protein.goal },
                    fat: { current: prev.macros.fat.current, goal: newMacros.fat.goal },
                  }
              };
          });
      },
      handleMarkDayAsCompleted: () => {
          const todayStr = new Date().toISOString().split('T')[0];
          if (userData.completedDays.includes(todayStr)) return;

          handleAddXP(XP_AMOUNTS.DAY_COMPLETE, 'Meta diária concluída');
          
          setUserData(prev => {
              const today = new Date();
              const yesterday = new Date();
              yesterday.setDate(today.getDate() - 1);
              const yesterdayStr = yesterday.toISOString().split('T')[0];
              
              const lastCompletedDay = prev.completedDays.length > 0 ? prev.completedDays[prev.completedDays.length - 1] : null;

              const newStreak = lastCompletedDay === yesterdayStr ? prev.streak + 1 : 1;

              if (newStreak === 3) handleAddXP(XP_AMOUNTS.STREAK_BONUS_3, 'Bônus: Sequência de 3 dias!');
              if (newStreak === 7) handleAddXP(XP_AMOUNTS.STREAK_BONUS_7, 'Bônus: Sequência de 7 dias!');

              const newCompletedDays = [...prev.completedDays, todayStr].sort();

              // Check for water streak
              const waterGoalMet = prev.water >= prev.waterGoal;
              const newWaterStreak = waterGoalMet ? (prev.waterStreak || 0) + 1 : 0;

              // Check for perfect day
              let isPerfectDay = false;
              const { calories, protein, carbs, fat } = prev.macros;
              if (calories.goal > 0 && protein.goal > 0 && carbs.goal > 0 && fat.goal > 0) {
                  const calRatio = calories.current / calories.goal;
                  const protRatio = protein.current / protein.goal;
                  const carbRatio = carbs.current / carbs.goal;
                  const fatRatio = fat.current / fat.goal;
                  if (calRatio >= 0.95 && calRatio <= 1.05 &&
                      protRatio >= 0.95 && protRatio <= 1.05 &&
                      carbRatio >= 0.95 && carbRatio <= 1.05 &&
                      fatRatio >= 0.95 && fatRatio <= 1.05) {
                      isPerfectDay = true;
                  }
              }
              const newPerfectDaysCount = isPerfectDay ? (prev.perfectDaysCount || 0) + 1 : (prev.perfectDaysCount || 0);

              return {
                  ...prev,
                  streak: newStreak,
                  completedDays: newCompletedDays,
                  waterStreak: newWaterStreak,
                  perfectDaysCount: newPerfectDaysCount,
              };
          });
      },
      addXP: handleAddXP,
      setFeaturedAchievement: handleSetFeaturedAchievement,
      startTutorial: startTutorial,
      generateWeeklyPlan: handleGenerateWeeklyPlan,
      generateDailyPlan: handleGenerateDailyPlan,
      importPlanFromChat: handleImportPlanFromChat,
      regenerateDay: handleRegenerateDay,
      adjustDayForMacro: handleAdjustDayForMacro,
      regenerateMeal: handleRegenerateMeal,
      updateMeal: handleUpdateMeal,
      handleSwapItem: handleSwapItem,
      generateShoppingList: handleGenerateShoppingList,
      handleSubscription,
      openSubscriptionModal: handleOpenSubscriptionModal,
      handleChangeSubscription,
      handleCancelSubscription,
      handlePurchaseFeaturePack,
      checkAndIncrementUsage: handleCheckAndIncrementUsage,
      handleChatSendMessage: async (message) => {
          if (!handleCheckAndIncrementUsage('chatInteractions')) throw new Error("Limite de interações no chat atingido.");
          return geminiService.sendMessageToAI(message);
      },
      handleAnalyzeMeal: async (data) => {
          const key = data.imageDataUrl ? 'mealAnalysesImage' : 'mealAnalysesText';
          if (!handleCheckAndIncrementUsage(key)) throw new Error("Limite de análise de refeições atingido.");
          
          if (data.imageDataUrl) {
              return geminiService.analyzeMealFromImage(data.imageDataUrl);
          } else if (data.description) {
              return geminiService.analyzeMealFromText(data.description);
          }
          throw new Error("Dados insuficientes para análise.");
      },
      handleAnalyzeProgress: async () => {
          if (!handleCheckAndIncrementUsage('progressAnalyses')) throw new Error("Limite de análise de progresso atingido.");
          return geminiService.analyzeProgress(userData);
      },
      getFoodInfo: async (question, mealContext) => {
          if (!handleCheckAndIncrementUsage('chatInteractions')) throw new Error("Limite de interações no chat atingido.");
          return geminiService.getFoodInfo(question, mealContext);
      },
      // FIX: Implement handleLogActivity
      handleLogActivity: (activity: Omit<ActivityLog, 'id' | 'date'>) => {
          const newLog: ActivityLog = {
              ...activity,
              id: Date.now().toString(),
              date: new Date().toISOString().split('T')[0],
          };
          setUserData(prev => ({
              ...prev,
              activityLogs: [newLog, ...(prev.activityLogs || [])],
          }));
          handleAddXP(XP_AMOUNTS.LOG_ACTIVITY, 'Atividade física registrada');
          showNotification({ type: 'success', message: `Atividade "${activity.type}" registrada!`});
          setTimeout(() => showNotification(null), 3000);
      },
      handleLogin,
      handleRegister,
      handleLogout,
  };

  if (!currentUser) {
      return <LoginView onLogin={handleLogin} onRegister={handleRegister} onSkipLogin={handleSkipLogin} />;
  }

  if (!userData.isRegistered) {
      return <OnboardingFlow onComplete={handleRegistrationComplete} />;
  }

  const renderView = () => {
    switch (activeView) {
      case 'Dashboard':
        return <Dashboard userData={userData} handlers={handlers} setActiveView={setActiveView} mealPlan={mealPlan} />;
      case 'Chat IA':
        return <ChatView 
                    userData={userData} 
                    messages={chatMessages} 
                    setMessages={setChatMessages}
                    onNewMealPlanText={setLastMealPlanText}
                    handlers={handlers}
                />;
      case 'Favoritos':
        return <FavoritesView 
                    favoritePlans={favoritePlans} 
                    onToggleFavorite={handleToggleFavoritePlan}
                    onUseToday={handleUseFavoriteAsToday}
                    onUpdateFavorite={handleUpdateFavoritePlan}
                />;
      case 'Dieta':
        return <PlanoAlimentarView 
                    userData={userData} 
                    handlers={handlers}
                    lastMealPlanText={lastMealPlanText}
                    mealPlan={mealPlan}
                    favoritePlans={favoritePlans}
                    onToggleFavorite={handleToggleFavoritePlan}
                    setActiveView={setActiveView}
                    showNotification={showNotification}
                    isPlanProcessing={isPlanProcessing}
                />;
      case 'Receitas':
        return <RecipesView 
                    userData={userData}
                    favoriteRecipes={favoriteRecipes}
                    onToggleFavorite={handleToggleFavoriteRecipe}
                    recipesViewState={recipesViewState}
                    onStateChange={setRecipesViewState}
                    onRecipesGenerated={handleRecipesGenerated} // This callback is now unused for incrementing
                    handlers={handlers}
                />;
      case 'Conquistas':
        return <AchievementsView userData={userData} handlers={handlers} />;
      case 'Recursos':
        return <FeaturesView setActiveView={setActiveView} />;
      case 'Conta':
        return <ProfileView userData={userData} handlers={handlers} setActiveView={setActiveView}/>;
      case 'Gerenciar Assinatura':
        return <ManageSubscriptionView userData={userData} handlers={handlers} setActiveView={setActiveView}/>;
      case 'Progresso':
        return <ProgressView userData={userData} handlers={handlers} />;
      // FIX: Add Atividades view to router
      case 'Atividades':
        return <AtividadesView userData={userData} handlers={handlers} />;
      case 'Admin':
        return <AdminView userData={userData} handlers={handlers} setActiveView={setActiveView} />;
      default:
        return <Dashboard userData={userData} handlers={handlers} setActiveView={setActiveView} mealPlan={mealPlan} />;
    }
  };

  return (
      <div className={`flex min-h-screen ${mainBgClass} text-slate-800 transition-colors duration-500 ${theme}`}>
        <FlameOverlay show={showFlameAnimation} />
        <Sidebar activeView={activeView} setActiveView={setActiveView} userData={userData} handlers={handlers} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-36 md:pb-8 relative">
          <button
              onClick={startTutorial}
              className="absolute top-4 right-4 md:top-6 md:right-6 z-10 flex items-center gap-2 px-3 py-1.5 bg-white/70 backdrop-blur-sm border border-slate-200 rounded-full text-sm font-semibold text-slate-600 hover:bg-white hover:text-slate-800 transition-all shadow-sm hover:shadow-md theme-athlete:bg-zinc-800/70 theme-athlete:border-zinc-700 theme-athlete:text-zinc-300 theme-athlete:hover:bg-zinc-700"
              aria-label="Iniciar tour guiado"
              id="help-button"
          >
              <QuestionMarkCircleIcon className="w-5 h-5" />
              <span className="hidden md:inline">Ajuda</span>
          </button>
          <ErrorBoundary>
            {renderView()}
          </ErrorBoundary>
        </main>

        {/* Central Dashboard Button for Mobile */}
        <button
            onClick={() => setActiveView('Dashboard')}
            className={`dashboard-fab ${activeView === 'Dashboard' ? 'active' : ''} flex md:hidden`}
            aria-label="Dashboard"
        >
            <HomeIcon className="w-8 h-8 text-slate-600 icon" />
        </button>

        <BottomNav activeView={activeView} setActiveView={setActiveView} />
        <Toast notification={notification} />
        <ShoppingListModal 
            isOpen={isShoppingListModalOpen}
            onClose={() => setIsShoppingListModalOpen(false)}
            content={shoppingListContent}
        />
        <StartTutorialModal
            isOpen={showStartTutorialModal}
            onStart={() => {
                setShowStartTutorialModal(false);
                startTutorial();
            }}
            onSkip={() => {
                setShowStartTutorialModal(false);
                setUserData(prev => ({...prev, hasCompletedTutorial: true}));
            }}
        />
        <Tutorial
            isActive={isTutorialActive}
            stepIndex={tutorialStepIndex}
            onNext={nextTutorialStep}
            onPrev={prevTutorialStep}
            onSkip={skipTutorial}
            isMobile={isMobileView}
        />
        <SubscriptionModal
            isOpen={isSubscriptionModalOpen}
            onClose={() => setIsSubscriptionModalOpen(false)}
            onSubscribe={handlers.handleSubscription}
            theme={theme}
        />
        <UpsellModal
            isOpen={upsellModalState.isOpen}
            onClose={() => setUpsellModalState({ isOpen: false, featureKey: null, featureText: null })}
            featureKey={upsellModalState.featureKey}
            featureText={upsellModalState.featureText}
            onNavigateToSubscription={() => {
                setUpsellModalState({ isOpen: false, featureKey: null, featureText: null });
                setActiveView('Gerenciar Assinatura');
            }}
            onPurchaseFeaturePack={handlers.handlePurchaseFeaturePack}
        />
      </div>
  );
};

export default App;