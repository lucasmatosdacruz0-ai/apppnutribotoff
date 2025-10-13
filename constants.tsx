

import React from 'react';
import { NavItem } from './types';
import { HomeIcon } from './components/icons/HomeIcon';
import { ChatIcon } from './components/icons/ChatIcon';
import { CalendarIcon } from './components/icons/CalendarIcon';
import { ChartIcon } from './components/icons/ChartIcon';
import { StarIcon } from './components/icons/StarIcon';
import { GridIcon } from './components/icons/GridIcon';
import { BookOpenIcon } from './components/icons/BookOpenIcon';
import { TrophyIcon } from './components/icons/TrophyIcon';
import { UserIcon } from './components/icons/UserIcon';


export const NAV_ITEMS: NavItem[] = [
    { name: 'Dashboard', icon: React.createElement(HomeIcon) },
    { name: 'Chat IA', icon: React.createElement(ChatIcon) },
    { name: 'Dieta', icon: React.createElement(CalendarIcon) },
    { name: 'Receitas', icon: React.createElement(BookOpenIcon) },
    { name: 'Favoritos', icon: React.createElement(StarIcon) },
    { name: 'Progresso', icon: React.createElement(ChartIcon) },
    { name: 'Recursos', icon: React.createElement(GridIcon) },
    { name: 'Conta', icon: React.createElement(UserIcon) },
];