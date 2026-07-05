import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('pages/IndexPage.vue') },
      { path: 'food-diary', component: () => import('pages/FoodDiaryPage.vue') },
      { path: 'food-diary/prices', component: () => import('pages/IngredientPricesPage.vue') },
      {
        path: 'food-diary/:date(\\d{4}-\\d{2}-\\d{2})',
        component: () => import('pages/FoodDiaryDayPage.vue'),
      },
    ],
  },

  {
    path: '/login',
    component: () => import('pages/LoginPage.vue'),
    meta: { requiresAuth: false },
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
